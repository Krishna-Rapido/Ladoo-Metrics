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
    confirmed: Optional[str] = None  # legacy single confirmation filter
    test_confirmed: Optional[str] = None  # per-test confirmation filter
    control_confirmed: Optional[str] = None  # per-control confirmation filter
    agg: Optional[Literal["sum", "mean", "count"]] = None  # optional aggregation for arbitrary metric
    series_breakout: Optional[str] = None  # categorical column to group by for series breakout


class FunnelPoint(BaseModel):
    date: str
    cohort: str
    metric: str
    value: float
    series_value: Optional[str] = None  # value of the series breakout column


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


class CohortAggregationRow(BaseModel):
    cohort: str
    totalExpCaps: float
    visitedCaps: float
    clickedCaptain: float
    pitch_centre_card_clicked: float
    pitch_centre_card_visible: float
    exploredCaptains: float
    exploredCaptains_Subs: float
    exploredCaptains_EPKM: float
    exploredCaptains_FlatCommission: float
    exploredCaptains_CM: float
    confirmedCaptains: float
    confirmedCaptains_Subs: float
    confirmedCaptains_Subs_purchased: float
    confirmedCaptains_Subs_purchased_weekend: float
    confirmedCaptains_EPKM: float
    confirmedCaptains_FlatCommission: float
    confirmedCaptains_CM: float
    Visit2Click: float
    Base2Visit: float
    Click2Confirm: float


class CohortAggregationResponse(BaseModel):
    data: List[CohortAggregationRow]


# Captain-Level Aggregation Schemas
class MetricAggregation(BaseModel):
    column: str
    agg_func: Literal["sum", "mean", "count", "nunique", "median", "std", "min", "max"]


class CaptainLevelRequest(BaseModel):
    pre_period: Optional[DateRange] = None
    post_period: Optional[DateRange] = None
    test_cohort: str
    control_cohort: str
    test_confirmed: Optional[str] = None
    control_confirmed: Optional[str] = None
    group_by_column: str  # e.g., consistency_segment
    metric_aggregations: List[MetricAggregation]  # list of metrics to aggregate


class CaptainLevelAggregationRow(BaseModel):
    period: str  # "pre" or "post"
    cohort_type: str  # "test" or "control"
    date: Optional[str] = None  # YYYY-MM-DD
    group_value: str  # value from group_by_column (e.g., specific consistency_segment)
    aggregations: Dict[str, float]  # {metric_agg: value}


class CaptainLevelResponse(BaseModel):
    data: List[CaptainLevelAggregationRow]
    group_by_column: str
    metrics: List[str]


# Funnel Analysis Schemas
class MobileNumberUploadResponse(BaseModel):
    funnel_session_id: str
    num_rows: int
    columns: List[str]
    has_cohort: bool
    preview: List[Dict[str, Any]]  # First 5 rows
    duplicates_removed: int = 0  # Number of duplicate rows removed


class CaptainIdRequest(BaseModel):
    username: str  # Presto username


class CaptainIdResponse(BaseModel):
    num_rows: int
    num_captains_found: int
    preview: List[Dict[str, Any]]  # First 5 rows


class AOFunnelRequest(BaseModel):
    username: str
    start_date: str = "20250801"
    end_date: str = "20251031"
    time_level: Literal["daily", "weekly", "monthly"] = "daily"
    tod_level: Literal["daily", "afternoon", "evening", "morning", "night", "all"] = "daily"


class AOFunnelResponse(BaseModel):
    num_rows: int
    columns: List[str]
    preview: List[Dict[str, Any]]  # First 10 rows
    metrics: List[str]  # Available metric columns
    unique_captain_ids: int  # Count of unique captain IDs in full dataset


class DaprBucketRequest(BaseModel):
    username: str
    start_date: str = "20250801"
    end_date: str = "20251031"
    city: str = "delhi"
    service_category: str = "bike_taxi"
    low_dapr: float = 0.6
    high_dapr: float = 0.8


class DaprBucketResponse(BaseModel):
    num_rows: int
    columns: List[str]
    data: List[Dict[str, Any]]  # Full result set


class Fe2NetRequest(BaseModel):
    username: str
    start_date: str = "20250801"
    end_date: str = "20251031"
    city: str = "delhi"
    service_category: str = "bike_taxi"
    geo_level: str = "city"
    time_level: str = "daily"


class Fe2NetResponse(BaseModel):
    num_rows: int
    columns: List[str]
    data: List[Dict[str, Any]]  # Full result set


class RtuPerformanceRequest(BaseModel):
    username: str
    start_date: str = "20251015"
    end_date: str = "20251130"
    city: str = "hyderabad"
    perf_cut: int = 0
    consistency_cut: int = 1
    time_level: str = "daily"
    tod_level: str = "daily"
    service_category: str = "auto"


class RtuPerformanceResponse(BaseModel):
    num_rows: int
    columns: List[str]
    data: List[Dict[str, Any]]  # Full result set


class R2ARequest(BaseModel):
    username: str
    start_date: str = "20251015"
    end_date: str = "20251130"
    city: str = "hyderabad"
    service: str = "auto"
    time_level: str = "day"


class R2AResponse(BaseModel):
    num_rows: int
    columns: List[str]
    data: List[Dict[str, Any]]  # Full result set


class R2APercentageRequest(BaseModel):
    username: str
    start_date: str = "20251001"
    end_date: str = "20251130"
    city: str = "hyderabad"
    service: str = "auto"
    time_level: str = "day"


class R2APercentageResponse(BaseModel):
    num_rows: int
    columns: List[str]
    data: List[Dict[str, Any]]  # Full result set


class A2PhhSummaryRequest(BaseModel):
    username: str
    start_date: str = "20251001"
    end_date: str = "20251130"
    city: str = "bangalore"
    service: str = "auto"
    time_level: str = "day"


class A2PhhSummaryResponse(BaseModel):
    num_rows: int
    columns: List[str]
    data: List[Dict[str, Any]]  # Full result set


class ReportItem(BaseModel):
    id: str
    type: str  # 'chart', 'table', 'text'
    title: str
    content: Dict[str, Any]  # Chart config, table data, or text content
    comment: str = ""
    timestamp: str


class ReportAddRequest(BaseModel):
    type: str
    title: str
    content: Dict[str, Any]
    comment: str = ""


class ReportAddResponse(BaseModel):
    report_id: str
    item_id: str
    num_items: int


class ReportUpdateCommentRequest(BaseModel):
    item_id: str
    comment: str


class ReportUpdateTitleRequest(BaseModel):
    item_id: str
    title: str


class ReportListResponse(BaseModel):
    report_id: str
    items: List[ReportItem]


class ReportExportResponse(BaseModel):
    report_html: str


