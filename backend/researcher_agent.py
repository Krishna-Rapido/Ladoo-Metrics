"""
Researcher Agent — Conversational AI Discovery Agent

Wraps existing researcher.py functions as Anthropic Claude tool-use calls,
enabling PMs to discover captain segments through natural language conversation.
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, Generator, List, Optional

import pandas as pd
from cachetools import TTLCache

from ai_agent import PRESTO_SCHEMA_CONTEXT
from knowledge_agent import build_schema_context
from researcher import (
    _query_presto,
    run_contrast_analysis,
    compute_response_profiles,
    validate_segment,
)
from sql_reference import RESEARCHER_SQL_REFERENCE

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Anthropic client (lazy singleton)
# ---------------------------------------------------------------------------

_anthropic_client = None


def _get_anthropic_client():
    global _anthropic_client
    if _anthropic_client is None:
        import anthropic
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY environment variable is not set")
        _anthropic_client = anthropic.Anthropic(api_key=api_key)
    return _anthropic_client


# ---------------------------------------------------------------------------
# SQL Safety
# ---------------------------------------------------------------------------

_FORBIDDEN_SQL = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)\b",
    re.IGNORECASE,
)


def _validate_sql(sql: str) -> str | None:
    """Return an error message if the SQL is unsafe, else None."""
    if _FORBIDDEN_SQL.search(sql):
        return "Only SELECT queries are allowed."
    return None


# ---------------------------------------------------------------------------
# Tool definitions (Anthropic format)
# ---------------------------------------------------------------------------

RESEARCHER_TOOLS: List[Dict[str, Any]] = [
    {
        "name": "run_presto_query",
        "description": (
            "Execute a read-only SQL SELECT query against Presto. "
            "Use this for exploratory data pulls — counting captains, "
            "checking distributions, fetching sample rows, etc. "
            "Only SELECT statements are allowed."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "sql": {
                    "type": "string",
                    "description": "The SQL SELECT query to execute against Presto.",
                },
                "description": {
                    "type": "string",
                    "description": "Brief explanation of what this query does and why.",
                },
            },
            "required": ["sql", "description"],
        },
    },
    {
        "name": "run_contrast_analysis",
        "description": (
            "Run a full contrast analysis between two captain groups. "
            "Splits captains by a splitting outcome (churn_28d, incentive_response, "
            "efficiency, or custom), fetches ~18 aggregated features from Presto, "
            "and compares them using Mann-Whitney U tests with Bonferroni correction. "
            "Returns ranked features by Cohen's d effect size. "
            "This is a heavy operation — use run_presto_query first for lighter exploration."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "City name (lowercase), e.g. 'bangalore'."},
                "start_date": {"type": "string", "description": "Start date in YYYYMMDD format."},
                "end_date": {"type": "string", "description": "End date in YYYYMMDD format."},
                "splitting_outcome": {
                    "type": "string",
                    "description": "How to split captains: 'churn_28d', 'incentive_response', 'efficiency', or 'custom'.",
                },
                "consistency_segment": {
                    "type": "string",
                    "description": "Optional: filter to this consistency segment (daily/weekly/monthly/quarterly/rest).",
                },
                "performance_segment": {
                    "type": "string",
                    "description": "Optional: filter to this performance segment (UHP/HP/MP/LP/ZP).",
                },
                "custom_column": {
                    "type": "string",
                    "description": "For splitting_outcome='custom': column name to split on.",
                },
                "custom_threshold": {
                    "type": "number",
                    "description": "For splitting_outcome='custom': numeric threshold.",
                },
                "custom_direction": {
                    "type": "string",
                    "enum": ["above", "below"],
                    "description": "For custom: 'above' or 'below' threshold.",
                },
            },
            "required": ["city", "start_date", "end_date", "splitting_outcome"],
        },
    },
    {
        "name": "compute_response_profiles",
        "description": (
            "Compute per-captain behavioral response profiles along 6 axes: "
            "incentive_elasticity, target_earning, frustration_resilience, "
            "behavioral_inertia, efficiency_trajectory, demand_supply_fit. "
            "Returns aggregate stats per axis and individual captain profiles."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "City name (lowercase)."},
                "start_date": {"type": "string", "description": "Start date YYYYMMDD."},
                "end_date": {"type": "string", "description": "End date YYYYMMDD."},
                "axes": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Which axes to compute. Defaults to all 6.",
                },
                "consistency_segment": {"type": "string", "description": "Optional consistency filter."},
                "performance_segment": {"type": "string", "description": "Optional performance filter."},
                "min_active_days": {"type": "integer", "description": "Minimum active days (default 14)."},
            },
            "required": ["city", "start_date", "end_date"],
        },
    },
    {
        "name": "validate_segment",
        "description": (
            "Run the 6-gate validation pipeline on a candidate segment definition. "
            "Gates: size (>5%), separation (Cohen's d > 0.3), stability (CV < 1.5), "
            "orthogonality (entropy > 0.3), predictive lift (correlation > 0.05), "
            "actionability (requires human note). Returns pass/fail per gate."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "City name (lowercase)."},
                "start_date": {"type": "string", "description": "Start date YYYYMMDD."},
                "end_date": {"type": "string", "description": "End date YYYYMMDD."},
                "segment_name": {"type": "string", "description": "Name for the candidate segment."},
                "segment_definition": {
                    "type": "object",
                    "description": "Definition object: {feature, operator, threshold}.",
                    "properties": {
                        "feature": {"type": "string"},
                        "operator": {"type": "string"},
                        "threshold": {"type": "number"},
                    },
                    "required": ["feature", "operator", "threshold"],
                },
                "consistency_segment": {"type": "string", "description": "Optional consistency filter."},
                "performance_segment": {"type": "string", "description": "Optional performance filter."},
                "actionability_note": {"type": "string", "description": "Human input for gate 6."},
            },
            "required": ["city", "start_date", "end_date", "segment_name", "segment_definition"],
        },
    },
    {
        "name": "summarize_dataframe",
        "description": (
            "Get summary statistics (count, mean, std, min, max, percentiles) "
            "for the last query result. Use after run_presto_query to understand "
            "the distribution of returned data without re-querying."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "columns": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Optional: specific columns to summarize. If empty, summarizes all numeric columns.",
                },
            },
            "required": [],
        },
    },
]


# ---------------------------------------------------------------------------
# Dynamic schema fetching (cached 30 min)
# ---------------------------------------------------------------------------

_schema_cache: TTLCache = TTLCache(maxsize=1, ttl=1800)


def _fetch_dynamic_schema() -> str:
    """Fetch knowledge graph schema from Supabase, cached for 30 min.

    Returns the dynamic schema string, or empty string on failure.
    """
    cache_key = "kg_schema"
    if cache_key in _schema_cache:
        return _schema_cache[cache_key]

    try:
        from supabase import create_client
        url = os.environ.get("SUPABASE_URL", "")
        key = os.environ.get("SUPABASE_KEY", "")
        if not url or not key:
            _schema_cache[cache_key] = ""
            return ""

        sb = create_client(url, key)

        # Fetch tables + columns
        tables_resp = sb.table("schema_tables").select("*").execute()
        tables = tables_resp.data or []

        for table in tables:
            cols_resp = (
                sb.table("schema_columns")
                .select("*")
                .eq("table_id", table["id"])
                .execute()
            )
            table["columns"] = cols_resp.data or []

        # Fetch relationships
        rels_resp = sb.table("schema_relationships").select("*").execute()
        relationships = rels_resp.data or []

        result = build_schema_context(tables, relationships)
        _schema_cache[cache_key] = result
        return result
    except Exception:
        logger.debug("Knowledge graph fetch failed (non-fatal), using static schema only")
        _schema_cache[cache_key] = ""
        return ""


# ---------------------------------------------------------------------------
# System prompt builder
# ---------------------------------------------------------------------------


def _build_system_prompt(rules: Optional[List[Dict[str, str]]] = None) -> str:
    """Build the full system prompt combining static schema, SQL reference, dynamic knowledge graph, and user rules."""
    dynamic_schema = _fetch_dynamic_schema()
    dynamic_section = ""
    if dynamic_schema:
        dynamic_section = f"""

## Dynamic Knowledge Graph (from Supabase)
{dynamic_schema}
"""

    rules_section = ""
    if rules:
        lines = []
        for r in rules:
            lines.append(f"- [{r.get('type', 'custom').upper()}] {r.get('content', '')}")
        rules_section = "\n\n## User-Defined Rules\nYou MUST follow these rules in every query and analysis:\n" + "\n".join(lines) + "\n"

    return f"""You are a research analyst agent for Rapido, a ride-sharing platform in India.
You help product managers discover and understand captain (driver) segments through data exploration.

You have access to Presto SQL databases with captain activity data. Use the tools provided to query data,
run analyses, and validate findings.

{PRESTO_SCHEMA_CONTEXT}

{RESEARCHER_SQL_REFERENCE}
{dynamic_section}
## Your approach:
1. **Plan first**: Before running any query, briefly explain what you're about to do and why.
2. **Show your work**: After each query/analysis, explain what the results mean.
3. **Be iterative**: Start with broad exploration, then drill deeper based on findings.
4. **Never fabricate data**: Only report numbers that came from actual tool results.
5. **Be concise**: Keep explanations clear and focused. Use bullet points for key findings.
{rules_section}
## SQL guidelines:
- BEFORE writing any WHERE clause, check the TABLE COLUMN REFERENCE above for the correct column name.
- Use only SELECT statements — no INSERT, UPDATE, DELETE, DROP, etc.
- Prefer captain_id counts and aggregates over pulling raw rows.
- When filtering by city, use lowercase via lower() (e.g., lower(city) = 'bangalore').
- Date columns vary by table — check the reference table for the correct column name, type, and filter pattern.
- For the mne table, `time_value` is DATE type — always cast to varchar before YYYYMMDD comparison.
- Every non-aggregated column in SELECT MUST appear in GROUP BY. Presto enforces this strictly.
- Limit large result sets to avoid timeouts: use LIMIT or GROUP BY.
- For captain counts, use COUNT(DISTINCT captain_id).

## Analysis tools:
- **run_presto_query**: For any SQL exploration. Use this first for light queries.
- **run_contrast_analysis**: Compares two groups across ~18 features. Use when you need to understand
  what differentiates one group from another (e.g., churners vs retained).
- **compute_response_profiles**: Profiles captains along behavioral axes. Use when you need to
  understand behavioral patterns (incentive sensitivity, frustration resilience, etc.).
- **validate_segment**: Tests a segment definition through 6 quality gates. Use when you have
  a hypothesis and want to formally validate it.
- **summarize_dataframe**: Quick stats on the last query result.

When a PM asks a question like "Why did weekly captains churn?", think through:
1. First quantify the problem (how many churned? what's the baseline?)
2. Then compare churners vs retained using contrast analysis
3. Highlight the top differentiating features
4. Suggest actionable segment definitions based on findings
"""

# ---------------------------------------------------------------------------
# Agent class
# ---------------------------------------------------------------------------

MAX_TOOL_LOOPS = 16


class ResearcherAgent:
    """Conversational AI agent that wraps researcher tools via Anthropic Claude."""

    def __init__(self, username: str):
        self.username = username
        self.client = None  # lazy-init in stream()
        self._last_df: Optional[pd.DataFrame] = None  # for summarize_dataframe

    # -- Tool execution -------------------------------------------------------

    def _execute_tool(self, name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool by name, return JSON-serializable result."""
        try:
            if name == "run_presto_query":
                return self._tool_presto_query(args)
            elif name == "run_contrast_analysis":
                return self._tool_contrast_analysis(args)
            elif name == "compute_response_profiles":
                return self._tool_response_profiles(args)
            elif name == "validate_segment":
                return self._tool_validate_segment(args)
            elif name == "summarize_dataframe":
                return self._tool_summarize(args)
            else:
                return {"error": f"Unknown tool: {name}"}
        except Exception as exc:
            logger.exception("Tool %s failed", name)
            return {"error": str(exc)}

    def _tool_presto_query(self, args: Dict[str, Any]) -> Dict[str, Any]:
        sql = args.get("sql", "").strip()
        if not sql:
            return {"error": "No SQL provided."}
        err = _validate_sql(sql)
        if err:
            return {"error": err}
        df = _query_presto(self.username, sql)
        self._last_df = df
        # Return first 50 rows as records + row count
        rows = df.head(50).to_dict(orient="records")
        # Clean NaN values for JSON serialization
        for row in rows:
            for k, v in row.items():
                if pd.isna(v):
                    row[k] = None
                elif hasattr(v, 'item'):  # numpy scalar
                    row[k] = v.item()
        return {
            "total_rows": len(df),
            "columns": list(df.columns),
            "rows": rows,
            "truncated": len(df) > 50,
        }

    def _tool_contrast_analysis(self, args: Dict[str, Any]) -> Dict[str, Any]:
        result = run_contrast_analysis(
            username=self.username,
            city=args["city"],
            start_date=args["start_date"],
            end_date=args["end_date"],
            splitting_outcome=args["splitting_outcome"],
            consistency_segment=args.get("consistency_segment"),
            performance_segment=args.get("performance_segment"),
            custom_column=args.get("custom_column"),
            custom_threshold=args.get("custom_threshold"),
            custom_direction=args.get("custom_direction", "above"),
        )
        if not result.get("success"):
            return {"error": result.get("error", "Analysis failed.")}
        comparisons = result.get("comparisons", [])
        return {
            "group_a_label": result["group_a_label"],
            "group_b_label": result["group_b_label"],
            "group_a_size": result["group_a_size"],
            "group_b_size": result["group_b_size"],
            "top_features": result.get("top_features", [])[:10],
            "comparisons": comparisons[:10],
            "total_features_compared": len(comparisons),
            "queries": result.get("queries", []),
        }

    def _tool_response_profiles(self, args: Dict[str, Any]) -> Dict[str, Any]:
        result = compute_response_profiles(
            username=self.username,
            city=args["city"],
            start_date=args["start_date"],
            end_date=args["end_date"],
            axes=args.get("axes", [
                "incentive_elasticity", "target_earning",
                "frustration_resilience", "behavioral_inertia",
                "efficiency_trajectory", "demand_supply_fit",
            ]),
            consistency_segment=args.get("consistency_segment"),
            performance_segment=args.get("performance_segment"),
            min_active_days=args.get("min_active_days", 14),
        )
        if not result.get("success"):
            return {"error": result.get("error", "Profiling failed.")}
        return {
            "captain_count": result["captain_count"],
            "axis_stats": result["axis_stats"],
            "queries": result.get("queries", []),
            "sample_profiles": result.get("profiles", [])[:5],
        }

    def _tool_validate_segment(self, args: Dict[str, Any]) -> Dict[str, Any]:
        result = validate_segment(
            username=self.username,
            city=args["city"],
            start_date=args["start_date"],
            end_date=args["end_date"],
            segment_name=args["segment_name"],
            segment_definition=args["segment_definition"],
            consistency_segment=args.get("consistency_segment"),
            performance_segment=args.get("performance_segment"),
            actionability_note=args.get("actionability_note"),
        )
        if not result.get("success"):
            return {"error": result.get("error", "Validation failed.")}
        return {
            "segment_name": result["segment_name"],
            "segment_size": result["segment_size"],
            "population_size": result["population_size"],
            "population_pct": result["population_pct"],
            "gates": result["gates"],
            "gates_passed": result["gates_passed"],
            "total_gates": result["total_gates"],
            "ready_to_publish": result["ready_to_publish"],
        }

    def _tool_summarize(self, args: Dict[str, Any]) -> Dict[str, Any]:
        if self._last_df is None or self._last_df.empty:
            return {"error": "No previous query result to summarize."}
        df = self._last_df
        cols = args.get("columns") or []
        if cols:
            valid = [c for c in cols if c in df.columns]
            if valid:
                df = df[valid]
        desc = df.describe(include="all").to_dict()
        for col, stats in desc.items():
            for k, v in stats.items():
                if pd.isna(v):
                    desc[col][k] = None
                elif hasattr(v, 'item'):
                    desc[col][k] = v.item()
        return {"shape": list(self._last_df.shape), "summary": desc}

    # -- SSE streaming --------------------------------------------------------

    def stream(self, messages: List[Dict[str, Any]], rules: Optional[List[Dict[str, str]]] = None) -> Generator[str, None, None]:
        """
        Generator yielding SSE events using Anthropic Claude streaming.

        Event types:
          - text_delta: {"content": "..."}
          - tool_call_start: {"name": "...", "arguments": {...}}
          - tool_result: {"name": "...", "result": {...}}
          - error: {"message": "..."}
          - done: {}
        """
        # Lazy-init Anthropic client
        if self.client is None:
            try:
                self.client = _get_anthropic_client()
            except RuntimeError as exc:
                yield _sse("error", {"message": str(exc)})
                yield _sse("done", {})
                return

        # Build Anthropic messages (system prompt is separate)
        api_messages = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role in ("user", "assistant") and content:
                api_messages.append({"role": role, "content": content})

        for loop in range(MAX_TOOL_LOOPS):
            try:
                # Stream from Claude
                with self.client.messages.stream(
                    model="claude-sonnet-4-20250514",
                    system=_build_system_prompt(rules=rules),
                    messages=api_messages,
                    tools=RESEARCHER_TOOLS,
                    max_tokens=4096,
                    temperature=0.2,
                ) as stream:
                    content_buffer = ""
                    tool_use_blocks: List[Dict[str, Any]] = []

                    for event in stream:
                        # Text deltas
                        if event.type == "content_block_delta":
                            if hasattr(event.delta, "text"):
                                content_buffer += event.delta.text
                                yield _sse("text_delta", {"content": event.delta.text})
                            elif hasattr(event.delta, "partial_json"):
                                # Tool input being streamed — accumulate silently
                                if tool_use_blocks:
                                    tool_use_blocks[-1]["_partial"] += event.delta.partial_json

                        # New content block starting
                        elif event.type == "content_block_start":
                            if event.content_block.type == "tool_use":
                                tool_use_blocks.append({
                                    "id": event.content_block.id,
                                    "name": event.content_block.name,
                                    "_partial": "",
                                })

                    # After stream ends, get the final message
                    final_message = stream.get_final_message()

            except Exception as exc:
                logger.exception("Anthropic API error")
                yield _sse("error", {"message": str(exc)})
                yield _sse("done", {})
                return

            # Check stop reason
            stop_reason = final_message.stop_reason

            # If no tool use, we're done
            if stop_reason != "tool_use":
                yield _sse("done", {})
                return

            # Extract tool_use blocks from the final message
            tool_uses = [
                block for block in final_message.content
                if block.type == "tool_use"
            ]

            if not tool_uses:
                yield _sse("done", {})
                return

            # Add assistant message to conversation (full content blocks)
            api_messages.append({
                "role": "assistant",
                "content": [_block_to_dict(b) for b in final_message.content],
            })

            # Execute each tool call and collect results
            tool_result_blocks = []
            for tu in tool_uses:
                tc_args = tu.input if isinstance(tu.input, dict) else {}

                # Emit tool call start
                yield _sse("tool_call_start", {
                    "name": tu.name,
                    "arguments": tc_args,
                })

                # Execute
                result = self._execute_tool(tu.name, tc_args)

                # Emit tool result
                yield _sse("tool_result", {
                    "name": tu.name,
                    "result": result,
                })

                tool_result_blocks.append({
                    "type": "tool_result",
                    "tool_use_id": tu.id,
                    "content": json.dumps(result, default=str),
                })

            # Add tool results as user message (Anthropic convention)
            api_messages.append({
                "role": "user",
                "content": tool_result_blocks,
            })

            # Continue loop — Claude will process tool results

        # Hit max loop limit
        yield _sse("text_delta", {
            "content": "\n\n*Reached maximum analysis steps. Please ask a follow-up question to continue.*"
        })
        yield _sse("done", {})


def _block_to_dict(block: Any) -> Dict[str, Any]:
    """Convert an Anthropic content block to a dict for the messages API."""
    if block.type == "text":
        return {"type": "text", "text": block.text}
    elif block.type == "tool_use":
        return {
            "type": "tool_use",
            "id": block.id,
            "name": block.name,
            "input": block.input,
        }
    return {"type": "text", "text": ""}


def _sse(event: str, data: Dict[str, Any]) -> str:
    """Format a server-sent event."""
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"
