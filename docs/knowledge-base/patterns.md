# Patterns & Conventions

How we do things in Ladoo Metrics. These are settled conventions —
follow them unless there's a strong reason to deviate.

---

## UI Components

- **Always import from `@/components/ui/*`** — never create parallel implementations
- **Use `cn()` for conditional classes** — never string concatenation for classNames
- **Date inputs use the DatePicker component** with standard quick presets (Last 7/14/30/90 days)
- **Chart colors come from the `COLORS` array** in the relevant chart component — never one-off hex values
- **Semantic color tokens via Tailwind** — `bg-background`, `text-foreground`, `border-border`, etc. Never raw hex for theme colors

## Styling

- **Scope visual fixes to the specific component** — never change `globals.css` or `tailwind.config.js` for a page-specific issue
- **No inline `style={{}}` for theme colors** — only for dynamic computed values (chart dimensions, grid widths)
- **Error states**: `text-destructive` / `bg-destructive/5`
- **Success states**: `text-emerald-700` / `bg-emerald-500/5`
- **Warning states**: `text-amber-700` / `bg-amber-500/5`

## Backend

- **All SQL touching Presto uses allowlists** from `funnel.py` — never interpolate user input directly
- **User code always goes through `function_executor.py` sandbox** — never bypass `FORBIDDEN_PATTERNS`
- **Session-based API**: validate `X-Session-Id` via `get_session_df()` / `get_session_metadata()`
- **Large file detection**: check `is_duckdb_session()` before choosing pandas vs DuckDB query path
- **No secrets in code** — use environment variables

## Data Conventions

- **Date columns**: YYYYMMDD integers in CSVs, YYYY-MM-DD strings in the UI
- **Cohort column**: Required in all uploaded CSVs — defines test/control groups
- **Metrics**: Numeric KPIs computed per captain per date

## Code Organization

- Feature-specific code goes in `features/<feature-name>/` with sub-components
- API client functions go in `lib/api.ts` (backend) or `lib/supabase.ts` (persistence)
- AI-specific API calls go in `lib/aiApi.ts`
- Pydantic models go in `schemas.py` (backend) or `ai_schemas.py` (AI routes)

---

<!-- Add new patterns as they emerge -->
