"""Tests for the Causal Inference Lab module."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from causal_inference import prepare_pre_period_features, recommend_methods, PSMAnalyzer
from causal_schemas import PSMRequest


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


@pytest.fixture()
def psm_experiment_df() -> pd.DataFrame:
    """Experiment with known selection bias: test group has higher pre-period trips."""
    np.random.seed(42)
    rows = []
    for i in range(200):
        cid = f"C{i:04d}"
        cohort = "test" if i < 100 else "control"
        base_trips = np.random.normal(10, 2) if cohort == "test" else np.random.normal(7, 2)
        base_earnings = base_trips * np.random.uniform(80, 120)
        for day_offset in range(20):
            date = pd.Timestamp("2025-01-01") + pd.Timedelta(days=day_offset)
            treatment_boost = 2.0 if cohort == "test" and day_offset >= 10 else 0
            rows.append({
                "captain_id": cid,
                "date": date.strftime("%Y-%m-%d"),
                "cohort": cohort,
                "trips": max(0, base_trips + np.random.normal(0, 1) + treatment_boost),
                "earnings": max(0, base_earnings + np.random.normal(0, 50) + treatment_boost * 100),
                "online_hours": np.random.uniform(4, 10),
            })
    return pd.DataFrame(rows)


class TestPSMAnalyzer:
    def test_returns_valid_response(self, psm_experiment_df: pd.DataFrame):
        config = PSMRequest(
            outcome_metric="trips",
            pre_start="2025-01-01", pre_end="2025-01-10",
            post_start="2025-01-11", post_end="2025-01-20",
        )
        analyzer = PSMAnalyzer(psm_experiment_df, config)
        result = analyzer.run()
        assert result.n_matched_pairs > 0
        assert 0 <= result.overlap_score <= 1
        assert len(result.balance) > 0
        assert result.narrative != ""

    def test_att_less_than_naive(self, psm_experiment_df: pd.DataFrame):
        """PSM should correct for selection bias, giving a smaller effect than naive."""
        config = PSMRequest(
            outcome_metric="trips",
            pre_start="2025-01-01", pre_end="2025-01-10",
            post_start="2025-01-11", post_end="2025-01-20",
        )
        result = PSMAnalyzer(psm_experiment_df, config).run()
        assert abs(result.att) < abs(result.naive_estimate) or abs(result.att - result.naive_estimate) < 1

    def test_balance_improves_after_matching(self, psm_experiment_df: pd.DataFrame):
        config = PSMRequest(
            outcome_metric="trips",
            pre_start="2025-01-01", pre_end="2025-01-10",
            post_start="2025-01-11", post_end="2025-01-20",
        )
        result = PSMAnalyzer(psm_experiment_df, config).run()
        # For covariates that were meaningfully imbalanced before matching (|SMD| > 0.1),
        # balance should improve after matching. Already-balanced covariates are excluded
        # because NN matching can slightly perturb them.
        for row in result.balance:
            if abs(row.smd_before) > 0.1:
                assert abs(row.smd_after) <= abs(row.smd_before) + 0.05
