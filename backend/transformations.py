from __future__ import annotations

from typing import Iterable, Literal, Optional, Dict, List

import pandas as pd


DateLike = pd.Timestamp | str


def coerce_datetime(series: pd.Series, tz_aware: bool = False) -> pd.Series:
    """Coerce a Series to pandas datetime.

    Parameters
    ----------
    series: pd.Series
        Series expected to contain date/time-like values.
    tz_aware: bool
        If True, ensure timezone-aware (UTC) timestamps.
    """
    dt = pd.to_datetime(series, errors="coerce")
    if tz_aware:
        if dt.dt.tz is None:
            dt = dt.dt.tz_localize("UTC")
        else:
            dt = dt.dt.tz_convert("UTC")
    return dt


def validate_columns(df: pd.DataFrame, required: Iterable[str]) -> None:
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")


def filter_by_date_range(
    df: pd.DataFrame,
    start_date: Optional[DateLike] = None,
    end_date: Optional[DateLike] = None,
    date_col: str = "date",
) -> pd.DataFrame:
    """Return subset of df between start_date and end_date inclusive.

    - Accepts str or Timestamp for dates.
    - Does not mutate original df.
    """
    if df.empty:
        return df.copy()
    out = df.copy()
    if date_col not in out.columns:
        raise ValueError(f"date column '{date_col}' not found")
    out[date_col] = coerce_datetime(out[date_col])
    print(f"filtering by date range {start_date} to {end_date} on column {date_col}")
    if start_date is not None:
        start_ts = pd.to_datetime(start_date)
        out = out[out[date_col] >= start_ts]
    if end_date is not None:
        end_ts = pd.to_datetime(end_date)
        out = out[out[date_col] <= end_ts]
    return out


def subset_by_cohorts(
    df: pd.DataFrame,
    cohorts: Iterable[str],
    cohort_col: str = "cohort",
) -> pd.DataFrame:
    if cohort_col not in df.columns:
        raise ValueError(f"cohort column '{cohort_col}' not found")
    cohorts_set = set(cohorts)
    return df[df[cohort_col].isin(cohorts_set)].copy()


def get_cohort(base: pd.DataFrame, cohort: str, confirmed: str = '', cohort_col: str = "cohort") -> pd.DataFrame:
    """
    Filter data by cohort and optionally by confirmation status.
    
    Parameters
    ----------
    base : pd.DataFrame
        The base dataframe to filter
    cohort : str
        The cohort value to filter by
    confirmed : str, optional
        The confirmation column to filter by (non-null values)
    cohort_col : str, default "cohort"
        The name of the cohort column
        
    Returns
    -------
    pd.DataFrame
        Filtered dataframe
    """
    if cohort_col not in base.columns:
        raise ValueError(f"cohort column '{cohort_col}' not found")
    
    # First filter by cohort
    cohort_filtered = base[base[cohort_col] == cohort].copy()
    
    # If confirmation filter is specified, apply it
    if confirmed:
        if confirmed not in base.columns:
            raise ValueError(f"confirmation column '{confirmed}' not found")
        # Filter for non-null values in the confirmation column
        cohort_filtered = cohort_filtered[~cohort_filtered[confirmed].isna()]
    
    return cohort_filtered


def aggregate_time_series(
    df: pd.DataFrame,
    group_by: list[str],
    value_col: str = "metric_value",
    agg: Literal["sum", "mean", "count"] = "sum",
) -> pd.DataFrame:
    validate_columns(df, group_by + [value_col])
    if agg == "count":
        grouped = df.groupby(group_by, dropna=False)[value_col].count()
    else:
        grouped = df.groupby(group_by, dropna=False)[value_col].agg(agg)
    out = grouped.reset_index().rename(columns={value_col: f"{value_col}_{agg}"})
    return out


def rolling_average(
    df: pd.DataFrame,
    value_col: str = "metric_value",
    window: int = 7,
    by: Optional[list[str]] = None,
    date_col: str = "date",
) -> pd.DataFrame:
    validate_columns(df, [value_col, date_col])
    out = df.copy()
    out[date_col] = coerce_datetime(out[date_col])
    sort_cols = (by or []) + [date_col]
    out = out.sort_values(sort_cols)

    def _roll(group: pd.DataFrame) -> pd.DataFrame:
        group[f"{value_col}_roll_{window}"] = (
            group[value_col].rolling(window=window, min_periods=1).mean()
        )
        return group

    if by:
        out = out.groupby(by, group_keys=False).apply(_roll)
    else:
        out = _roll(out)
    return out


def normalized_growth(
    df: pd.DataFrame,
    value_col: str = "metric_value",
    baseline_date: Optional[DateLike] = None,
    by: Optional[list[str]] = None,
    date_col: str = "date",
) -> pd.DataFrame:
    """Compute percent change relative to first value or provided baseline_date.

    Returns a new column `<value_col>_pct_change` in percentage (0..100).
    If baseline_date provided, use the value at that date per group as baseline.
    """
    validate_columns(df, [value_col, date_col])
    out = df.copy()
    out[date_col] = coerce_datetime(out[date_col])
    sort_cols = (by or []) + [date_col]
    out = out.sort_values(sort_cols)

    def _compute(group: pd.DataFrame) -> pd.DataFrame:
        if baseline_date is not None:
            base_ts = pd.to_datetime(baseline_date)
            baseline_row = group.loc[group[date_col] == base_ts]
            if not baseline_row.empty:
                baseline_val = baseline_row[value_col].iloc[0]
            else:
                baseline_val = group[value_col].iloc[0]
        else:
            baseline_val = group[value_col].iloc[0]

        denom = baseline_val if baseline_val != 0 else 1e-9
        group[f"{value_col}_pct_change"] = (group[value_col] - baseline_val) / denom * 100.0
        return group

    if by:
        out = out.groupby(by, group_keys=False).apply(_compute)
    else:
        out = _compute(out)
    return out


__all__ = [
    "coerce_datetime",
    "validate_columns",
    "filter_by_date_range",
    "subset_by_cohorts",
    "aggregate_time_series",
    "rolling_average",
    "normalized_growth",
]


# ---------- Funnel-specific utilities ----------

FUNNEL_STAGES: List[str] = [
    "ao_days",
    "online_days",
    "gross_days",
    "accepted_days",
    "net_days",
]


def add_funnel_ratios(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    for i, denom in enumerate(FUNNEL_STAGES):
        if denom not in out.columns:
            continue
        for j in range(i + 1, len(FUNNEL_STAGES)):
            numer = FUNNEL_STAGES[j]
            if numer not in out.columns:
                continue
            col_name = f"{denom}2{numer}"
            denom_series = out[denom].replace(0, pd.NA)
            out[col_name] = out[numer] / denom_series
    return out.fillna(0)


def get_ao2n_funnel_data(base: pd.DataFrame) -> pd.DataFrame:
    """Aggregate to daily timeseries and compute funnel ratios.

    Expects columns like:
      - 'date' (datetime), optional 'time' (int/str yyyymmdd already coerced to 'date' beforehand)
      - 'captain_id' (optional)
      - stages: ao_days, online_days, gross_days, accepted_days, net_days (optional if missing)
      - metrics like total_lh, dapr (optional)
    """
    df = base.copy()
    if "date" not in df.columns:
        if "time" in df.columns:
            df["date"] = pd.to_datetime(df["time"].astype(str), format="%Y%m%d", errors="coerce")
        else:
            raise ValueError("Expected 'date' or 'time' column")
    df["date"] = coerce_datetime(df["date"])  # ensure datetime

    agg_map: Dict[str, str] = {}
    if "captain_id" in df.columns:
        agg_map["captain_id"] = "nunique"
    for col in FUNNEL_STAGES:
        if col in df.columns:
            agg_map[col] = "sum"
    for mean_col in ["total_lh", "dapr"]:
        if mean_col in df.columns:
            agg_map[mean_col] = "mean"

    group_cols = ["date"]
    grouped = df.groupby(group_cols).agg(agg_map).reset_index()
    grouped = add_funnel_ratios(grouped)
    # enforce numeric types
    for c in grouped.columns:
        if c == "date":
            continue
        grouped[c] = pd.to_numeric(grouped[c], errors="coerce").fillna(0.0)
    return grouped


def compute_cohort_funnel_timeseries(df: pd.DataFrame) -> pd.DataFrame:
    """Compute funnel aggregations per cohort per date."""
    if "cohort" not in df.columns:
        raise ValueError("Missing 'cohort' column")
    frames: List[pd.DataFrame] = []
    for cohort in sorted(df["cohort"].dropna().unique().tolist()):
        part = df[df["cohort"] == cohort].copy()
        ts = get_ao2n_funnel_data(part)
        ts["cohort"] = cohort
        frames.append(ts)
    if not frames:
        return pd.DataFrame(columns=["date", "cohort"])  # empty
    out = pd.concat(frames, ignore_index=True)
    out = out.sort_values(["cohort", "date"]).reset_index(drop=True)
    return out


def compute_metric_timeseries_by_cohort(
    base: pd.DataFrame,
    value_col: str,
    agg: Literal["sum", "mean", "count"] = "sum",
) -> pd.DataFrame:
    """Compute per-day, per-cohort timeseries for an arbitrary column with an aggregation.

    Ensures a `date` column exists (derived from `time` if needed) and groups
    by ["date", "cohort"]. Returns a DataFrame with columns ["date", "cohort", value_col].
    """
    df = base.copy()
    if "cohort" not in df.columns:
        raise ValueError("Missing 'cohort' column")

    # Ensure a date column is present
    if "date" not in df.columns:
        if "time" in df.columns:
            df["date"] = pd.to_datetime(df["time"].astype(str), format="%Y%m%d", errors="coerce")
        else:
            raise ValueError("Expected 'date' or 'time' column")
    df["date"] = coerce_datetime(df["date"])  # ensure datetime

    # For numeric aggs, coerce to numeric to avoid type issues
    if agg in ("sum", "mean"):
        if value_col not in df.columns:
            raise ValueError(f"Column '{value_col}' not found in data")
        df[value_col] = pd.to_numeric(df[value_col], errors="coerce")

    group_cols = ["date", "cohort"]
    if value_col not in df.columns:
        raise ValueError(f"Column '{value_col}' not found in data")

    if agg == "count":
        grouped = (
            df.groupby(group_cols, dropna=False)[value_col]
            .count()
            .reset_index()
            .rename(columns={value_col: value_col})
        )
    else:
        grouped = (
            df.groupby(group_cols, dropna=False)[value_col]
            .agg(agg)
            .reset_index()
            .rename(columns={value_col: value_col})
        )

    # Ensure numeric output
    grouped[value_col] = pd.to_numeric(grouped[value_col], errors="coerce").fillna(0.0)
    grouped = grouped.sort_values(["cohort", "date"]).reset_index(drop=True)
    return grouped


