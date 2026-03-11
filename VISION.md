# Ladoo Metrics — Product Vision

## The Problem

Running a captain experiment at Rapido today requires an analyst at every step. A PM who wants to understand whether a new incentive structure is working has to:

1. Ask an analyst to write a Presto query for the right metrics
2. Wait for the query to run, get a CSV, clean it
3. Ask the analyst to compute lift across test/control cohorts
4. Hope the analyst defined "active captain" the same way as the last experiment

This creates a bottleneck. Insights are slow. Metric definitions drift across experiments. And the hardest question — **what should we even be measuring?** — never gets answered systematically. Problems go undiscovered because no one had time to look.

---

## The Vision

**Ladoo Metrics becomes the self-serve analytics operating system for Rapido's captain ecosystem** — where any analyst or PM can go from a question to a rigorous, shareable answer without writing a single line of SQL or waiting on a data team.

The platform does three things that no spreadsheet or BI tool can:

1. **Problem Discovery** — surfaces anomalies, segment shifts, and behavioral changes before anyone thinks to ask
2. **Metric Generation** — translates questions about captain behavior into validated, reusable metric definitions that the whole team agrees on
3. **Experiment Evaluation** — runs rigorous diff-in-diff analysis with the right metrics, automatically, from a Darwin experiment UUID

The end state: an analyst pastes an experiment UUID, and Ladoo tells them what moved, what didn't, what they might have missed, and what to look at next — all shareable in one report.

---

## The User

**Primary**: Analysts and PMs running captain experiments (incentives, quality programs, supply interventions, retention treatments)

**Secondary**: Ops managers monitoring captain health metrics without running experiments

**North star question both users have**: *"Is what we're doing actually changing captain behavior — and are we measuring the right things to know?"*

---

## The Four Layers (Current → Future)

### Layer 1 — Data Access (Today: functional, Tomorrow: invisible)

Today an analyst needs to know which Presto table has experiment assignments, which has performance metrics, which has OCARA data. They have to know to go to Discover, paste a UUID, then separately apply functions.

**Future state**: You provide an experiment UUID. Ladoo knows the experiment's dates, city, service, cohort sizes — and pre-selects a sensible starting metric set automatically. The "fetch → enrich → analyze" pipeline collapses into a single gesture. Functions from the library are suggested based on the experiment type (acquisition experiment → R2A metrics pre-loaded, retention experiment → RTU/FE2Net metrics pre-loaded).

### Layer 2 — Metric Generation (Today: manual library, Tomorrow: living catalog)

Today the Functions library is a folder of validated Python functions. It works, but it's static — someone has to know which function to pick, what parameters to pass, and whether the output columns are what they think they are.

**Future state**: The Functions library becomes a **living metric catalog** — the organization's agreed, versioned definitions of what "active captain", "quality captain", "retained captain" means. Every metric has:
- A plain-language description of what it captures about captain behavior
- The Presto logic that computes it
- A history of which experiments it's been used in and what it found
- Suggested companion metrics ("analysts who measured DAPR also measured...")

New metrics are proposed, debated, and validated in the platform itself. When an analyst creates a new function to capture a behavior no one has measured before, it enters the catalog and becomes reusable by everyone.

### Layer 3 — Problem Discovery (Today: absent, Tomorrow: the differentiator)

This is the biggest gap. Right now Ladoo is a reactive tool — you bring a question, it answers it. But the most valuable insights at Rapido aren't the ones analysts thought to ask about.

**The Transition/Sankey diagram hints at this**: when you see 46,000 Daily captains and 15,000 Weekly captains flowing between segments every day, the platform knows something. It knows which city's Weekly→Rest churn spiked last Tuesday. It knows which captain segment benefited from the last three incentive experiments and which one didn't move at all.

**Future state**: Ladoo runs continuous monitoring across captain segments, surface types, and cities. It flags:
- Unusual segment transitions ("Daily→Rest churn in Bangalore is 2σ above baseline this week")
- Metrics that moved in an experiment but weren't in the analyst's original readout
- Cohorts within an experiment that show heterogeneous treatment effects ("the experiment helped Weekly captains but hurt Monthly captains")
- Experiments that look flat on standard metrics but show signal on behavior-derived metrics

This is **automated problem discovery** — Ladoo tells you what to investigate, not just what you asked about.

### Layer 4 — Creative Metrics (Today: implicit, Tomorrow: explicit)

The deepest problem: **we may not have the right metrics to capture what experiments are actually changing about captain behavior.**

Standard metrics — net_days, accepted_orders, gross_pings — measure outputs. But captain behavior is a sequence of decisions: come online → accept or reject pings → complete or cancel → stay online or log off. An experiment that changes the ping acceptance logic will show up differently in gross_pings vs accepted_orders vs idle_lh, and the pattern across all three tells a richer story than any one metric.

**Future state**: Ladoo helps generate and validate behavioral metrics — composite measures that capture the shape of a captain's day, not just its sum. Examples:
- **Engagement ratio**: (net_days / online_days) — did the captain show up and actually work, or just stay online?
- **Quality-adjusted activity**: dapr × net_days — active days weighted by quality
- **Acceptance behavior index**: accepted_orders / gross_pings across different TOD buckets

These aren't one-off calculations. They become first-class metrics in the catalog, tested against past experiments to see if they were more predictive than the metrics those experiments actually used.

The Calculated Columns feature is the seed of this. The vision is to grow it into a **behavioral metrics lab** where the team systematically expands its vocabulary for describing what captains do.

---

## Roadmap

### Phase 1 — Tighten the Core Loop *(now)*
The experiment analysis workflow exists but has friction. Make it seamless.

- [ ] Experiment UUID → auto-populate dates, city, service from Darwin metadata
- [ ] Suggest relevant functions from library based on experiment type/tags
- [ ] Discover session → Insights in one click (no re-upload, no re-configuration)
- [ ] Insights Executive Summary: add statistical significance (p-value) column alongside LIFT %
- [ ] Report auto-naming from experiment UUID + date

### Phase 2 — Grow the Metric Catalog *(next)*
Make the Functions library the organization's metric definition layer.

- [ ] Metric catalog UI: plain-language descriptions, tags (quality/retention/acquisition/behavior), usage history
- [ ] "Companion metrics" suggestions on the Insights config panel
- [ ] Calculated Columns: promote best-performing derived metrics into the shared catalog
- [ ] Metric versioning: when a function changes, flag experiments that used the old version
- [ ] Standard behavioral metric bundle: engagement_ratio, quality_adjusted_activity, acceptance_behavior_index as first-class catalog entries

### Phase 3 — Self-Serve for PMs *(medium term)*
Remove the requirement for analyst involvement on standard experiment readouts.

- [ ] Guided experiment setup: PM inputs UUID, Ladoo walks through the rest with smart defaults
- [ ] Natural language metric descriptions that non-technical users can understand
- [ ] "Quick readout" mode: one-click standard report for common experiment types
- [ ] Report templates by experiment type (incentive / quality / supply / retention)
- [ ] Scheduled report delivery: auto-generate a readout N days after experiment ends

### Phase 4 — Problem Discovery *(longer term)*
Make Ladoo proactive, not just reactive.

- [ ] Continuous segment monitoring: daily tracking of Daily/Weekly/Monthly/Quarterly/Rest transitions by city × service
- [ ] Anomaly alerts: flag unusual segment shifts before anyone asks
- [ ] Heterogeneous treatment effect detection: automatically slice experiment results by segment, city, service to surface hidden effects
- [ ] "What you might have missed" panel on every Insights readout: metrics that moved but weren't in the analyst's selection
- [ ] Cross-experiment pattern library: "experiments of type X typically move metric Y — here's the historical distribution"

### Phase 5 — Behavioral Metrics Lab *(future)*
Build the vocabulary to describe captain behavior, not just captain output.

- [ ] Time-of-day analysis built into Insights: same DiD analysis sliced by TOD buckets
- [ ] Captain journey reconstruction: given an experiment's dates, show the average daily behavior arc (online hours × ping acceptance × completion × churn) for test vs control
- [ ] Metric discovery: given a set of raw columns, suggest behavioral composite metrics worth computing and show their historical correlation with important outcomes
- [ ] Feedback loop: when a report is published, capture whether the predicted metric movement was confirmed in the next experiment — use this to improve metric suggestions

---

## What Success Looks Like

**6 months**: Every experiment at Rapido has a Ladoo readout. No analyst needs to write Presto SQL for a standard experiment analysis.

**12 months**: PMs are running their own readouts without analyst involvement. The metric catalog has 50+ validated functions covering the full captain behavioral vocabulary.

**24 months**: Ladoo surfaces 20% of the experiments worth running — not because someone asked, but because the platform detected a segment anomaly or a behavioral pattern that suggests an opportunity.

The measure of the platform's success isn't how fast it answers questions. It's **how many important questions get asked that would have gone unasked without it.**
