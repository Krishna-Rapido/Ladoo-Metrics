---
name: project-memory
description: >
  Maintains a living knowledge base of project decisions, architecture evolution, and context
  for the Ladoo Metrics platform. Use this skill proactively after implementing any significant
  feature, fixing a non-trivial bug, making an architectural decision, or when the user asks
  to document changes, update context, capture decisions, or refresh project memory. Also trigger
  when the user says things like "remember this", "document what we did", "update the docs",
  "what's changed recently", or at the end of any implementation session that touched 3+ files.
  This skill keeps Claude deeply aware of the project's history, goals, and current state across
  sessions by maintaining structured documentation that feeds into CLAUDE.md and MEMORY.md.
---

# Project Memory Skill

You are maintaining the institutional memory for Ladoo Metrics — an internal analytics platform
for Rapido. Your job is to ensure that every significant change, decision, and evolution is
captured so that future Claude sessions (and human readers) can understand not just what the
code does, but why it does it that way and how it got there.

## When to Activate

Proactively offer to run this skill when any of these happen:

1. **After implementing a feature** — you just wrote or modified significant code
2. **After an architectural decision** — choosing between approaches, adding a dependency, changing data flow
3. **After a bug fix with root-cause insight** — the fix revealed something about the system worth remembering
4. **After refactoring** — structural changes that affect how the codebase is understood
5. **When the user explicitly asks** — "document this", "update context", "capture what we did"
6. **At session end** — if the session involved 3+ file changes, offer: "Want me to update the project knowledge base?"

When you activate, say something brief like: "Let me update the project knowledge base with what we just did." Then proceed.

## File Structure

The knowledge base lives in `docs/knowledge-base/` relative to the project root at
`/Users/krishna.poddar/Desktop/Rapido EDA/GIG/internal_tools_v1/`.

```
docs/knowledge-base/
├── decisions.md          # Decision log — what was decided, why, what alternatives were rejected
├── timeline.md           # Chronological feature/change timeline
├── architecture.md       # Living architecture doc — how the system actually works today
├── patterns.md           # Recurring patterns, conventions, and "how we do things"
├── lessons-learned.md    # Bugs, gotchas, things that bit us and how we fixed them
└── roadmap-progress.md   # Maps to VISION.md phases — tracks what's done, what's next
```

### File Purposes

**decisions.md** — The most important file. Every significant decision gets an entry:
```markdown
## [Date] Decision Title

**Context**: What situation prompted this decision
**Decision**: What we chose to do
**Alternatives considered**: What else we could have done
**Why**: The reasoning — this is the part that matters most
**Impact**: What files/systems were affected
```

**timeline.md** — Reverse-chronological log of changes. Brief entries, linked to decisions where relevant:
```markdown
## 2026-03-16
- Replaced text date inputs with DatePicker component across Insights and Sankey pages
- Added quick date presets (Last 7/14/30/90 days, custom range)
- See: decisions.md#date-picker-migration
```

**architecture.md** — A living document that reflects the *current* state of the system. Not a history — update it in place when things change. This supplements CLAUDE.md with deeper context about how subsystems interact, data flows, and integration points that are too detailed for CLAUDE.md.

**patterns.md** — Conventions the team has settled on. Examples: "We use shadcn/Radix for all UI primitives", "Chart colors come from the COLORS array, not one-off hex values", "Presto queries always use allowlists from funnel.py". Update when new patterns emerge.

**lessons-learned.md** — When a bug fix reveals a systemic issue, or when an approach fails and we learn from it. Example: "Tailwind v4 changed CSS import order — globals.css must be imported before component styles."

**roadmap-progress.md** — Maps to VISION.md's 5-phase roadmap. When a feature ships that advances a roadmap item, update both this file and check the box in VISION.md.

## How to Update

### Step 1: Assess What Changed

Look at the work done in this session:
- What files were created or modified?
- What decisions were made (explicitly or implicitly)?
- Did the architecture change?
- Did we discover a pattern or learn a lesson?
- Does this advance any VISION.md roadmap items?

### Step 2: Update the Knowledge Base

For each relevant file in `docs/knowledge-base/`:

1. **Read the file first** — understand what's already documented
2. **Add new entries** — don't rewrite existing content unless it's now wrong
3. **Keep entries concise** — a decision entry should be 5-10 lines, a timeline entry 1-3 lines
4. **Use the date** — every entry should be dated (YYYY-MM-DD format)
5. **Cross-reference** — link between files where relevant ("See decisions.md#section-name")

### Step 3: Update CLAUDE.md (if needed)

CLAUDE.md is the primary context file that every Claude session reads. Update it when:
- A new route or major component is added (update the route/file tables)
- The architecture changes (new data flow, new dependency)
- Deployment process changes
- A new "Key Pattern" emerges that every session should know

Keep CLAUDE.md **lean and structural**. Detailed reasoning goes in `docs/knowledge-base/decisions.md`, not CLAUDE.md.

### Step 4: Update MEMORY.md (if needed)

MEMORY.md is Claude's auto-memory file at:
`~/.claude/projects/-Users-krishna-poddar-Desktop-Rapido-EDA-GIG-internal-tools-v1/memory/MEMORY.md`

It has a **200-line limit** (lines after 200 are truncated). Update it when:
- Key file paths change
- Stack components change
- A new architectural pattern is established that affects every session
- User preferences are expressed

Keep MEMORY.md **extremely concise** — it's a quick-reference card, not a narrative.

### Step 5: Update VISION.md (if needed)

When a feature ships that maps to a roadmap checkbox in VISION.md:
- Check the box: `- [ ]` → `- [x]`
- Add a brief note with the date: `- [x] Feature name *(shipped 2026-03-16)*`

## Quality Guidelines

**Write for the next Claude session.** The reader has no context about this session. They'll read CLAUDE.md and MEMORY.md automatically, and may read knowledge-base files if they need deeper context. Write so that a fresh session can understand:
- What the current state of the system is
- Why it's that way (not just how)
- What the team's conventions are
- What pitfalls to avoid

**Don't duplicate.** If something is already well-documented in CLAUDE.md, don't repeat it in architecture.md. Instead, reference it: "See CLAUDE.md for the route table."

**Retire stale content.** If a decision is superseded, mark it: `**Superseded by**: [link to newer decision]`. Don't delete — the history of why we changed direction is valuable.

**Be honest about uncertainty.** If a decision was made under time pressure or without full information, say so. Future sessions should know when to revisit.

## Initial Setup

If `docs/knowledge-base/` is empty or missing files, create them with these templates:

### decisions.md
```markdown
# Decision Log

Significant architectural and design decisions for Ladoo Metrics.
Newest entries first.

---

<!-- Add new decisions above this line -->
```

### timeline.md
```markdown
# Project Timeline

Reverse-chronological log of significant changes to Ladoo Metrics.

---

<!-- Add new entries above this line -->
```

### architecture.md
```markdown
# Architecture — Living Document

How Ladoo Metrics works today. Updated in place as the system evolves.
For the canonical route/file tables, see CLAUDE.md.

---

<!-- Update sections in place as the architecture changes -->
```

### patterns.md
```markdown
# Patterns & Conventions

How we do things in Ladoo Metrics. These are settled conventions —
follow them unless there's a strong reason to deviate.

---

<!-- Add new patterns as they emerge -->
```

### lessons-learned.md
```markdown
# Lessons Learned

Bugs, gotchas, and insights from things that went wrong (or almost did).

---

<!-- Add new lessons as they emerge -->
```

### roadmap-progress.md
```markdown
# Roadmap Progress

Tracks progress against the 5-phase roadmap in VISION.md.

## Phase 1 — Tighten the Core Loop
*Status: In Progress*

## Phase 2 — Grow the Metric Catalog
*Status: Not Started*

## Phase 3 — Self-Serve for PMs
*Status: Not Started*

## Phase 4 — Problem Discovery
*Status: Not Started*

## Phase 5 — Behavioral Metrics Lab
*Status: Not Started*

---

<!-- Update phase status and add shipped items as they land -->
```

## Example Session Flow

After implementing a DatePicker migration:

1. **decisions.md** — Add entry: why DatePicker over native input, why quick presets were included
2. **timeline.md** — Add: "2026-03-16: Replaced text date inputs with DatePicker + quick presets"
3. **patterns.md** — If this establishes a new convention: "Date inputs always use the DatePicker component with standard presets"
4. **CLAUDE.md** — No update needed (no new routes or architecture changes)
5. **MEMORY.md** — No update needed (no stack or path changes)
6. **VISION.md** — Check if this maps to a roadmap item

After adding a new AI agent:

1. **decisions.md** — Why this agent, what problem it solves, what alternatives were considered
2. **timeline.md** — "2026-02-15: Added NarrativeExplainer agent for plain-English DiD summaries"
3. **architecture.md** — Update the agent subsystem description
4. **CLAUDE.md** — Add the new route, update the AI Agent section
5. **MEMORY.md** — Add the new file paths
6. **VISION.md** — Check Phase 4 items

## Important

- Never remove existing knowledge base content unless it's factually wrong
- Always read before writing — understand the current state
- Keep the total MEMORY.md under 200 lines
- Date every entry
- The "why" matters more than the "what" — code shows what, docs explain why
