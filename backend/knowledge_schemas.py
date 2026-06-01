"""
Pydantic schemas for the Knowledge Graph + NL Query system.
"""
from __future__ import annotations
from typing import Any, List, Optional, Dict
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Schema Tables
# ---------------------------------------------------------------------------

class SchemaTableCreate(BaseModel):
    table_name: str
    friendly_name: str = ""
    description: str = ""
    grain: str = ""
    time_column: str = ""
    time_format: str = ""
    default_filters: Dict[str, Any] = {}
    tags: List[str] = []


class SchemaTableUpdate(BaseModel):
    friendly_name: Optional[str] = None
    description: Optional[str] = None
    grain: Optional[str] = None
    time_column: Optional[str] = None
    time_format: Optional[str] = None
    default_filters: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None


class SchemaTableResponse(BaseModel):
    id: str
    table_name: str
    friendly_name: str
    description: str
    grain: str
    time_column: str
    time_format: str
    default_filters: Dict[str, Any] = {}
    tags: List[str] = []
    columns: List[SchemaColumnResponse] = []


# ---------------------------------------------------------------------------
# Schema Columns
# ---------------------------------------------------------------------------

class SchemaColumnCreate(BaseModel):
    column_name: str
    data_type: str = ""
    friendly_name: str = ""
    description: str = ""
    category: str = "dimension"          # dimension | measure | time | identifier
    is_nullable: bool = True
    sample_values: List[Any] = []


class SchemaColumnUpdate(BaseModel):
    friendly_name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    data_type: Optional[str] = None
    is_nullable: Optional[bool] = None
    sample_values: Optional[List[Any]] = None


class SchemaColumnResponse(BaseModel):
    id: str
    table_id: str
    column_name: str
    data_type: str
    friendly_name: str
    description: str
    category: str
    is_nullable: bool
    sample_values: List[Any] = []


class BulkColumnsCreate(BaseModel):
    columns: List[SchemaColumnCreate]


# ---------------------------------------------------------------------------
# Schema Relationships
# ---------------------------------------------------------------------------

class SchemaRelationshipCreate(BaseModel):
    from_table_id: str
    from_column: str
    to_table_id: str
    to_column: str
    join_type: str = "inner"             # inner | left | right | full
    confidence: float = 1.0
    is_approved: bool = True
    inference_reason: str = "manual"


class SchemaRelationshipUpdate(BaseModel):
    join_type: Optional[str] = None
    is_approved: Optional[bool] = None
    confidence: Optional[float] = None


class SchemaRelationshipResponse(BaseModel):
    id: str
    from_table_id: str
    from_column: str
    to_table_id: str
    to_column: str
    join_type: str
    confidence: float
    is_approved: bool
    approved_by: Optional[str] = None
    inference_reason: str


# ---------------------------------------------------------------------------
# Inference
# ---------------------------------------------------------------------------

class InferRelationshipsRequest(BaseModel):
    table_ids: List[str] = []            # Empty = infer across all tables


class InferRelationshipsResponse(BaseModel):
    inferred: List[SchemaRelationshipResponse]
    count: int


# ---------------------------------------------------------------------------
# Auto-detect
# ---------------------------------------------------------------------------

class AutoDetectRequest(BaseModel):
    table_name: str                       # Fully qualified Presto table name
    username: str


class AutoDetectResponse(BaseModel):
    table_name: str
    columns: List[SchemaColumnCreate]
    error: str = ""


# ---------------------------------------------------------------------------
# NL Query
# ---------------------------------------------------------------------------

class NLQueryRequest(BaseModel):
    question: str
    execute: bool = False
    sql_override: Optional[str] = None   # If user edited the SQL
    username: str = ""


class NLQueryResponse(BaseModel):
    success: bool
    intent: str = ""
    sql: str = ""
    explanation: str = ""
    rows: List[Dict[str, Any]] = []
    columns: List[str] = []
    row_count: int = 0
    execution_time_ms: int = 0
    query_id: str = ""
    error: str = ""


class NLQueryHistoryItem(BaseModel):
    id: str
    question: str
    interpreted_intent: str
    generated_sql: str
    was_executed: bool
    row_count: Optional[int] = None
    feedback: Optional[str] = None
    created_at: str


class QueryFeedbackRequest(BaseModel):
    feedback: str                         # "thumbs_up" | "thumbs_down"


# ---------------------------------------------------------------------------
# Dashboard Query Generation
# ---------------------------------------------------------------------------

class GenerateDashboardQueryRequest(BaseModel):
    prompt: str


class GenerateDashboardQueryResponse(BaseModel):
    success: bool
    sql: str = ""
    explanation: str = ""
    detected_params: List[str] = []
    error: str = 
