"""
Shared fixtures for the Ladoo Metrics backend test suite.

Sets TRINO_HOST="" to prevent real Trino connections during tests.
"""

from __future__ import annotations

import io
import os

import pytest

# Prevent Trino connections during tests
os.environ["TRINO_HOST"] = ""

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402


@pytest.fixture()
def client() -> TestClient:
    """FastAPI TestClient wrapping the app."""
    return TestClient(app)


@pytest.fixture()
def sample_csv_bytes() -> bytes:
    """Minimal valid CSV with cohort, date, and metric columns."""
    lines = [
        "captain_id,cohort,date,trips,earnings",
        "C001,test,2025-01-01,5,500",
        "C001,test,2025-01-02,7,700",
        "C002,test,2025-01-01,3,300",
        "C002,test,2025-01-02,4,400",
        "C003,control,2025-01-01,6,600",
        "C003,control,2025-01-02,8,800",
        "C004,control,2025-01-01,2,200",
        "C004,control,2025-01-02,5,500",
    ]
    return "\n".join(lines).encode("utf-8")


@pytest.fixture()
def sample_csv_time_col_bytes() -> bytes:
    """Valid CSV using 'time' (YYYYMMDD) instead of 'date'."""
    lines = [
        "captain_id,cohort,time,trips",
        "C001,test,20250101,5",
        "C001,test,20250102,7",
        "C002,control,20250101,3",
        "C002,control,20250102,4",
    ]
    return "\n".join(lines).encode("utf-8")


@pytest.fixture()
def uploaded_session(client: TestClient, sample_csv_bytes: bytes) -> str:
    """Upload the sample CSV and return the session_id."""
    resp = client.post(
        "/upload",
        files={"file": ("test.csv", io.BytesIO(sample_csv_bytes), "text/csv")},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["session_id"]
