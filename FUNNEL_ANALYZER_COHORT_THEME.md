# Funnel Analysis - Cohort Analyzer Theme Integration

## 🎨 Complete Refactor Overview

The Funnel Analysis wizard has been completely refactored to match the Cohort Analyzer theme, using AG Grid for professional data tables and maintaining consistent styling throughout.

## ✨ Key Changes

### 1. **AG Grid Integration** (Replacing TanStack Table)

#### New Component: `FunnelDataGrid.tsx`
Uses the same AG Grid library as `CohortDataGrid`:

```typescript
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
```

**Features:**
- ✅ Sortable columns (click headers)
- ✅ Filterable data (sidebar filters)
- ✅ Column visibility toggle (sidebar)
- ✅ Pagination (10, 20, 50, 100 rows)
- ✅ CSV Export (📥 button)
- ✅ Excel Export (📊 button)
- ✅ Resizable columns
- ✅ Number formatting with toLocaleString
- ✅ Pinned columns (first 3 identifier columns)

### 2. **Cohort Analyzer Theme Consistency**

#### Card Layout
```css
.glass-card - Main container
.card-header - Header with icon
.card-title - Title styling
.card-subtitle - Subtitle styling
```

All cards now use the same:
- Border radius: `rounded-lg`
- Shadow: `shadow-sm`
- Border: `border-slate-200`
- Background: `bg-white`
- Padding: `p-4` to `p-6`

#### Typography
- Headers: `text-xl font-semibold text-slate-800`
- Descriptions: `text-sm text-slate-600`
- Metrics: `text-2xl font-bold`
- Labels: `text-sm font-medium text-slate-700`

### 3. **Enhanced Summary Cards**

#### Upload Step Summary
Shows 3 key metrics:
1. **Total Rows**: Number of rows uploaded
2. **Unique Mobile Numbers**: Count of unique mobile numbers
3. **Has Cohort**: Whether cohort column exists (✓/✗)

Plus **Cohort Distribution** (if cohorts exist):
- Shows count per cohort
- Purple pills with cohort name and count

#### Captain IDs Step Summary
Shows 3 key metrics:
1. **Unique Captain IDs**: Number found
2. **Match Rate**: Percentage matched
3. **Unmatched**: Number not matched

Color-coded:
- Green for successful matches
- Amber for unmatched numbers

#### AO Funnel Step Summary
Shows 3 key metrics:
1. **Total Data Points**: Captain × Days
2. **Unique Captain IDs**: In final dataset
3. **Metrics Available**: Number of metric columns

All with purple gradient theme

### 4. **Step-by-Step Process Design**

Each step is now **independent and self-contained**:

```
Upload
  ↓
Captain IDs (shows upload summary)
  ↓
AO Funnel (shows captain ID summary)
  ↓
Complete (shows all metrics)
```

#### Future Extensibility
The design allows adding more steps between Captain IDs and AO Funnel:
- Additional data enrichment
- Filtering steps
- Data validation
- Custom transformations

### 5. **Progress Indicator**

Matches Cohort Analyzer style:
- Linear progress bar with gradient
- Circle indicators with icons
- Active state highlighting
- Completed state with checkmarks
- Smooth animations

### 6. **Info Cards**

All status messages use consistent card styling:

**Blue Cards** (Upload complete):
```css
bg-blue-50 border-blue-200 text-blue-900
```

**Green Cards** (Captain IDs success):
```css
bg-green-50 border-green-200 text-green-900
```

**Purple Cards** (AO Funnel complete):
```css
bg-purple-50 border-purple-200 text-purple-900
```

**Red Cards** (Errors):
```css
bg-red-50 border-red-200 text-red-700
```

### 7. **Table Integration**

#### FunnelDataGrid Component
- Same AG Grid setup as CohortDataGrid
- Same column definitions pattern
- Same formatting functions
- Same sidebar configuration
- Same pagination settings

#### Column Configuration
```typescript
{
  field: column_name,
  headerName: 'Formatted Name',
  sortable: true,
  filter: 'agNumberColumnFilter' | true,
  width: 120,
  pinned: 'left' | undefined,
  valueFormatter: (params) => formatting logic,
  cellClass: 'text-right' | 'text-left',
  headerTooltip: 'Column description'
}
```

#### Smart Column Ordering
1. Important columns first (mobile_number, captain_id, cohort, city, time, date)
2. First 3 columns pinned on left
3. Remaining columns alphabetically sorted
4. Identifier columns left-aligned
5. Metric columns right-aligned with numbers

### 8. **Export Functionality**

Two export buttons in table header:

**CSV Export (📥)**
```typescript
gridApi.exportDataAsCsv({
  fileName: `${fileName}.csv`,
  columnSeparator: ','
});
```

**Excel Export (📊)**
```typescript
gridApi.exportDataAsExcel({
  fileName: `${fileName}.xlsx`
});
```

Files named by step:
- `mobile_numbers.csv` - Upload step
- `captain_ids.csv` - Captain IDs step
- `ao_funnel_data.csv` - AO Funnel step

### 9. **Button Styling**

All buttons match Cohort Analyzer theme:

**Primary (Gradient)**:
```css
bg-gradient-to-r from-purple-600 to-blue-600
text-white font-semibold shadow-lg hover:shadow-xl
```

**Secondary (White)**:
```css
bg-white border border-slate-300 text-slate-700
font-medium hover:bg-slate-50
```

**Success (Green)**:
```css
bg-gradient-to-r from-green-600 to-emerald-600
text-white font-bold shadow-lg hover:shadow-xl
```

### 10. **Form Inputs**

All inputs match Cohort Analyzer:
```css
px-4 py-2 border border-slate-300 rounded-lg
focus:outline-none focus:ring-2 focus:ring-purple-500
```

Labels:
```css
text-sm font-medium text-slate-700 mb-2
```

### 11. **Animations**

Consistent with Cohort Analyzer:

**Step Transitions**:
```typescript
initial={{ opacity: 0, x: 20 }}
animate={{ opacity: 1, x: 0 }}
exit={{ opacity: 0, x: -20 }}
transition={{ duration: 0.3 }}
```

**Element Appearances**:
```typescript
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
```

**Progress Bar**:
```typescript
animate={{ width: `${percentage}%` }}
transition={{ duration: 0.5 }}
```

## 📊 Component Structure

```
FunnelAnalysis (Main Wizard)
├── Progress Indicator
├── Error Display
└── Step Content
    ├── Upload Step
    │   ├── File Upload Zone
    │   └── Summary Cards (3 metrics)
    ├── Captain IDs Step
    │   ├── Previous Step Summary
    │   ├── FunnelDataGrid (preview)
    │   ├── Username Input
    │   ├── Summary Cards (3 metrics)
    │   ├── FunnelDataGrid (captain IDs)
    │   └── Action Buttons
    ├── AO Funnel Step
    │   ├── Previous Step Summary
    │   ├── Parameters Form (4 inputs)
    │   ├── Summary Cards (3 metrics)
    │   └── Action Buttons
    └── Complete Step
        ├── Success Banner
        ├── Summary Cards (3 metrics)
        ├── Metrics List
        ├── FunnelDataGrid (full data)
        ├── Use for Analysis Button
        └── Reset Button

FunnelDataGrid (Reusable Table)
├── Header with Export Buttons
├── AG Grid
│   ├── Sortable Columns
│   ├── Filterable Data
│   ├── Pagination
│   ├── Sidebar (Columns & Filters)
│   └── Selection
└── Export Functions
    ├── CSV Export
    └── Excel Export
```

## 🎯 Visual Consistency Checklist

### ✅ Matching Cohort Analyzer
- [x] Same card layout (glass-card, card-header, etc.)
- [x] Same typography (font sizes, weights, colors)
- [x] Same spacing (padding, margins, gaps)
- [x] Same borders (colors, radius, widths)
- [x] Same shadows (elevations)
- [x] Same colors (slate for text, purple-blue gradients)
- [x] Same button styles (primary, secondary, success)
- [x] Same input styles (borders, focus rings)
- [x] Same AG Grid configuration
- [x] Same export functionality
- [x] Same pagination settings
- [x] Same filtering approach
- [x] Same column formatting

### ✅ Enhanced Features
- [x] Smart summary cards at each step
- [x] Cohort distribution visualization
- [x] Match rate calculation
- [x] Export buttons per table
- [x] Progress indicator
- [x] Smooth animations
- [x] Error handling
- [x] Loading states
- [x] Independent step processing

## 📈 Metrics Display

### Summary Card Format
```
┌─────────────────────────┐
│ Label (small, gray)     │
│ 1,234,567 (large, bold) │
│ Subtitle (small)        │
└─────────────────────────┘
```

### Colors by Step
- **Upload**: Blue theme
- **Captain IDs**: Green theme (success)
- **AO Funnel**: Purple theme
- **Complete**: Purple-blue gradient

### Number Formatting
All numbers use `toLocaleString()`:
- 1234567 → 1,234,567
- 45.678 → 45.68 (2 decimals max)
- Percentages → XX.XX%

## 🚀 Export Capabilities

### CSV Export
- Exports visible columns
- Preserves sort order
- Includes all filtered rows
- Standard comma separator
- Automatic file naming

### Excel Export
- Multiple sheets supported
- Preserves formatting
- Includes metadata
- Cell types preserved
- Automatic file naming

### Export Button Locations
1. Upload preview table - TOP RIGHT
2. Captain IDs table - TOP RIGHT  
3. AO Funnel final table - TOP RIGHT

## 💡 Usage Example

```typescript
// In FunnelAnalysis component
<FunnelDataGrid
  data={funnelData.preview}
  title="AO Funnel Metrics"
  description="Interactive, sortable, and exportable data grid"
  fileName="ao_funnel_data"
/>

// AG Grid handles:
// - Sorting (click headers)
// - Filtering (sidebar)
// - Pagination (bottom controls)
// - Export (CSV/Excel buttons)
// - Column visibility (sidebar)
// - Resizing (drag column edges)
```

## 🎨 Color Palette

### Primary Colors
```css
purple-50: #faf5ff
purple-100: #f3e8ff
purple-600: #9333ea
purple-700: #7e22ce
purple-900: #581c87

blue-50: #eff6ff
blue-100: #dbeafe
blue-600: #2563eb
blue-700: #1d4ed8
blue-900: #1e3a8a
```

### Status Colors
```css
green-50: #f0fdf4
green-600: #16a34a
green-900: #14532d

amber-600: #d97706

red-50: #fef2f2
red-600: #dc2626
red-700: #b91c1c
```

### Neutral Colors
```css
slate-50: #f8fafc
slate-100: #f1f5f9
slate-200: #e2e8f0
slate-300: #cbd5e1
slate-600: #475569
slate-700: #334155
slate-800: #1e293b
```

## 🔧 Technical Details

### Dependencies
- **ag-grid-react**: Professional data grid
- **ag-grid-community**: Core AG Grid functionality
- **framer-motion**: Smooth animations
- **React**: Component framework

### AG Grid Configuration
```typescript
{
  animateRows: true,
  suppressRowClickSelection: false,
  rowSelection: 'multiple',
  pagination: true,
  paginationPageSize: 50,
  paginationPageSizeSelector: [10, 20, 50, 100],
  sideBar: {
    toolPanels: ['columns', 'filters'],
    position: 'left'
  }
}
```

### Performance
- AG Grid virtual scrolling (renders only visible rows)
- Memoized column definitions
- Optimized re-renders with useCallback
- Efficient state management

## ✅ Testing Checklist

- [x] Upload CSV with mobile numbers
- [x] View upload summary (rows, unique numbers)
- [x] See cohort distribution (if available)
- [x] Export upload preview (CSV/Excel)
- [x] Enter Presto username
- [x] Get captain IDs
- [x] View captain ID summary (match rate)
- [x] Export captain IDs (CSV/Excel)
- [x] Configure funnel parameters
- [x] Get AO funnel data
- [x] View funnel summary (data points, metrics)
- [x] Sort columns (click headers)
- [x] Filter data (sidebar)
- [x] Toggle columns (sidebar)
- [x] Resize columns (drag edges)
- [x] Paginate through data
- [x] Export final data (CSV/Excel)
- [x] Use for cohort analysis
- [x] Start new analysis

## 📝 Summary

The Funnel Analysis wizard now:
- ✅ **Matches Cohort Analyzer theme exactly**
- ✅ **Uses same AG Grid library**
- ✅ **Shows proper summary metrics at each step**
- ✅ **Provides CSV/Excel export**
- ✅ **Maintains independent step processing**
- ✅ **Supports future extensibility**
- ✅ **Delivers professional UX**

---

**Result**: A unified, professional interface that seamlessly integrates with the existing Cohort Analyzer! 🎉

