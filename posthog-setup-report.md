<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into **Ladoo Metrics** (`backend/main.py`). A `Posthog()` instance is initialized at startup using environment variables, with `atexit` shutdown registration to ensure all events flush before the process exits. A lightweight `_ph_capture()` helper wraps every call so errors are silently swallowed and never break user-facing requests.

**18 events** are now instrumented across the FastAPI backend, covering the full analyst workflow — from CSV upload through to causal inference, report export, knowledge graph NL queries, and calculated columns.

## Events instrumented

| Event name | Description | File |
|---|---|---|
| `csv_uploaded` | Analyst uploads a CSV dataset (small or large file path) | `backend/main.py` |
| `insights_computed` | Analyst computes cohort-level time-series insights | `backend/main.py` |
| `statistical_test_run` | Analyst runs a significance test (t-test, chi-square, Mann-Whitney) | `backend/main.py` |
| `funnel_analysis_run` | Analyst runs retention/acquisition funnel analysis | `backend/main.py` |
| `report_item_added` | Analyst adds a chart, table, or annotation to the report builder | `backend/main.py` |
| `report_exported` | Analyst exports a report (HTML, PDF, or Word) | `backend/main.py` |
| `custom_function_executed` | Analyst executes a custom Python metric function | `backend/main.py` |
| `causal_analysis_run` | Analyst runs a causal inference method (PSM, Causal Impact, HTE, Synthetic Control, RDD) | `backend/main.py` |
| `captain_dashboard_queried` | Analyst queries a captain performance dashboard (FE2Net, RTU, R2A, R2A%, A2PHH) | `backend/main.py` |
| `segment_transitions_analyzed` | Analyst runs a segment transition (Sankey) analysis | `backend/main.py` |
| `experiment_performance_analyzed` | Analyst analyzes experiment performance in the Discover page | `backend/main.py` |
| `pivot_computed` | Analyst generates a pivot table on their dataset | `backend/main.py` |
| `data_visualized` | Analyst triggers a chart visualization | `backend/main.py` |
| `nl_query_run` | Analyst runs a natural language → SQL query via the Knowledge Graph; tracks whether it was executed against Presto | `backend/main.py` |
| `dashboard_query_generated` | Analyst generates a parameterised SQL template for a custom dashboard via AI | `backend/main.py` |
| `query_feedback_given` | Analyst gives thumbs-up/down feedback on a generated NL query result | `backend/main.py` |
| `calculated_column_applied` | Analyst applies a calculated column expression to their session dataset | `backend/main.py` |
| `captain_level_aggregation_run` | Analyst runs a captain-level aggregation grouped by a categorical column | `backend/main.py` |

## Other changes

- `backend/requirements.txt` — `posthog>=3.0.0` (already present)
- `backend/.env` — `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` set
- `backend/main.py` — `Posthog()` client, `atexit` shutdown, `_ph_capture()` helper (already present); 5 new `_ph_capture()` calls added for knowledge/calculated-columns/captain-level routes

## Next steps

We've built a dashboard and 5 insights to keep an eye on analyst behaviour:

- **Dashboard — Analytics basics:** https://us.posthog.com/project/400846/dashboard/1519086

### Insights

- **CSV Uploads over time** (line chart — funnel entry): https://us.posthog.com/project/400846/insights/YRCms2Lu
- **Analysis runs by type** (line chart — weekly breakdown of insights/funnel/causal/stat tests): https://us.posthog.com/project/400846/insights/2I0TzBvT
- **Upload to Insights funnel** (funnel — core activation conversion): https://us.posthog.com/project/400846/insights/4oKrZMJE
- **NL Query usage** (bar chart — all queries vs executed against Presto): https://us.posthog.com/project/400846/insights/hPRuVkPE
- **Feature usage breakdown (last 30 days)** (table — all 18 events ranked by volume): https://us.posthog.com/project/400846/insights/H3GePWiG

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-fastapi/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
