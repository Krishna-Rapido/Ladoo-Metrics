# Design System Reference — Ladoo Metrics

> **Purpose:** This document is the single source of truth for all visual design tokens, component patterns, and chart color palettes used in the Ladoo Metrics frontend. AI agents and developers MUST consult this before making any styling changes.

---

## Color Tokens (CSS Custom Properties)

All colors are defined as HSL values in `frontend/src/styles/globals.css` and mapped to Tailwind classes via `frontend/tailwind.config.js`.

### Light Mode (`:root`)

| CSS Variable | HSL Value | Tailwind Class | Usage |
|---|---|---|---|
| `--background` | `0 0% 100%` | `bg-background` | Page backgrounds (white) |
| `--foreground` | `222.2 84% 4.9%` | `text-foreground` | Primary text (near-black) |
| `--card` | `0 0% 100%` | `bg-card` | Card backgrounds (white) |
| `--card-foreground` | `222.2 84% 4.9%` | `text-card-foreground` | Card text |
| `--popover` | `0 0% 100%` | `bg-popover` | Popover/dropdown backgrounds |
| `--popover-foreground` | `222.2 84% 4.9%` | `text-popover-foreground` | Popover text |
| `--primary` | `222.2 47.4% 11.2%` | `bg-primary`, `text-primary` | Primary buttons, dark navy |
| `--primary-foreground` | `210 40% 98%` | `text-primary-foreground` | Text on primary backgrounds |
| `--secondary` | `210 40% 96.1%` | `bg-secondary` | Secondary backgrounds (light gray-blue) |
| `--secondary-foreground` | `222.2 47.4% 11.2%` | `text-secondary-foreground` | Text on secondary backgrounds |
| `--muted` | `210 40% 96.1%` | `bg-muted` | Muted/disabled backgrounds |
| `--muted-foreground` | `215.4 16.3% 46.9%` | `text-muted-foreground` | Secondary/helper text (gray) |
| `--accent` | `210 40% 96.1%` | `bg-accent` | Hover/focus backgrounds |
| `--accent-foreground` | `222.2 47.4% 11.2%` | `text-accent-foreground` | Text on accent backgrounds |
| `--destructive` | `0 84.2% 60.2%` | `bg-destructive`, `text-destructive` | Error states, delete actions (red) |
| `--destructive-foreground` | `210 40% 98%` | `text-destructive-foreground` | Text on destructive backgrounds |
| `--border` | `214.3 31.8% 91.4%` | `border-border` | All borders (light gray) |
| `--input` | `214.3 31.8% 91.4%` | `border-input` | Input field borders |
| `--ring` | `215 20.2% 65.1%` | `ring-ring` | Focus ring color |
| `--radius` | `0.875rem` (14px) | `rounded-lg` / `rounded-md` / `rounded-sm` | Base border radius |

### Dark Mode (`.dark`)

| CSS Variable | HSL Value | Notes |
|---|---|---|
| `--background` | `222.2 84% 4.9%` | Inverted — dark navy |
| `--foreground` | `210 40% 98%` | Inverted — near-white |
| `--card` | `222.2 84% 4.9%` | Same as dark background |
| `--primary` | `210 40% 98%` | Inverted — light for contrast |
| `--primary-foreground` | `222.2 47.4% 11.2%` | Dark text on light primary |
| `--secondary` | `217.2 32.6% 17.5%` | Dark gray-blue |
| `--muted` | `217.2 32.6% 17.5%` | Same as dark secondary |
| `--muted-foreground` | `215 20.2% 65.1%` | Medium gray |
| `--border` | `217.2 32.6% 17.5%` | Subtle dark border |
| `--destructive` | `0 62.8% 30.6%` | Darker red for dark mode |

### CSS Chart Variables

| Variable | HSL Value | Tailwind Class | Color |
|---|---|---|---|
| `--chart-1` | `142 76% 36%` | `text-chart-1` | Green |
| `--chart-2` | `199 89% 48%` | `text-chart-2` | Blue |
| `--chart-3` | `262 83% 58%` | `text-chart-3` | Purple |
| `--chart-4` | `43 96% 56%` | `text-chart-4` | Yellow |
| `--chart-5` | `0 84% 60%` | `text-chart-5` | Red |

### Border Radius Scale

| Tailwind Class | Value | Derived From |
|---|---|---|
| `rounded-lg` | `var(--radius)` = `0.875rem` (14px) | Base |
| `rounded-md` | `calc(var(--radius) - 2px)` = 12px | Base - 2px |
| `rounded-sm` | `calc(var(--radius) - 4px)` = 10px | Base - 4px |

---

## Chart Color Palettes

Charts use hardcoded hex arrays (not CSS variables). Each palette is scoped to specific files.

### General Series Palette — `ChartBuilder.tsx` + `DiscoverVisualization.tsx`

Used for multi-series line, bar, area, and scatter charts.

```
ChartBuilder.tsx:        '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
                         '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#84cc16'

DiscoverVisualization.tsx: '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
                           '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#84cc16'
```

Note: Same 10 colors, different starting order. Both use `COLORS[idx % COLORS.length]`.

| Index | Hex | Tailwind Equivalent | Color Name |
|---|---|---|---|
| 0 | `#8b5cf6` / `#10b981` | `violet-500` / `emerald-500` | Violet / Emerald |
| 1 | `#3b82f6` | `blue-500` | Blue |
| 2 | `#10b981` / `#f59e0b` | `emerald-500` / `amber-500` | Emerald / Amber |
| 3 | `#f59e0b` / `#ef4444` | `amber-500` / `red-500` | Amber / Red |
| 4 | `#ef4444` / `#8b5cf6` | `red-500` / `violet-500` | Red / Violet |
| 5 | `#ec4899` | `pink-500` | Pink |
| 6 | `#6366f1` | `indigo-500` | Indigo |
| 7 | `#14b8a6` | `teal-500` | Teal |
| 8 | `#f97316` | `orange-500` | Orange |
| 9 | `#84cc16` | `lime-500` | Lime |

### Executive Summary Palette — `InsightsPage.tsx`

4 colors for test/control × pre/post comparison:

```typescript
const PALETTE_4 = ['#10b981', '#059669', '#6366f1', '#4f46e5']
// Test Pre (emerald-500), Test Post (emerald-600), Control Pre (indigo-500), Control Post (indigo-700)
```

### Executive Summary Chart Palette — `computeExecutiveSummary.ts`

10-color D3-style categorical palette for multi-metric charts:

```
'#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
'#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
```

### Captain-Level Palette — `CaptainLevelCharts.tsx`

Named object for pre/post × test/control:

```typescript
const COLORS = {
    preTest:     '#3b82f6',  // blue-500
    postTest:    '#60a5fa',  // blue-400
    preControl:  '#10b981',  // emerald-500
    postControl: '#34d399'   // emerald-300
};
```

---

## Component Library

All shared UI components live in `frontend/src/components/ui/` and follow shadcn/ui conventions. They are built on Radix UI primitives and styled with Tailwind.

### Available Components (22)

| Component | File | Key Classes |
|---|---|---|
| Badge | `badge.tsx` | Variants: `default`, `secondary`, `destructive`, `outline` |
| Button | `button.tsx` | Variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`; Sizes: `default`, `sm`, `lg`, `icon` |
| Calendar | `calendar.tsx` | Day picker with Radix primitives |
| Card | `card.tsx` | `rounded-2xl border border-border bg-card text-card-foreground shadow-sm` |
| Checkbox | `checkbox.tsx` | Radix checkbox with focus ring |
| Collapsible | `collapsible.tsx` | Radix collapsible |
| Date Picker | `date-picker.tsx` | Popover + Calendar composition |
| Dialog | `dialog.tsx` | Overlay: `bg-black/50`; Content: `bg-background border p-6 shadow-lg` with `sm:rounded-lg` |
| Input | `input.tsx` | `border-input bg-transparent rounded-md` with focus ring |
| Label | `label.tsx` | `text-sm font-medium` |
| Popover | `popover.tsx` | `bg-popover text-popover-foreground rounded-md border shadow-md` |
| Radio Group | `radio-group.tsx` | Radix radio with indicators |
| Scroll Area | `scroll-area.tsx` | Radix scroll area with custom scrollbar |
| Select | `select.tsx` | `bg-popover text-popover-foreground rounded-md border` |
| Separator | `separator.tsx` | `bg-border` horizontal/vertical divider |
| Sheet | `sheet.tsx` | Slide-out panel (overlay: `bg-black/50`) |
| Sidebar | `sidebar.tsx` | `w-64` (16rem / 256px) fixed sidebar |
| Skeleton | `skeleton.tsx` | `bg-muted animate-pulse rounded-md` |
| Table | `table.tsx` | Standard table with `border-b` row dividers |
| Tabs | `tabs.tsx` | Radix tabs with `bg-muted rounded-md` list |
| Textarea | `textarea.tsx` | `border-input bg-transparent rounded-md` |
| Tooltip | `tooltip.tsx` | `bg-popover text-popover-foreground rounded-md` |

### Class Merging Utility

All conditional class names MUST use the `cn()` utility from `@/lib/utils`:

```typescript
import { cn } from "@/lib/utils"

// cn() merges clsx + tailwind-merge to avoid class conflicts
<div className={cn("base-class", isActive && "active-class")} />
```

---

## Typography

- **Font stack:** `Inter, system-ui, -apple-system, sans-serif`
- No explicit `@import` or `@font-face` — relies on system font availability
- Heading sizes follow Tailwind defaults (`text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`)
- Primary text: `text-foreground` (near-black in light mode)
- Secondary text: `text-muted-foreground` (gray)
- White-on-dark text: `text-primary-foreground`

---

## Spacing Conventions

| Context | Class | Value |
|---|---|---|
| Card padding | `p-6` | 24px |
| Section gaps | `gap-2`, `gap-4` | 8px, 16px |
| Dialog padding | `p-6` | 24px |
| Sidebar width | `w-64` | 256px (16rem) |
| Page max-width | varies by page | No global max-width |
| Input height | `h-9`, `h-10` | 36px, 40px |

---

## Semantic State Colors

For success/error/warning states in component files (NOT in globals.css):

| State | Text Class | Background Class | Hex Equivalent |
|---|---|---|---|
| Error/Destructive | `text-destructive` | `bg-destructive/5` | ~`#ef4444` |
| Success | `text-emerald-700` | `bg-emerald-500/5` | ~`#047857` / `#10b981` |
| Warning | `text-amber-700` | `bg-amber-500/5` | ~`#b45309` / `#f59e0b` |
| Info | `text-blue-700` | `bg-blue-500/5` | ~`#1d4ed8` / `#3b82f6` |

---

## Known Technical Debt (bugs, not patterns)

These are violations of the design system that exist in the codebase. They should be fixed incrementally, NOT used as precedent for new code.

| File | Issue |
|---|---|
| `pages/FunctionsPage.tsx` | ~40 inline `style={{ }}` overrides with hardcoded colors (e.g., `backgroundColor: 'white'`, `color: '#1a1a1a'`). Should use Tailwind classes. |
| `features/insights/report/InsightsReportTab.tsx` | Dialog content uses inline `style={{ backgroundColor: 'white', color: '#1a1a1a' }}` instead of the Dialog component's built-in `bg-background text-foreground` classes. |
| `features/insights/components/ExecutiveSummaryTable.tsx` | AG Grid cell styles use `backgroundColor: "#ffffff"` inline. |
| `features/insights/pivot/PivotBuilder.tsx` | AG Grid cell styles use `backgroundColor: "#ffffff"` inline. |
| `features/insights/components/PerformanceTrends.tsx` | AG Grid cell styles use `backgroundColor: "#ffffff"` inline. |
| Various | Some buttons use hardcoded `purple` / `indigo` instead of design tokens. |
| AG Grid instances | Use default Alpine theme, not customized to match design system. |

> **Rule:** When fixing a bug in a file listed above, fix only what's requested. Do not "clean up" the surrounding inline styles unless explicitly asked — that's a separate refactoring task.
