"""
Scheduled Dashboard Precomputation — Scheduler Loop

Asyncio background task that polls Supabase for due scheduled jobs,
acquires CAS locks, dispatches Presto queries, and stores results.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import re
import secrets
import traceback
from datetime import datetime, timezone, timedelta
from typing import Any

import pandas as pd
from croniter import croniter
import pytz

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
WORKER_ID = f"worker-{secrets.token_hex(4)}"
POLL_INTERVAL = int(os.environ.get("SCHEDULER_POLL_INTERVAL", "60"))
STALE_LOCK_SECONDS = 600  # 10 minutes
MAX_RESULT_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_PRESTO_CONCURRENT = int(os.environ.get("MAX_PRESTO_CONCURRENT", "4"))

VALID_DASHBOARD_TYPES = {
    "dapr_bucket", "fe2net", "rtu_performance",
    "r2a", "r2a_percentage", "a2phh_summary", "custom",
}

# Semaphore to limit concurrent Presto connections
_presto_semaphore: asyncio.Semaphore | None = None
_running = False
_task: asyncio.Task | None = None


def _get_semaphore() -> asyncio.Semaphore:
    global _presto_semaphore
    if _presto_semaphore is None:
        _presto_semaphore = asyncio.Semaphore(MAX_PRESTO_CONCURRENT)
    return _presto_semaphore


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def compute_params_hash(dashboard_type: str, query_version: int, params: dict) -> str:
    """Deterministic SHA-256 hash of the cache key components."""
    raw = f"{dashboard_type}:{query_version}:{json.dumps(params, sort_keys=True, default=str)}"
    return hashlib.sha256(raw.encode()).hexdigest()


# Date expression pattern: current_date, current_date - 7, current_date + 3
_DATE_EXPR_RE = re.compile(r'^current_date\s*([+-]\s*\d+)?$', re.IGNORECASE)


def resolve_dynamic_params(params: dict, date_format: str = "%Y%m%d") -> dict:
    """
    Resolve dynamic date expressions in params at execution time.

    Supported expressions:
      - "current_date"         → today
      - "current_date - 30"   → 30 days ago
      - "current_date + 7"    → 7 days from now

    date_format controls the output format:
      - "%Y%m%d"   → "20260414"  (built-in dashboards)
      - "%Y-%m-%d" → "2026-04-14" (custom dashboards / Trino TIMESTAMP)

    Only applies to string values that match the pattern.
    Returns a new dict with resolved values.
    """
    resolved = {}
    today = datetime.now(pytz.timezone("Asia/Kolkata")).date()

    for key, value in params.items():
        if isinstance(value, str):
            m = _DATE_EXPR_RE.match(value.strip())
            if m:
                offset_str = m.group(1)
                if offset_str:
                    offset_days = int(offset_str.replace(" ", ""))
                else:
                    offset_days = 0
                target_date = today + timedelta(days=offset_days)
                resolved[key] = target_date.strftime(date_format)
                continue
        resolved[key] = value

    return resolved


def compute_next_run(cron_expression: str, tz_name: str = "Asia/Kolkata", after: datetime | None = None) -> datetime:
    """Compute the next run time in UTC from a cron expression in the given timezone."""
    tz = pytz.timezone(tz_name)
    if after is None:
        after = datetime.now(tz)
    elif after.tzinfo is None:
        after = tz.localize(after)
    else:
        after = after.astimezone(tz)

    cron = croniter(cron_expression, after)
    next_local = cron.get_next(datetime)
    if next_local.tzinfo is None:
        next_local = tz.localize(next_local)
    return next_local.astimezone(timezone.utc)


def _get_supabase_service_client():
    """Get a Supabase client for scheduler operations.
    Prefers service-role key (bypasses RLS), falls back to anon key."""
    from supabase import create_client

    url = os.environ.get("SUPABASE_URL", "https://croniadpudboidlouhuu.supabase.co")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    anon_key = os.environ.get(
        "SUPABASE_ANON_KEY",
        "sb_publishable_XVL1eAexg-C1MpKPPC-b2Q_hl2pFTpT",
    )
    key = service_key or anon_key
    return create_client(url, key)


# ---------------------------------------------------------------------------
# Query Execution (synchronous — runs in thread pool)
# ---------------------------------------------------------------------------

def _execute_builtin_dashboard_sync(dashboard_type: str, params: dict, username: str) -> dict:
    """
    Execute a built-in dashboard query on Presto.
    Returns: { "num_rows": int, "columns": list[str], "data": list[dict] }
    """
    import funnel

    p = params

    if dashboard_type == "dapr_bucket":
        df = funnel.dapr_bucket(
            username=username,
            start_date=p["start_date"],
            end_date=p["end_date"],
            city=p["city"],
            service_category=p["service_category"],
            low_dapr=float(p.get("low_dapr", 0.6)),
            high_dapr=float(p.get("high_dapr", 0.8)),
        )
    elif dashboard_type == "fe2net":
        df = funnel.fe2net(
            username=username,
            start_date=p["start_date"],
            end_date=p["end_date"],
            city=p["city"],
            service_category=p["service_category"],
            geo_level=p.get("geo_level", "city"),
            time_level=p.get("time_level", "daily"),
        )
    elif dashboard_type == "rtu_performance":
        df = funnel.performance_metrics(
            username=username,
            start_date=p["start_date"],
            end_date=p["end_date"],
            city=p["city"],
            perf_cut=int(p.get("perf_cut", 0)),
            consistency_cut=int(p.get("consistency_cut", 1)),
            time_level=p.get("time_level", "daily"),
            tod_level=p.get("tod_level", "daily"),
            service_category=p.get("service_category", "auto"),
        )
    elif dashboard_type == "r2a":
        df = funnel.r2a_registration_by_activation(
            username=username,
            start_date=p["start_date"],
            end_date=p["end_date"],
            city=p["city"],
            service=p.get("service", "auto"),
            time_level=p.get("time_level", "day"),
        )
    elif dashboard_type == "r2a_percentage":
        df = funnel.r2a_pecentage(
            username=username,
            start_date=p["start_date"],
            end_date=p["end_date"],
            city=p["city"],
            service=p.get("service", "auto"),
            time_level=p.get("time_level", "day"),
        )
    elif dashboard_type == "a2phh_summary":
        df = funnel.a2phh_summary(
            username=username,
            start_date=p["start_date"],
            end_date=p["end_date"],
            city=p["city"],
            service=p.get("service", "auto"),
            time_level=p.get("time_level", "day"),
        )
    else:
        raise ValueError(f"Unknown dashboard_type: {dashboard_type}")

    # Convert DataFrame to dict result
    # Replace NaN/inf with None for JSON serialization
    df = df.replace({float("inf"): None, float("-inf"): None})
    df = df.where(df.notna(), None)

    data = df.to_dict(orient="records")
    columns = list(df.columns)
    return {"num_rows": len(data), "columns": columns, "data": data}


def _execute_custom_dashboard_sync(params: dict, username: str, custom_dashboard_id: str, sb_client=None) -> dict:
    """
    Execute a custom dashboard SQL query on Presto.
    Replicates the template substitution + DML blocking from main.py.
    """
    import ast as _ast
    from funnel import get_presto_connection

    sb = sb_client or _get_supabase_service_client()

    # Fetch the custom dashboard SQL
    result = sb.table("custom_dashboards").select("sql_query").eq("id", custom_dashboard_id).execute()
    if not result.data:
        raise ValueError(f"Custom dashboard {custom_dashboard_id} not found")

    query = result.data[0]["sql_query"]
    if not query:
        raise ValueError(f"Custom dashboard {custom_dashboard_id} has no SQL query")

    parameters = params.get("parameters", {})
    parameter_types = params.get("parameter_types", {})

    # Template substitution (same logic as main.py execute_custom_dashboard_query)
    for key, value in parameters.items():
        if value is None:
            bare_pattern = r"\{\{\s*" + re.escape(key) + r"\s*\}\}"
            quoted_pattern = r"'\s*\{\{\s*" + re.escape(key) + r"\s*\}\}\s*'"
            replacement = "NULL"
            if re.search(quoted_pattern, query):
                query = re.sub(quoted_pattern, replacement, query)
            elif re.search(bare_pattern, query):
                query = re.sub(bare_pattern, replacement, query)
            continue

        ptype = parameter_types.get(key, "string")

        if isinstance(value, list) and ptype != "multiselect":
            ptype = "multiselect"

        if isinstance(value, str) and ptype != "multiselect":
            stripped = value.strip()
            if stripped.startswith("[") and stripped.endswith("]"):
                try:
                    parsed = _ast.literal_eval(stripped)
                    if isinstance(parsed, list):
                        value = [str(v) for v in parsed]
                        ptype = "multiselect"
                except (ValueError, SyntaxError):
                    pass

        bare_pattern = r"\{\{\s*" + re.escape(key) + r"\s*\}\}"
        quoted_pattern = r"'\s*\{\{\s*" + re.escape(key) + r"\s*\}\}\s*'"

        if ptype == "multiselect":
            if isinstance(value, list):
                items = [str(v) for v in value]
            elif isinstance(value, str):
                items = [v.strip() for v in value.split(",") if v.strip()]
            else:
                items = [str(value)] if value else []
            if not items:
                raise ValueError(f"Parameter '{key}' requires at least one selected value.")
            safe_items = [item.replace("'", "''") for item in items]
            replacement = ", ".join(f"'{item}'" for item in safe_items)
            if re.search(quoted_pattern, query):
                query = re.sub(quoted_pattern, replacement, query)
            elif re.search(bare_pattern, query):
                query = re.sub(bare_pattern, replacement, query)
        else:
            str_value = str(value) if value is not None else ""
            safe_value = str_value.replace("'", "''")
            if ptype == "date":
                replacement = f"TIMESTAMP '{safe_value}'"
            elif ptype == "number":
                replacement = safe_value
            else:
                replacement = f"'{safe_value}'"

            if re.search(quoted_pattern, query):
                query = re.sub(quoted_pattern, replacement, query)
            elif re.search(bare_pattern, query):
                query = re.sub(bare_pattern, replacement, query)

    # Check for remaining unsubstituted placeholders
    remaining = re.findall(r"\{\{\s*(\w+)\s*\}\}", query)
    if remaining:
        unique_remaining = list(dict.fromkeys(remaining))
        raise ValueError(f"Missing parameter values for: {', '.join(unique_remaining)}")

    # Validate read-only
    _FORBIDDEN_SQL = re.compile(
        r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|MERGE|CALL|EXECUTE)\b",
        re.IGNORECASE,
    )
    if _FORBIDDEN_SQL.search(query):
        raise ValueError("Only read-only SELECT queries are allowed.")

    conn = None
    try:
        conn = get_presto_connection(username)
        df = pd.read_sql(query, conn)
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass

    df = df.replace({float("inf"): None, float("-inf"): None})
    df = df.where(df.notna(), None)

    data = df.to_dict(orient="records")
    columns = list(df.columns)
    return {"num_rows": len(data), "columns": columns, "data": data}


def execute_dashboard_sync(job: dict, sb_client=None) -> dict:
    """
    Top-level synchronous dispatcher. Called from thread pool.
    Resolves dynamic date expressions before execution.
    sb_client: optional Supabase client (used by run-now endpoint to pass its own).
    Returns: { "num_rows": int, "columns": list[str], "data": list[dict] }
    """
    dashboard_type = job["dashboard_type"]
    params = job["params"] if isinstance(job["params"], dict) else json.loads(job["params"])
    username = job["presto_username"]

    if dashboard_type == "custom":
        custom_id = job.get("custom_dashboard_id")
        if not custom_id:
            raise ValueError("custom_dashboard_id is required for custom dashboard type")
        # For custom dashboards, resolve dynamic expressions inside params.parameters
        # Use ISO date format (YYYY-MM-DD) since custom SQL uses TIMESTAMP '...' wrapping
        if "parameters" in params and isinstance(params["parameters"], dict):
            params["parameters"] = resolve_dynamic_params(params["parameters"], date_format="%Y-%m-%d")
        return _execute_custom_dashboard_sync(params, username, custom_id, sb_client=sb_client)
    else:
        # For built-in dashboards, resolve at top level (YYYYMMDD format)
        params = resolve_dynamic_params(params)
        return _execute_builtin_dashboard_sync(dashboard_type, params, username)


# ---------------------------------------------------------------------------
# Job Processing
# ---------------------------------------------------------------------------

async def _process_job(sb, job: dict) -> None:
    """Process a single scheduled job: execute query, store result, update state."""
    job_id = job["id"]
    dashboard_type = job["dashboard_type"]
    params = job["params"] if isinstance(job["params"], dict) else json.loads(job["params"])
    query_version = job["query_version"]
    timeout_seconds = job.get("timeout_seconds", 300)
    result_ttl = job.get("result_ttl_seconds", 86400)
    retry_count = job.get("retry_count", 0)
    max_retries = job.get("max_retries", 3)

    now = datetime.now(timezone.utc)
    run_id = None

    try:
        # 1. Create job_run record
        run_result = sb.table("job_runs").insert({
            "job_id": job_id,
            "status": "running",
            "worker_id": WORKER_ID,
            "started_at": now.isoformat(),
            "retry_attempt": retry_count,
            "params_snapshot": params,
            "query_version": query_version,
        }).execute()
        run_id = run_result.data[0]["id"]

        # 2. Execute query with semaphore + timeout
        loop = asyncio.get_running_loop()
        async with _get_semaphore():
            result = await asyncio.wait_for(
                loop.run_in_executor(None, execute_dashboard_sync, job),
                timeout=timeout_seconds,
            )

        # 3. Validate result size (allow_nan=False will be caught and replaced)
        import math
        def _sanitize(obj):
            if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
                return None
            if isinstance(obj, dict):
                return {k: _sanitize(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [_sanitize(v) for v in obj]
            return obj
        result = _sanitize(result)
        result_json = json.dumps(result, default=str)
        result_bytes = len(result_json.encode("utf-8"))
        if result_bytes > MAX_RESULT_BYTES:
            raise ValueError(
                f"Result exceeds {MAX_RESULT_BYTES // (1024*1024)}MB limit "
                f"({result_bytes // (1024*1024)}MB). Narrow your parameters."
            )

        # 4. Compute cache key and store result
        params_hash = compute_params_hash(dashboard_type, query_version, params)
        expires_at = now + timedelta(seconds=result_ttl)

        # Delete old result for this cache key, then insert new
        sb.table("materialized_results").delete().eq(
            "dashboard_type", dashboard_type
        ).eq("params_hash", params_hash).eq("query_version", query_version).execute()

        mr_result = sb.table("materialized_results").insert({
            "job_id": job_id,
            "dashboard_type": dashboard_type,
            "params_hash": params_hash,
            "query_version": query_version,
            "result_data": result,
            "result_rows": result.get("num_rows", 0),
            "result_bytes": result_bytes,
            "computed_at": now.isoformat(),
            "expires_at": expires_at.isoformat(),
        }).execute()
        result_id = mr_result.data[0]["id"]

        # 5. Update job_run as success (store result_data for history)
        finished_at = datetime.now(timezone.utc)
        duration_ms = int((finished_at - now).total_seconds() * 1000)
        sb.table("job_runs").update({
            "status": "success",
            "finished_at": finished_at.isoformat(),
            "duration_ms": duration_ms,
            "result_id": result_id,
            "result_rows": result.get("num_rows", 0),
            "result_bytes": result_bytes,
            "result_data": result,
        }).eq("id", run_id).execute()

        # 5b. Clean up old run data (keep last 10)
        try:
            sb.rpc("cleanup_old_run_data", {"p_job_id": job_id, "p_keep": 10}).execute()
        except Exception:
            pass  # Non-critical

        # 6. Advance job to next cron run
        next_run = compute_next_run(job["cron_expression"], job.get("timezone", "Asia/Kolkata"))
        sb.table("scheduled_jobs").update({
            "next_run_at": next_run.isoformat(),
            "last_run_at": now.isoformat(),
            "retry_count": 0,
            "locked_by": None,
            "locked_at": None,
        }).eq("id", job_id).execute()

        logger.info(
            "Job %s completed (run=%s, rows=%d, %dKB, %dms)",
            job_id, run_id, result.get("num_rows", 0),
            result_bytes // 1024, duration_ms,
        )

    except asyncio.TimeoutError:
        _handle_job_failure(sb, job, run_id, now, "timeout", f"Timed out after {timeout_seconds}s")

    except Exception as e:
        status = "failed"
        error_msg = str(e)
        tb = traceback.format_exc()
        _handle_job_failure(sb, job, run_id, now, status, error_msg, tb)


def _handle_job_failure(
    sb, job: dict, run_id: str | None, started_at: datetime,
    status: str, error_message: str, error_traceback: str | None = None,
) -> None:
    """Handle a failed/timed-out job: update run, decide retry vs advance."""
    job_id = job["id"]
    retry_count = job.get("retry_count", 0)
    max_retries = job.get("max_retries", 3)
    finished_at = datetime.now(timezone.utc)
    duration_ms = int((finished_at - started_at).total_seconds() * 1000)

    # Update the job_run
    if run_id:
        try:
            sb.table("job_runs").update({
                "status": status,
                "finished_at": finished_at.isoformat(),
                "duration_ms": duration_ms,
                "error_message": error_message[:2000],
                "error_traceback": (error_traceback or "")[:5000],
            }).eq("id", run_id).execute()
        except Exception:
            logger.exception("Failed to update job_run %s", run_id)

    # Decide retry or advance
    if retry_count < max_retries:
        # Exponential backoff: 2^retry * 60s → 2min, 4min, 8min
        backoff = timedelta(seconds=(2 ** (retry_count + 1)) * 60)
        next_run = finished_at + backoff
        new_retry_count = retry_count + 1
        logger.warning(
            "Job %s failed (attempt %d/%d), retrying at %s: %s",
            job_id, new_retry_count, max_retries, next_run.isoformat(), error_message,
        )
    else:
        # Exhausted retries — advance to next cron occurrence
        next_run = compute_next_run(job["cron_expression"], job.get("timezone", "Asia/Kolkata"))
        new_retry_count = 0
        logger.warning(
            "Job %s exhausted %d retries, advancing to next run at %s",
            job_id, max_retries, next_run.isoformat(),
        )

    try:
        sb.table("scheduled_jobs").update({
            "next_run_at": next_run.isoformat(),
            "retry_count": new_retry_count,
            "locked_by": None,
            "locked_at": None,
        }).eq("id", job_id).execute()
    except Exception:
        logger.exception("Failed to update scheduled_job %s after failure", job_id)


# ---------------------------------------------------------------------------
# Scheduler Loop
# ---------------------------------------------------------------------------

async def _tick(sb) -> None:
    """Single scheduler tick: reclaim stale locks, evict expired, process due jobs."""
    now = datetime.now(timezone.utc)

    # 1. Reclaim stale locks
    stale_cutoff = (now - timedelta(seconds=STALE_LOCK_SECONDS)).isoformat()
    try:
        sb.table("scheduled_jobs").update({
            "locked_by": None,
            "locked_at": None,
        }).not_.is_("locked_by", "null").lt("locked_at", stale_cutoff).execute()
    except Exception:
        logger.exception("Failed to reclaim stale locks")

    # 2. Evict expired materialized results
    try:
        sb.rpc("evict_expired_results").execute()
    except Exception:
        logger.exception("Failed to evict expired results")

    # 3. Fetch due jobs
    try:
        candidates_result = sb.table("scheduled_jobs").select("*").eq(
            "enabled", True
        ).is_("locked_by", "null").lte(
            "next_run_at", now.isoformat()
        ).order("next_run_at").limit(10).execute()
        candidates = candidates_result.data or []
    except Exception:
        logger.exception("Failed to fetch due jobs")
        return

    if not candidates:
        return

    # 4. Lock acquisition (CAS — one UPDATE per job)
    acquired = []
    for job in candidates:
        try:
            lock_result = sb.table("scheduled_jobs").update({
                "locked_by": WORKER_ID,
                "locked_at": now.isoformat(),
            }).eq("id", job["id"]).is_("locked_by", "null").execute()
            # Check if we actually locked it (affected rows > 0)
            if lock_result.data and len(lock_result.data) > 0:
                # Merge updated fields back
                job.update(lock_result.data[0])
                acquired.append(job)
        except Exception:
            logger.exception("Failed to acquire lock for job %s", job["id"])

    logger.info(
        "Scheduler tick: %d due jobs, %d acquired, %d skipped (locked)",
        len(candidates), len(acquired), len(candidates) - len(acquired),
    )

    # 5. Execute acquired jobs concurrently
    if acquired:
        await asyncio.gather(*[_process_job(sb, job) for job in acquired], return_exceptions=True)


async def _scheduler_loop() -> None:
    """Main scheduler loop — ticks every POLL_INTERVAL seconds."""
    global _running
    _running = True

    logger.info("Scheduler started (worker=%s, poll=%ds, max_concurrent=%d)",
                WORKER_ID, POLL_INTERVAL, MAX_PRESTO_CONCURRENT)

    # Wait a few seconds on startup to let the app fully initialize
    await asyncio.sleep(5)

    sb = None
    while _running:
        try:
            if sb is None:
                sb = _get_supabase_service_client()
            await _tick(sb)
        except Exception:
            logger.exception("Scheduler tick error")
            sb = None  # Reset client on error

        await asyncio.sleep(POLL_INTERVAL)


def start_scheduler() -> asyncio.Task | None:
    """Start the scheduler as an asyncio background task. Returns the task or None if already running."""
    global _task
    if _task is not None and not _task.done():
        logger.warning("Scheduler already running")
        return _task

    _task = asyncio.create_task(_scheduler_loop())
    return _task


def stop_scheduler() -> None:
    """Stop the scheduler loop."""
    global _running, _task
    _running = False
    if _task is not None:
        _task.cancel()
        _task = None
    logger.info("Scheduler stopped")
