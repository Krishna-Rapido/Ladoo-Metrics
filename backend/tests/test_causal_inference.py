"""Tests for the Causal Inference Lab module."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from causal_inference import prepare_pre_period_features, recommend_methods


@pytest.fixture()
def experiment_df() -> pd.DataFrame:
    """Experiment DataFrame: 20 captains × 10 days × 2 cohorts (10 test + 10 control)."""
    np.random.seed(42)
    rows = []
    test_ids = [f"T{i:03d}" for i in range(1, 11)]
    control_ids = [f"C{i:03d}" for i in range(1, 11)]
    for cid in test_ids + control_ids:
        cohort = "test" if cid.startswith("T") else "control"
        for day_offset in range(10):
            date = pd.Timestamp("2025-01-01") + pd.Timedelta(days=day_offset)
            rows.append({
                "captain_id": cid,
                "date": date.strftime("%Y-%m-%d"),
                "yyyymmdd": int(date.strftime("%Y%m%d")),
                "cohort": cohort,
                "trips": np.random.randint(1, 15),
                "earnings": np.random.uniform(200, 1500),
                "online_hours": np.random.uniform(2, 12),
            })
    return pd.DataFrame(rows)


class TestPreparePrePeriodFeatures:
    def test_returns_captain_level_aggregates(self, experiment_df: pd.DataFrame):
        result = prepare_pre_period_features(
            df=experiment_df,
            pre_start="2025-01-01",
            pre_end="2025-01-05",
            metrics=["trips", "earnings"],
        )
        assert len(result) == 20
        assert "captain_id" in result.columns
        assert "trips_mean" in result.columns
        assert "earnings_mean" in result.columns
        assert "trips_std" in result.columns

    def test_filters_to_pre_period_only(self, experiment_df: pd.DataFrame):
        result = prepare_pre_period_features(
            df=experiment_df,
            pre_start="2025-01-01",
            pre_end="2025-01-03",
            metrics=["trips"],
        )
        assert len(result) == 20

    def test_preserves_cohort_column(self, experiment_df: pd.DataFrame):
        result = prepare_pre_period_features(
            df=experiment_df,
            pre_start="2025-01-01",
            pre_end="2025-01-05",
            metrics=["trips"],
        )
        assert "cohort" in result.columns


class TestRecommendMethods:
    def test_recommends_psm_when_cohort_exists(self, experiment_df: pd.DataFrame):
        recs = recommend_methods(experiment_df, test_cohort="test", control_cohort="control")
        psm = next(r for r in recs if r.method == "psm")
        assert psm.feasible is True

    def test_synthetic_control_infeasible_without_city(self, experiment_df: pd.DataFrame):
        recs = recommend_methods(experiment_df, test_cohort="test", control_cohort="control")
        sc = next(r for r in recs if r.method == "synthetic_control")
        assert sc.feasible is False

    def test_rdd_infeasible_by_default(self, experiment_df: pd.DataFrame):
        recs = recommend_methods(experiment_df, test_cohort="test", control_cohort="control")
        rdd = next(r for r in recs if r.method == "rdd")
        assert rdd.feasible is False
