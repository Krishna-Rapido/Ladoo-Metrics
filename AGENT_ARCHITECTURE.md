# Ladoo Metrics — Agentic Intelligence Layer

## Overview

This document specifies the architecture and implementation plan for the AI agent system that transforms Ladoo Metrics from a passive analysis tool into a **self-evolving problem discovery platform**.

The system adds four agents that any user can invoke:

| Agent | What it does | Who uses it |
|---|---|---|
| **MetricGen** | Describe a metric in plain English → get a validated Presto function | Analysts, PMs |
| **MetricSuggest** | Given your experiment context, suggest metrics you haven't looked at | Analysts |
| **ProblemDiscovery** | Proactively scan for anomalies across segments, cities, and metrics | Ops, PMs |
| **NarrativeExplainer** | Explain the Executive Summary table in plain English | PMs, leadership |

---

## The Core Idea: LLM as Presto Query Author

Every agent ultimately does one thing: it uses GPT-4o (via the OpenAI API) to write a `compute_metrics()` function, then pipes it through the existing `function_executor.py` sandbox. The agent system is not separate infrastructure — it is a prompt-driven front-end to the function system that already exists.

```
User describes a metric
        ↓
MetricGen Agent (LLM with Presto schema context)
        ↓
Generated compute_metrics() code
        ↓
function_executor.py (existing sandbox + validation)
        ↓
captain_id × yyyymmdd DataFrame
        ↓
Insights / Discover / Discovery Report
```

This means:
- Zero new data pipelines
- Security model (sandboxing, allowlists) already in place
- Generated metrics are immediately usable everywhere in the platform
- Every generated function can be saved to the metric catalog

---

## Presto Schema Context (The LLM's World Model)

This is the full schema that gets embedded in every agent prompt. It is the key to quality output.

### Table: `metrics.captain_base_metrics_enriched`
The primary daily activity table. One row per captain per day per city.

```
Columns:
  captain_id          VARCHAR   - Unique captain identifier
  yyyymmdd            VARCHAR   - Date in YYYYMMDD format
  geo_city            VARCHAR   - City name (lowercase, e.g. 'bangalore')

  -- Online presence
  count_captain_num_online_daily_city           BIGINT  - Online events (all day)
  count_num_online_morning_peak_daily_city      BIGINT  - Online events (morning peak)
  count_num_online_afternoon_daily_city         BIGINT  - Online events (afternoon)
  count_num_online_evening_peak_daily_city      BIGINT  - Online events (evening peak)
  count_num_online_rest_midnight_daily_city     BIGINT  - Online events (night/rest)

  -- Net rides by service
  count_captain_net_rides_taxi_all_day_city     BIGINT  - Net taxi rides
  count_captain_c2c_orders_all_day_city         BIGINT  - C2C orders
  count_captain_delivery_orders_all_day_city    BIGINT  - Delivery orders

  -- Pings (demand signals)
  count_captain_gross_pings_taxi_all_day_city   BIGINT  - Gross taxi pings received
  count_captain_accepted_pings_taxi_all_day_city BIGINT - Taxi pings accepted
  count_captain_gross_pings_delivery_all_day_city BIGINT - Gross delivery pings
  count_captain_accepted_pings_delivery_all_day_city BIGINT - Delivery pings accepted
  count_captain_gross_pings_link_all_day_city   BIGINT  - Link pings

  -- Long-haul (earning time)
  sum_captain_total_lh_daily_city               DOUBLE  - Total login hours
  sum_captain_idle_lh_daily_city                DOUBLE  - Idle login hours (no ride)
  sum_captain_total_lh_morning_peak_daily_city  DOUBLE  - Login hours morning peak
  sum_captain_total_lh_afternoon_daily_city     DOUBLE  - Login hours afternoon
  sum_captain_total_lh_evening_peak_daily_city  DOUBLE  - Login hours evening peak

  -- All metrics also available for TOD: morning_peak, afternoon, evening_peak, rest_midnight
  -- Pattern: count_captain_net_rides_taxi_morning_peak_daily_city etc.
```

### Table: `datasets.captain_svo_daily_kpi`
Ride-level daily KPIs per captain.

```
Columns:
  captainid           VARCHAR   - Captain identifier (note: captainid not captain_id)
  yyyymmdd            VARCHAR   - Date
  city                VARCHAR   - City
  net_orders          BIGINT    - Net completed orders
  accepted_pings      BIGINT    - Accepted pings
  riderrejected_pings BIGINT    - Captain-rejected pings
  riderbusy_pings     BIGINT    - Captain-busy pings
  service_name        VARCHAR   - Service type
```

### Table: `reports_internal.marketplace_dapr_twenty_pings_combined_v7_v8`
DAPR (Driver Acceptance Rate) data. One row per captain per day.

```
Columns:
  captain_id          VARCHAR
  yyyymmdd            VARCHAR
  city_name           VARCHAR   - City (may differ from geo_city format)
  dapr                DOUBLE    - Driver acceptance rate (0.0–1.0)
  accepted_pings      BIGINT
  service_category    VARCHAR   - auto, bike_taxi, cab, etc.
```

### Table: `iceberg.experiments_internal.iceberg_experiment_v6_root`
Experiment assignment data. One row per captain per experiment.

```
Columns:
  experiment_id       VARCHAR   - UUID of experiment
  captain_id          VARCHAR   - (extracted from JSON attributes)
  cohort              VARCHAR   - 'test' or 'control'
  attributes          VARCHAR   - JSON blob, captain_id at '$payload.captain_id'
  experiment_split_attribute VARCHAR - Path to extract captain_id

NOTE: Extract captain_id with:
  json_extract_scalar(attributes, '$.' || replace(experiment_split_attribute, '$payload.', ''))
```

### Table: `datasets.captain_supply_journey_summary`
Captain onboarding and registration data.

```
Columns:
  captain_id          VARCHAR
  mobile_number       VARCHAR
  registration_date   DATE
  city                VARCHAR
  service_category    VARCHAR
```

### Table: `experiments.fe2net_dashboard_lite`
Frontend-to-net funnel metrics (high-level supply-demand matching).

```
Columns:
  city, time_level, time_value, geo_level, geo_value, service
  login_hours, fe_sessions, gross_session, fe2rr, fe2net, gsr2net
  gross_orders, mapped_orders, net_orders
  online_captains, gross_captains, net_captains
  idle_hours, rph, dapr, apr, dpr
  avg_shown_eta, avg_actual_eta
  ocara_percent, stockout_percent
  rider_busy_percent, rider_reject_percent
```

### Table: `mne.ms_1842554619_2584218394`
Captain consistency and performance segmentation (last 28/83 days window).

```
Columns:
  captain_id
  geo_city
  time_value                          - Date
  time_level                          - 'daily'/'weekly'/'monthly'
  count_net_days_last_28_days         - Net active days in last 28 days
  count_net_weeks_last_28_days        - Net active weeks in last 28 days
  captain_net_days_last_83_days       - Net active days in last 83 days
  count_total_rides_last_28_days      - Total rides in last 28 days

Consistency segment derived as:
  daily    → count_net_days_last_28_days >= 15
  weekly   → days 1-14 AND count_net_weeks_last_28_days >= 3
  monthly  → days 1-14 AND weeks < 3
  quarterly → days = 0 in 28d but > 0 in 83d
  rest     → days = 0 in both windows

Performance segment derived as:
  rides_per_day = count_total_rides_last_28_days / 28.0
  UHP  → > 15 rides/day
  HP   → > 10
  MP   → > 5
  LP   → > 0
  ZP   → = 0
```

### Derived Metrics to Know

```
net_days = COUNT(DISTINCT yyyymmdd WHERE net_rides > 0)
online_days = COUNT(DISTINCT yyyymmdd WHERE online_events > 0)
gross_days = COUNT(DISTINCT yyyymmdd WHERE gross_pings > 0)
accepted_days = COUNT(DISTINCT yyyymmdd WHERE accepted_pings > 0)
ao_days = COUNT(DISTINCT yyyymmdd WHERE online_events > 0 AND gross_pings > 0)

dapr = accepted_pings / gross_pings (from DAPR table — pre-computed)
idle_fraction = idle_lh / total_lh
engagement_rate = net_days / online_days
acceptance_rate = accepted_pings / gross_pings
```

---

## Agent 1: MetricGen

### What it does
Takes a plain-English description like:
> "Measure how many captains had more than 5 net rides in the morning peak but zero rides in the evening peak"

And returns a validated, tested `compute_metrics()` function that can immediately be used in Insights or saved to the catalog.

### API Endpoint

```
POST /ai/generate-metric
{
  "description": str,          // plain English metric description
  "context": str,              // optional: existing session columns, experiment type
  "parameters": [...],         // optional: override default params
  "username": str,
  "test_immediately": bool     // if true, run a preview against Presto
}

Response:
{
  "code": str,                 // generated compute_metrics() function
  "parameters": [...],         // extracted parameters
  "output_columns": [...],     // predicted output columns
  "explanation": str,          // what the metric captures and why
  "preview": [...],            // if test_immediately=true
  "confidence": "high"|"medium"|"low",
  "alternatives": [...]        // 2-3 variant metrics to consider
}
```

### System Prompt Architecture

```python
METRIC_GEN_SYSTEM_PROMPT = """
You are an expert data analyst at Rapido who writes Presto SQL queries
to measure captain behavior. You have deep knowledge of the data schema.

FUNCTION CONTRACT:
- You must produce a Python function named `compute_metrics(params)`
- It must return a pandas DataFrame with columns: captain_id, yyyymmdd, [your metrics]
- No duplicate (captain_id, yyyymmdd) combinations
- Use the `run_query(sql)` helper to execute Presto SQL
- Available imports: pandas (pd), numpy (np), datetime

SECURITY: Do NOT use: os, sys, subprocess, eval, exec, open, __import__

PRESTO SCHEMA:
{FULL_SCHEMA_CONTEXT}

EXISTING SAVED FUNCTIONS IN CATALOG:
{FUNCTION_CATALOG_CONTEXT}

BEHAVIORAL VOCABULARY:
- A captain is "active" on a day if they have net_rides > 0 (net_days)
- A captain is "online" if count_captain_num_online_daily_city > 0
- A captain is "pinged" if gross_pings > 0 (gross_days)
- DAPR = accepted_pings / gross_pings (pre-computed in DAPR table)
- Consistency segments: daily (>=15 net days/28), weekly (1-14, >=3 weeks),
  monthly (1-14, <3 weeks), quarterly (0 in 28d, >0 in 83d), rest
- Performance segments: UHP/HP/MP/LP/ZP based on rides/day

When generating SQL:
1. Always filter by yyyymmdd BETWEEN params['start_date'] AND params['end_date']
2. Always include city filter when relevant
3. Group by captain_id and yyyymmdd for captain-day level
4. Use aggregation tables for efficiency (captain_base_metrics_enriched)
5. Validate input parameters at the start of the function

Output format:
```python
def compute_metrics(params):
    # [explanation of what this measures]
    ...
```
"""
```

### Implementation: `backend/ai_agent.py`

```python
class MetricGenAgent:
    def __init__(self):
        self.model = "gpt-4o"

    def generate(
        self,
        description: str,
        context: str = "",
        username: str = "",
        function_catalog: list[dict] = [],
        test_immediately: bool = False,
    ) -> MetricGenResult:
        client = get_openai_client()
        prompt = self._build_prompt(description, context, function_catalog)

        response = client.chat.completions.create(
            model=self.model,
            max_tokens=4096,
            messages=[
                {"role": "system", "content": METRIC_GEN_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ]
        )

        code = self._extract_code(response.content[0].text)
        explanation = self._extract_explanation(response.content[0].text)
        alternatives = self._extract_alternatives(response.content[0].text)

        # Validate security immediately
        from function_executor import validate_code_security
        error = validate_code_security(code)
        if error:
            return MetricGenResult(success=False, error=error)

        # Optionally test against Presto
        preview = None
        if test_immediately and username:
            from function_executor import test_function
            default_params = self._extract_parameters(code)
            result = test_function(code, default_params, username)
            preview = result.get("preview")

        return MetricGenResult(
            success=True,
            code=code,
            explanation=explanation,
            alternatives=alternatives,
            preview=preview,
        )
```

---

## Agent 2: MetricSuggest

### What it does
Given the columns in your current session and the experiment you're analyzing, suggests 5-10 additional metrics worth measuring — including ones no one has thought to look at.

This is the "creative metrics" engine. It knows:
- What columns exist in the current dataset
- What experiment type is running (acquisition, retention, quality, etc.)
- What metrics other analysts used in similar experiments
- The behavioral vocabulary of captain lifecycle

### Example suggestions it might generate

For a **retention experiment**:
- "Morning peak adherence rate: % of captains who were online during morning peak in pre-period who maintained that behavior in post-period"
- "Ping acceptance degradation: change in acceptance rate specifically on high-surge days"
- "Sunday utilization: ratio of Sunday net_days to weekday net_days — measures whether the experiment changed weekend behavior"

For an **incentive experiment**:
- "Incentive elasticity proxy: correlation between days online and net_rides (did captains work more hours without more rides, or did efficiency increase?)"
- "Night shift concentration: % of total rides happening after 9pm — incentives often shift TOD patterns"

### API Endpoint

```
POST /ai/suggest-metrics
{
  "session_columns": [...],    // current CSV columns
  "selected_metrics": [...],   // what analyst already picked
  "experiment_type": str,      // inferred or user-specified
  "cohort_sizes": {...},       // test/control N
  "date_range_days": int,      // length of pre/post periods
  "username": str
}

Response:
{
  "suggestions": [
    {
      "metric_key": str,
      "label": str,
      "description": str,          // plain English
      "why": str,                  // why this is relevant to this experiment
      "source": "existing_column" | "ratio" | "generate_function",
      "column": str,               // if existing_column
      "ratio": {...},              // if ratio
      "function_hint": str,        // if generate_function — description for MetricGen
      "priority": "high"|"medium"|"low"
    }
  ],
  "behavioral_hypothesis": str     // what behavioral change this experiment likely targets
}
```

---

## Agent 3: ProblemDiscovery

### What it does
Autonomously scans for anomalies across the captain ecosystem. Runs on:
- **On-demand**: User clicks "Scan for Issues" in the Discover tab
- **Scheduled**: Daily background job at 7am

It runs a battery of behavioral metrics across segment × city combinations, applies statistical anomaly detection, and generates a ranked list of "things worth investigating."

### The Discovery Battery

The agent runs these checks across every (city, service, segment) combination:

```python
DISCOVERY_CHECKS = [
    # Segment health checks
    "daily_captain_count_trend",          # Is the daily cohort growing or shrinking?
    "weekly_to_rest_churn_rate",          # Are weekly captains dropping to rest?
    "segment_concentration_shift",        # Is the distribution shifting (daily% vs weekly%)?

    # Engagement quality checks
    "ping_acceptance_rate_trend",         # DAPR trend — supply quality signal
    "idle_fraction_trend",                # Are captains online but not getting rides?
    "morning_peak_dropout_rate",          # Captains who stop showing up for morning peak

    # Earnings signal checks
    "rides_per_online_day_trend",         # Earnings efficiency
    "gross_pings_per_net_ride_trend",     # Supply-demand mismatch signal

    # Cross-segment anomalies
    "uhp_to_hp_migration",               # Are top captains degrading?
    "new_daily_captain_activation_rate", # Are new captains reaching daily status?
    "quarterly_reactivation_spike",      # Sudden re-activation of dormant captains
]
```

### Anomaly Detection Logic

For each check, run a time-series and apply:
1. **Z-score** on last 7 days vs 28-day baseline: `z = (recent_mean - baseline_mean) / baseline_std`
2. **Trend break detection**: linear regression slope change
3. **Threshold rules**: hard-coded known-bad values (e.g., DAPR < 0.3 for a segment)

Severity scoring:
- `|z| > 3` → Critical
- `|z| > 2` → Warning
- `|z| > 1.5` → Notice

### API Endpoint

```
POST /ai/discover-problems
{
  "username": str,
  "city": str,                 // optional filter
  "service_category": str,     // optional filter
  "lookback_days": int,        // default 35 (5 weeks for context)
  "check_types": [...],        // subset of DISCOVERY_CHECKS, or "all"
}

Response:
{
  "findings": [
    {
      "id": str,
      "title": str,                    // "Daily captain churn in Bangalore spiked 2.3σ above baseline"
      "severity": "critical"|"warning"|"notice",
      "segment": str,                  // "daily captains, auto, bangalore"
      "metric": str,                   // what was measured
      "finding": str,                  // plain English: what changed, by how much
      "hypothesis": str,               // what might be causing it
      "suggested_action": str,         // what to investigate next
      "data": {...},                   // time series data for chart
      "z_score": float,
      "baseline": float,
      "recent": float,
      "pct_change": float
    }
  ],
  "scan_timestamp": str,
  "captains_scanned": int,
  "checks_run": int,
  "narrative": str             // LLM-generated paragraph summarizing the top 3 findings
}
```

### Persistence in Supabase

Findings are stored in a new `ai_discoveries` table so any user can see the historical scan results:

```sql
CREATE TABLE ai_discoveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    triggered_by UUID REFERENCES auth.users(id),
    city TEXT,
    service_category TEXT,
    findings JSONB NOT NULL,    -- full findings array
    narrative TEXT,
    checks_run INTEGER,
    captains_scanned INTEGER,
    is_scheduled BOOLEAN DEFAULT false
);
```

---

## Agent 4: NarrativeExplainer

### What it does
Takes the Executive Summary diff-in-diff table and produces a plain-English narrative:

> "This experiment improved captain net days by 0.26/captain/week (a 5.4% lift vs control), which is statistically meaningful given 742 test captains. However, accepted_orders improved while gross_pings declined — suggesting captains are being more selective rather than working more. The improvement in DAPR (+2.17%) supports this. Key concern: the improvement in accepted_orders is driven entirely by accepted_pings, not by more online days. If the experiment creates DAPR improvement by reducing captain supply at bad hours, that may hurt marketplace health."

### API Endpoint

```
POST /ai/explain-insights
{
  "summary_rows": [...],       // ExecutiveRow[] from the insights table
  "experiment_context": {
    "experiment_id": str,
    "test_cohort_size": int,
    "control_cohort_size": int,
    "pre_days": int,
    "post_days": int,
    "city": str,
    "service": str,
  },
  "username": str
}

Response:
{
  "narrative": str,            // 3-5 paragraph plain English explanation
  "key_findings": [...],       // 3-5 bullet points
  "concerns": [...],           // flags: sample ratio mismatch, pre-period divergence, etc.
  "recommended_next_metrics": [...] // what to look at next
}
```

---

## Implementation Plan

### Step 1: Backend — `backend/ai_agent.py`

New module with:
- `PRESTO_SCHEMA_CONTEXT` constant — full schema as string
- `MetricGenAgent` class
- `MetricSuggestAgent` class
- `ProblemDiscoveryAgent` class
- `NarrativeExplainerAgent` class
- `build_function_catalog_context(functions: list[dict]) -> str` — formats saved functions for prompt context

### Step 2: Backend — New routes in `main.py`

```python
@app.post("/ai/generate-metric")
async def ai_generate_metric(req: AIGenerateMetricRequest) -> AIGenerateMetricResponse

@app.post("/ai/suggest-metrics")
async def ai_suggest_metrics(req: AISuggestMetricsRequest) -> AISuggestMetricsResponse

@app.post("/ai/discover-problems")
async def ai_discover_problems(req: AIDiscoverProblemsRequest) -> AIDiscoverProblemsResponse

@app.post("/ai/explain-insights")
async def ai_explain_insights(req: AIExplainInsightsRequest) -> AIExplainInsightsResponse
```

### Step 3: Backend — `backend/schemas.py` additions

New Pydantic models for all AI request/response types.

### Step 4: Backend — `requirements.txt` addition

```
openai>=1.0.0
apscheduler>=3.10.0     # for scheduled discovery scans
```

### Step 5: Environment variable

```
OPENAI_API_KEY=sk-...
```

### Step 6: Supabase — new tables

New SQL migration for:
- `ai_discoveries` table (stores discovery scan results)
- `ai_generated_metrics` table (tracks which functions were AI-generated, their usage, accuracy)

### Step 7: Frontend — New components

1. **`AIMetricGenerator.tsx`** — floating panel with text input "Describe the metric you want..."
   - Entry point: "✨ Generate with AI" button in FunctionEditor and InsightsConfigSidebar
   - Shows generated code + explanation + alternatives
   - One-click "Use this metric" to apply immediately or "Save to library"

2. **`AISuggestions.tsx`** — collapsible panel in InsightsConfigSidebar
   - Shows after cohort + dates are set
   - "Suggested metrics based on your experiment" section
   - Each suggestion has a "Add" button

3. **`DiscoveryFeed.tsx`** — new page or Discover tab
   - Shows latest scan findings ranked by severity
   - Each finding has a mini chart and a "Investigate" button that pre-loads context into Insights
   - "Run Scan Now" button

4. **`InsightsNarrative.tsx`** — panel below Executive Summary table
   - "✨ Explain this" button
   - Streams the narrative response
   - "Key concerns" badges (red flags auto-highlighted)

---

## The Full User Journey (Post-Implementation)

### PM flow (no SQL, no analyst needed):
1. PM opens Ladoo → clicks "Run Scan" → sees "Daily captain churn in Bangalore +2.3σ"
2. Clicks "Investigate" → pre-loaded Discover session
3. Types "measure captains who were active for 3+ weeks then went silent" → AI generates function
4. Runs analysis → Executive Summary auto-explained in plain English
5. Saves to report → shares link with ops team

### Analyst flow (supercharged):
1. Analyst pastes experiment UUID in Discover
2. AI suggests 8 additional metrics relevant to the experiment type
3. Analyst clicks "Add all high priority suggestions"
4. One analyst who is not there has AI explain why `accepted_orders` moved but `net_days` didn't
5. AI narrative flags: "pre-period imbalance in consistency_segment distribution"
6. Analyst fixes the analysis and saves a clean report

### Continuous health monitoring (no user needed):
1. Daily 7am scan runs across all cities × services
2. Findings stored in Supabase
3. Any user opening Discover sees the "3 new issues found today" banner
4. Critical findings can trigger Slack notifications (future)

---

## Metrics That No One Has Looked At (Starting List)

These are creative behavioral metrics the AI should be able to generate:

```
1. Captain circadian stability score
   — consistency of HOW MUCH a captain works across days (low variance = stable behavior)
   — metric: std(daily_net_rides) / mean(daily_net_rides) per captain per period

2. Ping fatigue index
   — captains who received many pings but converted few (high gross_pings, low accepted)
   — measures frustration signal: are captains getting low-quality pings?

3. Morning peak commitment rate
   — % of captains who showed up for morning peak in pre-period who continue in post
   — signals: does the intervention disturb established behavioral patterns?

4. Efficiency trajectory
   — slope of (net_rides / online_hours) over time per captain
   — positive slope = captain improving; negative = degrading; 0 = plateaued

5. Weekend-weekday ratio
   — (net_days on Sat+Sun) / (net_days on Mon-Fri) normalized
   — measures work-pattern flexibility; interventions often shift this

6. Churn propensity score
   — days_since_last_active / median_inter_session_gap per captain
   — early warning: captains whose gap is growing beyond their norm

7. Service switching rate
   — captains who took rides in both taxi and delivery in the period
   — interventions can accidentally shift captains between services

8. Supply concentration index (city-level)
   — what % of rides are done by the top 20% of captains by volume?
   — signals healthy/unhealthy supply distribution; experiments can worsen this

9. Acceptance window efficiency
   — accepted_pings / total_pings_in_30_second_window (if data available)
   — measures cognitive load: are captains accepting quickly or hesitating?

10. Reactivation quality
    — for captains returning from rest: how many net_rides in first 3 days back?
    — low = soft reactivation (they came back but didn't engage)
```

---

## File Changes Summary

### New files:
- `backend/ai_agent.py`
- `backend/ai_schemas.py` (AI-specific Pydantic models)
- `frontend/src/features/ai/AIMetricGenerator.tsx`
- `frontend/src/features/ai/AISuggestions.tsx`
- `frontend/src/features/ai/InsightsNarrative.tsx`
- `frontend/src/pages/DiscoveryPage.tsx`
- `supabase_ai_migration.sql`

### Modified files:
- `backend/requirements.txt` — add `anthropic>=0.40.0`, `apscheduler>=3.10.0`
- `backend/main.py` — add 4 new `/ai/*` routes
- `backend/schemas.py` — add AI request/response models
- `frontend/src/lib/api.ts` — add AI API client functions
- `frontend/src/App.tsx` — add `/discovery` route
- `frontend/src/components/nav/PrimarySidebar.tsx` — add Discovery nav item
- `frontend/src/features/insights/InsightsConfigSidebar.tsx` — add AISuggestions panel
- `frontend/src/components/FunctionEditor.tsx` — add "Generate with AI" button
