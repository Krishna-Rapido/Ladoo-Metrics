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


class CausalImpactAnalyzer:
    """Bayesian Structural Time Series (CausalImpact)."""
    def __init__(self, df: pd.DataFrame, config: "CausalImpactRequest"):
        self.df = df
        self.config = config

    def run(self) -> "CausalImpactResponse":
        raise NotImplementedError("CausalImpact implementation pending")


class HTEAnalyzer:
    """Heterogeneous Treatment Effects via Causal Forest."""
    def __init__(self, df: pd.DataFrame, config: "HTERequest"):
        self.df = df
        self.config = config

    def run(self) -> "HTEResponse":
        raise NotImplementedError("HTE implementation pending")


class SyntheticControlAnalyzer:
    """Synthetic Control Method."""
    def __init__(self, df: pd.DataFrame, config: "SyntheticControlRequest"):
        self.df = df
        self.config = config

    def run(self) -> "SyntheticControlResponse":
        raise NotImplementedError("Synthetic Control implementation pending")


class RDDAnalyzer:
    """Regression Discontinuity Design."""
    def __init__(self, df: pd.DataFrame, config: "RDDRequest"):
        self.df = df
        self.config = config

    def run(self) -> "RDDResponse":
        raise NotImplementedError("RDD implementation pending")
