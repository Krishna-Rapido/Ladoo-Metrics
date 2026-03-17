# Architecture — Living Document

How Ladoo Metrics works today. Updated in place as the system evolves.
For the canonical route/file tables, see CLAUDE.md.

---

## System Overview

Ladoo Metrics is a three-tier application:

```
Browser (React SPA)
  ├── FastAPI backend (compute layer)
  │     ├── In-memory session store (uploaded CSVs as DataFrames)
  │     ├── DuckDB (large file queries via Parquet)
  │     ├── Presto (captain dashboards, live queries)
  │     └── OpenAI API (AI agents)
  └── Supabase (persistence layer)
        ├── Auth (@rapido.bike restriction)
        ├── Reports + folders
        ├── Functions + folders
        ├── Calculated columns
        └── AI discoveries + generated metrics
```

The backend is **stateless for persistence** — it only holds transient session data (uploaded CSVs).
All durable data lives in Supabase, accessed directly from the frontend via `supabase.ts`.

## Data Flow: Experiment Analysis

1. Analyst uploads CSV (captain × date level, must have `cohort` column + `date`/`time` column)
2. Backend stores as pandas DataFrame (small) or Parquet file (>50MB) → returns `session_id`
3. Frontend sends `X-Session-Id` header with all subsequent requests
4. Backend computes metrics via pandas (small) or DuckDB SQL (large)
5. Frontend renders charts (Recharts), tables (AG Grid), Sankey (Plotly.js)
6. Analyst configures diff-in-diff analysis (test/control cohorts, pre/post periods)
7. Executive summary computed client-side in `computeExecutiveSummary.ts`
8. Results can be saved to a report (Supabase) or exported

## Data Flow: Captain Dashboards

1. Frontend sends captain identifiers + filters to backend
2. Backend queries Presto directly using `pyhive` (SQL in `funnel.py`)
3. All user-supplied identifiers validated against allowlists before SQL insertion
4. Results returned as JSON, rendered in dashboard-specific components

## Data Flow: AI Agents

1. Frontend calls `/ai/*` routes with context (session data, experiment info)
2. Backend constructs prompts with `PRESTO_SCHEMA_CONTEXT` (full table/column definitions)
3. GPT-4o generates code/suggestions/analysis
4. Generated functions validated through `function_executor.py` sandbox before returning
5. Results displayed in AI-specific UI components (`features/ai/`)

## Session Management

Four separate in-memory stores (all lost on restart):
- `SESSION_STORE` — uploaded CSV data
- `FUNNEL_SESSION_STORE` — mobile → captain ID mappings
- `REPORT_STORE` — ephemeral report items (real persistence in Supabase)
- `SEGMENT_TRANSITION_STORE` — TTLCache for expensive Presto queries (64 entries, 1hr TTL)

## Frontend Architecture

React 19 SPA with React Router. Key patterns:
- Feature modules in `features/` (insights, dashboard, discover, ai)
- Shared UI primitives in `components/ui/` (shadcn/Radix — 22 components)
- Two React contexts: `AuthContext` (Supabase auth), `ReportContext` (report builder state)
- `@/` path alias → `src/`
- API calls in `lib/api.ts` (backend) and `lib/supabase.ts` (persistence)

---

<!-- Update sections in place as the architecture changes -->
