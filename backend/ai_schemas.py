"""
Pydantic schemas for the AI agent layer.
"""
from __future__ import annotations
from typing import Any, List, Optional, Dict
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# MetricGen
# ---------------------------------------------------------------------------

class AIGenerateMetricRequest(BaseModel):
    description: str                          # Plain English metric description
    context: str = ""                         # Optional: session columns, experiment type
    username: str
    function_catalog: List[Dict[str, Any]] = []  # Saved functions for context
    test_immediately: bool = False            # If True, run preview against Presto
    default_params: Optional[Dict[str, Any]] = None  # Params for test run


class AIGenerateMetricResponse(BaseModel):
    success: bool
    code: str = ""
    explanation: str = ""
    alternatives: List[str] = []
    parameters: List[Dict[str, Any]] = []
    output_columns: List[str] = []
    preview: List[Dict[str, Any]] = []
    error: str = ""
    confidence: str = "medium"               # "high" | "medium" | "low"


class AIRefineMetricRequest(BaseModel):
    original_code: str
    feedback: str                             # "add a city filter" / "also include accepted_pings"
    username: str = ""


# ---------------------------------------------------------------------------
# MetricSuggest
# ---------------------------------------------------------------------------

class AISuggestMetricsRequest(BaseModel):
    session_columns: List[str]
    selected_metrics: List[str] = []
    experiment_type: str = "unknown"          # "acquisition" | "retention" | "quality" | "incentive"
    cohort_sizes: Optional[Dict[str, int]] = None
    date_range_days: int = 14
    extra_context: str = ""


class MetricSuggestionItem(BaseModel):
    label: str
    description: str
    why: str
    source: str                               # "existing_column" | "ratio" | "generate_function"
    column: str = ""
    ratio_x: str = ""
    ratio_y: str = ""
    function_hint: str = ""
    priority: str = "medium"


class AISuggestMetricsResponse(BaseModel):
    suggestions: List[MetricSuggestionItem]
    behavioral_hypothesis: str = ""


# ---------------------------------------------------------------------------
# ProblemDiscovery
# ---------------------------------------------------------------------------

class AIDiscoverProblemsRequest(BaseModel):
    username: str
    city: str = ""
    service_category: str = "auto"
    lookback_days: int = 35
    check_types: Optional[List[str]] = None   # None = all checks
    enhance_with_llm: bool = True


class DiscoveryFindingItem(BaseModel):
    id: str
    title: str
    severity: str                             # "critical" | "warning" | "notice"
    segment: str
    metric: str
    finding: str
    hypothesis: str
    suggested_action: str
    z_score: float
    baseline: float
    recent: float
    pct_change: float
    data: Dict[str, Any] = {}


class AIDiscoverProblemsResponse(BaseModel):
    findings: List[DiscoveryFindingItem]
    scan_timestamp: str
    checks_run: int
    city: str = ""
    service_category: str = ""
    narrative: str = ""


# ---------------------------------------------------------------------------
# NarrativeExplainer
# ---------------------------------------------------------------------------

class ExperimentContextInput(BaseModel):
    experiment_id: str = ""
    test_cohort_size: Optional[int] = None
    control_cohort_size: Optional[int] = None
    pre_days: Optional[int] = None
    post_days: Optional[int] = None
    city: str = ""
    service: str = ""


class AIExplainInsightsRequest(BaseModel):
    summary_rows: List[Dict[str, Any]]        # ExecutiveRow dicts from frontend
    experiment_context: Optional[ExperimentContextInput] = None


class AIExplainInsightsResponse(BaseModel):
    narrative: str
    key_findings: List[str] = []
    concerns: List[str] = []
    recommended_next_metrics: List[str] = []
