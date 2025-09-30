from __future__ import annotations

from typing import Dict, List, Literal, Optional, Any

from pydantic import BaseModel, Field


class UploadResponse(BaseModel):
    session_id: str
    num_rows: int
    columns: List[str]
    cohorts: List[str]
    date_min: Optional[str] = None
    date_max: Optional[str] = None
    metrics: List[str] = Field(default_factory=list)


class DateRange(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None


Aggregation = Literal["sum", "mean", "count"]


class MetricsRequest(BaseModel):
    pre_period: Optional[DateRange] = None
    post_period: Optional[DateRange] = None
    test_cohort: Optional[str] = None
    control_cohort: Optional[str] = None
    aggregations: List[Aggregation] = Field(default_factory=lambda: ["sum", "mean", "count"])
    rolling_windows: List[int] = Field(default_factory=lambda: [7, 30])
    normalized_growth_baseline_date: Optional[str] = None


class TimeSeriesPoint(BaseModel):
    date: str
    cohort: str
    metric_value: float
    metric_value_roll_7: Optional[float] = None
    metric_value_roll_30: Optional[float] = None
    metric_value_pct_change: Optional[float] = None


class SummaryStats(BaseModel):
    aggregation: Aggregation
    test_value: float
    control_value: float
    mean_difference: float
    pct_change: Optional[float] = None


class MetricsResponse(BaseModel):
    time_series: List[TimeSeriesPoint]
    summaries: List[SummaryStats]


class ErrorResponse(BaseModel):
    detail: str


class FunnelRequest(BaseModel):
    pre_period: Optional[DateRange] = None
    post_period: Optional[DateRange] = None
    test_cohort: Optional[str] = None
    control_cohort: Optional[str] = None
    metric: Optional[str] = None  # which metric to plot (any of stages/ratios)
    confirmed: Optional[str] = None  # confirmation column filter
    agg: Optional[Literal["sum", "mean", "count"]] = None  # optional aggregation for arbitrary metric


class FunnelPoint(BaseModel):
    date: str
    cohort: str
    metric: str
    value: float


class FunnelResponse(BaseModel):
    metrics_available: List[str]
    pre_series: List[FunnelPoint]
    post_series: List[FunnelPoint]
    pre_summary: Dict[str, float]
    post_summary: Dict[str, float]


# Statistical Testing Schemas
class StatTestData(BaseModel):
    pre_test: List[float]
    post_test: List[float]
    pre_control: List[float]
    post_control: List[float]


class StatTestRequest(BaseModel):
    test_category: str
    test_name: str
    parameters: Dict[str, Any] = Field(default_factory=dict)
    data: StatTestData


class StatTestResult(BaseModel):
    test_name: str
    category: str
    statistic: Optional[float] = None
    p_value: Optional[float] = None
    effect_size: Optional[float] = None
    confidence_interval: Optional[List[float]] = None
    sample_size: Optional[int] = None
    power: Optional[float] = None
    summary: str
    parameters_used: Dict[str, Any] = Field(default_factory=dict)
    raw_output: Optional[Dict[str, Any]] = None


