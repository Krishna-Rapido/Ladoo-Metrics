"""
Pydantic schemas for the Researcher — Captain Segment Discovery Lab.

Covers:
  - Contrast Analysis (Method 2)
  - Stimulus-Response Analysis (Method 3)
  - Response Profiles (6 axes)
  - Validation Pipeline (6-gate test)
  - Segment Catalog CRUD
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


# =============================================================================
# Shared types
# =============================================================================

class FeatureComparison(BaseModel):
    """One row of the contrast analysis output."""
    feature: str
    group_a_mean: float
    group_b_mean: float
    effect_size: float        # Cohen's d
    p_value: float
    test_used: str            # "mann_whitney" | "chi_square"
    significant: bool         # After Bonferroni correction


class ResponseProfileItem(BaseModel):
    """One captain's response profile vector."""
    captain_id: str
    incentive_elasticity: Optional[float] = None
    incentive_persistence: Optional[float] = None
    target_earning_score: Optional[float] = None
    loss_response: Optional[float] = None
    frustration_resilience: Optional[float] = None
    behavioral_inertia: Optional[float] = None
    efficiency_slope: Optional[float] = None
    demand_supply_fit: Optional[float] = None


# =============================================================================
# Contrast Analysis
# =============================================================================

class ContrastAnalysisRequest(BaseModel):
    """Run Method 2: Contrast Analysis."""
    username: str
    city: str
    start_date: str           # YYYYMMDD
    end_date: str             # YYYYMMDD
    # Base population filters
    consistency_segment: Optional[str] = None   # "daily" | "weekly" | etc.
    performance_segment: Optional[str] = None   # "UHP" | "HP" | etc.
    # Splitting outcome
    splitting_outcome: str    # "churn_28d" | "incentive_response" | "custom"
    # For custom splitting: column name + threshold
    custom_column: Optional[str] = None
    custom_threshold: Optional[float] = None
    custom_direction: Optional[str] = "above"   # "above" | "below"
    # Minimum captains per group
    min_group_size: int = 50


class ContrastAnalysisResponse(BaseModel):
    success: bool
    group_a_label: str        # e.g. "Churned"
    group_b_label: str        # e.g. "Retained"
    group_a_size: int
    group_b_size: int
    comparisons: List[FeatureComparison]
    top_features: List[str]   # Sorted by absolute effect size
    queries: List[str] = []   # Executed SQL queries for transparency
    error: str = ""


# =============================================================================
# Stimulus-Response Analysis
# =============================================================================

class StimulusResponseRequest(BaseModel):
    """Run Method 3: Stimulus-Response profiling."""
    username: str
    city: str
    start_date: str           # YYYYMMDD
    end_date: str             # YYYYMMDD
    # Which response axes to compute
    axes: List[str] = [
        "incentive_elasticity",
        "target_earning",
        "frustration_resilience",
        "behavioral_inertia",
        "efficiency_trajectory",
        "demand_supply_fit",
    ]
    # Population filters (optional)
    consistency_segment: Optional[str] = None
    performance_segment: Optional[str] = None
    min_active_days: int = 14


class StimulusResponseResponse(BaseModel):
    success: bool
    captain_count: int
    profiles: List[ResponseProfileItem]
    axis_stats: Dict[str, Dict[str, float]]  # { axis: { mean, median, std, min, max } }
    queries: List[str] = []   # Executed SQL queries for transparency
    error: str = ""


# =============================================================================
# Validation (6-Gate Test)
# =============================================================================

class GateResult(BaseModel):
    gate: str                 # "size" | "separation" | "stability" | "orthogonality" | "predictive_lift" | "actionability"
    passed: bool
    value: Optional[float] = None
    threshold: Optional[float] = None
    detail: str = ""


class ValidateSegmentRequest(BaseModel):
    """Run the 6-gate validation on a candidate segment."""
    username: str
    city: str
    start_date: str
    end_date: str
    # Segment definition
    segment_name: str
    segment_definition: Dict[str, Any]
    # e.g. {"feature": "target_earning_score", "operator": "<", "threshold": -0.25}
    # Population context
    consistency_segment: Optional[str] = None
    performance_segment: Optional[str] = None
    # Actionability note (Gate 6 — human input)
    actionability_note: Optional[str] = None


class ValidateSegmentResponse(BaseModel):
    success: bool
    segment_name: str
    segment_size: int
    population_size: int
    population_pct: float
    gates: List[GateResult]
    gates_passed: int
    total_gates: int
    ready_to_publish: bool
    error: str = ""


# =============================================================================
# Segment Catalog
# =============================================================================

class SegmentCreateRequest(BaseModel):
    """Publish a validated segment to the catalog."""
    name: str
    description: str
    definition: str
    method: str
    city: Optional[str] = None
    population_context: Optional[str] = None
    validation: Dict[str, Any] = {}
    segment_size: Optional[int] = None
    population_pct: Optional[float] = None
    key_features: List[str] = []
    actionability_note: Optional[str] = None
    investigation_id: Optional[str] = None


class SegmentResponse(BaseModel):
    id: str
    name: str
    description: str
    definition: str
    method: str
    city: Optional[str] = None
    population_context: Optional[str] = None
    validation: Dict[str, Any] = {}
    segment_size: Optional[int] = None
    population_pct: Optional[float] = None
    key_features: List[str] = []
    status: str
    actionability_note: Optional[str] = None
    created_by: str
    created_at: str
    updated_at: str


class SegmentListResponse(BaseModel):
    segments: List[SegmentResponse]


# =============================================================================
# Investigation CRUD
# =============================================================================

class InvestigationCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    method: str               # "contrast" | "stimulus_response" | "residual" | "combined"
    config: Dict[str, Any] = {}


class InvestigationUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    results: Optional[Dict[str, Any]] = None
    notebook_entry: Optional[Dict[str, Any]] = None  # Append a single entry


class InvestigationResponse(BaseModel):
    id: str
    user_id: str
    title: str
    description: Optional[str] = None
    method: str
    status: str
    config: Dict[str, Any] = {}
    results: Optional[Dict[str, Any]] = None
    notebook: List[Dict[str, Any]] = []
    created_at: str
    updated_at: str


class InvestigationListResponse(BaseModel):
    investigations: List[InvestigationResponse]


# =============================================================================
# Chat (Conversational Agent)
# =============================================================================

class ResearcherChatMessage(BaseModel):
    """A single message in the researcher chat conversation."""
    role: str                 # "user" | "assistant"
    content: Optional[str] = None


class ResearcherRule(BaseModel):
    """A user-defined rule that the AI agent should follow."""
    type: str     # "table" | "filter" | "analysis" | "custom"
    content: str
    scope: str    # "global" | "chat"


class ResearcherChatRequest(BaseModel):
    """Request body for the /researcher/chat SSE endpoint."""
    messages: List[ResearcherChatMessage]
    username: str
    investigation_id: Optional[str] = None
    rules: List[ResearcherRule] = []


# =============================================================================
# Presto Connection Test
# =============================================================================

class PrestoTestRequest(BaseModel):
    """Request body for /researcher/test-connection."""
    username: str


class TableTestResult(BaseModel):
    """Result of testing access to a single Presto table."""
    table: str
    accessible: bool
    row_count: Optional[int] = None
    columns_found: List[str] = []
    error: Optional[str] = None
    query_ms: int = 0


class PrestoTestResponse(BaseModel):
    """Full diagnostic result for Presto connectivity."""
    connected: bool
    username: str
    presto_host: str
    presto_port: int
    basic_query_ok: bool
    basic_query_error: Optional[str] = None
    tables: List[TableTestResult]
    summary: str
