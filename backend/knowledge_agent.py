"""
Ladoo Metrics — Knowledge Graph Agent Layer

Two components:
  SchemaInferenceEngine — deterministic join relationship inference (no LLM)
  NLQueryAgent          — natural language → validated SQL via Claude

The knowledge graph stores table schemas, column metadata, and join relationships
in Supabase. The NLQueryAgent reads that graph at query time to build dynamic
schema context for the LLM, then validates all generated SQL before execution.
"""

from __future__ import annotations

import logging
import os
import re
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Anthropic client (Claude API)
# ---------------------------------------------------------------------------

_anthropic_client = None


def get_anthropic_client():
    global _anthropic_client
    if _anthropic_client is None:
        from anthropic import Anthropic
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY environment variable is not set")
        _anthropic_client = Anthropic(api_key=api_key)
    return _anthropic_client


# ---------------------------------------------------------------------------
# SQL Validation — defense-in-depth
# ---------------------------------------------------------------------------

# Blocked SQL keywords (case-insensitive, word-boundary match)
_BLOCKED_SQL_PATTERNS = [
    r'\bINSERT\b',
    r'\bUPDATE\b',
    r'\bDELETE\b',
    r'\bDROP\b',
    r'\bCREATE\b',
    r'\bALTER\b',
    r'\bTRUNCATE\b',
    r'\bGRANT\b',
    r'\bREVOKE\b',
    r'\bEXEC\b',
    r'\bEXECUTE\b',
    r'\bCALL\b',
    r'\bMERGE\b',
    r'\bREPLACE\b',
]


def validate_generated_sql(sql: str) -> Tuple[bool, str]:
    """
    Validate that generated SQL is safe to execute.
    Returns (is_valid, error_message).
    Only SELECT and WITH (CTE) statements are allowed.
    """
    stripped = sql.strip()
    if not stripped:
        return False, "Empty SQL"

    # Must start with SELECT or WITH
    upper = stripped.upper()
    if not (upper.startswith("SELECT") or upper.startswith("WITH")):
        return False, "SQL must start with SELECT or WITH"

    # Check for blocked patterns
    for pattern in _BLOCKED_SQL_PATTERNS:
        # Skip checking inside string literals by doing a rough check
        # on the SQL outside of quoted strings
        if re.search(pattern, sql, re.IGNORECASE):
            # More precise: strip string literals first
            sql_no_strings = re.sub(r"'[^']*'", "''", sql)
            if re.search(pattern, sql_no_strings, re.IGNORECASE):
                keyword = re.search(pattern, sql_no_strings, re.IGNORECASE).group()
                return False, f"Blocked SQL keyword: {keyword}"

    # No multiple statements (semicolons outside string literals)
    sql_no_strings = re.sub(r"'[^']*'", "''", sql)
    if ";" in sql_no_strings.rstrip().rstrip(";"):
        return False, "Multiple SQL statements not allowed"

    return True, ""


# ---------------------------------------------------------------------------
# Schema Inference Engine (deterministic, no LLM)
# ---------------------------------------------------------------------------

def _jaro_winkler_similarity(s1: str, s2: str) -> float:
    """Simple Jaro-Winkler similarity for column name fuzzy matching."""
    if s1 == s2:
        return 1.0
    len_s1, len_s2 = len(s1), len(s2)
    if len_s1 == 0 or len_s2 == 0:
        return 0.0

    match_distance = max(len_s1, len_s2) // 2 - 1
    if match_distance < 0:
        match_distance = 0

    s1_matches = [False] * len_s1
    s2_matches = [False] * len_s2

    matches = 0
    transpositions = 0

    for i in range(len_s1):
        start = max(0, i - match_distance)
        end = min(i + match_distance + 1, len_s2)
        for j in range(start, end):
            if s2_matches[j] or s1[i] != s2[j]:
                continue
            s1_matches[i] = True
            s2_matches[j] = True
            matches += 1
            break

    if matches == 0:
        return 0.0

    k = 0
    for i in range(len_s1):
        if not s1_matches[i]:
            continue
        while not s2_matches[k]:
            k += 1
        if s1[i] != s2[k]:
            transpositions += 1
        k += 1

    jaro = (matches / len_s1 + matches / len_s2 + (matches - transpositions / 2) / matches) / 3

    # Winkler modification: boost for common prefix (up to 4 chars)
    prefix = 0
    for i in range(min(4, len_s1, len_s2)):
        if s1[i] == s2[i]:
            prefix += 1
        else:
            break

    return jaro + prefix * 0.1 * (1 - jaro)


# Type-compatible groups for join inference
_COMPATIBLE_TYPE_GROUPS = {
    "varchar": {"varchar", "text", "string", "char"},
    "bigint": {"bigint", "integer", "int", "smallint", "tinyint"},
    "double": {"double", "float", "real", "decimal", "numeric"},
}


def _types_compatible(type_a: str, type_b: str) -> bool:
    """Check if two SQL types are compatible for joining."""
    a = type_a.lower().split("(")[0].strip()
    b = type_b.lower().split("(")[0].strip()
    if a == b:
        return True
    for group in _COMPATIBLE_TYPE_GROUPS.values():
        if a in group and b in group:
            return True
    return False


@dataclass
class InferredRelationship:
    from_table_id: str
    from_table_name: str
    from_column: str
    from_type: str
    to_table_id: str
    to_table_name: str
    to_column: str
    to_type: str
    confidence: float
    reason: str


class SchemaInferenceEngine:
    """
    Infers join relationships between registered tables using deterministic rules.
    No LLM involved — purely pattern-based.
    """

    def infer(
        self,
        tables: List[Dict[str, Any]],
        existing_relationships: Optional[List[Dict[str, Any]]] = None,
    ) -> List[InferredRelationship]:
        """
        Given a list of tables (each with 'id', 'table_name', 'columns' list),
        infer join relationships.

        Each column in 'columns' should have: column_name, data_type
        """
        if len(tables) < 2:
            return []

        existing_pairs = set()
        if existing_relationships:
            for rel in existing_relationships:
                pair = (rel["from_table_id"], rel["from_column"],
                        rel["to_table_id"], rel["to_column"])
                existing_pairs.add(pair)
                # Also add reverse
                reverse = (rel["to_table_id"], rel["to_column"],
                           rel["from_table_id"], rel["from_column"])
                existing_pairs.add(reverse)

        candidates: List[InferredRelationship] = []

        for i, table_a in enumerate(tables):
            for table_b in tables[i + 1:]:
                pair_candidates = self._infer_between(table_a, table_b, existing_pairs)
                candidates.extend(pair_candidates)

        # Keep top relationship per table pair
        best: Dict[str, InferredRelationship] = {}
        for c in candidates:
            key = tuple(sorted([c.from_table_id, c.to_table_id]))
            pair_key = f"{key[0]}_{key[1]}"
            if pair_key not in best or c.confidence > best[pair_key].confidence:
                best[pair_key] = c

        # Filter below threshold
        return [r for r in best.values() if r.confidence >= 0.40]

    def _infer_between(
        self,
        table_a: Dict[str, Any],
        table_b: Dict[str, Any],
        existing_pairs: set,
    ) -> List[InferredRelationship]:
        """Infer relationships between two specific tables."""
        results = []

        cols_a = table_a.get("columns", [])
        cols_b = table_b.get("columns", [])

        for ca in cols_a:
            for cb in cols_b:
                pair = (table_a["id"], ca["column_name"],
                        table_b["id"], cb["column_name"])
                if pair in existing_pairs:
                    continue

                rel = self._check_relationship(
                    table_a, ca, table_b, cb
                )
                if rel:
                    results.append(rel)

        return results

    def _check_relationship(
        self,
        table_a: Dict, col_a: Dict,
        table_b: Dict, col_b: Dict,
    ) -> Optional[InferredRelationship]:
        """Check if two columns form a join relationship."""
        name_a = col_a["column_name"].lower()
        name_b = col_b["column_name"].lower()
        type_a = col_a.get("data_type", "")
        type_b = col_b.get("data_type", "")

        if not _types_compatible(type_a, type_b):
            return None

        # Rule 1: Exact name match (confidence 0.95)
        if name_a == name_b:
            return InferredRelationship(
                from_table_id=table_a["id"],
                from_table_name=table_a["table_name"],
                from_column=col_a["column_name"],
                from_type=type_a,
                to_table_id=table_b["id"],
                to_table_name=table_b["table_name"],
                to_column=col_b["column_name"],
                to_type=type_b,
                confidence=0.95,
                reason=f"Exact column name match: {name_a}",
            )

        # Extract table short names for prefix matching
        short_a = table_a["table_name"].split(".")[-1].lower()
        short_b = table_b["table_name"].split(".")[-1].lower()

        # Rule 2: Table-name-prefixed ID (confidence 0.90)
        # e.g. column 'captain_id' matches if other table has 'captain' in its name
        if name_a == f"{short_b}_id" or name_a == f"{short_b}id":
            return InferredRelationship(
                from_table_id=table_a["id"],
                from_table_name=table_a["table_name"],
                from_column=col_a["column_name"],
                from_type=type_a,
                to_table_id=table_b["id"],
                to_table_name=table_b["table_name"],
                to_column=col_b["column_name"],
                to_type=type_b,
                confidence=0.90,
                reason=f"Table-name-prefixed ID: {name_a} → {short_b}",
            )
        if name_b == f"{short_a}_id" or name_b == f"{short_a}id":
            return InferredRelationship(
                from_table_id=table_a["id"],
                from_table_name=table_a["table_name"],
                from_column=col_a["column_name"],
                from_type=type_a,
                to_table_id=table_b["id"],
                to_table_name=table_b["table_name"],
                to_column=col_b["column_name"],
                to_type=type_b,
                confidence=0.90,
                reason=f"Table-name-prefixed ID: {name_b} → {short_a}",
            )

        # Rule 3: Shared ID suffix (confidence 0.85)
        if (name_a.endswith("_id") and name_b.endswith("_id") and
                name_a.replace("_id", "") == name_b.replace("_id", "")):
            return InferredRelationship(
                from_table_id=table_a["id"],
                from_table_name=table_a["table_name"],
                from_column=col_a["column_name"],
                from_type=type_a,
                to_table_id=table_b["id"],
                to_table_name=table_b["table_name"],
                to_column=col_b["column_name"],
                to_type=type_b,
                confidence=0.85,
                reason=f"Shared ID suffix: {name_a} ↔ {name_b}",
            )

        # Rule 4: Jaro-Winkler fuzzy match (confidence based on similarity)
        similarity = _jaro_winkler_similarity(name_a, name_b)
        if similarity >= 0.85:
            confidence = round(0.70 * similarity, 2)
            if confidence >= 0.40:
                return InferredRelationship(
                    from_table_id=table_a["id"],
                    from_table_name=table_a["table_name"],
                    from_column=col_a["column_name"],
                    from_type=type_a,
                    to_table_id=table_b["id"],
                    to_table_name=table_b["table_name"],
                    to_column=col_b["column_name"],
                    to_type=type_b,
                    confidence=confidence,
                    reason=f"Fuzzy name match ({similarity:.0%}): {name_a} ↔ {name_b}",
                )

        return None


# ---------------------------------------------------------------------------
# NL Query Agent (LLM for intent parsing, SQL generation)
# ---------------------------------------------------------------------------

def build_schema_context(tables: List[Dict[str, Any]], relationships: List[Dict[str, Any]]) -> str:
    """
    Build a dynamic schema context string from the stored knowledge graph.
    This replaces the hardcoded PRESTO_SCHEMA_CONTEXT for NL queries.
    """
    if not tables:
        return "No tables registered in the knowledge graph yet."

    lines = ["=== KNOWLEDGE GRAPH SCHEMA ===\n"]

    for table in tables:
        t_name = table.get("table_name", "unknown")
        friendly = table.get("friendly_name", "")
        desc = table.get("description", "")
        grain = table.get("grain", "")
        time_col = table.get("time_column", "")

        lines.append(f"TABLE: {t_name}")
        if friendly:
            lines.append(f"  Name: {friendly}")
        if desc:
            lines.append(f"  Description: {desc}")
        if grain:
            lines.append(f"  Grain: {grain}")
        if time_col:
            time_fmt = table.get("time_format", "")
            lines.append(f"  Time column: {time_col} (format: {time_fmt})")

        cols = table.get("columns", [])
        if cols:
            lines.append("  COLUMNS:")
            for col in cols:
                col_name = col.get("column_name", "")
                col_type = col.get("data_type", "")
                col_desc = col.get("friendly_name") or col.get("description", "")
                cat = col.get("category", "")
                line = f"    {col_name:40s} {col_type:15s}"
                if col_desc:
                    line += f"  {col_desc}"
                if cat:
                    line += f"  [{cat}]"
                lines.append(line)
        lines.append("")

    # Add relationship info
    if relationships:
        lines.append("=== JOIN RELATIONSHIPS ===")
        for rel in relationships:
            approved = "approved" if rel.get("is_approved") else "inferred"
            lines.append(
                f"  {rel.get('from_table_name', '?')}.{rel.get('from_column', '?')} "
                f"→ {rel.get('to_table_name', '?')}.{rel.get('to_column', '?')} "
                f"({rel.get('join_type', 'inner')} join, {approved})"
            )
        lines.append("")

    return "\n".join(lines)


_NL_QUERY_SYSTEM_PROMPT = """\
You are a SQL query generator for a ride-sharing analytics platform (Rapido).
You translate natural language questions into Presto/Trino SQL queries.

RULES:
1. Only generate SELECT or WITH (CTE) statements. Never INSERT, UPDATE, DELETE, DROP, etc.
2. Use the schema below to determine table names, column names, and join conditions.
3. When the user mentions "captains", they mean drivers on the Rapido platform.
4. Date columns may be in YYYYMMDD string format — use appropriate casting/comparison.
5. Always use fully-qualified table names (schema.table).
6. For aggregations, include reasonable GROUP BY and ORDER BY clauses.
7. Limit results to 1000 rows unless the user specifically asks for more.
8. If the question is ambiguous, make reasonable assumptions and explain them.

RESPOND IN THIS EXACT FORMAT:
<intent>One sentence describing what you understood the user wants</intent>
<sql>The SQL query</sql>
<explanation>Brief explanation of the query logic and any assumptions made</explanation>
"""


@dataclass
class NLQueryAgent:
    """Translates natural language questions to validated SQL queries."""

    def generate(
        self,
        question: str,
        schema_context: str,
    ) -> Dict[str, str]:
        """
        Generate SQL from a natural language question.
        Returns dict with keys: intent, sql, explanation, error
        """
        try:
            client = get_anthropic_client()
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2000,
                temperature=0.1,
                system=_NL_QUERY_SYSTEM_PROMPT + "\n\n" + schema_context,
                messages=[
                    {"role": "user", "content": question},
                ],
            )

            content = response.content[0].text if response.content else ""

            # Parse structured response
            intent = self._extract_tag(content, "intent") or ""
            sql = self._extract_tag(content, "sql") or ""
            explanation = self._extract_tag(content, "explanation") or ""

            if not sql:
                return {
                    "intent": intent or content[:200],
                    "sql": "",
                    "explanation": "",
                    "error": "LLM did not generate a SQL query.",
                }

            # Clean up SQL
            sql = sql.strip().rstrip(";")

            # Validate
            is_valid, error_msg = validate_generated_sql(sql)
            if not is_valid:
                return {
                    "intent": intent,
                    "sql": sql,
                    "explanation": explanation,
                    "error": f"SQL validation failed: {error_msg}",
                }

            return {
                "intent": intent,
                "sql": sql,
                "explanation": explanation,
                "error": "",
            }

        except Exception as e:
            logger.exception("NLQueryAgent.generate failed")
            return {
                "intent": "",
                "sql": "",
                "explanation": "",
                "error": str(e),
            }

    def execute_sql(
        self,
        sql: str,
        username: str,
    ) -> Dict[str, Any]:
        """
        Execute validated SQL against Presto and return results.
        Returns dict with keys: rows, columns, row_count, execution_time_ms, error
        """
        from function_executor import get_presto_connection

        # Re-validate before execution
        is_valid, error_msg = validate_generated_sql(sql)
        if not is_valid:
            return {"rows": [], "columns": [], "row_count": 0,
                    "execution_time_ms": 0, "error": f"SQL validation failed: {error_msg}"}

        conn = None
        try:
            start = time.time()
            conn = get_presto_connection(username)
            df = pd.read_sql(sql, conn)
            elapsed_ms = int((time.time() - start) * 1000)

            # Limit preview to 500 rows
            preview_df = df.head(500)

            # Convert to JSON-safe types
            rows = preview_df.where(preview_df.notna(), None).to_dict(orient="records")
            columns = list(df.columns)

            return {
                "rows": rows,
                "columns": columns,
                "row_count": len(df),
                "execution_time_ms": elapsed_ms,
                "error": "",
            }
        except Exception as e:
            logger.exception("NLQueryAgent.execute_sql failed")
            return {
                "rows": [],
                "columns": [],
                "row_count": 0,
                "execution_time_ms": 0,
                "error": str(e),
            }
        finally:
            if conn:
                try:
                    conn.close()
                except Exception:
                    pass

    @staticmethod
    def _extract_tag(text: str, tag: str) -> Optional[str]:
        """Extract content between <tag>...</tag>."""
        pattern = rf"<{tag}>(.*?)</{tag}>"
        match = re.search(pattern, text, re.DOTALL)
        return match.group(1).strip() if match else None


# ---------------------------------------------------------------------------
# Auto-detect: read Presto SHOW COLUMNS
# ---------------------------------------------------------------------------

def auto_detect_columns(table_name: str, username: str) -> List[Dict[str, str]]:
    """
    Run SHOW COLUMNS FROM <table_name> on Presto and return column metadata.
    Returns list of dicts with column_name, data_type.
    """
    from function_executor import get_presto_connection

    # Basic table name validation (schema.table or catalog.schema.table)
    if not re.match(r'^[\w]+\.[\w]+(?:\.[\w]+)?$', table_name):
        raise ValueError(f"Invalid table name format: {table_name}")

    conn = None
    try:
        conn = get_presto_connection(username)
        cursor = conn.cursor()
        cursor.execute(f"SHOW COLUMNS FROM {table_name}")
        rows = cursor.fetchall()

        columns = []
        for row in rows:
            col_name = row[0]
            col_type = row[1] if len(row) > 1 else ""
            # Infer category from type
            category = "dimension"
            lower_type = col_type.lower()
            if any(t in lower_type for t in ["bigint", "integer", "double", "float", "decimal"]):
                category = "measure"
            if any(t in col_name.lower() for t in ["date", "time", "yyyymmdd", "timestamp"]):
                category = "time"
            if col_name.lower().endswith("_id") or col_name.lower() == "id":
                category = "identifier"

            columns.append({
                "column_name": col_name,
                "data_type": col_type,
                "category": category,
            })

        return columns
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass
