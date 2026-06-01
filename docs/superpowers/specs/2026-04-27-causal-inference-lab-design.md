# Causal Inference Lab — Design Spec

## Context

Rapido runs diverse captain experiments — randomized (Darwin), segmented (LP/non-daily captains), and city-wide rollouts. Today, Ladoo Metrics supports diff-in-diff as the sole causal method. This leaves critical gaps:

- **Selection bias** in segmented experiments goes uncorrected (naive lift estimates are inflated)
- **City-wide rollouts** have no counterfactual — teams can't estimate what would have happened without the intervention
- **Treatment heterogeneity** is invisible — a +8% average hides that LP captains gained +25% while HP captains lost -3%
- **Threshold-based treatments** (DAPR cutoffs, ride count rules) lack a proper causal framework

The Causal Inference Lab adds 5 methods that collectively cover every experiment type at Rapido, with auto-generated explainable narratives and 17 diagnostic+result visualizations.

## Methods

### 1. Propensity Score Matching (PSM)

**When to use:** Test/control groups differ on observables (imperfect randomization).

**Algorithm:**
1. Aggregate each metric to captain-level pre-period features (mean, std, trend slope, active days count)
2. Fit logistic regression: P(treatment | X) → propensity score per captain
3. Match using nearest-neighbor with caliper (default: 0.2 × pooled SD of logit propensity)
4. Assess covariate balance via standardized mean differences (SMD)
5. Estimate ATT on matched pairs via paired t-test

**Outputs:**
- Propensity score overlap histogram (test vs control density)
- Love plot (SMD per covariate, before vs after matching)
- ATT estimate with 95% CI and p-value
- Naive vs matched comparison bar chart
- Auto-narrative explaining bias correction magnitude

**Config inputs:** outcome_metric, covariates (auto-selected: all numeric pre-period metrics), matching_method (nearest | caliper | kernel), caliper_width (default: 0.2)

### 2. CausalImpact (Bayesian Structural Time Series)

**When to use:** City-wide rollouts or any pre/post analysis without a clean control group.

**Algorithm:**
1. Aggregate session data to daily time series of the outcome metric
2. If control cohort exists, use its time series as covariate (improves prediction)
3. Fit Bayesian structural time series model on pre-period
4. Generate counterfactual prediction for post-period with 95% credible intervals
5. Compute pointwise impact (actual - predicted) and cumulative impact

**Library:** `causalimpact` (pure Python port, no TensorFlow dependency)

**Outputs:**
- Panel 1: Original vs counterfactual with credible interval band
- Panel 2: Pointwise daily impact
- Panel 3: Cumulative impact over time
- Summary card: average effect %, cumulative absolute impact, posterior probability, model fit (MAPE)
- Auto-narrative with business interpretation

**Config inputs:** outcome_metric, aggregation (sum | mean), pre_period, post_period, control_series (optional, auto-detected from control cohort)

### 3. Heterogeneous Treatment Effects (HTE)

**When to use:** Any experiment — discover which captain segments benefit most or get hurt.

**Algorithm:**
1. Prepare captain-level data: X (pre-period features), T (treatment indicator), Y (post-period outcome)
2. Fit CausalForestDML from Microsoft's `econml` library
3. Estimate Conditional Average Treatment Effect (CATE) for each captain
4. Aggregate CATEs by user-selected segment columns (or auto-detected categorical columns)
5. Extract feature importance for heterogeneity

**Library:** `econml` (CausalForestDML with cross-fitting)

**Outputs:**
- CATE waterfall chart (segments sorted by treatment effect, most positive → most negative)
- Feature importance bar chart (which features drive response heterogeneity)
- CATE distribution histogram (spread of individual treatment effects)
- CATE scatter plot (interactive: user picks feature on X-axis, sees CATE on Y-axis)
- Auto-narrative with targeting recommendations

**Config inputs:** outcome_metric, treatment_col (default: "cohort"), covariates (auto: all numeric pre-period), segment_columns (auto-detected categorical columns for waterfall grouping)

### 4. Synthetic Control Method

**When to use:** City-level pilot with no randomization — one treated city, multiple untreated donor cities.

**Algorithm:**
1. Require a `city` column in session data (or user specifies unit column)
2. Aggregate to city × date panel: outcome metric per city per day
3. User selects treated city; remaining cities become donor pool
4. Solve convex optimization: find non-negative weights W such that Σ(W_i × donor_i_pre) ≈ treated_pre (minimize pre-period RMSPE)
5. Construct synthetic unit: Σ(W_i × donor_i_post) as counterfactual
6. Run placebo tests: repeat analysis pretending each donor was treated; compute p-value as rank of actual gap

**Library:** Custom implementation using `scipy.optimize.minimize` (method='SLSQP', constraints: weights >= 0, sum = 1)

**Outputs:**
- Actual vs synthetic time series (pre + post periods)
- Donor city weights bar chart (which cities compose the synthetic unit)
- Placebo spaghetti plot (all permutation gaps overlaid, treated highlighted)
- Gap plot (actual - synthetic over time)
- Auto-narrative with p-value from placebo inference

**Config inputs:** outcome_metric, unit_column (default: "city"), treated_unit, intervention_date, aggregation (sum | mean)

### 5. Regression Discontinuity Design (RDD)

**When to use:** Treatment assigned by a threshold rule (captains above/below a score get different treatment).

**Algorithm:**
1. User selects: running_variable (the score), cutoff_value, outcome_metric
2. Aggregate per captain: mean of running variable and post-period outcome
3. Estimate local polynomial regression on both sides of cutoff using `rdrobust`
4. MSE-optimal bandwidth selection (Imbens-Kalyanaraman or Calonico-Cattaneo-Titiunik)
5. McCrary density test for manipulation (bunching at cutoff)
6. Bandwidth sensitivity analysis (estimate at h, h/2, 2h)

**Library:** `rdrobust` (Python port of Cattaneo et al.)

**Outputs:**
- RD scatter plot with local polynomial fits and discontinuity jump
- McCrary density test plot (smooth density through cutoff = no manipulation)
- Bandwidth sensitivity forest plot (effect estimates at multiple bandwidths)
- Summary: RD estimate, CI, optimal bandwidth, McCrary p-value
- Auto-narrative explaining the causal logic

**Config inputs:** running_variable, cutoff_value, outcome_metric, kernel (triangular | epanechnikov | uniform), polynomial_order (default: 1)

## Architecture

### Backend

#### New files

**`backend/causal_inference.py`** (~800 lines)

Five analyzer classes, each following the same interface:

```python
class PSMAnalyzer:
    def __init__(self, df: pd.DataFrame, config: PSMRequest):
        """Prepares data from session DataFrame."""

    def run(self) -> PSMResponse:
        """Executes full analysis pipeline, returns all chart data + stats."""

# Same pattern for: CausalImpactAnalyzer, HTEAnalyzer,
# SyntheticControlAnalyzer, RDDAnalyzer
```

Shared utility at module level:

```python
def prepare_pre_period_features(df, pre_start, pre_end, metrics) -> pd.DataFrame:
    """Aggregate captain-level pre-period features for PSM and HTE."""

def generate_narrative(method: str, results: dict) -> str:
    """Template-based narrative. Returns plain English interpretation."""

def recommend_methods(df, config) -> list[MethodRecommendation]:
    """Check data feasibility for each method, return recommendations."""
```

**`backend/causal_schemas.py`** (~200 lines)

Pydantic request/response models:

- `PSMRequest` / `PSMResponse`
- `CausalImpactRequest` / `CausalImpactResponse`
- `HTERequest` / `HTEResponse`
- `SyntheticControlRequest` / `SyntheticControlResponse`
- `RDDRequest` / `RDDResponse`
- `CausalRecommendRequest` / `CausalRecommendResponse`
- `CausalValidateRequest` / `CausalValidateResponse`
- Shared: `NarrativeBlock`, `ChartData`, `MethodRecommendation`

Each response includes:
- `charts: dict[str, ChartData]` — keyed by chart name, contains data arrays for frontend rendering
- `summary: dict` — key statistics (effect size, CI, p-value, sample sizes)
- `narrative: str` — template-based plain English interpretation
- `diagnostics: dict` — method-specific diagnostic information
- `warnings: list[str]` — data quality or methodology warnings

#### Modified files

**`backend/main.py`** — Add ~80 lines: 8 route handler stubs that import from `causal_inference.py` and use session management (`get_session_df()`).

**`backend/requirements.txt`** — Add 4 packages:
```
scikit-learn>=1.4.0
econml>=0.15.0
causalimpact>=0.3.0
rdrobust>=1.0.0
```

#### API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/causal/psm` | Run propensity score matching |
| POST | `/causal/impact` | Run CausalImpact analysis |
| POST | `/causal/hte` | Run heterogeneous treatment effects |
| POST | `/causal/synthetic-control` | Run synthetic control method |
| POST | `/causal/rdd` | Run regression discontinuity |
| POST | `/causal/recommend` | Auto-recommend feasible methods for current data |
| POST | `/causal/validate` | Pre-flight data validation per method |
| POST | `/causal/export` | Export analysis as report item |

All endpoints require `X-Session-Id` header (reuse existing session management). Data is read from the in-memory session store.

**Large file handling:** For DuckDB/Parquet sessions (files >50MB), the data prep functions run aggregation queries in DuckDB first (captain-level or daily-level), producing a small DataFrame that the Python causal methods operate on. The raw row-level data is never loaded into memory for causal analysis.

### Frontend

#### New files

**`frontend/src/features/causal/`** — New feature module

Page-level components:
- `CausalLabPage.tsx` — Main layout: left sidebar (method selector + config) + right content (results)
- `CausalMethodSelector.tsx` — 5 method cards with "Recommended" / "Feasible" / "Needs more data" badges. Calls `/causal/recommend` on mount.
- `CausalConfigPanel.tsx` — Dynamic config form that changes per method (outcome metric dropdown, covariate multi-select, method-specific options)
- `CausalResultsView.tsx` — Switches between method-specific result components
- `CausalNarrative.tsx` — Renders template narrative + "Explain Further" button that calls LLM

Method result components (`features/causal/methods/`):
- `PSMResults.tsx` — Renders 4 PSM charts + summary card
- `CausalImpactResults.tsx` — Renders 3-panel time series + summary card
- `HTEResults.tsx` — Renders 4 HTE charts + summary card
- `SyntheticControlResults.tsx` — Renders 3 SC charts + summary card
- `RDDResults.tsx` — Renders 3 RDD charts + summary card

Reusable chart components (`features/causal/charts/`):
- `LovePlot.tsx` — Recharts custom scatter (dot plot with before/after)
- `OverlapHistogram.tsx` — Plotly overlapping density curves
- `CounterfactualChart.tsx` — Recharts area + line (shared by CausalImpact and SynthControl)
- `WaterfallChart.tsx` — Recharts horizontal bar chart for CATE segments
- `ImportanceBar.tsx` — Recharts horizontal bar for feature importance
- `CATEScatter.tsx` — Plotly scatter with trend line (interactive axis selection)
- `RDScatter.tsx` — Plotly scatter with two regression lines and discontinuity annotation
- `PlaceboSpaghetti.tsx` — Recharts multi-line chart (gray placebos + colored treatment)
- `BandwidthForest.tsx` — Recharts forest plot (point estimates with CIs at different bandwidths)

#### Modified files

**`frontend/src/lib/api.ts`** — Add typed API calls:
- `runPSM(request)`, `runCausalImpact(request)`, `runHTE(request)`, `runSyntheticControl(request)`, `runRDD(request)`
- `getCausalRecommendations(sessionId)`, `validateCausalMethod(request)`, `exportCausalToReport(request)`

**`frontend/src/App.tsx`** — Add route: `<Route path="/causal-lab" element={<CausalLabPage />} />`

**`frontend/src/features/insights/InsightsPage.tsx`** (or equivalent) — Add "Deepen Analysis" button that navigates to `/causal-lab` with session context.

**Sidebar navigation** — Add "Causal Lab" nav item to the app sidebar (same level as Insights, Discover, Dashboard).

### Charting strategy

- **Recharts** (already in package.json): ~80% of charts — time series, bars, forest plots, love plots
- **Plotly.js** (already in package.json): ~20% — scatter plots needing hover/zoom interactivity (RD scatter, CATE scatter, overlap density)
- **No new frontend dependencies**

### Narrative engine

Two tiers:

1. **Instant (template-based):** Generated in `causal_inference.py` using string templates with computed variables. Renders immediately with results. Covers: effect size interpretation, significance statement, bias correction note, sample size note, warnings.

2. **Deep (LLM-enhanced):** Triggered by "Explain Further" button. Sends results + experiment context to Claude (reusing Anthropic client pattern from `researcher_agent.py`). Returns: contextual interpretation, strategic recommendations, suggested next experiments, caveats.

## Data requirements

All methods derive from the existing `captain_id × yyyymmdd × cohort × metrics` schema:

| Method | Required columns | Additional user input | Auto-derived |
|--------|-----------------|----------------------|-------------|
| PSM | captain_id, yyyymmdd, cohort, metrics | outcome_metric | Pre-period features (mean/std/slope per metric) |
| CausalImpact | captain_id, yyyymmdd, metrics | outcome_metric, aggregation | Daily time series |
| HTE | captain_id, yyyymmdd, cohort, metrics | outcome_metric | Pre-period features, individual CATEs |
| Synth Control | captain_id, yyyymmdd, **city**, metrics | treated_city, outcome_metric | City-level daily panel |
| RDD | captain_id, yyyymmdd, metrics | running_variable, cutoff, outcome_metric | Captain-level aggregates |

**Synthetic Control** is the only method requiring a column not in the standard schema (`city`). If the uploaded CSV lacks a city column, the UI shows "Needs city column" and suggests uploading data with city or fetching from Presto.

**RDD** requires the user to specify which column is the running variable and the cutoff value — these cannot be auto-detected.

## Implementation order

Build in dependency order — each phase is independently shippable:

1. **Phase 1: Foundation** — `causal_schemas.py`, `causal_inference.py` scaffolding, shared `prepare_pre_period_features()`, route stubs in `main.py`, frontend `CausalLabPage` shell with method selector
2. **Phase 2: PSM** — Full PSMAnalyzer + PSMResults + LovePlot + OverlapHistogram + narrative
3. **Phase 3: CausalImpact** — Full CausalImpactAnalyzer + CausalImpactResults + CounterfactualChart + narrative
4. **Phase 4: HTE** — Full HTEAnalyzer + HTEResults + WaterfallChart + ImportanceBar + CATEScatter + narrative
5. **Phase 5: Synthetic Control** — Full SyntheticControlAnalyzer + SyntheticControlResults + PlaceboSpaghetti + narrative
6. **Phase 6: RDD** — Full RDDAnalyzer + RDDResults + RDScatter + BandwidthForest + narrative
7. **Phase 7: Polish** — `/causal/recommend` endpoint, "Deepen Analysis" button in Insights, "Explain Further" LLM narratives, report export integration

## Verification plan

For each method, test with:

1. **Synthetic data** — Generate CSV with known treatment effect. Verify the method recovers it within CI.
2. **Real Rapido data** — Use a past experiment CSV. Compare Causal Lab output with the existing diff-in-diff result.
3. **Edge cases** — Small sample sizes (<100 captains), no overlap (PSM should warn), single city (SynthControl should fail gracefully), flat pre-period (CausalImpact should warn about model fit).

Frontend verification:
- Start both dev servers (`python main.py` + `npm run dev`)
- Navigate to `/causal-lab`
- Upload a test CSV, run each method
- Verify all 17 charts render correctly
- Verify narratives are coherent
- Verify "Add to Report" captures chart data
- Run `npm run build` — zero TypeScript errors
