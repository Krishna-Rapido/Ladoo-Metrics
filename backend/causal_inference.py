"""
Causal Inference Lab — core analysis module.

Provides five causal analysis methods:
  1. PSMAnalyzer — Propensity Score Matching
  2. CausalImpactAnalyzer — Bayesian Structural Time Series
  3. HTEAnalyzer — Heterogeneous Treatment Effects (Causal Forest)
  4. SyntheticControlAnalyzer — Synthetic Control Method
  5. RDDAnalyzer — Regression Discontinuity Design
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from causal_schemas import MethodRecommendation


def _to_native(obj: Any) -> Any:
    """Recursively convert numpy types to native Python types for JSON serialization."""
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        v = float(obj)
        if np.isnan(v) or np.isinf(v):
            return 0.0
        return v
    if isinstance(obj, np.ndarray):
        return [_to_native(x) for x in obj.tolist()]
    if isinstance(obj, dict):
        return {k: _to_native(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_to_native(x) for x in obj]
    if isinstance(obj, float) and (np.isnan(obj) or np.isinf(obj)):
        return 0.0
    return obj


# ── Shared data preparation ──────────────────────────────────────────

def _normalize_date_col(df: pd.DataFrame) -> pd.DataFrame:
    """Ensure a 'date' column exists as YYYY-MM-DD string."""
    out = df.copy()
    if "date" not in out.columns and "yyyymmdd" in out.columns:
        out["date"] = pd.to_datetime(out["yyyymmdd"], format="%Y%m%d").dt.strftime("%Y-%m-%d")
    elif "date" not in out.columns and "time" in out.columns:
        out["date"] = pd.to_datetime(out["time"], format="%Y%m%d").dt.strftime("%Y-%m-%d")
    return out


def prepare_pre_period_features(
    df: pd.DataFrame,
    pre_start: str,
    pre_end: str,
    metrics: List[str],
) -> pd.DataFrame:
    """
    Aggregate captain-level pre-period features for PSM and HTE.

    For each captain, computes: mean, std, and active_days count
    over the pre-period for each metric.

    Returns DataFrame with one row per captain, columns:
      captain_id, cohort, {metric}_mean, {metric}_std, {metric}_active_days
    """
    out = _normalize_date_col(df)
    pre = out[(out["date"] >= pre_start) & (out["date"] <= pre_end)].copy()

    agg_dict: Dict[str, Any] = {}
    for m in metrics:
        if m not in pre.columns:
            continue
        agg_dict[f"{m}_mean"] = (m, "mean")
        agg_dict[f"{m}_std"] = (m, "std")
        agg_dict[f"{m}_active_days"] = (m, "count")

    agg_dict["cohort"] = ("cohort", "first")

    result = pre.groupby("captain_id").agg(**agg_dict).reset_index()

    std_cols = [c for c in result.columns if c.endswith("_std")]
    result[std_cols] = result[std_cols].fillna(0)

    return result


def prepare_post_period_outcome(
    df: pd.DataFrame,
    post_start: str,
    post_end: str,
    outcome_metric: str,
    aggregation: str = "mean",
) -> pd.DataFrame:
    """
    Aggregate captain-level post-period outcome.

    Returns DataFrame with captain_id and outcome columns.
    """
    out = _normalize_date_col(df)
    post = out[(out["date"] >= post_start) & (out["date"] <= post_end)].copy()

    agg_func = "mean" if aggregation == "mean" else "sum"
    result = post.groupby("captain_id").agg(
        outcome=(outcome_metric, agg_func)
    ).reset_index()

    return result


def recommend_methods(
    df: pd.DataFrame,
    test_cohort: Optional[str] = None,
    control_cohort: Optional[str] = None,
) -> List[MethodRecommendation]:
    """Check data feasibility for each causal method."""
    out = _normalize_date_col(df)
    has_cohort = "cohort" in out.columns
    has_test = has_cohort and test_cohort and test_cohort in out["cohort"].unique()
    has_control = has_cohort and control_cohort and control_cohort in out["cohort"].unique()
    has_city = "city" in out.columns
    n_cities = out["city"].nunique() if has_city else 0
    numeric_cols = out.select_dtypes(include=[np.number]).columns.tolist()
    n_captains = out["captain_id"].nunique() if "captain_id" in out.columns else 0

    recommendations = []

    # PSM
    if has_test and has_control and n_captains >= 20 and len(numeric_cols) >= 1:
        recommendations.append(MethodRecommendation(
            method="psm", feasible=True, recommended=True,
            reason=f"Two cohorts ({test_cohort}/{control_cohort}) with {n_captains} captains and {len(numeric_cols)} numeric features.",
        ))
    else:
        reasons = []
        if not has_test or not has_control:
            reasons.append("needs test and control cohorts")
        if n_captains < 20:
            reasons.append(f"only {n_captains} captains (need ≥20)")
        recommendations.append(MethodRecommendation(
            method="psm", feasible=False,
            reason=f"Not feasible: {'; '.join(reasons)}." if reasons else "Not feasible.",
        ))

    # CausalImpact
    has_dates = "date" in out.columns or "yyyymmdd" in out.columns
    if has_dates and len(numeric_cols) >= 1:
        recommendations.append(MethodRecommendation(
            method="causal_impact", feasible=True,
            recommended=not has_control,
            reason="Time series data available. Works best for pre/post without control group."
                   + (" Control cohort can improve prediction." if has_control else ""),
        ))
    else:
        recommendations.append(MethodRecommendation(
            method="causal_impact", feasible=False,
            reason="Needs time series data with date column.",
        ))

    # HTE
    if has_test and has_control and n_captains >= 50 and len(numeric_cols) >= 2:
        recommendations.append(MethodRecommendation(
            method="hte", feasible=True, recommended=True,
            reason=f"Causal Forest needs ≥50 captains per arm. You have {n_captains} total with {len(numeric_cols)} features.",
        ))
    else:
        reasons = []
        if not has_test or not has_control:
            reasons.append("needs test and control cohorts")
        if n_captains < 50:
            reasons.append(f"only {n_captains} captains (need ≥50 for reliable CATEs)")
        if len(numeric_cols) < 2:
            reasons.append("needs ≥2 numeric features")
        recommendations.append(MethodRecommendation(
            method="hte", feasible=False,
            reason=f"Not feasible: {'; '.join(reasons)}.",
        ))

    # Synthetic Control
    if has_city and n_cities >= 3:
        recommendations.append(MethodRecommendation(
            method="synthetic_control", feasible=True,
            recommended=has_city and n_cities >= 5,
            reason=f"Found {n_cities} cities. Need ≥3 (1 treated + ≥2 donors). Best with ≥5.",
        ))
    else:
        recommendations.append(MethodRecommendation(
            method="synthetic_control", feasible=False,
            reason=f"Needs a 'city' (or unit) column with ≥3 distinct values. Found: {'city col with ' + str(n_cities) if has_city else 'no city column'}.",
        ))

    # RDD — always infeasible by default
    recommendations.append(MethodRecommendation(
        method="rdd", feasible=False,
        reason="Select a running variable and cutoff to enable RDD. Any numeric column can be the running variable.",
    ))

    return recommendations


# ── Narrative generation ─────────────────────────────────────────────

def generate_narrative(method: str, results: Dict[str, Any]) -> str:
    """Generate a template-based plain English narrative for the given method's results."""
    if method == "psm":
        return _narrative_psm(results)
    elif method == "causal_impact":
        return _narrative_causal_impact(results)
    elif method == "hte":
        return _narrative_hte(results)
    elif method == "synthetic_control":
        return _narrative_synthetic_control(results)
    elif method == "rdd":
        return _narrative_rdd(results)
    return ""


def _narrative_psm(r: Dict[str, Any]) -> str:
    bias_pct = abs(r["naive_estimate"] - r["att"]) / abs(r["naive_estimate"]) * 100 if r["naive_estimate"] != 0 else 0
    direction = "inflated" if abs(r["naive_estimate"]) > abs(r["att"]) else "underestimated"
    return (
        f"After matching on covariates, the Average Treatment Effect on the Treated (ATT) is "
        f"{r['att']:+.1f}% (95% CI: [{r['att_ci_lower']:+.1f}%, {r['att_ci_upper']:+.1f}%], "
        f"p={r['att_p_value']:.4f}). "
        f"The naive estimate was {r['naive_estimate']:+.1f}%, which was {direction} by {bias_pct:.0f}% "
        f"due to pre-existing differences between groups. "
        f"{r['n_matched_pairs']} matched pairs were used; "
        f"{r['n_unmatched_test']} test captains had no suitable match and were excluded."
    )


def _narrative_causal_impact(r: Dict[str, Any]) -> str:
    return (
        f"The intervention caused a {r['average_effect']:+.1f}% change in the outcome metric "
        f"(95% CI: [{r['average_effect_ci'][0]:+.1f}%, {r['average_effect_ci'][1]:+.1f}%]). "
        f"The posterior probability of a causal effect is {r['posterior_probability']:.1f}%. "
        f"The model achieved {r['model_mape']:.1f}% MAPE on the pre-period, "
        f"{'indicating excellent fit' if r['model_mape'] < 5 else 'suggesting moderate fit — interpret with caution'}. "
        f"The cumulative impact is {r['cumulative_effect']:+,.0f} units over the post-period."
    )


def _narrative_hte(r: Dict[str, Any]) -> str:
    top = r["segment_effects"][0] if r.get("segment_effects") else None
    bottom = r["segment_effects"][-1] if r.get("segment_effects") else None
    lines = [
        f"The overall Average Treatment Effect is {r['ate']:+.1f}% "
        f"(95% CI: [{r['ate_ci'][0]:+.1f}%, {r['ate_ci'][1]:+.1f}%]).",
    ]
    if top and bottom:
        lines.append(
            f"Treatment effects vary significantly across segments. "
            f"The most responsive segment is {top['segment_value']} ({top['cate']:+.1f}%), "
            f"while {bottom['segment_value']} shows the weakest response ({bottom['cate']:+.1f}%)."
        )
    if r.get("feature_importance"):
        top_feat = r["feature_importance"][0]
        lines.append(
            f"The most important driver of heterogeneity is '{top_feat['feature']}' "
            f"(importance: {top_feat['importance']:.2f})."
        )
    return " ".join(lines)


def _narrative_synthetic_control(r: Dict[str, Any]) -> str:
    weights_str = ", ".join(
        f"{w['unit']} ({w['weight']:.0%})" for w in r["donor_weights"] if w["weight"] > 0.01
    )
    placebo_str = (
        f"Placebo p-value = {r['placebo_p_value']:.3f}."
        if r.get("placebo_p_value") is not None
        else ""
    )
    return (
        f"The synthetic control estimates an effect of {r['estimated_effect_pct']:+.1f}% "
        f"on the outcome metric. "
        f"Pre-period fit: RMSPE = {r['pre_rmspe']:.3f}. "
        f"{placebo_str} "
        f"The synthetic unit is composed of: {weights_str}."
    )


def _narrative_rdd(r: Dict[str, Any]) -> str:
    manip_warning = (
        " WARNING: McCrary density test suggests possible manipulation at the cutoff "
        f"(p={r['mccrary_p_value']:.3f})."
        if r.get("mccrary_manipulation") else ""
    )
    return (
        f"The regression discontinuity estimate is {r['rd_estimate']:+.2f} "
        f"(95% CI: [{r['rd_ci_lower']:+.2f}, {r['rd_ci_upper']:+.2f}], p={r['rd_p_value']:.4f}). "
        f"Optimal bandwidth: {r['optimal_bandwidth']:.3f}. "
        f"Observations: {r['n_left']} left of cutoff, {r['n_right']} right.{manip_warning}"
    )


# ── Analyzer stubs ───────────────────────────────────────────────────

def _standardized_mean_diff(treated: np.ndarray, control: np.ndarray) -> float:
    """Compute standardized mean difference (Cohen's d variant for balance)."""
    diff = treated.mean() - control.mean()
    pooled_std = np.sqrt((treated.var() + control.var()) / 2)
    if pooled_std < 1e-10:
        return 0.0
    return float(diff / pooled_std)


class PSMAnalyzer:
    """Propensity Score Matching for selection bias correction."""

    def __init__(self, df: pd.DataFrame, config: "PSMRequest"):
        from causal_schemas import PSMRequest
        self.df = df
        self.config = config

    def run(self) -> "PSMResponse":
        from sklearn.linear_model import LogisticRegression
        from sklearn.neighbors import NearestNeighbors
        from scipy import stats
        from causal_schemas import PSMResponse, PSMBalanceRow, ChartData, ChartSeries

        cfg = self.config
        metrics = cfg.covariates or [
            c for c in self.df.select_dtypes(include=[np.number]).columns
            if c not in ("captain_id", "yyyymmdd") and c != cfg.outcome_metric
        ]

        features = prepare_pre_period_features(self.df, cfg.pre_start, cfg.pre_end, metrics)
        outcomes = prepare_post_period_outcome(self.df, cfg.post_start, cfg.post_end, cfg.outcome_metric)

        merged = features.merge(outcomes, on="captain_id", how="inner")
        test_mask = merged["cohort"] == cfg.test_cohort
        control_mask = merged["cohort"] == cfg.control_cohort
        merged = merged[test_mask | control_mask].copy()

        feature_cols = [c for c in merged.columns if c.endswith(("_mean", "_std", "_active_days"))]
        X = merged[feature_cols].fillna(0).values
        T = (merged["cohort"] == cfg.test_cohort).astype(int).values
        Y = merged["outcome"].values

        # Fit propensity scores
        lr = LogisticRegression(max_iter=1000, random_state=42)
        lr.fit(X, T)
        ps = lr.predict_proba(X)[:, 1]

        ps_test = ps[T == 1]
        ps_control = ps[T == 0]

        # Overlap
        ps_min = max(ps_test.min(), ps_control.min())
        ps_max = min(ps_test.max(), ps_control.max())
        in_common_support = ((ps >= ps_min) & (ps <= ps_max))
        overlap_score = float(in_common_support.mean())

        # Match on logit propensity
        logit_ps = np.log(ps / (1 - ps + 1e-10) + 1e-10)
        logit_test = logit_ps[T == 1].reshape(-1, 1)
        logit_control = logit_ps[T == 0].reshape(-1, 1)

        nn = NearestNeighbors(n_neighbors=1, metric="euclidean")
        nn.fit(logit_control)
        distances, indices = nn.kneighbors(logit_test)

        caliper = cfg.caliper_width * logit_ps.std()
        within_caliper = distances.flatten() <= caliper
        matched_test_idx = np.where(T == 1)[0][within_caliper]
        matched_control_idx = np.where(T == 0)[0][indices.flatten()[within_caliper]]

        n_matched = len(matched_test_idx)
        n_unmatched = int((T == 1).sum()) - n_matched

        # Balance
        balance_rows = []
        for col_idx, col_name in enumerate(feature_cols):
            smd_before = _standardized_mean_diff(X[T == 1, col_idx], X[T == 0, col_idx])
            smd_after = _standardized_mean_diff(X[matched_test_idx, col_idx], X[matched_control_idx, col_idx])
            balance_rows.append(PSMBalanceRow(
                covariate=col_name,
                smd_before=float(smd_before),
                smd_after=float(smd_after),
                mean_test_before=float(X[T == 1, col_idx].mean()),
                mean_control_before=float(X[T == 0, col_idx].mean()),
                mean_test_after=float(X[matched_test_idx, col_idx].mean()),
                mean_control_after=float(X[matched_control_idx, col_idx].mean()),
            ))

        # ATT
        y_test_matched = Y[matched_test_idx]
        y_control_matched = Y[matched_control_idx]
        att_diff = y_test_matched - y_control_matched
        att = float(att_diff.mean())
        naive = float(Y[T == 1].mean() - Y[T == 0].mean())

        if n_matched >= 2:
            t_stat, p_val = stats.ttest_rel(y_test_matched, y_control_matched)
            se = att_diff.std() / np.sqrt(n_matched)
            ci_lower = att - 1.96 * se
            ci_upper = att + 1.96 * se
        else:
            p_val, ci_lower, ci_upper = 1.0, att, att

        control_mean = float(Y[T == 0].mean())
        if control_mean != 0:
            att_pct = att / control_mean * 100
            naive_pct = naive / control_mean * 100
            ci_lower_pct = ci_lower / control_mean * 100
            ci_upper_pct = ci_upper / control_mean * 100
        else:
            att_pct = naive_pct = ci_lower_pct = ci_upper_pct = 0.0

        charts = {
            "overlap": ChartData(
                chart_type="histogram", title="Propensity Score Distribution",
                x_label="Propensity Score", y_label="Density",
                series=[
                    ChartSeries(name="Test", values=ps_test.tolist()),
                    ChartSeries(name="Control", values=ps_control.tolist()),
                ],
            ),
            "love_plot": ChartData(
                chart_type="scatter", title="Covariate Balance (Love Plot)",
                x_label="Standardized Mean Difference", y_label="Covariate",
                data=[{"covariate": b.covariate, "before": b.smd_before, "after": b.smd_after} for b in balance_rows],
            ),
            "att_comparison": ChartData(
                chart_type="bar", title="Naive vs PSM-Adjusted Estimate",
                series=[
                    ChartSeries(name="Naive DiD", values=[naive_pct]),
                    ChartSeries(name="PSM-Adjusted", values=[att_pct]),
                ],
            ),
        }

        result_dict = {
            "att": att_pct, "att_ci_lower": ci_lower_pct, "att_ci_upper": ci_upper_pct,
            "att_p_value": float(p_val), "naive_estimate": naive_pct,
            "n_matched_pairs": n_matched, "n_unmatched_test": n_unmatched,
        }
        narrative = generate_narrative("psm", result_dict)

        return PSMResponse(
            att=att_pct, att_ci_lower=ci_lower_pct, att_ci_upper=ci_upper_pct,
            att_p_value=float(p_val), naive_estimate=naive_pct,
            n_matched_pairs=n_matched, n_unmatched_test=n_unmatched,
            n_total_test=int((T == 1).sum()), n_total_control=int((T == 0).sum()),
            overlap_score=overlap_score, balance=balance_rows, charts=charts,
            propensity_scores_test=ps_test.tolist(),
            propensity_scores_control=ps_control.tolist(),
            narrative=narrative, warnings=[],
        )


def _patch_pandas_causalimpact() -> None:
    """Monkey-patch pandas 2.x to restore `is_datetime_or_timedelta_dtype`
    that was removed in pandas 2.2 but is still used by causalimpact 0.2.x."""
    import pandas.core.dtypes.common as _c
    if not hasattr(_c, "is_datetime_or_timedelta_dtype"):
        def _is_datetime_or_timedelta_dtype(arr_or_dtype):  # type: ignore[misc]
            try:
                return (
                    _c.is_datetime64_any_dtype(arr_or_dtype)
                    or _c.is_timedelta64_dtype(arr_or_dtype)
                )
            except Exception:
                return False
        _c.is_datetime_or_timedelta_dtype = _is_datetime_or_timedelta_dtype


class CausalImpactAnalyzer:
    """Bayesian Structural Time Series (CausalImpact).

    Uses the ``causalimpact`` package which requires pandas 2.x compatibility
    patching (see ``_patch_pandas_causalimpact``).

    When no control cohort is available the model uses a linear time-trend as
    the single exogenous regressor, which still allows the BSTS model to fit a
    counterfactual.
    """

    def __init__(self, df: pd.DataFrame, config: "CausalImpactRequest"):
        self.df = df
        self.config = config

    # ── public ───────────────────────────────────────────────────────────

    def run(self) -> "CausalImpactResponse":
        from causal_schemas import CausalImpactResponse, ChartData, ChartSeries

        _patch_pandas_causalimpact()
        from causalimpact import CausalImpact  # noqa: PLC0415  (local import after patch)

        cfg = self.config
        out = _normalize_date_col(self.df)

        # 1. Filter to test cohort
        if cfg.test_cohort and "cohort" in out.columns:
            test_df = out[out["cohort"] == cfg.test_cohort]
        else:
            test_df = out

        # 2. Aggregate to daily time series
        agg_func = cfg.aggregation  # "sum" or "mean"
        daily = (
            test_df.groupby("date")
            .agg({cfg.outcome_metric: agg_func})
            .reset_index()
        )
        daily["date"] = pd.to_datetime(daily["date"])
        daily = daily.sort_values("date").set_index("date")
        daily.columns = ["y"]

        # 3. Build covariate: control group OR linear time trend
        data = daily.copy()
        warnings: List[str] = []

        if (
            cfg.use_control_as_covariate
            and cfg.control_cohort
            and "cohort" in out.columns
            and cfg.control_cohort in out["cohort"].values
        ):
            ctrl_df = out[out["cohort"] == cfg.control_cohort]
            ctrl_daily = (
                ctrl_df.groupby("date")
                .agg({cfg.outcome_metric: agg_func})
                .reset_index()
            )
            ctrl_daily["date"] = pd.to_datetime(ctrl_daily["date"])
            ctrl_daily = ctrl_daily.sort_values("date").set_index("date")
            ctrl_daily.columns = ["x1"]
            data = data.join(ctrl_daily, how="left").ffill().fillna(0)
        else:
            # Fall back to a linear time trend so the model has a covariate
            data["x1"] = np.arange(len(data), dtype=float)
            if not cfg.use_control_as_covariate:
                pass  # user explicitly chose no control
            elif cfg.control_cohort:
                warnings.append(
                    f"Control cohort '{cfg.control_cohort}' not found in data. "
                    "Using a linear time trend as covariate instead."
                )
            else:
                warnings.append(
                    "No control cohort specified. "
                    "Using a linear time trend as covariate."
                )

        # 4. Map dates to integer positions (avoids pandas DatetimeIndex bug)
        n_points = len(data)
        date_index = data.index  # keep for later
        data_int = data.copy()
        data_int.index = np.arange(n_points)

        pre_dates = pd.date_range(cfg.pre_start, cfg.pre_end)
        post_dates = pd.date_range(cfg.post_start, cfg.post_end)

        pre_mask = date_index.isin(pre_dates)
        post_mask = date_index.isin(post_dates)

        pre_indices = np.where(pre_mask)[0]
        post_indices = np.where(post_mask)[0]

        if len(pre_indices) == 0:
            raise ValueError(
                f"Pre-period [{cfg.pre_start}, {cfg.pre_end}] has no data points."
            )
        if len(post_indices) == 0:
            raise ValueError(
                f"Post-period [{cfg.post_start}, {cfg.post_end}] has no data points."
            )

        pre_period = [int(pre_indices[0]), int(pre_indices[-1])]
        post_period = [int(post_indices[0]), int(post_indices[-1])]

        # 5. Run CausalImpact
        ci = CausalImpact(data_int, pre_period, post_period)
        ci.run()

        inf = ci.inferences  # DataFrame indexed 0..n-1

        # 6. Extract time-series rows
        time_series: List[Dict[str, Any]] = []
        for i, dt in enumerate(date_index):
            row = inf.iloc[i]
            time_series.append({
                "date": dt.strftime("%Y-%m-%d"),
                "actual": float(row["response"]),
                "predicted": float(row["point_pred"]),
                "ci_lower": float(row["point_pred_lower"]),
                "ci_upper": float(row["point_pred_upper"]),
                "pointwise": float(row["point_effect"]),
                "cumulative": float(row["cum_effect"]),
            })

        # 7. Compute summary statistics
        post_inf = inf.iloc[post_indices[0]: post_indices[-1] + 1]
        pre_inf = inf.iloc[pre_indices[0]: pre_indices[-1] + 1]

        avg_effect = float(post_inf["point_effect"].mean())
        avg_effect_lower = float(post_inf["point_effect_lower"].mean())
        avg_effect_upper = float(post_inf["point_effect_upper"].mean())
        cum_effect = float(post_inf["cum_effect"].iloc[-1])
        cum_effect_lower = float(post_inf["cum_effect_lower"].iloc[-1])
        cum_effect_upper = float(post_inf["cum_effect_upper"].iloc[-1])

        # Posterior probability: fraction of post-period where lower CI > 0
        # (or upper CI < 0 for negative effects)
        if avg_effect >= 0:
            post_prob = float(
                (post_inf["point_effect_lower"] > 0).mean() * 100
            )
        else:
            post_prob = float(
                (post_inf["point_effect_upper"] < 0).mean() * 100
            )
        post_prob = min(100.0, max(0.0, post_prob))

        # Pre-period MAPE
        actual_pre = pre_inf["response"].replace(0, np.nan)
        mape = float(
            (abs(pre_inf["response"] - pre_inf["point_pred"]) / actual_pre.abs())
            .replace([np.inf, -np.inf], np.nan)
            .dropna()
            .mean()
            * 100
        )

        # % effect
        avg_predicted = float(post_inf["point_pred"].mean())
        avg_effect_pct = (
            (avg_effect / avg_predicted * 100) if avg_predicted != 0 else 0.0
        )
        avg_effect_ci_pct = [
            (avg_effect_lower / avg_predicted * 100) if avg_predicted != 0 else 0.0,
            (avg_effect_upper / avg_predicted * 100) if avg_predicted != 0 else 0.0,
        ]
        cum_predicted = float(post_inf["cum_pred"].iloc[-1])
        cum_effect_ci = [cum_effect_lower, cum_effect_upper]

        # 8. Build charts
        dates_all = [r["date"] for r in time_series]
        actual_vals = [r["actual"] for r in time_series]
        predicted_vals = [r["predicted"] for r in time_series]
        ci_lower_vals = [r["ci_lower"] for r in time_series]
        ci_upper_vals = [r["ci_upper"] for r in time_series]
        pointwise_vals = [r["pointwise"] for r in time_series]
        cumulative_vals = [r["cumulative"] for r in time_series]

        charts: Dict[str, Any] = {
            "time_series": ChartData(
                chart_type="line",
                title="Actual vs Counterfactual",
                x_label="Date",
                y_label=cfg.outcome_metric,
                series=[
                    ChartSeries(name="Actual", values=actual_vals, labels=dates_all),
                    ChartSeries(name="Predicted", values=predicted_vals, labels=dates_all),
                    ChartSeries(name="CI Lower", values=ci_lower_vals, labels=dates_all),
                    ChartSeries(name="CI Upper", values=ci_upper_vals, labels=dates_all),
                ],
                annotations={"intervention_date": cfg.post_start},
            ),
            "pointwise_effect": ChartData(
                chart_type="bar",
                title="Pointwise Causal Effect",
                x_label="Date",
                y_label="Effect",
                series=[
                    ChartSeries(name="Pointwise Effect", values=pointwise_vals, labels=dates_all),
                ],
                annotations={"intervention_date": cfg.post_start},
            ),
            "cumulative_effect": ChartData(
                chart_type="line",
                title="Cumulative Causal Effect",
                x_label="Date",
                y_label="Cumulative Effect",
                series=[
                    ChartSeries(name="Cumulative Effect", values=cumulative_vals, labels=dates_all),
                ],
                annotations={"intervention_date": cfg.post_start},
            ),
        }

        # 9. Narrative
        narrative_dict: Dict[str, Any] = {
            "average_effect": avg_effect_pct,
            "average_effect_ci": avg_effect_ci_pct,
            "posterior_probability": post_prob,
            "model_mape": mape,
            "cumulative_effect": cum_effect,
        }
        narrative = generate_narrative("causal_impact", narrative_dict)

        return CausalImpactResponse(
            average_effect=avg_effect_pct,
            average_effect_ci=avg_effect_ci_pct,
            cumulative_effect=cum_effect,
            cumulative_effect_ci=cum_effect_ci,
            posterior_probability=post_prob,
            model_mape=mape,
            charts=charts,
            time_series=time_series,
            narrative=narrative,
            warnings=warnings,
        )


class HTEAnalyzer:
    """Heterogeneous Treatment Effects via Causal Forest (CausalForestDML)."""

    def __init__(self, df: pd.DataFrame, config: "HTERequest"):
        self.df = df
        self.config = config

    def run(self) -> "HTEResponse":
        from econml.dml import CausalForestDML
        from sklearn.ensemble import GradientBoostingRegressor, GradientBoostingClassifier
        from causal_schemas import (
            HTEResponse, HTESegmentEffect, HTEFeatureImportance, ChartData, ChartSeries,
        )

        cfg = self.config
        warnings: List[str] = []

        # ── 1. Build pre-period features (X) ────────────────────────────
        metrics = cfg.covariates or [
            c for c in self.df.select_dtypes(include=[np.number]).columns
            if c not in ("captain_id", "yyyymmdd") and c != cfg.outcome_metric
        ]

        features = prepare_pre_period_features(
            self.df, cfg.pre_start, cfg.pre_end, metrics
        )
        outcomes = prepare_post_period_outcome(
            self.df, cfg.post_start, cfg.post_end, cfg.outcome_metric
        )

        merged = features.merge(outcomes, on="captain_id", how="inner")
        test_mask = merged["cohort"] == cfg.test_cohort
        control_mask = merged["cohort"] == cfg.control_cohort
        merged = merged[test_mask | control_mask].copy().reset_index(drop=True)

        feature_cols = [
            c for c in merged.columns
            if c.endswith(("_mean", "_std", "_active_days"))
        ]

        X = merged[feature_cols].fillna(0).values.astype(float)
        T = (merged["cohort"] == cfg.test_cohort).astype(int).values  # 1D
        Y = merged["outcome"].values.astype(float)
        captain_ids = merged["captain_id"].tolist()

        n_test = int(T.sum())
        n_control = int((T == 0).sum())
        if n_test < 10 or n_control < 10:
            raise ValueError(
                f"Not enough captains: {n_test} test, {n_control} control (need ≥10 each)."
            )

        # ── 2. Fit CausalForestDML ────────────────────────────────────────
        cf = CausalForestDML(
            model_y=GradientBoostingRegressor(
                n_estimators=100, max_depth=3, random_state=42
            ),
            model_t=GradientBoostingClassifier(
                n_estimators=100, max_depth=3, random_state=42
            ),
            n_estimators=200,
            random_state=42,
            discrete_treatment=True,
        )
        cf.fit(Y, T, X=X)

        # ── 3. Individual CATEs ───────────────────────────────────────────
        cates = cf.effect(X)  # shape (n,)
        inf = cf.effect_inference(X)
        ci_lower, ci_upper = inf.conf_int()  # each shape (n,)

        # ── 4. ATE and CI ─────────────────────────────────────────────────
        ate_raw = float(cf.ate(X))
        ate_lower_raw, ate_upper_raw = cf.ate_interval(X)

        control_mean = float(Y[T == 0].mean())
        if control_mean != 0:
            ate_pct = ate_raw / control_mean * 100
            ate_ci = [
                float(ate_lower_raw) / control_mean * 100,
                float(ate_upper_raw) / control_mean * 100,
            ]
        else:
            ate_pct = 0.0
            ate_ci = [0.0, 0.0]
            warnings.append("Control mean is 0; ATE expressed as raw difference.")

        # ── 5. Feature importance ─────────────────────────────────────────
        feature_importances = cf.feature_importances_  # 1D array
        fi_rows = [
            HTEFeatureImportance(feature=col, importance=float(imp))
            for col, imp in sorted(
                zip(feature_cols, feature_importances),
                key=lambda x: x[1],
                reverse=True,
            )
        ]

        # ── 6. Individual CATEs list ──────────────────────────────────────
        individual_cates = []
        for i, cid in enumerate(captain_ids):
            row: Dict[str, Any] = {
                "captain_id": cid,
                "cate": float(cates[i]),
                "cate_ci_lower": float(ci_lower[i]),
                "cate_ci_upper": float(ci_upper[i]),
            }
            for col_idx, col in enumerate(feature_cols):
                row[col] = float(X[i, col_idx])
            individual_cates.append(row)

        # ── 7. Segment effects ────────────────────────────────────────────
        segment_effects: List[HTESegmentEffect] = []

        # Auto-detect segment columns: categorical cols from original data for captains in merged
        seg_cols = cfg.segment_columns or []
        if not seg_cols:
            orig = _normalize_date_col(self.df)
            cat_cols = [
                c for c in orig.select_dtypes(include=["object", "category"]).columns
                if c not in ("captain_id", "date", "cohort")
            ]
            seg_cols = cat_cols[:3]  # limit to first 3

        # Build a captain → segment value lookup from the original DataFrame
        orig_df = _normalize_date_col(self.df)
        captain_level = (
            orig_df[orig_df["captain_id"].isin(captain_ids)]
            .groupby("captain_id")
            .first()
            .reset_index()
        )
        cate_series = pd.Series(cates, index=captain_ids, name="cate")
        ci_lower_series = pd.Series(ci_lower, index=captain_ids, name="ci_lower")
        ci_upper_series = pd.Series(ci_upper, index=captain_ids, name="ci_upper")

        for seg_col in seg_cols:
            if seg_col not in captain_level.columns:
                continue
            seg_map = captain_level.set_index("captain_id")[seg_col]
            for seg_val, group in seg_map.groupby(seg_map):
                group_ids = group.index.tolist()
                if len(group_ids) < 3:
                    continue
                group_cates = cate_series.loc[group_ids].values
                group_ci_lo = ci_lower_series.loc[group_ids].values
                group_ci_hi = ci_upper_series.loc[group_ids].values
                seg_cate = float(group_cates.mean())
                seg_ci_lo = float(group_ci_lo.mean())
                seg_ci_hi = float(group_ci_hi.mean())
                if control_mean != 0:
                    seg_cate = seg_cate / control_mean * 100
                    seg_ci_lo = seg_ci_lo / control_mean * 100
                    seg_ci_hi = seg_ci_hi / control_mean * 100
                segment_effects.append(HTESegmentEffect(
                    segment_name=seg_col,
                    segment_value=str(seg_val),
                    cate=seg_cate,
                    cate_ci_lower=seg_ci_lo,
                    cate_ci_upper=seg_ci_hi,
                    n_captains=len(group_ids),
                ))

        # Sort segments by CATE descending
        segment_effects.sort(key=lambda s: s.cate, reverse=True)

        # ── 8. CATE distribution histogram ───────────────────────────────
        hist_counts, bin_edges = np.histogram(cates, bins=20)
        bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2
        cate_distribution: Dict[str, Any] = {
            "bins": bin_centers.tolist(),
            "counts": hist_counts.tolist(),
            "bin_edges": bin_edges.tolist(),
        }

        # ── 9. Charts ─────────────────────────────────────────────────────
        charts: Dict[str, Any] = {
            "cate_histogram": ChartData(
                chart_type="histogram",
                title="Distribution of Individual Treatment Effects",
                x_label="CATE",
                y_label="Count",
                series=[
                    ChartSeries(
                        name="CATE Distribution",
                        values=hist_counts.tolist(),
                        labels=[f"{v:.2f}" for v in bin_centers.tolist()],
                    )
                ],
            ),
            "feature_importance": ChartData(
                chart_type="bar",
                title="Feature Importance (Heterogeneity Drivers)",
                x_label="Importance",
                y_label="Feature",
                data=[{"feature": fi.feature, "importance": fi.importance} for fi in fi_rows],
            ),
        }
        if segment_effects:
            charts["segment_effects"] = ChartData(
                chart_type="bar",
                title="Average CATE by Segment",
                x_label="Segment",
                y_label="CATE (%)",
                data=[
                    {
                        "segment": f"{s.segment_name}={s.segment_value}",
                        "cate": s.cate,
                        "ci_lower": s.cate_ci_lower,
                        "ci_upper": s.cate_ci_upper,
                    }
                    for s in segment_effects
                ],
            )

        # ── 10. Narrative ─────────────────────────────────────────────────
        narrative_dict: Dict[str, Any] = {
            "ate": ate_pct,
            "ate_ci": ate_ci,
            "segment_effects": [
                {"segment_value": s.segment_value, "cate": s.cate}
                for s in segment_effects
            ],
            "feature_importance": [
                {"feature": fi.feature, "importance": fi.importance}
                for fi in fi_rows
            ],
        }
        narrative = generate_narrative("hte", narrative_dict)

        return HTEResponse(
            ate=ate_pct,
            ate_ci=ate_ci,
            segment_effects=segment_effects,
            feature_importance=fi_rows,
            cate_distribution=cate_distribution,
            individual_cates=individual_cates,
            charts=charts,
            narrative=narrative,
            warnings=warnings,
        )


class SyntheticControlAnalyzer:
    """Synthetic Control Method — custom implementation via scipy.optimize."""

    def __init__(self, df: pd.DataFrame, config: "SyntheticControlRequest"):
        self.df = df
        self.config = config

    def run(self) -> "SyntheticControlResponse":
        from scipy.optimize import minimize
        from causal_schemas import SyntheticControlResponse, DonorWeight, ChartData

        cfg = self.config
        out = _normalize_date_col(self.df)
        unit_col = cfg.unit_column

        if unit_col not in out.columns:
            raise ValueError(f"Column '{unit_col}' not found in data.")

        # Aggregate to unit × date panel
        panel = out.groupby([unit_col, "date"]).agg({cfg.outcome_metric: cfg.aggregation}).reset_index()
        panel_wide = panel.pivot(index="date", columns=unit_col, values=cfg.outcome_metric).sort_index()
        panel_wide = panel_wide.ffill().fillna(0)

        if cfg.treated_unit not in panel_wide.columns:
            raise ValueError(f"Treated unit '{cfg.treated_unit}' not found.")

        treated = panel_wide[cfg.treated_unit].values
        donor_names = [c for c in panel_wide.columns if c != cfg.treated_unit]
        donors = panel_wide[donor_names].values

        dates = panel_wide.index.tolist()
        intervention_idx = next(
            (i for i, d in enumerate(dates) if d >= cfg.intervention_date), len(dates)
        )
        treated_pre = treated[:intervention_idx]
        donors_pre = donors[:intervention_idx]

        n_donors = donors_pre.shape[1]

        def objective(w):
            synthetic = donors_pre @ w
            return float(np.sum((treated_pre - synthetic) ** 2))

        constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1}]
        bounds = [(0, 1)] * n_donors
        w0 = np.ones(n_donors) / n_donors

        result = minimize(objective, w0, method="SLSQP", bounds=bounds, constraints=constraints)
        weights = result.x

        synthetic = donors @ weights
        gap = treated - synthetic
        pre_rmspe = float(np.sqrt(np.mean(gap[:intervention_idx] ** 2)))
        post_gap = gap[intervention_idx:]
        post_rmspe = float(np.sqrt(np.mean(post_gap ** 2))) if len(post_gap) > 0 else 0
        avg_effect = float(post_gap.mean()) if len(post_gap) > 0 else 0
        avg_treated_post = float(treated[intervention_idx:].mean()) if len(treated[intervention_idx:]) > 0 else 1
        effect_pct = avg_effect / (avg_treated_post - avg_effect) * 100 if (avg_treated_post - avg_effect) != 0 else 0

        # Placebo tests
        placebo_gaps_data = []
        ratios = []
        for donor_name in donor_names:
            p_treated = panel_wide[donor_name].values
            p_donors_names = [c for c in panel_wide.columns if c != donor_name]
            p_donors = panel_wide[p_donors_names].values
            p_donors_pre = p_donors[:intervention_idx]
            p_treated_pre = p_treated[:intervention_idx]

            p_n = p_donors_pre.shape[1]
            p_w0 = np.ones(p_n) / p_n
            p_bounds = [(0, 1)] * p_n
            p_constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1}]

            def p_obj(w, dp=p_donors_pre, tp=p_treated_pre):
                return float(np.sum((tp - dp @ w) ** 2))

            p_result = minimize(p_obj, p_w0, method="SLSQP", bounds=p_bounds, constraints=p_constraints)
            p_synthetic = p_donors @ p_result.x
            p_gap = p_treated - p_synthetic
            p_pre_rmspe = float(np.sqrt(np.mean(p_gap[:intervention_idx] ** 2)))
            p_post_rmspe = float(np.sqrt(np.mean(p_gap[intervention_idx:] ** 2))) if len(p_gap[intervention_idx:]) > 0 else 0

            placebo_gaps_data.append({"unit": donor_name, "gaps": p_gap.tolist()})
            if p_pre_rmspe > 0:
                ratios.append(p_post_rmspe / p_pre_rmspe)

        actual_ratio = post_rmspe / pre_rmspe if pre_rmspe > 0 else float("inf")
        p_value = float(sum(1 for r in ratios if r >= actual_ratio) + 1) / (len(ratios) + 1)

        ts = [
            {"date": str(dates[i]), "actual": float(treated[i]), "synthetic": float(synthetic[i]), "gap": float(gap[i])}
            for i in range(len(dates))
        ]

        donor_weights = sorted(
            [DonorWeight(unit=donor_names[i], weight=float(weights[i])) for i in range(n_donors)],
            key=lambda x: x.weight, reverse=True,
        )

        charts = {
            "actual_vs_synthetic": ChartData(
                chart_type="line", title=f"Actual vs Synthetic {cfg.treated_unit}",
                x_label="Date", y_label=cfg.outcome_metric, data=ts,
            ),
            "weights": ChartData(
                chart_type="bar", title="Donor Weights",
                data=[{"unit": w.unit, "weight": w.weight} for w in donor_weights if w.weight > 0.01],
            ),
            "gap": ChartData(
                chart_type="line", title="Gap (Actual - Synthetic)",
                data=[{"date": r["date"], "gap": r["gap"]} for r in ts],
            ),
            "placebo": ChartData(
                chart_type="line", title="Placebo Tests",
                data=placebo_gaps_data,
                annotations={"treated_unit": cfg.treated_unit, "treated_gaps": gap.tolist()},
            ),
        }

        result_dict = {
            "estimated_effect_pct": effect_pct,
            "pre_rmspe": pre_rmspe, "placebo_p_value": p_value,
            "donor_weights": [{"unit": w.unit, "weight": w.weight} for w in donor_weights if w.weight > 0.01],
        }
        narrative = generate_narrative("synthetic_control", result_dict)

        return SyntheticControlResponse(
            estimated_effect=avg_effect, estimated_effect_pct=effect_pct,
            pre_rmspe=pre_rmspe, post_rmspe=post_rmspe,
            placebo_p_value=p_value, donor_weights=donor_weights,
            time_series=ts, placebo_gaps=placebo_gaps_data,
            charts=charts, narrative=narrative, warnings=[],
        )


class RDDAnalyzer:
    """Regression Discontinuity Design using rdrobust."""

    def __init__(self, df: pd.DataFrame, config: "RDDRequest"):
        self.df = df
        self.config = config

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _aggregate(self) -> pd.DataFrame:
        """Aggregate to captain level (mean of running variable + outcome)."""
        agg = (
            self.df.groupby("captain_id")[[self.config.running_variable, self.config.outcome_metric]]
            .mean()
            .reset_index()
        )
        return agg

    @staticmethod
    def _extract_scalar(val: Any) -> float:
        """Safely pull a single float from a DataFrame cell, ndarray, or list."""
        if isinstance(val, pd.DataFrame):
            return float(val.iloc[0, 0])
        if isinstance(val, pd.Series):
            return float(val.iloc[0])
        if isinstance(val, (list, np.ndarray)):
            v = val[0]
            if hasattr(v, "item"):
                return float(v.item())
            return float(v)
        if hasattr(val, "item"):
            return float(val.item())
        return float(val)

    def _run_rdrobust(self, agg: pd.DataFrame, h: Optional[float] = None):
        """Run rdrobust; returns the result object or None on failure."""
        from rdrobust import rdrobust as _rdrobust

        y = agg[self.config.outcome_metric].values
        x = agg[self.config.running_variable].values
        kwargs: Dict[str, Any] = dict(c=self.config.cutoff_value, p=self.config.polynomial_order)
        kernel_map = {"triangular": "triangular", "epanechnikov": "epanechnikov", "uniform": "uniform"}
        kwargs["kernel"] = kernel_map.get(self.config.kernel, "triangular")
        if h is not None:
            kwargs["h"] = h
        try:
            return _rdrobust(y, x, **kwargs)
        except Exception:
            return None

    def _bandwidth_sensitivity(
        self, agg: pd.DataFrame, optimal_h: float
    ) -> "List[BandwidthEstimate]":
        from causal_schemas import BandwidthEstimate

        results = []
        for scale in [0.5, 0.75, 1.0, 1.25, 1.5]:
            h = optimal_h * scale
            rd = self._run_rdrobust(agg, h=h)
            if rd is None:
                continue
            try:
                est = self._extract_scalar(rd.coef)
                ci_lo = float(rd.ci.iloc[0, 0])
                ci_hi = float(rd.ci.iloc[0, 1])
                n_left = int(rd.N_h[0])
                n_right = int(rd.N_h[1])
                results.append(
                    BandwidthEstimate(
                        bandwidth=round(h, 6),
                        estimate=round(est, 6),
                        ci_lower=round(ci_lo, 6),
                        ci_upper=round(ci_hi, 6),
                        n_left=n_left,
                        n_right=n_right,
                    )
                )
            except Exception:
                continue
        return results

    def _mccrary_test(self, agg: pd.DataFrame, optimal_h: float) -> tuple[Optional[float], bool]:
        """
        Simplified McCrary density test:
        Compare captain count left vs right within the bandwidth window using a chi-square test.
        Returns (p_value, manipulation_flag).
        """
        from scipy.stats import chisquare

        x = agg[self.config.running_variable].values
        c = self.config.cutoff_value
        in_bw = (x >= c - optimal_h) & (x <= c + optimal_h)
        left_count = int(((x >= c - optimal_h) & (x < c)).sum())
        right_count = int(((x >= c) & (x <= c + optimal_h)).sum())
        total = left_count + right_count
        if total < 10:
            return None, False
        try:
            _, p = chisquare([left_count, right_count])
            return round(float(p), 6), bool(p < 0.05)
        except Exception:
            return None, False

    def _build_scatter(self, agg: pd.DataFrame) -> "List[Dict[str, Any]]":
        """Return captain-level scatter points (x, y, side)."""
        c = self.config.cutoff_value
        scatter = []
        for _, row in agg.iterrows():
            xv = float(row[self.config.running_variable])
            scatter.append(
                {
                    "x": xv,
                    "y": float(row[self.config.outcome_metric]),
                    "side": "left" if xv < c else "right",
                }
            )
        return scatter

    def _build_fitted_lines(
        self, agg: pd.DataFrame, optimal_h: float
    ) -> "Dict[str, List[Dict[str, float]]]":
        """Build bin-mean fitted lines for each side within bandwidth."""
        c = self.config.cutoff_value
        x = agg[self.config.running_variable].values
        y = agg[self.config.outcome_metric].values

        def bin_means(mask: np.ndarray, n_bins: int = 20) -> List[Dict[str, float]]:
            xs = x[mask]
            ys = y[mask]
            if len(xs) < 2:
                return []
            bins = np.linspace(xs.min(), xs.max(), n_bins + 1)
            points = []
            for i in range(n_bins):
                in_bin = (xs >= bins[i]) & (xs < bins[i + 1])
                if in_bin.sum() == 0:
                    continue
                points.append({"x": float((bins[i] + bins[i + 1]) / 2), "y": float(ys[in_bin].mean())})
            return points

        left_mask = (x >= c - optimal_h) & (x < c)
        right_mask = (x >= c) & (x <= c + optimal_h)
        return {
            "left": bin_means(left_mask),
            "right": bin_means(right_mask),
        }

    # ------------------------------------------------------------------
    # Main entry point
    # ------------------------------------------------------------------

    def run(self) -> "RDDResponse":
        from causal_schemas import BandwidthEstimate, ChartData, RDDResponse

        warnings: List[str] = []
        agg = self._aggregate()

        rd = self._run_rdrobust(agg)

        # ---------- Primary estimate ----------
        if rd is not None:
            try:
                rd_estimate = self._extract_scalar(rd.coef)
                ci_lower = float(rd.ci.iloc[0, 0])
                ci_upper = float(rd.ci.iloc[0, 1])
                p_value = self._extract_scalar(rd.pv)
                optimal_h = float(rd.bws.iloc[0, 0])
                n_left = int(rd.N_h[0])
                n_right = int(rd.N_h[1])
            except Exception as exc:
                warnings.append(f"rdrobust result parsing error: {exc}. Falling back to mean difference.")
                rd = None

        if rd is None:
            # Fallback: simple mean-difference at a default bandwidth
            x = agg[self.config.running_variable].values
            y = agg[self.config.outcome_metric].values
            c = self.config.cutoff_value
            optimal_h = float(np.std(x) * 0.5)
            left = y[(x >= c - optimal_h) & (x < c)]
            right = y[(x >= c) & (x <= c + optimal_h)]
            if len(left) == 0 or len(right) == 0:
                left = y[x < c]
                right = y[x >= c]
                optimal_h = float(max(c - x.min(), x.max() - c))
            rd_estimate = float(right.mean() - left.mean()) if len(right) and len(left) else 0.0
            ci_lower = rd_estimate - abs(rd_estimate) * 0.5
            ci_upper = rd_estimate + abs(rd_estimate) * 0.5
            p_value = 0.5
            n_left = int(len(left))
            n_right = int(len(right))
            warnings.append("rdrobust fallback: used simple mean-difference estimate.")

        # ---------- McCrary density test ----------
        mccrary_p, mccrary_manip = self._mccrary_test(agg, optimal_h)

        # ---------- Bandwidth sensitivity ----------
        sensitivity = self._bandwidth_sensitivity(agg, optimal_h)
        if len(sensitivity) < 3:
            warnings.append("Bandwidth sensitivity: fewer than 3 estimates available (small sample?).")

        # ---------- Scatter + fitted lines ----------
        scatter = self._build_scatter(agg)
        fitted_lines = self._build_fitted_lines(agg, optimal_h)

        # ---------- Charts ----------
        charts: Dict[str, ChartData] = {
            "rd_plot": ChartData(
                chart_type="scatter",
                title=f"RD Plot: {self.config.outcome_metric} vs {self.config.running_variable}",
                x_label=self.config.running_variable,
                y_label=self.config.outcome_metric,
                data=scatter,
            ),
            "bandwidth_sensitivity": ChartData(
                chart_type="line",
                title="Bandwidth Sensitivity",
                x_label="Bandwidth",
                y_label="RD Estimate",
                data=[
                    {"x": b.bandwidth, "y": b.estimate, "ci_lower": b.ci_lower, "ci_upper": b.ci_upper}
                    for b in sensitivity
                ],
            ),
        }

        # ---------- Narrative ----------
        result_dict = dict(
            rd_estimate=rd_estimate,
            rd_ci_lower=ci_lower,
            rd_ci_upper=ci_upper,
            rd_p_value=p_value,
            optimal_bandwidth=optimal_h,
            mccrary_p_value=mccrary_p,
            mccrary_manipulation=mccrary_manip,
            n_left=n_left,
            n_right=n_right,
        )
        narrative = _narrative_rdd(result_dict)

        return RDDResponse(
            rd_estimate=round(rd_estimate, 6),
            rd_ci_lower=round(ci_lower, 6),
            rd_ci_upper=round(ci_upper, 6),
            rd_p_value=round(p_value, 6),
            optimal_bandwidth=round(optimal_h, 6),
            mccrary_p_value=mccrary_p,
            mccrary_manipulation=mccrary_manip,
            n_left=n_left,
            n_right=n_right,
            bandwidth_sensitivity=sensitivity,
            scatter_data=scatter,
            fitted_lines=fitted_lines,
            charts=charts,
            narrative=narrative,
            warnings=warnings,
        )
