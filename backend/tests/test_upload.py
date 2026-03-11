"""Tests for CSV upload endpoint."""

import io


def test_upload_valid_csv(client, sample_csv_bytes):
    resp = client.post(
        "/upload",
        files={"file": ("data.csv", io.BytesIO(sample_csv_bytes), "text/csv")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "session_id" in data
    assert data["num_rows"] == 8
    assert set(data["cohorts"]) == {"test", "control"}
    assert "trips" in data["metrics"]
    assert "earnings" in data["metrics"]
    assert data["date_min"] == "2025-01-01"
    assert data["date_max"] == "2025-01-02"


def test_upload_time_column(client, sample_csv_time_col_bytes):
    """CSV with 'time' (YYYYMMDD) column should also be accepted."""
    resp = client.post(
        "/upload",
        files={"file": ("data.csv", io.BytesIO(sample_csv_time_col_bytes), "text/csv")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["num_rows"] == 4
    assert set(data["cohorts"]) == {"test", "control"}


def test_upload_rejects_non_csv(client):
    resp = client.post(
        "/upload",
        files={"file": ("data.json", io.BytesIO(b'{"a":1}'), "application/json")},
    )
    assert resp.status_code == 400
    assert "CSV" in resp.json()["detail"]


def test_upload_rejects_missing_cohort(client):
    csv = b"captain_id,date,trips\nC001,2025-01-01,5\n"
    resp = client.post(
        "/upload",
        files={"file": ("data.csv", io.BytesIO(csv), "text/csv")},
    )
    assert resp.status_code == 400
    assert "cohort" in resp.json()["detail"].lower()


def test_upload_rejects_missing_date(client):
    csv = b"captain_id,cohort,trips\nC001,test,5\n"
    resp = client.post(
        "/upload",
        files={"file": ("data.csv", io.BytesIO(csv), "text/csv")},
    )
    assert resp.status_code == 400
    assert "date" in resp.json()["detail"].lower() or "time" in resp.json()["detail"].lower()


def test_session_id_is_unique(client, sample_csv_bytes):
    """Two uploads should produce different session IDs."""
    r1 = client.post("/upload", files={"file": ("a.csv", io.BytesIO(sample_csv_bytes), "text/csv")})
    r2 = client.post("/upload", files={"file": ("b.csv", io.BytesIO(sample_csv_bytes), "text/csv")})
    assert r1.json()["session_id"] != r2.json()["session_id"]
