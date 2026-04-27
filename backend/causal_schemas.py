"""Pydantic schemas for the Causal Inference Lab endpoints."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


# ── Shared types ──────────────────────────────────────────────────────

class ChartSeries(BaseModel):
    """A single data series for a chart."""
    name: str
    values: List[float]
    labels: Optional[List[str]] = None


class ChartData(BaseModel):
    """Generic chart data container."""
    chart_type: str
    title: str
    x_label: Optional[str] = None
    y_label: Optional[str] = None
    series: List[ChartSeries] = Field(default_factory=list)
    annotations: Optional[Dict[str, Any]] = None
    data: Optional[List[Dict[str, Any]]] = None


class MethodRecommendation(BaseModel):
    """Recommendation for a single causal method."""
    method: Literal["psm", "causal_impact", "hte", "synthetic_control", "rdd"]
    feasible: bool
    recommended: bool = False
    reason: str
    warnings: List[str] = Field(default_factory=list)


# ── PSM ───────────────────────────────────────────────────────────────

class PSMRequest(BaseModel):
    outcome_metric: str
    covariates: Optional[List[str]] = None
    matching_method: Literal["nearest", "caliper", "kernel"] = "nearest"
    caliper_width: float = 0.2
    pre_start: str
    pre_end: str
    post_start: str
    post_end: str
    test_cohort: str = "test"
    control_cohort: str = "control"


class PSMBalanceRow(BaseModel):
    """One covariate's balance stats before and after matching."""
    covariate: str
    smd_before: float
    smd_after: float
    mean_test_before: float
    mean_control_before: float
    mean_test_after: float
    mean_control_after: float


class PSMResponse(BaseModel):
    att: float
    att_ci_lower: float
    att_ci_upper: float
    att_p_value: float
    naive_estimate: float
    n_matched_pairs: int
    n_unmatched_test: int
    n_total_test: int
    n_total_control: int
    overlap_score: float
    balance: List[PSMBalanceRow]
    charts: Dict[str, ChartData]
    propensity_scores_test: List[float]
    propensity_scores_control: List[float]
    narrative: str
    warnings: List[str] = Field(default_factory=list)


# ── CausalImpact ─────────────────────────────────────────────────────

class CausalImpactRequest(BaseModel):
    outcome_metric: str
    aggregation: Literal["sum", "mean"] = "mean"
    pre_start: str
    pre_end: str
    post_start: str
    post_end: str
    use_control_as_covariate: bool = True
    test_cohort: str = "test"
    control_cohort: Optional[str] = "control"


class CausalImpactResponse(BaseModel):
    average_effect: float
    average_effect_ci: List[float]
    cumulative_effect: float
    cumulative_effect_ci: List[float]
    posterior_probability: float
    model_mape: float
    charts: Dict[str, ChartData]
    time_series: List[Dict[str, Any]]
    narrative: str
    warnings: List[str] = Field(default_factory=list)


# ── HTE ──────────────────────────────────────────────────────────────

class HTERequest(BaseModel):
    outcome_metric: str
    covariates: Optional[List[str]] = None
    segment_columns: Optional[List[str]] = None
    pre_start: str
    pre_end: str
    post_start: str
    post_end: str
    test_cohort: str = "test"
    control_cohort: str = "control"


class HTESegmentEffect(BaseModel):
    """CATE for one segment."""
    segment_name: str
    segment_value: str
    cate: float
    cate_ci_lower: float
    cate_ci_upper: float
    n_captains: int


class HTEFeatureImportance(BaseModel):
    feature: str
    importance: float


class HTEResponse(BaseModel):
    ate: float
    ate_ci: List[float]
    segment_effects: List[HTESegmentEffect]
    feature_importance: List[HTEFeatureImportance]
    cate_distribution: Dict[str, Any]
    individual_cates: List[Dict[str, Any]]
    charts: Dict[str, ChartData]
    narrative: str
    warnings: List[str] = Field(default_factory=list)


# ── Synthetic Control ────────────────────────────────────────────────

class SyntheticControlRequest(BaseModel):
    outcome_metric: str
    unit_column: str = "city"
    treated_unit: str
    intervention_date: str
    aggregation: Literal["sum", "mean"] = "mean"


class DonorWeight(BaseModel):
    unit: str
    weight: float


class SyntheticControlResponse(BaseModel):
    estimated_effect: float
    estimated_effect_pct: float
    pre_rmspe: float
    post_rmspe: float
    placebo_p_value: Optional[float] = None
    donor_weights: List[DonorWeight]
    time_series: List[Dict[str, Any]]
    placebo_gaps: Optional[List[Dict[str, Any]]] = None
    charts: Dict[str, ChartData]
    narrative: str
    warnings: List[str] = Field(default_factory=list)


# ── RDD ──────────────────────────────────────────────────────────────

class RDDRequest(BaseModel):
    running_variable: str
    cutoff_value: float
    outcome_metric: str
    kernel: Literal["triangular", "epanechnikov", "uniform"] = "triangular"
    polynomial_order: int = 1
    post_start: Optional[str] = None
    post_end: Optional[str] = None


class BandwidthEstimate(BaseModel):
    bandwidth: float
    estimate: float
    ci_lower: float
    ci_upper: float
    n_left: int
    n_right: int


class RDDResponse(BaseModel):
    rd_estimate: float
    rd_ci_lower: float
    rd_ci_upper: float
    rd_p_value: float
    optimal_bandwidth: float
    mccrary_p_value: Optional[float] = None
    mccrary_manipulation: bool = False
    n_left: int
    n_right: int
    bandwidth_sensitivity: List[BandwidthEstimate]
    scatter_data: List[Dict[str, Any]]
    fitted_lines: Dict[str, List[Dict[str, float]]]
    charts: Dict[str, ChartData]
    narrative: str
    warnings: List[str] = Field(default_factory=list)


# ── Recommend / Validate / Export ────────────────────────────────────

class CausalRecommendRequest(BaseModel):
    test_cohort: Optional[str] = None
    control_cohort: Optional[str] = None


class CausalRecommendResponse(BaseModel):
    recommendations: List[MethodRecommendation]


class CausalValidateRequest(BaseModel):
    method: Literal["psm", "causal_impact", "hte", "synthetic_control", "rdd"]
    outcome_metric: str
    running_variable: Optional[str] = None
    cutoff_value: Optional[float] = None
    unit_column: Optional[str] = None
    treated_unit: Optional[str] = None


class CausalValidateResponse(BaseModel):
    feasible: bool
    warnings: List[str]
    sample_sizes: Optional[Dict[str, int]] = None
    data_quality: Optional[Dict[str, Any]] = None


class CausalExportRequest(BaseModel):
    method: str
    results: Dict[str, Any]
    title: Optional[str] = None
    comment: Optional[str] = None
