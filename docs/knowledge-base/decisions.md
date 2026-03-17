# Decision Log

Significant architectural and design decisions for Ladoo Metrics.
Newest entries first.

---

## 2026-03-16 Replace text date inputs with DatePicker component

**Context**: Date inputs across Insights and Sankey pages used plain text inputs requiring users to type dates in specific formats (YYYY-MM-DD or YYYYMMDD). Error-prone and poor UX.
**Decision**: Migrate all date inputs to a DatePicker component with calendar popup and add quick preset buttons (Last 7/14/30/90 days, custom range).
**Alternatives considered**: Native HTML `<input type="date">` — rejected because styling is inconsistent across browsers and doesn't support presets.
**Why**: Reduces input errors, speeds up common workflows (analysts almost always want "last N days"), and brings consistency across all date-selecting surfaces.
**Impact**: `InsightsConfigSidebar`, Sankey diagram config, DatePicker component.

## 2026-03-11 Fix Tailwind v4 CSS import order for transparent dialogs

**Context**: Dialog boxes (shadcn/Radix) appeared transparent/unreadable. Root cause: Tailwind v4 changed how CSS layers work, and `globals.css` was being imported after component styles, so CSS custom properties weren't available when components rendered.
**Decision**: Fix the import order — `globals.css` must be imported before all component styles in the app entry point.
**Alternatives considered**: Adding inline styles to dialog components — rejected because it would bypass the design system and create maintenance burden.
**Why**: The issue was systemic (affected all dialogs), so the fix needed to be at the root, not per-component.
**Impact**: `main.tsx` import order, `globals.css`. Lesson captured in lessons-learned.md.

## 2026-02 Add AI Agent layer (MetricGen, MetricSuggest, ProblemDiscovery, NarrativeExplainer)

**Context**: Analysts were manually writing Python functions for every new metric. PMs couldn't generate metrics without analyst help. No systematic way to discover anomalies in captain data.
**Decision**: Add four LLM-powered agents behind `/ai/*` routes, using GPT-4o via OpenAI API. Agents generate validated Python functions, suggest relevant metrics, scan for anomalies, and explain DiD summaries in plain English.
**Alternatives considered**: (1) Claude API — decided GPT-4o was sufficient for code generation tasks and the team had existing OpenAI infra. (2) Building a rule-based metric suggester — rejected because the value is in natural language understanding.
**Why**: Directly advances Phase 3 (Self-Serve for PMs) and Phase 4 (Problem Discovery) of the roadmap. The metric generation pipeline reuses the existing `function_executor.py` sandbox, so generated code goes through the same security validation as hand-written code.
**Impact**: New files: `ai_agent.py`, `ai_schemas.py`, `aiApi.ts`, `features/ai/` components, `DiscoveryPage.tsx`. New env var: `OPENAI_API_KEY`. New Supabase tables: `ai_discoveries`, `ai_generated_metrics`.

## 2026-01 Adopt Supabase as persistence layer (not the backend)

**Context**: The FastAPI backend is stateless (in-memory sessions). Needed persistent storage for reports, functions, folders, and user data without adding a database to the backend deployment.
**Decision**: Use Supabase for all persistent data. Backend remains stateless — Supabase is called directly from the frontend for CRUD operations on reports, functions, and calculated columns.
**Alternatives considered**: (1) Adding PostgreSQL to the backend — rejected because it would complicate the single-file backend deployment. (2) SQLite — rejected because it doesn't support concurrent access well and doesn't provide auth.
**Why**: Supabase gives us auth (restricted to @rapido.bike), a PostgreSQL database, and a client SDK for free. The backend stays simple — it only handles compute (CSV processing, DuckDB queries, Presto queries).
**Impact**: All persistent features (reports, functions, folders) use `supabase.ts` client. Auth gating via `AuthContext.tsx`.

---

<!-- Add new decisions above this line -->
