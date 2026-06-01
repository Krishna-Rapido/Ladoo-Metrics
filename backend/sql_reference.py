"""
SQL Reference for Researcher Agent

Static SQL reference material embedded in the researcher agent's system prompt
to prevent common query errors (wrong column names, type mismatches, missing GROUP BY).
"""

# ---------------------------------------------------------------------------
# Layer 1: Per-table column reference — exact city/date columns and types
# ---------------------------------------------------------------------------

TABLE_COLUMN_REFERENCE = """
=== TABLE COLUMN REFERENCE (use this before writing any WHERE clause) ===

| Table                                              | City Column  | City Filter Pattern             | Date Column  | Date Type | Date Filter Pattern                                    | Captain ID Column |
|----------------------------------------------------|-------------|--------------------------------|-------------|-----------|-------------------------------------------------------|-------------------|
| metrics.captain_base_metrics_enriched              | city        | lower(city) = 'bangalore'      | yyyymmdd    | VARCHAR   | yyyymmdd BETWEEN '20260301' AND '20260331'            | captain_id        |
| mne.ms_1842554619_2584218394                       | geo_city    | lower(geo_city) = 'bangalore'  | time_value  | DATE      | replace(substr(cast(time_value as varchar),1,10),'-','') BETWEEN '20260301' AND '20260331' | captain_id |
| reports_internal.marketplace_dapr_twenty_pings_combined_v7_v8 | city_name | lower(city_name) = 'bangalore' | yyyymmdd | VARCHAR | yyyymmdd BETWEEN '20260301' AND '20260331'            | captain_id        |
| datasets.captain_svo_daily_kpi                     | city        | lower(city) = 'bangalore'      | yyyymmdd    | VARCHAR   | yyyymmdd BETWEEN '20260301' AND '20260331'            | captainid (no underscore!) |
| datasets.captain_supply_journey_summary            | (none)      | (no city column — filter via join) | registration_date | DATE | substr(replace(registration_date,'-',''),1,8) >= '20260301' | captain_id |
| experiments.fe2net_dashboard_lite                   | city        | lower(city) = 'bangalore'      | time_value  | VARCHAR   | time_value BETWEEN '20260301' AND '20260331'          | (aggregated, no captain_id) |
| iceberg.experiments_internal.iceberg_experiment_v6_root | (none) | (filter by experiment_id)      | (none)      | (none)    | (filter by experiment_id)                              | json_extract_scalar(...) |

CRITICAL RULES:
- captain_base_metrics_enriched uses `city`, NOT `geo_city`
- mne.ms_1842554619_2584218394 uses `geo_city` and `time_value` is DATE type (not VARCHAR)
- captain_svo_daily_kpi uses `captainid` (no underscore), NOT `captain_id`
- Always use lower() when filtering city columns
"""

# ---------------------------------------------------------------------------
# Layer 2: Working SQL examples (extracted from researcher.py and funnel.py)
# ---------------------------------------------------------------------------

SQL_EXAMPLES = """
=== WORKING SQL EXAMPLES (use these as templates) ===

-- Example 1: Count active captains per day (captain_base_metrics_enriched)
-- Note: city column is `city`, date is `yyyymmdd` VARCHAR
SELECT
    yyyymmdd,
    COUNT(DISTINCT captain_id) AS active_captains
FROM metrics.captain_base_metrics_enriched
WHERE lower(city) = 'bangalore'
  AND yyyymmdd BETWEEN '20260301' AND '20260331'
  AND sum_captain_total_lh_daily_city > 0
GROUP BY yyyymmdd
ORDER BY yyyymmdd

-- Example 2: Captain-level aggregation with derived metrics (EPH, acceptance rate)
SELECT
    captain_id,
    COUNT(*) AS active_days,
    AVG(COALESCE(count_captain_net_rides_taxi_all_day_city, 0)) AS avg_daily_rides,
    AVG(COALESCE(sum_captain_total_lh_daily_city, 0)) AS avg_daily_lh,
    CASE WHEN SUM(sum_captain_total_lh_daily_city) > 0
         THEN SUM(sum_captain_final_captain_earnings_daily_city) / SUM(sum_captain_total_lh_daily_city)
         ELSE NULL END AS earnings_per_hour,
    CASE WHEN SUM(count_captain_gross_pings_taxi_all_day_city) > 0
         THEN CAST(SUM(count_captain_accepted_pings_taxi_all_day_city) AS DOUBLE)
              / SUM(count_captain_gross_pings_taxi_all_day_city)
         ELSE NULL END AS acceptance_rate
FROM metrics.captain_base_metrics_enriched
WHERE lower(city) = 'bangalore'
  AND yyyymmdd BETWEEN '20260301' AND '20260331'
  AND sum_captain_total_lh_daily_city > 0
GROUP BY captain_id
HAVING COUNT(*) >= 3

-- Example 3: Segment lookup from mne table (DATE type handling for time_value)
-- CRITICAL: time_value is DATE, must cast to varchar for YYYYMMDD comparison
SELECT
    captain_id,
    CASE
        WHEN count_net_days_last_28_days >= 15 THEN 'daily'
        WHEN count_net_days_last_28_days BETWEEN 1 AND 14
             AND count_net_weeks_last_28_days >= 3 THEN 'weekly'
        WHEN count_net_days_last_28_days BETWEEN 1 AND 14
             AND count_net_weeks_last_28_days < 3 THEN 'monthly'
        ELSE 'rest'
    END AS consistency_segment,
    CASE
        WHEN count_total_rides_last_28_days / 28.0 > 15 THEN 'UHP'
        WHEN count_total_rides_last_28_days / 28.0 > 10 THEN 'HP'
        WHEN count_total_rides_last_28_days / 28.0 > 5 THEN 'MP'
        WHEN count_total_rides_last_28_days / 28.0 > 0 THEN 'LP'
        ELSE 'ZP'
    END AS performance_segment
FROM mne.ms_1842554619_2584218394
WHERE time_level = 'daily'
  AND lower(geo_city) = 'bangalore'
  AND replace(substr(cast(time_value as varchar), 1, 10), '-', '') BETWEEN '20260301' AND '20260331'

-- Example 4: Join captain_base_metrics with DAPR data
-- Note: base_metrics uses `city`, DAPR uses `city_name`
SELECT
    b.captain_id,
    b.yyyymmdd,
    AVG(b.count_captain_net_rides_taxi_all_day_city) AS avg_rides,
    AVG(d.dapr) AS avg_dapr
FROM metrics.captain_base_metrics_enriched b
JOIN reports_internal.marketplace_dapr_twenty_pings_combined_v7_v8 d
  ON b.captain_id = d.captain_id AND b.yyyymmdd = d.yyyymmdd
WHERE lower(b.city) = 'bangalore'
  AND b.yyyymmdd BETWEEN '20260301' AND '20260331'
GROUP BY b.captain_id, b.yyyymmdd

-- Example 5: Join with SVO daily KPI (note: captainid without underscore!)
SELECT
    b.captain_id,
    b.yyyymmdd,
    b.count_captain_net_rides_taxi_all_day_city AS net_rides,
    s.net_orders,
    s.accepted_pings
FROM metrics.captain_base_metrics_enriched b
JOIN datasets.captain_svo_daily_kpi s
  ON b.captain_id = s.captainid AND b.yyyymmdd = s.yyyymmdd
WHERE lower(b.city) = 'bangalore'
  AND b.yyyymmdd BETWEEN '20260301' AND '20260331'

-- Example 6: FE2Net funnel data (city-level aggregated, no captain_id)
SELECT
    time_value,
    city,
    service,
    login_hours,
    net_orders,
    online_captains,
    fe2net,
    dapr
FROM experiments.fe2net_dashboard_lite
WHERE lower(city) = 'bangalore'
  AND time_level = 'daily'
  AND time_value BETWEEN '20260301' AND '20260331'
ORDER BY time_value

-- Example 7: Experiment cohort extraction from iceberg
SELECT
    json_extract_scalar(attributes, '$.' || replace(experiment_split_attribute, '$payload.', '')) AS captain_id,
    cohort
FROM iceberg.experiments_internal.iceberg_experiment_v6_root
WHERE experiment_id = '<experiment-uuid-here>'
"""

# ---------------------------------------------------------------------------
# Layer 3: Anti-patterns — the exact errors the LLM keeps making
# ---------------------------------------------------------------------------

SQL_ANTI_PATTERNS = """
=== SQL ANTI-PATTERNS (avoid these exact mistakes) ===

MISTAKE 1: Using `geo_city` on captain_base_metrics_enriched
  WRONG: SELECT * FROM metrics.captain_base_metrics_enriched WHERE geo_city = 'bangalore'
  RIGHT: SELECT * FROM metrics.captain_base_metrics_enriched WHERE lower(city) = 'bangalore'
  WHY:   captain_base_metrics_enriched has a column named `city`, not `geo_city`.
         Only mne.ms_1842554619_2584218394 uses `geo_city`.

MISTAKE 2: Comparing DATE column with VARCHAR using <= or >= directly
  WRONG: SELECT * FROM mne.ms_1842554619_2584218394 WHERE time_value >= '20260301'
  RIGHT: SELECT * FROM mne.ms_1842554619_2584218394 WHERE replace(substr(cast(time_value as varchar), 1, 10), '-', '') >= '20260301'
  WHY:   `time_value` in the mne table is DATE type (e.g., 2026-03-01), not VARCHAR.
         You cannot compare DATE with a YYYYMMDD string directly. Cast to varchar first,
         then strip dashes to get YYYYMMDD format for comparison.

MISTAKE 3: Missing GROUP BY for non-aggregated columns
  WRONG: SELECT yyyymmdd, captain_id, COUNT(*) FROM metrics.captain_base_metrics_enriched WHERE lower(city) = 'bangalore' GROUP BY yyyymmdd
  RIGHT: SELECT yyyymmdd, captain_id, COUNT(*) FROM metrics.captain_base_metrics_enriched WHERE lower(city) = 'bangalore' GROUP BY yyyymmdd, captain_id
  WHY:   Every column in SELECT that is not inside an aggregate function (COUNT, SUM, AVG, etc.)
         MUST appear in the GROUP BY clause. Presto/Trino enforces this strictly.
"""

# ---------------------------------------------------------------------------
# Combined reference string for the system prompt
# ---------------------------------------------------------------------------

RESEARCHER_SQL_REFERENCE = f"""
{TABLE_COLUMN_REFERENCE}
{SQL_EXAMPLES}
{SQL_ANTI_PATTERNS}
"""
