"""
Ladoo Metrics — AI Agent Layer

Four agents that transform Ladoo from a passive tool into a self-evolving
problem discovery platform:

  MetricGenAgent        — natural language → validated compute_metrics() function
  MetricSuggestAgent    — suggest metrics given experiment context
  ProblemDiscoveryAgent — autonomous anomaly detection across captain segments
  NarrativeExplainerAgent — plain-English explanation of Executive Summary tables

All agents use GPT-4o via the OpenAI API.
All generated code is piped through the existing function_executor.py sandbox.
"""

from __future__ import annotations

import json
import logging
import os
import re
import textwrap
from dataclasses import dataclass, field
from typing import Any, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# OpenAI client (lazy-initialized so the module loads without the key)
# ---------------------------------------------------------------------------

_openai_client = None

def get_openai_client():
    global _openai_client
    if _openai_client is None:
        from openai import OpenAI
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY environment variable is not set")
        _openai_client = OpenAI(api_key=api_key)
    return _openai_client


# ---------------------------------------------------------------------------
# Presto schema context — the LLM's world model
# This string is embedded in every agent prompt.
# ---------------------------------------------------------------------------

PRESTO_SCHEMA_CONTEXT = """
=== PRESTO SCHEMA ===

TABLE: metrics.captain_base_metrics_enriched
PURPOSE: Primary daily activity table. One row per captain per day per city.
KEY COLUMNS:
  captain_id          VARCHAR   Unique captain identifier
  yyyymmdd            VARCHAR   Date in YYYYMMDD format (e.g. '20260119')
  geo_city            VARCHAR   City name lowercase (e.g. 'bangalore', 'delhi')

  -- Online presence (how long / how often they are online)
  count_captain_num_online_daily_city            BIGINT  Online events all day
  count_num_online_morning_peak_daily_city       BIGINT  Online events morning peak (6-10am)
  count_num_online_afternoon_daily_city          BIGINT  Online events afternoon (12-4pm)
  count_num_online_evening_peak_daily_city       BIGINT  Online events evening peak (5-9pm)
  count_num_online_rest_midnight_daily_city      BIGINT  Online events night/rest

  -- Net rides by service
  count_captain_net_rides_taxi_all_day_city      BIGINT  Net taxi rides completed
  count_captain_c2c_orders_all_day_city          BIGINT  C2C (captain-to-captain) orders
  count_captain_delivery_orders_all_day_city     BIGINT  Delivery orders

  -- Pings (demand signals received)
  count_captain_gross_pings_taxi_all_day_city    BIGINT  Gross taxi pings received
  count_captain_accepted_pings_taxi_all_day_city BIGINT  Taxi pings accepted
  count_captain_gross_pings_delivery_all_day_city BIGINT Gross delivery pings
  count_captain_accepted_pings_delivery_all_day_city BIGINT  Delivery pings accepted
  count_captain_gross_pings_link_all_day_city    BIGINT  Link pings received

  -- Login hours (earning time)
  sum_captain_total_lh_daily_city                DOUBLE  Total login hours
  sum_captain_idle_lh_daily_city                 DOUBLE  Idle login hours (online, no ride)
  sum_captain_total_lh_morning_peak_daily_city   DOUBLE  Login hours morning peak
  sum_captain_total_lh_afternoon_daily_city      DOUBLE  Login hours afternoon
  sum_captain_total_lh_evening_peak_daily_city   DOUBLE  Login hours evening peak

  NOTE: TOD variants exist for most columns:
    morning_peak, afternoon, evening_peak, rest_midnight
    Pattern: count_captain_net_rides_taxi_morning_peak_daily_city

TABLE: datasets.captain_svo_daily_kpi
PURPOSE: Ride-level daily KPIs per captain.
KEY COLUMNS:
  captainid           VARCHAR   Captain identifier (NOTE: no underscore)
  yyyymmdd            VARCHAR   Date
  city                VARCHAR   City
  net_orders          BIGINT    Net completed orders
  accepted_pings      BIGINT    Accepted pings
  riderrejected_pings BIGINT    Captain-rejected pings
  riderbusy_pings     BIGINT    Captain-busy pings
  service_name        VARCHAR   Service type (auto, bike_taxi, cab, etc.)

TABLE: reports_internal.marketplace_dapr_twenty_pings_combined_v7_v8
PURPOSE: DAPR (Driver Acceptance Rate) data. One row per captain per day.
KEY COLUMNS:
  captain_id          VARCHAR
  yyyymmdd            VARCHAR
  city_name           VARCHAR   City (may differ from geo_city format)
  dapr                DOUBLE    Driver acceptance rate (0.0 to 1.0)
  accepted_pings      BIGINT
  service_category    VARCHAR   auto, bike_taxi, cab, etc.

TABLE: iceberg.experiments_internal.iceberg_experiment_v6_root
PURPOSE: Experiment assignment data (which captain is in which cohort).
KEY COLUMNS:
  experiment_id       VARCHAR   UUID of experiment
  attributes          VARCHAR   JSON blob containing captain_id
  experiment_split_attribute VARCHAR  Path to extract captain_id
  cohort              VARCHAR   'test' or 'control'

IMPORTANT: Extract captain_id with:
  json_extract_scalar(attributes, '$.' || replace(experiment_split_attribute, '$payload.', ''))
AS captain_id

TABLE: datasets.captain_supply_journey_summary
PURPOSE: Captain onboarding and registration data.
KEY COLUMNS:
  captain_id          VARCHAR
  mobile_number       VARCHAR
  registration_date   DATE
  city                VARCHAR
  service_category    VARCHAR

TABLE: mne.ms_1842554619_2584218394
PURPOSE: Rolling 28/83-day consistency and performance segmentation.
KEY COLUMNS:
  captain_id
  geo_city
  time_value                          Date
  time_level                          'daily'/'weekly'/'monthly'
  count_net_days_last_28_days         Net active days in last 28 days
  count_net_weeks_last_28_days        Net active weeks in last 28 days
  captain_net_days_last_83_days       Net active days in last 83 days
  count_total_rides_last_28_days      Total rides in last 28 days

CONSISTENCY SEGMENT LOGIC:
  daily     → count_net_days_last_28_days >= 15
  weekly    → days 1-14 AND count_net_weeks_last_28_days >= 3
  monthly   → days 1-14 AND count_net_weeks_last_28_days < 3
  quarterly → days = 0 in 28d but count > 0 in 83d
  rest      → days = 0 in both windows

PERFORMANCE SEGMENT LOGIC:
  rides_per_day = count_total_rides_last_28_days / 28.0
  UHP → > 15   HP → > 10   MP → > 5   LP → > 0   ZP → = 0

TABLE: experiments.fe2net_dashboard_lite
PURPOSE: Front-end-to-net funnel metrics (high-level supply-demand matching).
KEY COLUMNS:
  city, time_level, time_value, service
  login_hours, fe_sessions, gross_session, fe2rr, fe2net, gsr2net
  gross_orders, mapped_orders, net_orders
  online_captains, gross_captains, net_captains
  idle_hours, rph, dapr, apr, dpr
  avg_shown_eta, avg_actual_eta
  ocara_percent, stockout_percent
  rider_busy_percent, rider_reject_percent

=== DERIVED METRIC DEFINITIONS ===
net_days   = days where net_rides_taxi + net_rides_c2c > 0
online_days = days where count_captain_num_online > 0
gross_days = days where gross_pings > 0
ao_days    = days where online AND gross_pings > 0
idle_fraction = idle_lh / total_lh (fraction of online time with no ride)
engagement_rate = net_days / online_days
acceptance_rate = accepted_pings / gross_pings

=== ALLOWED CITIES ===
bangalore, delhi, mumbai, hyderabad, chennai, kolkata, pune, ahmedabad,
jaipur, lucknow, chandigarh, kochi, coimbatore, indore, nagpur, guwahati,
surat, noida, gurgaon, patna, vadodara, bhopal, visakhapatnam, mysore,
mangalore, bhubaneswar, ranchi, dehradun, agra, varanasi, amritsar,
ludhiana, kanpur, nashik, rajkot, madurai, aurangabad, jodhpur, raipur,
gwalior, vijayawada, meerut, faridabad

=== ALLOWED SERVICE CATEGORIES ===
bike_taxi, auto, cab, link, c2c, delivery, auto_c2c
"""

# ---------------------------------------------------------------------------
# Metric generation system prompt
# ---------------------------------------------------------------------------

METRIC_GEN_SYSTEM_PROMPT = """\
You are an expert data analyst at Rapido who writes Presto SQL to measure captain behavior.
You write Python functions that query Presto and return captain_id × yyyymmdd level DataFrames.

FUNCTION CONTRACT:
- Function must be named `compute_metrics(params)`
- Must return a pandas DataFrame with columns: captain_id, yyyymmdd, [your metric columns]
- No duplicate (captain_id, yyyymmdd) pairs
- Use the run_query(sql) helper to execute Presto SQL (already available in scope)
- Available imports: pandas (pd), numpy (np), datetime
- Do NOT use: os, sys, subprocess, eval, exec, open, __import__, globals, locals

PARAMETER CONVENTION:
  params.get('start_date', '20260101')  → YYYYMMDD string
  params.get('end_date', '20261231')    → YYYYMMDD string
  params.get('city', 'bangalore')       → lowercase city name
  params.get('service_category', 'auto') → service type

SQL BEST PRACTICES:
1. Always filter: WHERE yyyymmdd BETWEEN params['start_date'] AND params['end_date']
2. Prefer captain_base_metrics_enriched for day-level activity (it's pre-aggregated)
3. GROUP BY captain_id, yyyymmdd when aggregating
4. Use CAST(SUM(...) AS DOUBLE) for ratios to avoid integer division
5. Handle NULL with COALESCE(col, 0)

{schema}

{catalog}

RESPONSE FORMAT — use these exact markers:
<explanation>
2-3 sentences: what this metric captures about captain behavior and why it matters.
</explanation>

<code>
def compute_metrics(params):
    ...
</code>

<alternatives>
- Alternative 1: [description]
- Alternative 2: [description]
</alternatives>
"""

# ---------------------------------------------------------------------------
# Metric suggestion system prompt
# ---------------------------------------------------------------------------

METRIC_SUGGEST_SYSTEM_PROMPT = """\
You are a senior analyst at Rapido helping a colleague get the most out of their experiment analysis.
Given context about an experiment, suggest additional metrics that would give a complete picture.

Think creatively about BEHAVIORAL metrics — not just output counts, but patterns:
- Timing patterns (morning vs evening behavior)
- Consistency patterns (variance across days, not just averages)
- Funnel breakdown (where in the online→gross→accepted→net funnel does the effect appear?)
- Segment heterogeneity (does the effect differ by consistency_segment or performance_segment?)
- Cross-service effects (does the experiment shift captains between taxi and delivery?)

{schema}

RESPONSE FORMAT — return a JSON array:
[
  {{
    "label": "short metric name",
    "description": "plain English: what it measures",
    "why": "why relevant to THIS experiment",
    "source": "existing_column" | "ratio" | "generate_function",
    "column": "column_name_if_existing",
    "ratio_x": "numerator_col_if_ratio",
    "ratio_y": "denominator_col_if_ratio",
    "function_hint": "describe the function for MetricGen if generate_function",
    "priority": "high" | "medium" | "low"
  }}
]
Return 6-10 suggestions. Prioritize behavioral/creative metrics over simple counts.
"""

# ---------------------------------------------------------------------------
# Narrative explainer system prompt
# ---------------------------------------------------------------------------

NARRATIVE_SYSTEM_PROMPT = """\
You are a senior data scientist at Rapido explaining an experiment result to a mixed audience
of analysts and product managers. Be precise but accessible. No jargon without explanation.

Your explanation should:
1. State what the experiment appears to have changed (and what it didn't)
2. Explain WHY the metric movements make sense (or are surprising) given captain behavior
3. Flag any concerns: sample ratio mismatch, pre-period divergence, effect driven by a single metric
4. Suggest 2-3 things to look at next

Be direct. Say "this experiment helped X" or "the effect is ambiguous because Y".
Do not hedge everything. A useful explanation takes a clear position.

{schema}
"""


# ---------------------------------------------------------------------------
# Discovery check definitions
# ---------------------------------------------------------------------------

DISCOVERY_CHECKS = [
    "daily_captain_count_trend",
    "weekly_to_rest_churn_rate",
    "segment_concentration_shift",
    "ping_acceptance_rate_trend",
    "idle_fraction_trend",
    "morning_peak_dropout_rate",
    "rides_per_online_day_trend",
    "uhp_captain_degradation",
    "new_captain_daily_activation",
]


# ---------------------------------------------------------------------------
# Result dataclasses
# ---------------------------------------------------------------------------

@dataclass
class MetricGenResult:
    success: bool
    code: str = ""
    explanation: str = ""
    alternatives: list[str] = field(default_factory=list)
    parameters: list[dict] = field(default_factory=list)
    output_columns: list[str] = field(default_factory=list)
    preview: list[dict] = field(default_factory=list)
    error: str = ""
    confidence: str = "medium"


@dataclass
class MetricSuggestion:
    label: str
    description: str
    why: str
    source: str  # "existing_column" | "ratio" | "generate_function"
    column: str = ""
    ratio_x: str = ""
    ratio_y: str = ""
    function_hint: str = ""
    priority: str = "medium"


@dataclass
class DiscoveryFinding:
    id: str
    title: str
    severity: str  # "critical" | "warning" | "notice"
    segment: str
    metric: str
    finding: str
    hypothesis: str
    suggested_action: str
    z_score: float
    baseline: float
    recent: float
    pct_change: float
    data: dict = field(default_factory=dict)


@dataclass
class NarrativeResult:
    narrative: str
    key_findings: list[str]
    concerns: list[str]
    recommended_next_metrics: list[str]


# ---------------------------------------------------------------------------
# Helper: extract code block from LLM response
# ---------------------------------------------------------------------------

def _extract_tagged(text: str, tag: str) -> str:
    pattern = rf"<{tag}>(.*?)</{tag}>"
    m = re.search(pattern, text, re.DOTALL)
    return m.group(1).strip() if m else ""


def _extract_code_block(text: str) -> str:
    """Extract Python code from <code> tag or markdown fence."""
    # Try <code> tag first
    tagged = _extract_tagged(text, "code")
    if tagged:
        return tagged

    # Fall back to ```python ... ``` fence
    m = re.search(r"```(?:python)?\s*(.*?)```", text, re.DOTALL)
    if m:
        return m.group(1).strip()

    return text.strip()


def _extract_alternatives(text: str) -> list[str]:
    block = _extract_tagged(text, "alternatives")
    if not block:
        return []
    lines = [l.strip().lstrip("- ") for l in block.splitlines() if l.strip()]
    return [l for l in lines if l]


def _build_catalog_context(functions: list[dict]) -> str:
    if not functions:
        return ""
    lines = ["=== SAVED FUNCTIONS IN METRIC CATALOG ==="]
    for fn in functions[:20]:  # cap at 20 to stay within context
        name = fn.get("name", "unnamed")
        desc = fn.get("description", "")
        out_cols = fn.get("output_columns", [])
        params = [p.get("name", "") for p in fn.get("parameters", [])]
        lines.append(f"- {name}: {desc} | outputs: {out_cols} | params: {params}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Agent 1: MetricGen
# ---------------------------------------------------------------------------

class MetricGenAgent:
    """
    Generates a validated compute_metrics() function from a plain-English description.

    Usage:
        agent = MetricGenAgent()
        result = agent.generate(
            description="captains who had high morning peak activity but low evening activity",
            username="krishna.poddar@rapido.bike",
            test_immediately=True,
        )
        if result.success:
            print(result.code)
            print(result.explanation)
    """

    def __init__(self):
        self.model = "gpt-4o"

    def generate(
        self,
        description: str,
        context: str = "",
        username: str = "",
        function_catalog: list[dict] | None = None,
        test_immediately: bool = False,
        default_params: dict | None = None,
    ) -> MetricGenResult:
        client = get_openai_client()
        catalog_ctx = _build_catalog_context(function_catalog or [])

        system = METRIC_GEN_SYSTEM_PROMPT.format(
            schema=PRESTO_SCHEMA_CONTEXT,
            catalog=catalog_ctx,
        )

        user_msg = f"Generate a compute_metrics() function that measures:\n\n{description}"
        if context:
            user_msg += f"\n\nAdditional context:\n{context}"

        try:
            response = client.chat.completions.create(
                model=self.model,
                max_tokens=4096,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_msg},
                ],
            )
            text = response.choices[0].message.content
        except Exception as e:
            return MetricGenResult(success=False, error=f"LLM call failed: {e}")

        code = _extract_code_block(text)
        explanation = _extract_tagged(text, "explanation") or ""
        alternatives = _extract_alternatives(text)

        if not code or "compute_metrics" not in code:
            return MetricGenResult(
                success=False,
                error="LLM did not return a valid compute_metrics() function",
            )

        # Security validation through existing sandbox
        from function_executor import validate_code_security
        is_safe, sec_error = validate_code_security(code)
        if not is_safe:
            return MetricGenResult(success=False, error=f"Security check failed: {sec_error}")

        # Extract parameters declared in the function
        params = _infer_parameters(code)

        # Extract predicted output columns from code (column names after AS)
        output_columns = _infer_output_columns(code)

        preview: list[dict] = []
        if test_immediately and username:
            from function_executor import test_function
            test_params = default_params or {
                p["name"]: p.get("default", "") for p in params
            }
            res = test_function(code, test_params, username, limit_rows=50)
            if res.get("success"):
                preview = res.get("preview") or []
                output_columns = res.get("output_columns") or output_columns
            else:
                # Still return the code, just note the test failed
                return MetricGenResult(
                    success=True,
                    code=code,
                    explanation=explanation,
                    alternatives=alternatives,
                    parameters=params,
                    output_columns=output_columns,
                    error=f"Generated OK but Presto test failed: {res.get('error', '')}",
                    confidence="low",
                )

        return MetricGenResult(
            success=True,
            code=code,
            explanation=explanation,
            alternatives=alternatives,
            parameters=params,
            output_columns=output_columns,
            preview=preview,
            confidence="high" if preview else "medium",
        )

    def refine(
        self,
        original_code: str,
        feedback: str,
        username: str = "",
    ) -> MetricGenResult:
        """Refine a previously generated function based on feedback."""
        client = get_openai_client()
        system = METRIC_GEN_SYSTEM_PROMPT.format(
            schema=PRESTO_SCHEMA_CONTEXT,
            catalog="",
        )
        user_msg = (
            f"Here is an existing compute_metrics() function:\n\n```python\n{original_code}\n```\n\n"
            f"Please refine it based on this feedback:\n{feedback}\n\n"
            "Return the refined function using the same <code>...</code> format."
        )
        try:
            response = client.chat.completions.create(
                model=self.model,
                max_tokens=4096,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_msg},
                ],
            )
            text = response.choices[0].message.content
        except Exception as e:
            return MetricGenResult(success=False, error=str(e))

        code = _extract_code_block(text)
        explanation = _extract_tagged(text, "explanation") or ""

        from function_executor import validate_code_security
        is_safe, sec_error = validate_code_security(code)
        if not is_safe:
            return MetricGenResult(success=False, error=f"Security check failed: {sec_error}")

        return MetricGenResult(
            success=True,
            code=code,
            explanation=explanation,
            parameters=_infer_parameters(code),
            output_columns=_infer_output_columns(code),
        )


# ---------------------------------------------------------------------------
# Agent 2: MetricSuggest
# ---------------------------------------------------------------------------

class MetricSuggestAgent:
    """
    Suggests additional metrics given current experiment context.

    Usage:
        agent = MetricSuggestAgent()
        suggestions = agent.suggest(
            session_columns=["captain_id", "cohort", "yyyymmdd", "net_days", "accepted_orders"],
            selected_metrics=["net_days", "accepted_orders"],
            experiment_type="retention",
        )
    """

    def __init__(self):
        self.model = "gpt-4o"

    def suggest(
        self,
        session_columns: list[str],
        selected_metrics: list[str],
        experiment_type: str = "unknown",
        cohort_sizes: dict | None = None,
        date_range_days: int = 14,
        extra_context: str = "",
    ) -> list[MetricSuggestion]:
        client = get_openai_client()

        system = METRIC_SUGGEST_SYSTEM_PROMPT.format(schema=PRESTO_SCHEMA_CONTEXT)

        user_msg = textwrap.dedent(f"""
            Experiment context:
            - Type: {experiment_type}
            - Pre/post period length: ~{date_range_days} days each
            - Cohort sizes: {json.dumps(cohort_sizes or {})}
            - Columns in current dataset: {session_columns}
            - Metrics analyst has already selected: {selected_metrics}
            {('- Additional context: ' + extra_context) if extra_context else ''}

            Suggest 6-10 additional metrics worth analyzing.
            For "existing_column" sources, only suggest columns that are in: {session_columns}
        """).strip()

        try:
            response = client.chat.completions.create(
                model=self.model,
                max_tokens=2048,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_msg},
                ],
            )
            text = response.choices[0].message.content
        except Exception as e:
            logger.error("MetricSuggestAgent LLM call failed: %s", e)
            return []

        # Parse JSON from response
        json_match = re.search(r"\[.*\]", text, re.DOTALL)
        if not json_match:
            logger.warning("MetricSuggestAgent: no JSON array in response")
            return []

        try:
            raw = json.loads(json_match.group(0))
        except json.JSONDecodeError as e:
            logger.warning("MetricSuggestAgent: JSON parse error: %s", e)
            return []

        suggestions = []
        for item in raw:
            try:
                suggestions.append(MetricSuggestion(
                    label=item.get("label", ""),
                    description=item.get("description", ""),
                    why=item.get("why", ""),
                    source=item.get("source", "existing_column"),
                    column=item.get("column", ""),
                    ratio_x=item.get("ratio_x", ""),
                    ratio_y=item.get("ratio_y", ""),
                    function_hint=item.get("function_hint", ""),
                    priority=item.get("priority", "medium"),
                ))
            except Exception:
                continue

        return suggestions


# ---------------------------------------------------------------------------
# Agent 3: ProblemDiscovery
# ---------------------------------------------------------------------------

class ProblemDiscoveryAgent:
    """
    Autonomously scans for anomalies across captain segments.

    Two modes:
      1. Statistical: runs Presto queries and applies z-score anomaly detection
      2. LLM-enhanced: passes findings to Claude for hypothesis generation

    Usage:
        agent = ProblemDiscoveryAgent()
        findings = agent.scan(
            username="krishna.poddar@rapido.bike",
            city="bangalore",
            service_category="auto",
            lookback_days=35,
        )
    """

    def __init__(self):
        self.model = "gpt-4o"

    def scan(
        self,
        username: str,
        city: str = "",
        service_category: str = "auto",
        lookback_days: int = 35,
        check_types: list[str] | None = None,
        enhance_with_llm: bool = True,
    ) -> dict:
        import uuid
        from datetime import date, timedelta

        checks = check_types or DISCOVERY_CHECKS

        end_date = date.today()
        start_date = end_date - timedelta(days=lookback_days)
        start_yyyymmdd = start_date.strftime("%Y%m%d")
        end_yyyymmdd = end_date.strftime("%Y%m%d")

        raw_findings: list[DiscoveryFinding] = []

        for check in checks:
            try:
                check_fn = getattr(self, f"_check_{check}", None)
                if check_fn:
                    findings = check_fn(
                        username=username,
                        city=city,
                        service_category=service_category,
                        start_yyyymmdd=start_yyyymmdd,
                        end_yyyymmdd=end_yyyymmdd,
                    )
                    raw_findings.extend(findings)
            except Exception as e:
                logger.warning("Discovery check %s failed: %s", check, e)

        # Sort by severity
        severity_order = {"critical": 0, "warning": 1, "notice": 2}
        raw_findings.sort(key=lambda f: (severity_order.get(f.severity, 3), -abs(f.z_score)))

        narrative = ""
        if enhance_with_llm and raw_findings:
            narrative = self._generate_narrative(raw_findings[:5])

        return {
            "findings": [self._finding_to_dict(f) for f in raw_findings],
            "scan_timestamp": end_date.isoformat(),
            "checks_run": len(checks),
            "city": city,
            "service_category": service_category,
            "narrative": narrative,
        }

    def _run_query(self, username: str, sql: str) -> pd.DataFrame:
        """Execute a Presto query and return DataFrame."""
        from function_executor import get_presto_connection
        conn = get_presto_connection(username)
        return pd.read_sql(sql, conn)

    def _zscore_findings(
        self,
        df: pd.DataFrame,
        metric_col: str,
        date_col: str,
        recent_window: int = 7,
        label: str = "",
        segment: str = "",
        hypothesis_template: str = "",
        action_template: str = "",
    ) -> list[DiscoveryFinding]:
        """
        Given a time-series DataFrame, compute z-score for recent_window vs baseline.
        Returns a finding if |z| > 1.5.
        """
        import uuid

        if df.empty or metric_col not in df.columns:
            return []

        df = df.copy()
        df[date_col] = pd.to_datetime(df[date_col], format="%Y%m%d", errors="coerce")
        df = df.dropna(subset=[date_col]).sort_values(date_col)

        if len(df) < recent_window + 7:
            return []

        recent = df.tail(recent_window)[metric_col].values
        baseline = df.iloc[-(recent_window + 21):-recent_window][metric_col].values

        if len(baseline) < 5:
            return []

        baseline_mean = float(np.mean(baseline))
        baseline_std = float(np.std(baseline))
        recent_mean = float(np.mean(recent))

        if baseline_std < 1e-9:
            return []

        z = (recent_mean - baseline_mean) / baseline_std

        if abs(z) < 1.5:
            return []

        severity = "critical" if abs(z) > 3 else "warning" if abs(z) > 2 else "notice"
        pct_change = ((recent_mean - baseline_mean) / baseline_mean * 100) if baseline_mean != 0 else 0
        direction = "above" if z > 0 else "below"

        finding = DiscoveryFinding(
            id=str(uuid.uuid4())[:8],
            title=f"{label}: {recent_mean:.1f} ({pct_change:+.1f}%) — {abs(z):.1f}σ {direction} baseline",
            severity=severity,
            segment=segment,
            metric=metric_col,
            finding=(
                f"{label} is {abs(z):.1f} standard deviations {direction} the 3-week baseline. "
                f"Baseline average: {baseline_mean:.2f}, recent average: {recent_mean:.2f} "
                f"({pct_change:+.1f}%)."
            ),
            hypothesis=hypothesis_template or f"Investigate whether {label.lower()} has structurally changed.",
            suggested_action=action_template or f"Run segment transition analysis for {segment} over the past 14 days.",
            z_score=round(z, 2),
            baseline=round(baseline_mean, 3),
            recent=round(recent_mean, 3),
            pct_change=round(pct_change, 2),
            data={
                "dates": [str(d.date()) for d in df[date_col].tolist()],
                "values": df[metric_col].round(3).tolist(),
            },
        )
        return [finding]

    def _check_daily_captain_count_trend(self, username, city, service_category, start_yyyymmdd, end_yyyymmdd):
        city_filter = f"AND geo_city = '{city}'" if city else ""
        sql = f"""
        SELECT
            yyyymmdd,
            COUNT(DISTINCT captain_id) AS daily_captain_count
        FROM metrics.captain_base_metrics_enriched
        WHERE yyyymmdd BETWEEN '{start_yyyymmdd}' AND '{end_yyyymmdd}'
          AND count_captain_net_rides_taxi_all_day_city > 0
          {city_filter}
        GROUP BY yyyymmdd
        ORDER BY yyyymmdd
        """
        df = self._run_query(username, sql)
        return self._zscore_findings(
            df, "daily_captain_count", "yyyymmdd",
            label=f"Daily active captains ({city or 'all cities'})",
            segment=f"daily, {service_category}, {city or 'all'}",
            hypothesis_template="Supply may be shrinking — check if recent policy/incentive changes deterred captains from working.",
            action_template="Run segment transition analysis for daily captains. Check DAU trend in Dashboard.",
        )

    def _check_ping_acceptance_rate_trend(self, username, city, service_category, start_yyyymmdd, end_yyyymmdd):
        city_filter = f"AND city_name = '{city}'" if city else ""
        svc_filter = f"AND service_category = '{service_category}'" if service_category else ""
        sql = f"""
        SELECT
            yyyymmdd,
            CAST(SUM(accepted_pings) AS DOUBLE) / NULLIF(SUM(accepted_pings), 0) AS avg_dapr
        FROM reports_internal.marketplace_dapr_twenty_pings_combined_v7_v8
        WHERE yyyymmdd BETWEEN '{start_yyyymmdd}' AND '{end_yyyymmdd}'
          {city_filter}
          {svc_filter}
        GROUP BY yyyymmdd
        ORDER BY yyyymmdd
        """
        # Simpler: direct DAPR average
        sql = f"""
        SELECT
            yyyymmdd,
            AVG(dapr) AS avg_dapr
        FROM reports_internal.marketplace_dapr_twenty_pings_combined_v7_v8
        WHERE yyyymmdd BETWEEN '{start_yyyymmdd}' AND '{end_yyyymmdd}'
          {city_filter}
          {svc_filter}
        GROUP BY yyyymmdd
        ORDER BY yyyymmdd
        """
        df = self._run_query(username, sql)
        return self._zscore_findings(
            df, "avg_dapr", "yyyymmdd",
            label=f"Average DAPR ({city or 'all'}, {service_category})",
            segment=f"{service_category}, {city or 'all'}",
            hypothesis_template=(
                "DAPR drop may indicate captain supply quality is declining, or demand "
                "is spiking beyond captain capacity in certain areas/times."
            ),
            action_template="Check FE2Net funnel in Dashboard. Look at gross_pings vs accepted_pings split by TOD.",
        )

    def _check_idle_fraction_trend(self, username, city, service_category, start_yyyymmdd, end_yyyymmdd):
        city_filter = f"AND geo_city = '{city}'" if city else ""
        sql = f"""
        SELECT
            yyyymmdd,
            CAST(SUM(sum_captain_idle_lh_daily_city) AS DOUBLE)
              / NULLIF(SUM(sum_captain_total_lh_daily_city), 0) AS idle_fraction
        FROM metrics.captain_base_metrics_enriched
        WHERE yyyymmdd BETWEEN '{start_yyyymmdd}' AND '{end_yyyymmdd}'
          {city_filter}
        GROUP BY yyyymmdd
        ORDER BY yyyymmdd
        """
        df = self._run_query(username, sql)
        return self._zscore_findings(
            df, "idle_fraction", "yyyymmdd",
            label=f"Idle fraction ({city or 'all'})",
            segment=f"{service_category}, {city or 'all'}",
            hypothesis_template=(
                "Rising idle fraction means captains are online but not earning — "
                "supply is outpacing demand or ping matching is degrading."
            ),
            action_template="Compare idle_lh vs total_lh trend. Check stockout % in FE2Net dashboard.",
        )

    def _generate_narrative(self, findings: list[DiscoveryFinding]) -> str:
        """Ask Claude to generate a human-readable narrative for the top findings."""
        client = get_openai_client()

        findings_text = "\n\n".join([
            f"FINDING {i+1} [{f.severity.upper()}]: {f.title}\n"
            f"Metric: {f.metric}\nSegment: {f.segment}\n"
            f"Detail: {f.finding}\nHypothesis: {f.hypothesis}"
            for i, f in enumerate(findings)
        ])

        prompt = (
            "Here are the top anomalies detected in the Rapido captain ecosystem today:\n\n"
            f"{findings_text}\n\n"
            "Write a 2-3 paragraph plain-English brief for the ops team: what is happening, "
            "what likely caused it, and what to investigate first. Be direct and specific."
        )

        try:
            response = client.chat.completions.create(
                model=self.model,
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error("Narrative generation failed: %s", e)
            return ""

    @staticmethod
    def _finding_to_dict(f: DiscoveryFinding) -> dict:
        return {
            "id": f.id,
            "title": f.title,
            "severity": f.severity,
            "segment": f.segment,
            "metric": f.metric,
            "finding": f.finding,
            "hypothesis": f.hypothesis,
            "suggested_action": f.suggested_action,
            "z_score": f.z_score,
            "baseline": f.baseline,
            "recent": f.recent,
            "pct_change": f.pct_change,
            "data": f.data,
        }


# ---------------------------------------------------------------------------
# Agent 4: NarrativeExplainer
# ---------------------------------------------------------------------------

class NarrativeExplainerAgent:
    """
    Explains the Executive Summary diff-in-diff table in plain English.

    Usage:
        agent = NarrativeExplainerAgent()
        result = agent.explain(
            summary_rows=[...],  # list of ExecutiveRow-like dicts
            experiment_context={...},
        )
    """

    def __init__(self):
        self.model = "gpt-4o"

    def explain(
        self,
        summary_rows: list[dict],
        experiment_context: dict | None = None,
    ) -> NarrativeResult:
        client = get_openai_client()
        ctx = experiment_context or {}

        system = NARRATIVE_SYSTEM_PROMPT.format(schema=PRESTO_SCHEMA_CONTEXT)

        # Format the summary table as readable text
        table_lines = [
            "EXECUTIVE SUMMARY TABLE (Diff-in-Diff Analysis)",
            f"Experiment: {ctx.get('experiment_id', 'unknown')}",
            f"City: {ctx.get('city', 'N/A')} | Service: {ctx.get('service', 'N/A')}",
            f"Test captains: {ctx.get('test_cohort_size', 'N/A')} | Control captains: {ctx.get('control_cohort_size', 'N/A')}",
            f"Pre-period: {ctx.get('pre_days', 'N/A')} days | Post-period: {ctx.get('post_days', 'N/A')} days",
            "",
            f"{'METRIC':<35} {'AGG':<15} {'CTRL_PRE':<12} {'CTRL_POST':<12} {'Δ_CTRL':<10} "
            f"{'TEST_PRE':<12} {'TEST_POST':<12} {'Δ_TEST':<10} {'DID':<10} {'LIFT%':<8}",
            "-" * 130,
        ]

        for row in summary_rows:
            metric = str(row.get("metricKey") or row.get("metric", ""))[:34]
            agg = str(row.get("agg") or row.get("agg_func", ""))[:14]
            ctrl_pre = _fmt(row.get("controlPre") or row.get("control_pre"))
            ctrl_post = _fmt(row.get("controlPost") or row.get("control_post"))
            d_ctrl = _fmt(row.get("deltaControl") or row.get("control_delta"))
            test_pre = _fmt(row.get("testPre") or row.get("test_pre"))
            test_post = _fmt(row.get("testPost") or row.get("test_post"))
            d_test = _fmt(row.get("deltaTest") or row.get("test_delta"))
            did = _fmt(row.get("did") or row.get("diff_in_diff"))
            lift = _fmt(row.get("liftPct") or row.get("diff_in_diff_pct"))
            table_lines.append(
                f"{metric:<35} {agg:<15} {ctrl_pre:<12} {ctrl_post:<12} {d_ctrl:<10} "
                f"{test_pre:<12} {test_post:<12} {d_test:<10} {did:<10} {lift:<8}"
            )

        table_text = "\n".join(table_lines)

        prompt = (
            f"Please explain this experiment result:\n\n{table_text}\n\n"
            "Structure your response as:\n"
            "<narrative>3-5 paragraphs</narrative>\n"
            "<key_findings>- bullet 1\n- bullet 2\n...</key_findings>\n"
            "<concerns>- concern 1\n- concern 2\n...</concerns>\n"
            "<recommended_next_metrics>- metric 1\n- metric 2\n...</recommended_next_metrics>"
        )

        try:
            response = client.chat.completions.create(
                model=self.model,
                max_tokens=2048,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
            )
            text = response.choices[0].message.content
        except Exception as e:
            return NarrativeResult(
                narrative=f"Explanation failed: {e}",
                key_findings=[],
                concerns=[],
                recommended_next_metrics=[],
            )

        narrative = _extract_tagged(text, "narrative") or text
        key_findings = _parse_bullets(_extract_tagged(text, "key_findings"))
        concerns = _parse_bullets(_extract_tagged(text, "concerns"))
        next_metrics = _parse_bullets(_extract_tagged(text, "recommended_next_metrics"))

        return NarrativeResult(
            narrative=narrative,
            key_findings=key_findings,
            concerns=concerns,
            recommended_next_metrics=next_metrics,
        )


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _fmt(v: Any) -> str:
    if v is None:
        return "N/A"
    if isinstance(v, float):
        return f"{v:.3f}"
    return str(v)


def _parse_bullets(text: str) -> list[str]:
    if not text:
        return []
    return [l.strip().lstrip("- •*") for l in text.splitlines() if l.strip()]


def _infer_parameters(code: str) -> list[dict]:
    """Extract params.get() calls from generated code to infer parameter spec."""
    params = []
    seen = set()
    for m in re.finditer(r"params\.get\(['\"](\w+)['\"],\s*['\"]?([^'\")\s]*)['\"]?\)", code):
        name = m.group(1)
        default = m.group(2)
        if name in seen:
            continue
        seen.add(name)
        # Guess type
        if "date" in name.lower() or re.match(r"^\d{8}$", default):
            ptype = "date"
        elif default.replace(".", "").isdigit():
            ptype = "number"
        else:
            ptype = "string"
        params.append({"name": name, "type": ptype, "default": default, "label": name.replace("_", " ").title()})
    return params


def _infer_output_columns(code: str) -> list[str]:
    """Extract column aliases from SELECT ... AS col_name patterns."""
    cols = []
    for m in re.finditer(r"\bAS\s+(\w+)", code, re.IGNORECASE):
        col = m.group(1).lower()
        if col not in ("captain_id", "yyyymmdd", "date"):
            cols.append(col)
    return list(dict.fromkeys(cols))  # deduplicate preserving order
