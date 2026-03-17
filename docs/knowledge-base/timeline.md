# Project Timeline

Reverse-chronological log of significant changes to Ladoo Metrics.

---

## 2026-03-16
- Replaced text date inputs with DatePicker component + quick presets (Last 7/14/30/90 days)
- Applied to both Insights config sidebar and Sankey Diagram page
- See: decisions.md#replace-text-date-inputs-with-datepicker-component

## 2026-03-11
- Fixed transparent dialog boxes caused by Tailwind v4 CSS import order
- Upgraded pandas in CI to resolve Python 3.12 wheel build failure
- See: decisions.md#fix-tailwind-v4-css-import-order-for-transparent-dialogs, lessons-learned.md

## 2026-03 (early)
- Added Claude Code GitHub Actions (PR review workflow, CI integration)
- Set up Slack-driven dev pipeline: tests, CI, Claude Action, Edge Function

## 2026-02
- Added AI Agent layer: MetricGen, MetricSuggest, ProblemDiscovery, NarrativeExplainer
- Created `/discovery` page for automated problem discovery
- Added "Generate with AI" floating panel and "Explain this" narrative panel
- See: decisions.md#add-ai-agent-layer

## 2026-01
- Adopted Supabase for auth and persistence (reports, functions, folders)
- Built report builder with folder hierarchy and export
- Built functions library with folder hierarchy and parameter management
- Added calculated columns feature
- See: decisions.md#adopt-supabase-as-persistence-layer

## 2025 (foundation)
- Built core platform: CSV upload, cohort analysis, diff-in-diff, funnel metrics
- Captain dashboards (DAPR, FE2Net, RTU, R2A, A2PHH) via Presto
- Discover page with Sankey diagrams (Plotly.js)
- Large dataset handling via DuckDB + Parquet
- Deployed to VM at laddoo.labs.plectrum.dev

---

<!-- Add new entries above this line -->
