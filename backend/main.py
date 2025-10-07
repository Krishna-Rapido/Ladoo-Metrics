from __future__ import annotations

import io
import secrets
from typing import Dict, Optional

import pandas as pd
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import schemas
from schemas import (
    ErrorResponse,
    MetricsRequest,
    MetricsResponse,
    TimeSeriesPoint,
    UploadResponse,
    FunnelRequest,
    FunnelResponse,
    FunnelPoint,
    StatTestRequest,
    StatTestResult,
    CohortAggregationResponse,
    CohortAggregationRow,
)
from transformations import (
    aggregate_time_series,
    filter_by_date_range,
    normalized_growth,
    rolling_average,
    subset_by_cohorts,
    get_cohort,
    compute_cohort_funnel_timeseries,
)


app = FastAPI(title="Cohort Metrics API")

# Simple in-memory session store mapping session_id to DataFrame
SESSION_STORE: Dict[str, pd.DataFrame] = {}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_session_df(x_session_id: Optional[str] = Header(default=None)) -> pd.DataFrame:
    if not x_session_id or x_session_id not in SESSION_STORE:
        raise HTTPException(status_code=400, detail="Invalid or missing session_id. Upload data first.")
    return SESSION_STORE[x_session_id]


@app.post("/upload", response_model=UploadResponse, responses={400: {"model": ErrorResponse}})
async def upload_csv(file: UploadFile = File(...)) -> UploadResponse:
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Failed to read CSV: {exc}")

    # Validate identifiers
    if "cohort" not in df.columns:
        raise HTTPException(status_code=400, detail="CSV missing required column: 'cohort'")
    if ("date" not in df.columns) and ("time" not in df.columns):
        raise HTTPException(status_code=400, detail="CSV must include 'date' (YYYY-MM-DD) or 'time' (YYYYMMDD)")

    df = df.copy()
    # Coerce a unified date column
    # df['date'] = df['time'].astype(str)
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
    else:
        df["date"] = pd.to_datetime(df["time"].astype(str), format="%Y%m%d", errors="coerce")
    if df["date"].isna().any():
        x = df["date"].isna().sum()
        raise HTTPException(status_code=400, detail=f"Invalid date/time values found = {x}")
    df["cohort"] = df["cohort"].astype(str)
    # Best-effort numeric coercion for other columns
    for c in df.columns:
        if c in {"cohort", "date", "time"}:
            continue
        try:
            df[c] = pd.to_numeric(df[c], errors="ignore")
        except Exception:
            pass

    session_id = secrets.token_hex(16)
    SESSION_STORE[session_id] = df

    cohorts = sorted(df["cohort"].dropna().unique().tolist())
    date_min = df["date"].min()
    date_max = df["date"].max()

    # Determine available metric columns
    metric_candidates = [c for c in df.columns if c not in {"cohort", "date", "time"}]
    return UploadResponse(
        session_id=session_id,
        num_rows=df.shape[0],
        columns=list(df.columns.astype(str)),
        cohorts=cohorts,
        date_min=date_min.strftime("%Y-%m-%d"),
        date_max=date_max.strftime("%Y-%m-%d"),
        metrics=metric_candidates,
    )


@app.get("/meta")
def get_meta(df: pd.DataFrame = Depends(get_session_df)):
    cohorts = sorted(df["cohort"].dropna().unique().tolist())
    date_min = df["date"].min().strftime("%Y-%m-%d")
    date_max = df["date"].max().strftime("%Y-%m-%d")
    metrics = [c for c in df.columns if c not in {"cohort", "date", "time"}]
    return {"cohorts": cohorts, "date_min": date_min, "date_max": date_max, "metrics": metrics}


@app.post("/metrics", response_model=MetricsResponse, responses={400: {"model": ErrorResponse}})
def compute_metrics(payload: MetricsRequest, df: pd.DataFrame = Depends(get_session_df)) -> MetricsResponse:
    working = df.copy()

    # Apply cohort subset if provided
    cohorts = [c for c in [payload.test_cohort, payload.control_cohort] if c]
    if cohorts:
        working = subset_by_cohorts(working, cohorts)

    # Pre and Post period filters are used to compute summary aggregations per period
    pre_df = working
    post_df = working
    if payload.pre_period:
        pre_df = filter_by_date_range(working, payload.pre_period.start_date, payload.pre_period.end_date)
    if payload.post_period:
        post_df = filter_by_date_range(working, payload.post_period.start_date, payload.post_period.end_date)

    # Time series for plotting (full range filtered only by cohorts)
    ts_df = working.copy()
    ts_df = ts_df.sort_values(["cohort", "date"]).reset_index(drop=True)

    # Rolling windows
    for w in payload.rolling_windows:
        ts_df = rolling_average(ts_df, value_col="metric_value", window=w, by=["cohort"], date_col="date")

    # Normalized growth relative to baseline date or first date
    ts_df = normalized_growth(
        ts_df,
        value_col="metric_value",
        baseline_date=payload.normalized_growth_baseline_date,
        by=["cohort"],
        date_col="date",
    )

    # Build timeseries response points
    def _row_to_point(row) -> TimeSeriesPoint:
        point = {
            "date": pd.to_datetime(row["date"]).strftime("%Y-%m-%d"),
            "cohort": row["cohort"],
            "metric_value": float(row["metric_value"]),
            "metric_value_pct_change": float(row.get("metric_value_pct_change", float("nan"))) if "metric_value_pct_change" in row else None,
        }
        for w in payload.rolling_windows:
            col = f"metric_value_roll_{w}"
            if col in ts_df.columns:
                val = row.get(col)
                point[col] = float(val) if pd.notna(val) else None
        return TimeSeriesPoint(**point)

    time_series = [_row_to_point(r) for r in ts_df.to_dict("records")]

    # Compute summaries for pre and post periods by cohort
    summaries = []
    def _compute_agg(d: pd.DataFrame, label: str):
        for agg in payload.aggregations:
            out = aggregate_time_series(d, group_by=["cohort"], value_col="metric_value", agg=agg)
            # Map to test/control values
            test_val = out.loc[out["cohort"] == payload.test_cohort, f"metric_value_{agg}"]
            control_val = out.loc[out["cohort"] == payload.control_cohort, f"metric_value_{agg}"]
            tv = float(test_val.iloc[0]) if not test_val.empty else 0.0
            cv = float(control_val.iloc[0]) if not control_val.empty else 0.0
            mean_diff = tv - cv
            pct_change = (mean_diff / cv * 100.0) if cv != 0 else None
            summaries.append({
                "aggregation": agg,
                "test_value": tv,
                "control_value": cv,
                "mean_difference": mean_diff,
                "pct_change": pct_change,
            })

    _compute_agg(pre_df, "pre")
    _compute_agg(post_df, "post")

    return MetricsResponse(
        time_series=time_series,
        summaries=summaries,
    )


@app.post("/funnel", response_model=FunnelResponse, responses={400: {"model": ErrorResponse}})
def funnel(payload: FunnelRequest, df: pd.DataFrame = Depends(get_session_df)) -> FunnelResponse:
    working = df.copy()
    
    # Apply confirmation filtering if specified (support per-test/control and legacy)
    test_confirmed = getattr(payload, 'test_confirmed', None) or getattr(payload, 'confirmed', None) or ''
    control_confirmed = getattr(payload, 'control_confirmed', None) or getattr(payload, 'confirmed', None) or ''
    
    # Filter for test and control cohorts with optional confirmation filtering
    if payload.test_cohort and payload.control_cohort:
        test_data = get_cohort(working, payload.test_cohort, test_confirmed).copy()
        control_data = get_cohort(working, payload.control_cohort, control_confirmed).copy()
        # Label cohorts explicitly so identical cohort names remain distinct
        test_data["cohort"] = test_data["cohort"].astype(str).apply(lambda c: f"TEST: {c}")
        control_data["cohort"] = control_data["cohort"].astype(str).apply(lambda c: f"CONTROL: {c}")
        working = pd.concat([test_data, control_data], ignore_index=True)
    elif payload.test_cohort:
        working = get_cohort(working, payload.test_cohort, test_confirmed).copy()
        working["cohort"] = working["cohort"].astype(str).apply(lambda c: f"TEST: {c}")
    elif payload.control_cohort:
        working = get_cohort(working, payload.control_cohort, control_confirmed).copy()
        working["cohort"] = working["cohort"].astype(str).apply(lambda c: f"CONTROL: {c}")
    else:
        # If no specific cohorts, just apply confirmation filter if specified
        if test_confirmed:
            if test_confirmed not in working.columns:
                raise HTTPException(status_code=400, detail=f"Confirmation column '{test_confirmed}' not found")
            working = working[~working[test_confirmed].isna()]

    ts = compute_cohort_funnel_timeseries(working)
    metrics_available = [c for c in ts.columns if c not in {"date", "cohort"}]
    if not metrics_available:
        raise HTTPException(status_code=400, detail="No metrics available in dataset")

    # If requested metric not in precomputed set, try computing it via aggregation
    metric = payload.metric or metrics_available[0]
    if payload.metric and payload.metric not in metrics_available:
        from transformations import compute_metric_timeseries_by_cohort
        agg = payload.agg or "sum"
        try:
            extra = compute_metric_timeseries_by_cohort(working, payload.metric, agg)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
        # Merge with existing to reuse date filtering & response shape
        ts = ts.copy()
        merged = ts.merge(extra, on=["date", "cohort"], how="outer", suffixes=("", "_extra"))
        # If both existed, prefer the non-null new computation
        if f"{metric}_extra" in merged.columns and metric in merged.columns:
            merged[metric] = merged[metric].fillna(merged[f"{metric}_extra"]).astype(float)
            merged = merged.drop(columns=[f"{metric}_extra"]) 
        elif f"{metric}_extra" in merged.columns and metric not in merged.columns:
            merged = merged.rename(columns={f"{metric}_extra": metric})
        ts = merged
        metrics_available = [c for c in ts.columns if c not in {"date", "cohort"}]

    pre_df = ts
    post_df = ts
    if payload.pre_period:
        pre_df = filter_by_date_range(ts, payload.pre_period.start_date, payload.pre_period.end_date, date_col="date")
    if payload.post_period:
        post_df = filter_by_date_range(ts, payload.post_period.start_date, payload.post_period.end_date, date_col="date")

    def to_points(d: pd.DataFrame) -> list[FunnelPoint]:
        return [
            FunnelPoint(date=pd.to_datetime(r["date"]).strftime("%Y-%m-%d"), cohort=r["cohort"], metric=metric, value=float(r.get(metric, 0.0)))
            for r in d.to_dict("records")
        ]

    def summarize(d: pd.DataFrame) -> dict[str, float]:
        if d.empty:
            return {}
        tmp = d.groupby("cohort")[metric].sum().reset_index()
        return {str(row["cohort"]): float(row[metric]) for _, row in tmp.iterrows()}

    return FunnelResponse(
        metrics_available=metrics_available,
        pre_series=to_points(pre_df),
        post_series=to_points(post_df),
        pre_summary=summarize(pre_df),
        post_summary=summarize(post_df),
    )


@app.get("/cohort-aggregation", response_model=CohortAggregationResponse, responses={400: {"model": ErrorResponse}})
def get_cohort_aggregation(df: pd.DataFrame = Depends(get_session_df)) -> CohortAggregationResponse:
    """Get cohort-level aggregation data as shown in the example"""
    working = df.copy()

    # Check if required columns exist
    required_columns = [
        "totalExpCaps", "visitedCaps", "clickedCaptain", "exploredCaptains",
        "exploredCaptains_Subs", "exploredCaptains_EPKM", "exploredCaptains_FlatCommission",
        "exploredCaptains_CM", "confirmedCaptains", "confirmedCaptains_Subs",
        "confirmedCaptains_Subs_purchased", "confirmedCaptains_Subs_purchased_weekend",
        "confirmedCaptains_EPKM", "confirmedCaptains_FlatCommission", "confirmedCaptains_CM"
    ]

    missing_columns = [col for col in required_columns if col not in working.columns]
    if missing_columns:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required columns for cohort aggregation: {missing_columns}. "
                   f"Available columns: {list(working.columns)}"
        )

    # Perform the aggregation as specified in the example
    result = working.groupby(["cohort"]).agg({
        "totalExpCaps": "nunique",
        "visitedCaps": "nunique",
        'clickedCaptain': 'nunique',
        'exploredCaptains': 'nunique',
        'exploredCaptains_Subs': 'nunique',
        'exploredCaptains_EPKM': 'nunique',
        'exploredCaptains_FlatCommission': 'nunique',
        'exploredCaptains_CM': 'nunique',
        'confirmedCaptains': 'nunique',
        'confirmedCaptains_Subs': 'nunique',
        'confirmedCaptains_Subs_purchased': 'nunique',
        'confirmedCaptains_Subs_purchased_weekend': 'nunique',
        'confirmedCaptains_EPKM': 'nunique',
        'confirmedCaptains_FlatCommission': 'nunique',
        'confirmedCaptains_CM': 'nunique'

    }).reset_index().sort_values("exploredCaptains", ascending=False)

    # Calculate the ratio columns
    result['Visit2Click'] = result['clickedCaptain'] / result['visitedCaps']
    result['Base2Visit'] = result['visitedCaps'] / result['totalExpCaps']

    # Handle division by zero
    result['Visit2Click'] = result['Visit2Click'].fillna(0)
    result['Base2Visit'] = result['Base2Visit'].fillna(0)

    # Convert to list of CohortAggregationRow objects
    data = []
    for _, row in result.iterrows():
        data.append(CohortAggregationRow(
            cohort=str(row['cohort']),
            totalExpCaps=float(row['totalExpCaps']),
            visitedCaps=float(row['visitedCaps']),
            clickedCaptain=float(row['clickedCaptain']),
            exploredCaptains=float(row['exploredCaptains']),
            exploredCaptains_Subs=float(row['exploredCaptains_Subs']),
            exploredCaptains_EPKM=float(row['exploredCaptains_EPKM']),
            exploredCaptains_FlatCommission=float(row['exploredCaptains_FlatCommission']),
            exploredCaptains_CM=float(row['exploredCaptains_CM']),
            confirmedCaptains=float(row['confirmedCaptains']),
            confirmedCaptains_Subs=float(row['confirmedCaptains_Subs']),
            confirmedCaptains_Subs_purchased=float(row['confirmedCaptains_Subs_purchased']),
            confirmedCaptains_Subs_purchased_weekend=float(row['confirmedCaptains_Subs_purchased_weekend']),
            confirmedCaptains_EPKM=float(row['confirmedCaptains_EPKM']),
            confirmedCaptains_FlatCommission=float(row['confirmedCaptains_FlatCommission']),
            confirmedCaptains_CM=float(row['confirmedCaptains_CM']),
            Visit2Click=float(row['Visit2Click']),
            Base2Visit=float(row['Base2Visit']),
        ))

    return CohortAggregationResponse(data=data)


@app.delete("/session")
def clear_session(x_session_id: Optional[str] = Header(default=None)):
    if x_session_id and x_session_id in SESSION_STORE:
        del SESSION_STORE[x_session_id]
    return {"ok": True}


@app.post("/statistical-test")
def run_statistical_test_endpoint(
    request: StatTestRequest,
    x_session_id: Optional[str] = Header(default=None)
) -> StatTestResult:
    """Run statistical tests on cohort data"""
    from statistical_analysis import run_statistical_test
    
    try:
        result = run_statistical_test(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/cohort-aggregation")
def get_cohort_aggregation(df: pd.DataFrame = Depends(get_session_df)):
    """Compute cohort-level aggregations and return as styled HTML table"""
    try:
        # Define columns to aggregate with nunique
        agg_cols = [
            "totalExpCaps", "visitedCaps", "clickedCaptain", "exploredCaptains",
            "exploredCaptains_Subs", "exploredCaptains_EPKM", "exploredCaptains_FlatCommission",
            "exploredCaptains_CM", "confirmedCaptains", "confirmedCaptains_Subs",
            "confirmedCaptains_Subs_purchased", "confirmedCaptains_Subs_purchased_weekend",
            "confirmedCaptains_EPKM", "confirmedCaptains_FlatCommission", "confirmedCaptains_CM"
        ]

        # Filter to only existing columns
        agg_dict = {col: "nunique" for col in agg_cols if col in df.columns}

        if not agg_dict:
            # Return empty styled table
            empty_df = pd.DataFrame({"cohort": []})
            return empty_df.to_html(
                table_id="cohort-table",
                classes="table table-striped table-hover",
                index=False,
                justify="center"
            )

        # Aggregate by cohort
        result = df.groupby("cohort").agg(agg_dict).reset_index()

        # Add computed ratio columns if base columns exist
        if "clickedCaptain" in result.columns and "visitedCaps" in result.columns:
            result["Visit2Click"] = result["clickedCaptain"] / result["visitedCaps"].replace(0, pd.NA)
        if "visitedCaps" in result.columns and "totalExpCaps" in result.columns:
            result["Base2Visit"] = result["visitedCaps"] / result["totalExpCaps"].replace(0, pd.NA)

        # Sort by exploredCaptains if available
        if "exploredCaptains" in result.columns:
            result = result.sort_values("exploredCaptains", ascending=False)

        # Fill NaN with 0 for display
        result = result.fillna(0)

        # Helper for pretty numeric formatting
        def _fmt(val):
            try:
                if isinstance(val, (int, float)):
                    if isinstance(val, float) and not val.is_integer():
                        return f"{val:,.2f}"
                    return f"{int(val):,}"
                return str(val)
            except Exception:
                return str(val)

        # Generate styled HTML table
        html_table = result.to_html(
            table_id="cohort-table",
            classes="table table-striped table-hover table-responsive",
            index=False,
            justify="center",
            escape=False,
            formatters={col: _fmt for col in result.columns}
        )

        return html_table

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute cohort aggregation: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

