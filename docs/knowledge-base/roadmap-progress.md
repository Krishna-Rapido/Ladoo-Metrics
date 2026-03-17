# Roadmap Progress

Tracks progress against the 5-phase roadmap in VISION.md.

---

## Phase 1 — Tighten the Core Loop
*Status: In Progress*

- [ ] Experiment UUID → auto-populate dates, city, service from Darwin metadata
- [ ] Suggest relevant functions from library based on experiment type/tags
- [ ] Discover session → Insights in one click (no re-upload, no re-configuration)
- [ ] Insights Executive Summary: add statistical significance (p-value) column alongside LIFT %
- [ ] Report auto-naming from experiment UUID + date
- [x] Date picker with quick presets for Insights and Sankey *(shipped 2026-03-16)*

## Phase 2 — Grow the Metric Catalog
*Status: Partially Started (AI generation available, catalog UI not yet built)*

- [ ] Metric catalog UI: plain-language descriptions, tags, usage history
- [ ] "Companion metrics" suggestions on the Insights config panel
- [ ] Calculated Columns: promote best-performing derived metrics into the shared catalog
- [ ] Metric versioning: flag experiments using old function versions
- [ ] Standard behavioral metric bundle (engagement_ratio, quality_adjusted_activity, acceptance_behavior_index)
- [x] AI-powered metric generation (MetricGen agent) *(shipped 2026-02)*
- [x] AI metric suggestions (MetricSuggest agent) *(shipped 2026-02)*

## Phase 3 — Self-Serve for PMs
*Status: Early Progress*

- [ ] Guided experiment setup (PM inputs UUID, Ladoo walks through the rest)
- [ ] Natural language metric descriptions for non-technical users
- [ ] "Quick readout" mode: one-click standard report
- [ ] Report templates by experiment type
- [ ] Scheduled report delivery
- [x] Plain-English experiment narrative (NarrativeExplainer agent) *(shipped 2026-02)*

## Phase 4 — Problem Discovery
*Status: Early Progress*

- [x] Automated anomaly detection via z-score scan (ProblemDiscovery agent) *(shipped 2026-02)*
- [x] Discovery page UI *(shipped 2026-02)*
- [ ] Continuous segment monitoring (daily tracking by city × service)
- [ ] Anomaly alerts
- [ ] Heterogeneous treatment effect detection
- [ ] "What you might have missed" panel on Insights readout
- [ ] Cross-experiment pattern library

## Phase 5 — Behavioral Metrics Lab
*Status: Not Started*

- [ ] Time-of-day analysis in Insights
- [ ] Captain journey reconstruction
- [ ] Metric discovery (suggest behavioral composites from raw columns)
- [ ] Feedback loop (track prediction accuracy across experiments)

---

<!-- Update phase status and add shipped items as they land -->
