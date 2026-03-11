# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Ladoo Metrics** — an internal analytics platform for Rapido captain data analysis. It lets analysts upload CSV exports (captain × date level data) from experiments, then run cohort comparisons, diff-in-diff analysis, funnel metrics, and build exportable HTML reports.

Access is restricted to `@rapido.bike` email addresses via Supabase Auth.

## Development Commands

### Backend (Python / FastAPI)
```bash
cd backend

# Activate virtual environment (venv is at repo root)
source ../.venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run dev server (auto-reloads via uvicorn)
python main.py
# Backend available at http://localhost:8000
# API docs at http://localhost:8000/docs
```

### Frontend (React / Vite)
```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev
# Frontend available at http://localhost:5173

# Type-check + build
npm run build

# Lint
npm run lint
```

### Kill stuck ports
```bash
lsof -ti:8000 | xargs kill -9   # backend
lsof -ti:5173 | xargs kill -9   # frontend
```

## Architecture

### Data Flow

```
Browser → FastAPI backend → (Presto for dashboard queries)
                         → (In-memory session store for uploaded CSVs)
```

1. **Upload**: User uploads a captain × date CSV. Backend stores it as an in-memory pandas DataFrame (small files, <50MB) or a Parquet file on disk queried via DuckDB (large files, up to 5GB). Returns a `session_id`.
2. **Insights**: Frontend sends `session_id` in the `X-Session-Id` header with all subsequent requests. Backend looks up the session and computes metrics.
3. **Presto queries**: Captain dashboard endpoints (`/dapr-bucket`, `/fe2net`, etc.) query Presto directly using `pyhive`. The Presto username is passed via the `X-Username` header from the frontend.

### Backend (`backend/`)

| File | Purpose |
|---|---|
| `main.py` | FastAPI app — all routes, session store, upload handling |
| `schemas.py` | Pydantic request/response models |
| `transformations.py` | Pandas-based data transforms: date filtering, cohort subsetting, rolling averages, growth normalization |
| `funnel.py` | Presto SQL query functions for captain dashboards; includes allowlists for city/service/date validation used in SQL parameters |
| `statistical_analysis.py` | T-test, Chi-square, Mann-Whitney U implementations |
| `function_executor.py` | Sandboxed Python execution for user-defined metric functions; validates code against a forbidden-patterns list before running |

**Session stores (all in-memory, lost on restart):**
- `SESSION_STORE` — uploaded CSV data (pandas DataFrame or `{parquet_path, metadata}` dict)
- `FUNNEL_SESSION_STORE` — mobile number → captain ID mapping data
- `REPORT_STORE` — ephemeral report items (not persisted; reports are saved to Supabase)
- `SEGMENT_TRANSITION_STORE` — `TTLCache(maxsize=64, ttl=3600)` for expensive Presto queries

**CSV requirements**: uploaded files must have a `cohort` column and either `date` (YYYY-MM-DD) or `time` (YYYYMMDD) column.

**CORS**: In development, only `localhost:5173` and `localhost:5174` are allowed. In production, set the `ALLOWED_ORIGINS` environment variable (comma-separated URLs).

### Frontend (`frontend/src/`)

| Path | Purpose |
|---|---|
| `App.tsx` | Router — protected routes, auth guards |
| `contexts/AuthContext.tsx` | Supabase auth state (user, session, signIn/Out) |
| `contexts/ReportContext.tsx` | Report builder state (items saved to report) |
| `lib/api.ts` | All FastAPI client calls (typed) |
| `lib/supabase.ts` | Supabase client + all DB operations (folders, reports, functions, calculated columns) |
| `features/insights/` | Core experiment analysis feature — config sidebar, charts, pivot builder, diff-in-diff summary, report tab |
| `features/dashboard/` | Captain dashboards (DAPR, FE2Net, RTU, R2A, A2PHH) |
| `features/discover/` | Discover/explore page |
| `pages/InsightsPage.tsx` | Main analysis page — orchestrates upload, cohort config, metrics fetch, and rendering |
| `pages/ReportsPage.tsx` | Folder/file browser for saved reports (stored in Supabase) |
| `pages/FunctionsPage.tsx` | Folder/file browser for saved metric functions (stored in Supabase) |

**Path alias**: `@/` resolves to `frontend/src/` (configured in `vite.config.ts`).

**API base URL**: Configured via the `VITE_API_BASE_URL` environment variable. In dev, defaults to `http://localhost:8000`.

### Supabase (persistence layer)

All persistent data lives in Supabase (not the backend):
- `saved_reports` — experiment reports (items stored as JSONB)
- `report_folders` — folder hierarchy for reports
- `metric_functions` — user-defined Python metric functions with parameters
- `function_folders` — folder hierarchy for functions
- `calculated_columns` — expression-based derived columns

The migration SQL to create these tables is in `supabase_migration.sql`.

## AI Agent Layer

Four agents accessible to all users via `/ai/*` backend routes. Documented in `AGENT_ARCHITECTURE.md`.

| Agent | Route | Purpose |
|---|---|---|
| MetricGen | `POST /ai/generate-metric` | Plain English → validated `compute_metrics()` function |
| MetricRefine | `POST /ai/refine-metric` | Iterate on generated code with feedback |
| MetricSuggest | `POST /ai/suggest-metrics` | Suggest metrics given experiment context |
| ProblemDiscovery | `POST /ai/discover-problems` | Statistical anomaly scan (z-score) across captain segments |
| NarrativeExplainer | `POST /ai/explain-insights` | Plain-English explanation of the DiD Executive Summary |

**Key files:**
- `backend/ai_agent.py` — all four agent classes + `PRESTO_SCHEMA_CONTEXT` (the full schema embedded in every LLM prompt)
- `backend/ai_schemas.py` — Pydantic request/response models for all AI routes
- `frontend/src/lib/aiApi.ts` — typed client for all `/ai/*` routes
- `frontend/src/features/ai/AIMetricGenerator.tsx` — "Generate with AI" floating panel
- `frontend/src/features/ai/AISuggestions.tsx` — metric suggestion panel for InsightsConfigSidebar
- `frontend/src/features/ai/InsightsNarrative.tsx` — "Explain this" panel below Executive Summary
- `frontend/src/pages/DiscoveryPage.tsx` — Problem Discovery page (route: `/discovery`)
- `supabase_ai_migration.sql` — new tables: `ai_discoveries`, `ai_generated_metrics`

**Required env var:** `ANTHROPIC_API_KEY` must be set on the backend.

**How MetricGen works:** LLM receives `PRESTO_SCHEMA_CONTEXT` (all table/column definitions) + the saved functions catalog as context, generates a `compute_metrics(params) -> DataFrame` function, which is immediately validated through the existing `function_executor.py` security sandbox before returning to the user.

## Key Patterns

- **Session-based API**: the frontend always sends `X-Session-Id` header after upload; backend validates this header in `get_session_df()` / `get_session_metadata()` dependency.
- **Large file handling**: files >50MB bypass pandas and use `process_csv_to_parquet()` → DuckDB at query time. Code checks `is_duckdb_session()` before choosing the query path.
- **Presto SQL safety**: `funnel.py` uses allowlists (`ALLOWED_CITIES`, `ALLOWED_SERVICE_CATEGORIES`, etc.) and regex validation for all user-supplied identifiers inserted into SQL strings.
- **Function sandboxing**: `function_executor.py` applies a `FORBIDDEN_PATTERNS` regex list to user code before `exec()`-ing it in a restricted namespace.
- **Diff-in-diff**: The `InsightsSummaryRow` schema captures `control_pre/post`, `test_pre/post`, and `diff_in_diff` — computed in `features/insights/analysis/computeExecutiveSummary.ts` client-side from the backend's time-series response.

## Deployment

Production runs on a private VM behind Nginx. All deployment scripts are in `deployment/`.

| Component | Details |
|---|---|
| VM | `172.18.39.236`, SSH as `krishna.poddar` |
| App root | `/opt/ladoo-metrics/` on the VM |
| Live URL | `http://laddoo.labs.plectrum.dev/` (HTTP only, no SSL) |
| Backend port | `8001` (Nginx proxies `/api` → `localhost:8001`) |
| Backend service | systemd unit `ladoo-metrics` |

### Deploy to VM

```bash
ssh krishna.poddar@172.18.39.236
sudo su
cd /opt/ladoo-metrics

# Pull latest code
git pull

# Redeploy backend (reinstalls deps, restarts systemd service)
bash deployment/deploy-backend.sh

# Redeploy frontend (runs npm build, copies dist to Nginx root)
bash deployment/deploy-frontend.sh
```

### Useful VM commands

```bash
# Check backend logs (live)
journalctl -u ladoo-metrics -f

# Restart backend
systemctl restart ladoo-metrics

# Check service status
systemctl status ladoo-metrics
systemctl status nginx

# Test backend health directly
curl http://localhost:8001/health

# Test through Nginx
curl http://localhost/health
```

### Environment variables

Set in `/etc/systemd/system/ladoo-metrics.service`. After editing, run:
```bash
systemctl daemon-reload && systemctl restart ladoo-metrics
```

Key vars: `PRESTO_HOST`, `PRESTO_PORT` (default `80`), `ALLOWED_ORIGINS`.

### First-time VM setup

See `deployment/DEPLOYMENT_INSTRUCTIONS.md` for full setup (Nginx config, systemd service, firewall). The `deployment/vm-setup.sh` script handles initial provisioning.
