"""
Researcher — Captain Segment Discovery Lab

Core computation module for three discovery methods:
  1. Residual Analysis — finds captains unexplained by existing segments
  2. Contrast Analysis — exhaustive feature comparison between two groups
  3. Stimulus-Response Analysis — computes behavioral response profiles

Also implements the 6-gate validation pipeline.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from scipy import stats

logger = logging.getLogger(__name__)

from datetime import datetime, timedelta

# ---------------------------------------------------------------------------
# Presto connection (reuse from funnel.py)
# ---------------------------------------------------------------------------

def _get_presto_connection(username: str):
    # Centralized Trino/Presto connection (OAuth2). `username` = signed-in email.
    from presto_connection import get_trino_connection
    return get_trino_connection(username)


def _query_presto(username: str, sql: str) -> pd.DataFrame:
    """Execute SQL against Presto and return a DataFrame."""
    conn = _get_presto_connection(username)
    try:
        df = pd.read_sql(sql, conn)
        return df
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# SQL: Expanded Feature Set
# ---------------------------------------------------------------------------

EXPANDED_FEATURES_SQL = """
WITH base AS (
    SELECT
        captain_id,
        yyyymmdd,
        -- Core activity
        COALESCE(count_captain_net_rides_taxi_all_day_city, 0) AS net_rides,
        COALESCE(count_captain_c2c_orders_all_day_city, 0) AS c2c_orders,
        COALESCE(count_captain_delivery_orders_all_day_city, 0) AS delivery_orders,
        COALESCE(sum_captain_total_lh_daily_city, 0) AS total_lh,
        COALESCE(sum_captain_idle_lh_daily_city, 0) AS idle_lh,
        -- Pings
        COALESCE(count_captain_gross_pings_taxi_all_day_city, 0) AS gross_pings,
        COALESCE(count_captain_accepted_pings_taxi_all_day_city, 0) AS accepted_pings,
        -- Earnings
        COALESCE(sum_captain_final_captain_earnings_daily_city, 0) AS earnings,
        COALESCE(sum_captain_special_incentives_daily_city, 0) AS special_incentives,
        COALESCE(sum_captain_gmv_daily_city, 0) AS gmv,
        -- TOD login hours
        COALESCE(sum_captain_total_lh_morning_peak_daily_city, 0) AS lh_morning,
        COALESCE(sum_captain_total_lh_afternoon_daily_city, 0) AS lh_afternoon,
        COALESCE(sum_captain_total_lh_evening_peak_daily_city, 0) AS lh_evening
    FROM metrics.captain_base_metrics_enriched
    WHERE lower(city) = '{city}'
      AND yyyymmdd BETWEEN '{start_date}' AND '{end_date}'
      AND sum_captain_total_lh_daily_city > 0
),
captain_agg AS (
    SELECT
        captain_id,
        COUNT(*) AS active_days,
        -- Activity averages
        AVG(net_rides) AS avg_daily_rides,
        AVG(total_lh) AS avg_daily_lh,
        AVG(earnings) AS avg_daily_earnings,
        -- Variability (coefficient of variation)
        CASE WHEN AVG(net_rides) > 0
             THEN STDDEV(net_rides) / AVG(net_rides) ELSE NULL END AS rides_cv,
        CASE WHEN AVG(total_lh) > 0
             THEN STDDEV(total_lh) / AVG(total_lh) ELSE NULL END AS lh_cv,
        CASE WHEN AVG(earnings) > 0
             THEN STDDEV(earnings) / AVG(earnings) ELSE NULL END AS earnings_cv,
        -- Efficiency
        CASE WHEN SUM(total_lh) > 0
             THEN SUM(earnings) / SUM(total_lh) ELSE NULL END AS earnings_per_hour,
        CASE WHEN SUM(net_rides) > 0
             THEN SUM(earnings) / SUM(net_rides) ELSE NULL END AS earnings_per_ride,
        -- Idle fraction
        CASE WHEN SUM(total_lh) > 0
             THEN SUM(idle_lh) / SUM(total_lh) ELSE NULL END AS idle_fraction,
        -- Demand interaction
        CASE WHEN SUM(gross_pings) > 0
             THEN CAST(SUM(accepted_pings) AS DOUBLE) / SUM(gross_pings) ELSE NULL END AS acceptance_rate,
        CASE WHEN SUM(total_lh) > 0
             THEN CAST(SUM(gross_pings) AS DOUBLE) / SUM(total_lh) ELSE NULL END AS pings_per_lh,
        -- TOD distribution
        CASE WHEN SUM(total_lh) > 0
             THEN SUM(lh_morning) / SUM(total_lh) ELSE NULL END AS morning_share,
        CASE WHEN SUM(total_lh) > 0
             THEN SUM(lh_afternoon) / SUM(total_lh) ELSE NULL END AS afternoon_share,
        CASE WHEN SUM(total_lh) > 0
             THEN SUM(lh_evening) / SUM(total_lh) ELSE NULL END AS evening_share,
        -- Service mix
        CASE WHEN (SUM(net_rides) + SUM(c2c_orders) + SUM(delivery_orders)) > 0
             THEN CAST(SUM(net_rides) AS DOUBLE)
                  / (SUM(net_rides) + SUM(c2c_orders) + SUM(delivery_orders))
             ELSE NULL END AS taxi_share,
        CASE WHEN (SUM(net_rides) + SUM(c2c_orders) + SUM(delivery_orders)) > 0
             THEN CAST(SUM(delivery_orders) AS DOUBLE)
                  / (SUM(net_rides) + SUM(c2c_orders) + SUM(delivery_orders))
             ELSE NULL END AS delivery_share,
        -- Incentive dependency
        CASE WHEN SUM(earnings) > 0
             THEN SUM(special_incentives) / SUM(earnings) ELSE NULL END AS incentive_share,
        -- Active days ratio (out of total days in range)
        CAST(COUNT(*) AS DOUBLE) / {total_days} AS active_days_ratio
    FROM base
    GROUP BY captain_id
    HAVING COUNT(*) >= {min_days}
)
SELECT * FROM captain_agg
"""

# ---------------------------------------------------------------------------
# SQL: Segment membership lookup
# ---------------------------------------------------------------------------

SEGMENT_LOOKUP_SQL = """
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
  AND lower(city) = '{city}'
  AND replace(substr(time_value, 1, 10), '-', '') BETWEEN '{range_start}' AND '{end_date}'
"""


def _fetch_segments_safe(username: str, city: str, end_date: str) -> tuple[pd.DataFrame, str]:
    """Fetch segment membership, returning (DataFrame, executed_sql).

    Returns (empty_df, "") on failure so analysis can continue.
    Uses a 7-day lookback window ending at end_date so we don't miss data
    if the exact date isn't available.
    """
    try:
        d = datetime.strptime(end_date, "%Y%m%d")
        range_start = (d - timedelta(days=7)).strftime("%Y%m%d")
        sql = SEGMENT_LOOKUP_SQL.format(
            city=city.lower(),
            range_start=range_start,
            end_date=end_date,
        )
        seg_df = _query_presto(username, sql)
        if seg_df.empty:
            logger.warning("Segment lookup returned 0 rows for city=%s end_date=%s", city, end_date)
            return pd.DataFrame(), sql.strip()
        # If a captain appears on multiple dates, keep the latest row
        seg_df = seg_df.drop_duplicates(subset=["captain_id"], keep="last")
        return seg_df, sql.strip()
    except Exception:
        logger.exception("Segment lookup failed (non-fatal) — skipping segment filters")
        return pd.DataFrame(), ""


# =============================================================================
# Method 2: Contrast Analysis
# =============================================================================

def run_contrast_analysis(
    username: str,
    city: str,
    start_date: str,
    end_date: str,
    splitting_outcome: str,
    consistency_segment: Optional[str] = None,
    performance_segment: Optional[str] = None,
    custom_column: Optional[str] = None,
    custom_threshold: Optional[float] = None,
    custom_direction: str = "above",
    min_group_size: int = 50,
) -> Dict[str, Any]:
    """
    Run contrast analysis: compare expanded features between two groups
    defined by a splitting outcome.

    Returns dict with group sizes, feature comparisons ranked by effect size.
    """
    # Calculate total days in range
    d0 = datetime.strptime(start_date, "%Y%m%d")
    d1 = datetime.strptime(end_date, "%Y%m%d")
    total_days = max((d1 - d0).days, 1)

    executed_queries: list[str] = []

    # 1. Fetch expanded features
    features_sql = EXPANDED_FEATURES_SQL.format(
        city=city.lower(),
        start_date=start_date,
        end_date=end_date,
        total_days=total_days,
        min_days=3,
    )
    executed_queries.append(features_sql.strip())
    df = _query_presto(username, features_sql)
    if df.empty:
        return {"success": False, "error": "No data returned from Presto for the given filters.", "queries": executed_queries}

    # 2. Fetch segment info (best-effort) and join
    seg_df, seg_sql = _fetch_segments_safe(username, city, end_date)
    if seg_sql:
        executed_queries.append(seg_sql)
    if not seg_df.empty:
        df = df.merge(seg_df, on="captain_id", how="left")
    else:
        df["consistency_segment"] = None
        df["performance_segment"] = None

    # 3. Filter by base population (only if segment data was available)
    segment_filter_applied = False
    if consistency_segment and "consistency_segment" in df.columns and not seg_df.empty:
        df = df[df["consistency_segment"] == consistency_segment.lower()]
        segment_filter_applied = True
    if performance_segment and "performance_segment" in df.columns and not seg_df.empty:
        df = df[df["performance_segment"] == performance_segment.upper()]
        segment_filter_applied = True

    if len(df) < min_group_size * 2:
        extra = ""
        if (consistency_segment or performance_segment) and seg_df.empty:
            extra = " Segment lookup returned no data — try without segment filters."
        return {"success": False, "error": f"Base population too small ({len(df)} captains). Need at least {min_group_size * 2}.{extra}", "queries": executed_queries}

    # 4. Split into two groups based on outcome
    group_a_label, group_b_label = _split_groups(df, splitting_outcome, custom_column, custom_threshold, custom_direction)
    group_a = df[df["_group"] == "A"]
    group_b = df[df["_group"] == "B"]

    if len(group_a) < min_group_size or len(group_b) < min_group_size:
        return {
            "success": False,
            "error": f"Groups too small: {group_a_label}={len(group_a)}, {group_b_label}={len(group_b)}. Need at least {min_group_size} each.",
        }

    # 5. Compare all numeric features
    feature_cols = [
        c for c in df.select_dtypes(include=[np.number]).columns
        if c not in ("_group", "active_days")
    ]

    comparisons = _compare_features(group_a, group_b, feature_cols)

    # Sort by absolute effect size
    comparisons.sort(key=lambda x: abs(x["effect_size"]), reverse=True)
    top_features = [c["feature"] for c in comparisons[:10]]

    return {
        "success": True,
        "group_a_label": group_a_label,
        "group_b_label": group_b_label,
        "group_a_size": len(group_a),
        "group_b_size": len(group_b),
        "comparisons": comparisons,
        "top_features": top_features,
        "queries": executed_queries,
    }


def _split_groups(
    df: pd.DataFrame,
    splitting_outcome: str,
    custom_column: Optional[str],
    custom_threshold: Optional[float],
    custom_direction: str,
) -> Tuple[str, str]:
    """Add a '_group' column to df based on the splitting outcome. Returns (label_a, label_b)."""

    if splitting_outcome == "churn_28d":
        # Churn proxy: captains with very low active_days_ratio
        median_ratio = df["active_days_ratio"].median()
        threshold = median_ratio * 0.3  # Bottom 30% of median
        df["_group"] = np.where(df["active_days_ratio"] <= threshold, "A", "B")
        return ("Low Activity (Churning)", "Active (Retained)")

    elif splitting_outcome == "incentive_response":
        if "incentive_share" not in df.columns or df["incentive_share"].isna().all():
            # Fallback: split on earnings efficiency
            median_eph = df["earnings_per_hour"].median()
            df["_group"] = np.where(df["earnings_per_hour"] <= median_eph, "A", "B")
            return ("Low Efficiency", "High Efficiency")
        median_inc = df["incentive_share"].median()
        df["_group"] = np.where(df["incentive_share"] > median_inc, "A", "B")
        return ("High Incentive Dependency", "Low Incentive Dependency")

    elif splitting_outcome == "efficiency":
        median_eph = df["earnings_per_hour"].median()
        df["_group"] = np.where(df["earnings_per_hour"] <= median_eph, "A", "B")
        return ("Low Efficiency", "High Efficiency")

    elif splitting_outcome == "custom" and custom_column and custom_threshold is not None:
        if custom_column not in df.columns:
            raise ValueError(f"Column '{custom_column}' not found in data.")
        if custom_direction == "above":
            df["_group"] = np.where(df[custom_column] > custom_threshold, "A", "B")
            return (f"{custom_column} > {custom_threshold}", f"{custom_column} <= {custom_threshold}")
        else:
            df["_group"] = np.where(df[custom_column] < custom_threshold, "A", "B")
            return (f"{custom_column} < {custom_threshold}", f"{custom_column} >= {custom_threshold}")

    else:
        # Default: median split on rides
        median_rides = df["avg_daily_rides"].median()
        df["_group"] = np.where(df["avg_daily_rides"] <= median_rides, "A", "B")
        return ("Below Median Rides", "Above Median Rides")


def _compare_features(
    group_a: pd.DataFrame,
    group_b: pd.DataFrame,
    feature_cols: List[str],
) -> List[Dict[str, Any]]:
    """Compare feature distributions between two groups using Mann-Whitney U."""
    n_tests = len(feature_cols)
    bonferroni_alpha = 0.05 / max(n_tests, 1)
    results = []

    for col in feature_cols:
        a_vals = group_a[col].dropna()
        b_vals = group_b[col].dropna()

        if len(a_vals) < 5 or len(b_vals) < 5:
            continue

        a_mean = float(a_vals.mean())
        b_mean = float(b_vals.mean())

        # Mann-Whitney U test (non-parametric)
        try:
            stat, p_value = stats.mannwhitneyu(a_vals, b_vals, alternative="two-sided")
        except Exception:
            continue

        # Cohen's d effect size
        pooled_std = np.sqrt(
            ((len(a_vals) - 1) * a_vals.std() ** 2 + (len(b_vals) - 1) * b_vals.std() ** 2)
            / (len(a_vals) + len(b_vals) - 2)
        )
        effect_size = (a_mean - b_mean) / pooled_std if pooled_std > 0 else 0.0

        results.append({
            "feature": col,
            "group_a_mean": round(a_mean, 4),
            "group_b_mean": round(b_mean, 4),
            "effect_size": round(float(effect_size), 4),
            "p_value": round(float(p_value), 6),
            "test_used": "mann_whitney",
            "significant": p_value < bonferroni_alpha,
        })

    return results


# =============================================================================
# Method 3: Stimulus-Response Analysis
# =============================================================================

DAILY_DATA_SQL = """
SELECT
    captain_id,
    yyyymmdd,
    COALESCE(count_captain_net_rides_taxi_all_day_city, 0) AS net_rides,
    COALESCE(sum_captain_total_lh_daily_city, 0) AS total_lh,
    COALESCE(sum_captain_idle_lh_daily_city, 0) AS idle_lh,
    COALESCE(sum_captain_final_captain_earnings_daily_city, 0) AS earnings,
    COALESCE(sum_captain_special_incentives_daily_city, 0) AS special_incentives,
    COALESCE(count_captain_gross_pings_taxi_all_day_city, 0) AS gross_pings,
    COALESCE(count_captain_accepted_pings_taxi_all_day_city, 0) AS accepted_pings,
    COALESCE(count_captain_c2c_orders_all_day_city, 0) AS c2c_orders,
    COALESCE(count_captain_delivery_orders_all_day_city, 0) AS delivery_orders,
    COALESCE(sum_captain_total_lh_morning_peak_daily_city, 0) AS lh_morning,
    COALESCE(sum_captain_total_lh_afternoon_daily_city, 0) AS lh_afternoon,
    COALESCE(sum_captain_total_lh_evening_peak_daily_city, 0) AS lh_evening
FROM metrics.captain_base_metrics_enriched
WHERE lower(city) = '{city}'
  AND yyyymmdd BETWEEN '{start_date}' AND '{end_date}'
  AND sum_captain_total_lh_daily_city > 0
ORDER BY captain_id, yyyymmdd
"""


def compute_response_profiles(
    username: str,
    city: str,
    start_date: str,
    end_date: str,
    axes: List[str],
    consistency_segment: Optional[str] = None,
    performance_segment: Optional[str] = None,
    min_active_days: int = 14,
) -> Dict[str, Any]:
    """
    Compute per-captain response profiles along requested axes.
    Returns profiles list and axis-level summary stats.
    """
    executed_queries: list[str] = []

    # 1. Fetch daily captain data
    sql = DAILY_DATA_SQL.format(
        city=city.lower(),
        start_date=start_date,
        end_date=end_date,
    )
    executed_queries.append(sql.strip())
    df = _query_presto(username, sql)
    if df.empty:
        return {"success": False, "error": "No data returned from Presto.", "queries": executed_queries}

    # 2. Filter by segment if specified (best-effort)
    if consistency_segment or performance_segment:
        seg_df, seg_sql = _fetch_segments_safe(username, city, end_date)
        if seg_sql:
            executed_queries.append(seg_sql)
        if not seg_df.empty:
            if consistency_segment:
                valid_ids = set(seg_df[seg_df["consistency_segment"] == consistency_segment.lower()]["captain_id"])
                df = df[df["captain_id"].isin(valid_ids)]
            if performance_segment:
                valid_ids = set(seg_df[seg_df["performance_segment"] == performance_segment.upper()]["captain_id"])
                df = df[df["captain_id"].isin(valid_ids)]
        else:
            logger.warning("Segment filters requested but segment lookup returned no data — proceeding without filters")

    # 3. Filter captains with enough active days
    captain_days = df.groupby("captain_id").size()
    valid_captains = set(captain_days[captain_days >= min_active_days].index)
    df = df[df["captain_id"].isin(valid_captains)]

    if df.empty:
        return {"success": False, "error": f"No captains with >= {min_active_days} active days.", "queries": executed_queries}

    # 4. Compute each axis
    profiles: Dict[str, Dict[str, float]] = {}
    for cid in valid_captains:
        profiles[cid] = {"captain_id": cid}

    if "incentive_elasticity" in axes:
        _compute_incentive_elasticity(df, profiles)

    if "target_earning" in axes:
        _compute_target_earning(df, profiles)

    if "frustration_resilience" in axes:
        _compute_frustration_resilience(df, profiles)

    if "behavioral_inertia" in axes:
        _compute_behavioral_inertia(df, profiles)

    if "efficiency_trajectory" in axes:
        _compute_efficiency_trajectory(df, profiles)

    if "demand_supply_fit" in axes:
        _compute_demand_supply_fit(df, profiles)

    # 5. Build output
    profile_list = list(profiles.values())

    # Compute axis-level summary stats
    axis_stats = {}
    for axis in axes:
        vals = [p.get(axis) for p in profile_list if p.get(axis) is not None]
        if vals:
            arr = np.array(vals, dtype=float)
            axis_stats[axis] = {
                "mean": round(float(np.mean(arr)), 4),
                "median": round(float(np.median(arr)), 4),
                "std": round(float(np.std(arr)), 4),
                "min": round(float(np.min(arr)), 4),
                "max": round(float(np.max(arr)), 4),
                "count": len(vals),
            }

    return {
        "success": True,
        "captain_count": len(profile_list),
        "profiles": profile_list,
        "axis_stats": axis_stats,
        "queries": executed_queries,
    }


def _compute_incentive_elasticity(df: pd.DataFrame, profiles: Dict[str, Dict]):
    """Axis 1: How much do rides change with incentives?"""
    for cid, cdf in df.groupby("captain_id"):
        if cid not in profiles:
            continue
        inc_days = cdf[cdf["special_incentives"] > 0]
        base_days = cdf[cdf["special_incentives"] == 0]

        if len(inc_days) < 3 or len(base_days) < 3:
            profiles[cid]["incentive_elasticity"] = None
            profiles[cid]["incentive_persistence"] = None
            continue

        base_rides = base_days["net_rides"].mean()
        if base_rides <= 0:
            profiles[cid]["incentive_elasticity"] = None
            profiles[cid]["incentive_persistence"] = None
            continue

        inc_rides = inc_days["net_rides"].mean()
        elasticity = (inc_rides - base_rides) / base_rides
        profiles[cid]["incentive_elasticity"] = round(float(elasticity), 4)
        # Persistence: approximate — compare last 25% of timeline to first 25%
        profiles[cid]["incentive_persistence"] = None  # Requires temporal ordering


def _compute_target_earning(df: pd.DataFrame, profiles: Dict[str, Dict]):
    """Axis 2: Correlation between earnings-per-hour and login hours."""
    for cid, cdf in df.groupby("captain_id"):
        if cid not in profiles:
            continue
        valid = cdf[(cdf["total_lh"] > 0) & (cdf["earnings"] > 0)].copy()
        if len(valid) < 7:
            profiles[cid]["target_earning_score"] = None
            profiles[cid]["loss_response"] = None
            continue

        valid["eph"] = valid["earnings"] / valid["total_lh"]
        # Pearson correlation: eph vs login hours
        corr = valid["eph"].corr(valid["total_lh"])
        profiles[cid]["target_earning_score"] = round(float(corr), 4) if pd.notna(corr) else None

        # Loss response: after bad day (bottom quartile eph), does next-day hours change?
        q25 = valid["eph"].quantile(0.25)
        bad_days_idx = valid[valid["eph"] <= q25].index
        if len(bad_days_idx) >= 2:
            next_day_lh = []
            for idx_pos in range(len(valid)):
                if valid.index[idx_pos] in bad_days_idx and idx_pos + 1 < len(valid):
                    next_day_lh.append(valid.iloc[idx_pos + 1]["total_lh"])
            normal_lh = valid["total_lh"].mean()
            if next_day_lh and normal_lh > 0:
                loss_resp = np.mean(next_day_lh) / normal_lh - 1
                profiles[cid]["loss_response"] = round(float(loss_resp), 4)
            else:
                profiles[cid]["loss_response"] = None
        else:
            profiles[cid]["loss_response"] = None


def _compute_frustration_resilience(df: pd.DataFrame, profiles: Dict[str, Dict]):
    """Axis 3: How does login time change after a high-idle day?"""
    for cid, cdf in df.groupby("captain_id"):
        if cid not in profiles:
            continue
        valid = cdf[cdf["total_lh"] > 2].copy().sort_values("yyyymmdd").reset_index(drop=True)
        if len(valid) < 5:
            profiles[cid]["frustration_resilience"] = None
            continue

        valid["idle_fraction"] = valid["idle_lh"] / valid["total_lh"]
        high_idle = valid[valid["idle_fraction"] > 0.5]

        if len(high_idle) < 2:
            profiles[cid]["frustration_resilience"] = None
            continue

        non_frustration_lh = valid[valid["idle_fraction"] <= 0.5]["total_lh"].median()
        if non_frustration_lh <= 0:
            profiles[cid]["frustration_resilience"] = None
            continue

        next_day_ratios = []
        for idx in high_idle.index:
            pos = valid.index.get_loc(idx)
            if pos + 1 < len(valid):
                next_lh = valid.iloc[pos + 1]["total_lh"]
                next_day_ratios.append(next_lh / non_frustration_lh)

        if next_day_ratios:
            profiles[cid]["frustration_resilience"] = round(float(np.median(next_day_ratios)), 4)
        else:
            profiles[cid]["frustration_resilience"] = None


def _compute_behavioral_inertia(df: pd.DataFrame, profiles: Dict[str, Dict]):
    """Axis 4: How much does daily pattern vary? High = habitual, low = adaptive."""
    for cid, cdf in df.groupby("captain_id"):
        if cid not in profiles:
            continue
        if len(cdf) < 7:
            profiles[cid]["behavioral_inertia"] = None
            continue

        cv_scores = []
        for col in ["net_rides", "total_lh"]:
            mean_val = cdf[col].mean()
            if mean_val > 0:
                cv = cdf[col].std() / mean_val
                cv_scores.append(1 - min(cv, 2.0) / 2.0)  # Normalize to 0-1

        if cv_scores:
            profiles[cid]["behavioral_inertia"] = round(float(np.mean(cv_scores)), 4)
        else:
            profiles[cid]["behavioral_inertia"] = None


def _compute_efficiency_trajectory(df: pd.DataFrame, profiles: Dict[str, Dict]):
    """Axis 5: Trend in earnings-per-hour over the period."""
    for cid, cdf in df.groupby("captain_id"):
        if cid not in profiles:
            continue
        valid = cdf[(cdf["total_lh"] > 0) & (cdf["earnings"] > 0)].copy()
        valid = valid.sort_values("yyyymmdd").reset_index(drop=True)
        if len(valid) < 7:
            profiles[cid]["efficiency_slope"] = None
            continue

        valid["eph"] = valid["earnings"] / valid["total_lh"]
        x = np.arange(len(valid), dtype=float)
        y = valid["eph"].values.astype(float)

        # Simple linear regression slope
        try:
            slope, _, _, _, _ = stats.linregress(x, y)
            profiles[cid]["efficiency_slope"] = round(float(slope), 4)
        except Exception:
            profiles[cid]["efficiency_slope"] = None


def _compute_demand_supply_fit(df: pd.DataFrame, profiles: Dict[str, Dict]):
    """Axis 6: How well does the marketplace work for this captain?"""
    for cid, cdf in df.groupby("captain_id"):
        if cid not in profiles:
            continue
        total_lh = cdf["total_lh"].sum()
        total_pings = cdf["gross_pings"].sum()
        total_rides = cdf["net_rides"].sum()
        total_idle = cdf["idle_lh"].sum()

        if total_lh <= 0 or total_pings <= 0:
            profiles[cid]["demand_supply_fit"] = None
            continue

        demand_exposure = total_pings / total_lh
        conversion = total_rides / total_pings if total_pings > 0 else 0
        waste = total_idle / total_lh

        fit_score = (demand_exposure * conversion) / (1 + waste)
        profiles[cid]["demand_supply_fit"] = round(float(fit_score), 4)


# =============================================================================
# Validation Pipeline (6-Gate Test)
# =============================================================================

def validate_segment(
    username: str,
    city: str,
    start_date: str,
    end_date: str,
    segment_name: str,
    segment_definition: Dict[str, Any],
    consistency_segment: Optional[str] = None,
    performance_segment: Optional[str] = None,
    actionability_note: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Run the 6-gate validation test on a candidate segment.

    segment_definition: {"feature": "target_earning_score", "operator": "<", "threshold": -0.25}
    """
    d0 = datetime.strptime(start_date, "%Y%m%d")
    d1 = datetime.strptime(end_date, "%Y%m%d")
    total_days = max((d1 - d0).days, 1)

    # Get expanded features for the population
    features_sql = EXPANDED_FEATURES_SQL.format(
        city=city.lower(),
        start_date=start_date,
        end_date=end_date,
        total_days=total_days,
        min_days=3,
    )
    df = _query_presto(username, features_sql)
    if df.empty:
        return {"success": False, "error": "No data returned."}

    # Filter by base population segments (best-effort)
    if consistency_segment or performance_segment:
        seg_df, _seg_sql = _fetch_segments_safe(username, city, end_date)
        if not seg_df.empty:
            df = df.merge(seg_df, on="captain_id", how="left")
            if consistency_segment:
                df = df[df["consistency_segment"] == consistency_segment.lower()]
            if performance_segment:
                df = df[df["performance_segment"] == performance_segment.upper()]

    population_size = len(df)
    if population_size < 20:
        return {"success": False, "error": f"Population too small ({population_size})."}

    # Apply segment definition to split in-segment vs complement
    feature = segment_definition.get("feature", "")
    operator = segment_definition.get("operator", "<")
    threshold = segment_definition.get("threshold", 0)

    # For stimulus-response features, we need to compute them first
    # Check if the feature exists in the aggregated data
    if feature not in df.columns:
        # Need to compute response profiles to get this feature
        profiles_result = compute_response_profiles(
            username, city, start_date, end_date,
            axes=["incentive_elasticity", "target_earning", "frustration_resilience",
                  "behavioral_inertia", "efficiency_trajectory", "demand_supply_fit"],
            consistency_segment=consistency_segment,
            performance_segment=performance_segment,
            min_active_days=7,
        )
        if profiles_result.get("success") and profiles_result.get("profiles"):
            profile_df = pd.DataFrame(profiles_result["profiles"])
            df = df.merge(profile_df, on="captain_id", how="left")

    if feature not in df.columns:
        return {"success": False, "error": f"Feature '{feature}' not found in data."}

    # Split
    if operator == "<":
        in_segment = df[df[feature] < threshold]
    elif operator == ">":
        in_segment = df[df[feature] > threshold]
    elif operator == "<=":
        in_segment = df[df[feature] <= threshold]
    elif operator == ">=":
        in_segment = df[df[feature] >= threshold]
    else:
        return {"success": False, "error": f"Unknown operator: {operator}"}

    complement = df[~df.index.isin(in_segment.index)]
    segment_size = len(in_segment)
    population_pct = segment_size / population_size * 100

    gates: List[Dict[str, Any]] = []

    # Gate 1: Size (> 5% of population)
    size_passed = population_pct > 5.0
    gates.append({
        "gate": "size",
        "passed": size_passed,
        "value": round(population_pct, 2),
        "threshold": 5.0,
        "detail": f"{segment_size} captains ({population_pct:.1f}% of {population_size})",
    })

    # Gate 2: Separation (Cohen's d > 0.3 on >= 2 KPIs)
    kpi_cols = [c for c in df.select_dtypes(include=[np.number]).columns if c != feature]
    sig_kpis = []
    for col in kpi_cols:
        a_vals = in_segment[col].dropna()
        b_vals = complement[col].dropna()
        if len(a_vals) < 5 or len(b_vals) < 5:
            continue
        pooled_std = np.sqrt(
            ((len(a_vals) - 1) * a_vals.std() ** 2 + (len(b_vals) - 1) * b_vals.std() ** 2)
            / (len(a_vals) + len(b_vals) - 2)
        )
        if pooled_std > 0:
            d = abs(a_vals.mean() - b_vals.mean()) / pooled_std
            if d > 0.3:
                try:
                    _, p = stats.mannwhitneyu(a_vals, b_vals, alternative="two-sided")
                    if p < 0.01:
                        sig_kpis.append({"kpi": col, "d": round(float(d), 3), "p": round(float(p), 6)})
                except Exception:
                    pass

    separation_passed = len(sig_kpis) >= 2
    gates.append({
        "gate": "separation",
        "passed": separation_passed,
        "value": float(len(sig_kpis)),
        "threshold": 2.0,
        "detail": f"{len(sig_kpis)} KPIs with d>0.3 & p<0.01: {[s['kpi'] for s in sig_kpis[:5]]}",
    })

    # Gate 3: Stability — simplified (check feature distribution consistency)
    # Full stability requires recomputing on two time windows; here we approximate
    # by checking the coefficient of variation of the defining feature
    feature_cv = in_segment[feature].std() / abs(in_segment[feature].mean()) if in_segment[feature].mean() != 0 else 999
    stability_passed = feature_cv < 1.5  # Reasonable stability proxy
    gates.append({
        "gate": "stability",
        "passed": stability_passed,
        "value": round(float(feature_cv), 3),
        "threshold": 1.5,
        "detail": f"Feature CV = {feature_cv:.3f} (lower = more stable membership)",
    })

    # Gate 4: Orthogonality — check if segment cuts across existing segments
    orthogonality_value = 0.0
    if "consistency_segment" in df.columns and "performance_segment" in df.columns:
        # Check if segment members come from multiple existing segments
        in_seg_combos = in_segment.groupby(["consistency_segment", "performance_segment"]).size()
        total_combos = df.groupby(["consistency_segment", "performance_segment"]).size()
        # Entropy of distribution across existing segment combinations
        probs = in_seg_combos / in_seg_combos.sum()
        entropy = -float((probs * np.log2(probs.clip(lower=1e-10))).sum())
        max_entropy = np.log2(max(len(total_combos), 1))
        orthogonality_value = entropy / max_entropy if max_entropy > 0 else 0
    orthogonality_passed = orthogonality_value > 0.3
    gates.append({
        "gate": "orthogonality",
        "passed": orthogonality_passed,
        "value": round(orthogonality_value, 3),
        "threshold": 0.3,
        "detail": f"Normalized entropy across existing segments = {orthogonality_value:.3f}",
    })

    # Gate 5: Predictive Lift — check if segment feature correlates with an outcome
    # Use earnings_per_hour as a proxy outcome
    lift_value = 0.0
    if "earnings_per_hour" in df.columns:
        df["_in_segment"] = df.index.isin(in_segment.index).astype(int)
        corr = df["_in_segment"].corr(df["earnings_per_hour"])
        lift_value = abs(corr) if pd.notna(corr) else 0.0
        df.drop(columns=["_in_segment"], inplace=True)
    predictive_passed = lift_value > 0.05
    gates.append({
        "gate": "predictive_lift",
        "passed": predictive_passed,
        "value": round(lift_value, 4),
        "threshold": 0.05,
        "detail": f"Correlation with earnings_per_hour = {lift_value:.4f}",
    })

    # Gate 6: Actionability (human input)
    actionability_passed = bool(actionability_note and len(actionability_note.strip()) > 10)
    gates.append({
        "gate": "actionability",
        "passed": actionability_passed,
        "value": None,
        "threshold": None,
        "detail": actionability_note or "Pending analyst input",
    })

    gates_passed = sum(1 for g in gates if g["passed"])
    ready = gates_passed == len(gates)

    return {
        "success": True,
        "segment_name": segment_name,
        "segment_size": segment_size,
        "population_size": population_size,
        "population_pct": round(population_pct, 2),
        "gates": gates,
        "gates_passed": gates_passed,
        "total_gates": len(gates),
        "ready_to_publish": ready,
    }
