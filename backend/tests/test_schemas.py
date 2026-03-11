"""Pydantic model validation tests for key request/response schemas."""

import pytest
from pydantic import ValidationError

from schemas import (
    UploadResponse,
    InsightsRequest,
    InsightsSummaryRow,
    StatTestRequest,
    StatTestData,
    MetricSpec,
    DateRange,
)


class TestUploadResponse:
    def test_valid(self):
        resp = UploadResponse(
            session_id="abc123",
            num_rows=100,
            columns=["captain_id", "cohort", "date", "trips"],
            cohorts=["test", "control"],
            date_min="2025-01-01",
            date_max="2025-01-31",
            metrics=["trips"],
        )
        assert resp.session_id == "abc123"
        assert resp.num_rows == 100

    def test_missing_required_field(self):
        with pytest.raises(ValidationError):
            UploadResponse(session_id="abc123")  # type: ignore[call-arg]


class TestInsightsRequest:
    def test_minimal(self):
        req = InsightsRequest(test_cohort="test", control_cohort="control")
        assert req.test_cohort == "test"
        assert req.metrics == []

    def test_with_date_ranges(self):
        req = InsightsRequest(
            pre_period=DateRange(start_date="2025-01-01", end_date="2025-01-15"),
            post_period=DateRange(start_date="2025-01-16", end_date="2025-01-31"),
            test_cohort="test",
            control_cohort="control",
            metrics=[MetricSpec(column="trips", agg_func="mean")],
        )
        assert req.pre_period.start_date == "2025-01-01"
        assert len(req.metrics) == 1


class TestInsightsSummaryRow:
    def test_valid(self):
        row = InsightsSummaryRow(
            metric="trips",
            agg_func="mean",
            control_pre=5.0,
            control_post=6.0,
            control_delta=1.0,
            test_pre=5.0,
            test_post=8.0,
            test_delta=3.0,
            diff_in_diff=2.0,
        )
        assert row.diff_in_diff == 2.0


class TestStatTestRequest:
    def test_valid(self):
        req = StatTestRequest(
            test_category="parametric",
            test_name="t_test",
            data=StatTestData(
                pre_test=[1.0, 2.0, 3.0],
                post_test=[4.0, 5.0, 6.0],
                pre_control=[1.0, 2.0, 3.0],
                post_control=[4.0, 5.0, 6.0],
            ),
        )
        assert req.test_name == "t_test"
