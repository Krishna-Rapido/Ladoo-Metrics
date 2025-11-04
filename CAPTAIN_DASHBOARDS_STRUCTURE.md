# Captain Dashboards - File Structure Navigation

## 📁 Overview
A new hierarchical navigation system for specialized captain analytics, organized like a file system for intuitive access.

## 🗂️ Navigation Structure

```
Captain Dashboards
└── Quality
    └── DAPR Distribution
    
Future Structure:
Captain Dashboards
├── Quality
│   ├── DAPR Distribution ✓
│   ├── Ratings Analysis (planned)
│   └── Cancellation Patterns (planned)
├── Performance (planned)
│   ├── Segment Analysis
│   └── Productivity Metrics
└── Retention (planned)
    ├── Cohort Analysis
    └── Churn Prediction
```

## ✨ Current Implementation

### Level 1: Captain Dashboards (Main Container)
**Component**: `CaptainDashboards.tsx`

**Purpose**: Top-level navigation for all captain-related analytics

**Sections Available**:
- **Quality** ⭐ - Quality metrics and analysis (Active)
- Performance 🚀 - Performance analytics (Future)
- Retention 🔄 - Retention analysis (Future)

**Design**:
- Grid layout with large clickable cards
- Icon + title + description for each section
- Active section highlighted with purple border
- Smooth animations on selection

### Level 2: Quality Section
**Location**: Within Captain Dashboards

**Tabs**:
- **DAPR Distribution** 📊 (Active)
- Ratings Analysis ⭐ (Future)
- Cancellation Patterns ❌ (Future)

**Design**:
- Horizontal tab navigation
- Active tab highlighted
- Content area below tabs
- Smooth transitions between tabs

### Level 3: DAPR Distribution
**Component**: `DaprBucketAnalysis.tsx`

**Purpose**: Analyze daily acceptance rate distribution across buckets

**Features**:
- ✅ Parameter configuration form
- ✅ Date range filters (Start/End Date)
- ✅ City selection
- ✅ Service category selection
- ✅ DAPR threshold configuration
- ✅ Interactive AG Grid results table
- ✅ Export to CSV/Excel
- ✅ Sort, filter, paginate results

## 🎨 UI/UX Design

### Captain Dashboards Card Layout

```
┌─────────────────────────────────────────────────┐
│ 👨‍✈️ Captain Dashboards                           │
│ Specialized analytics for captain management    │
├─────────────────────────────────────────────────┤
│                                                 │
│ ┌─────────┐  ┌─────────┐  ┌─────────┐         │
│ │⭐ Quality│  │🚀 Perf  │  │🔄 Retain│         │
│ │ Quality │  │ metrics │  │ analysis│         │
│ │ metrics │  │         │  │         │         │
│ └─────────┘  └─────────┘  └─────────┘         │
└─────────────────────────────────────────────────┘
```

### Quality Section with Tabs

```
┌─────────────────────────────────────────────────┐
│ [📊 DAPR Distribution] [⭐ Ratings] [❌ Cancel] │
├─────────────────────────────────────────────────┤
│                                                 │
│  ⚙️ Analysis Parameters                        │
│  ┌─────────┬─────────┬─────────┐              │
│  │Start    │End      │City     │              │
│  │20250801 │20251031 │delhi    │              │
│  └─────────┴─────────┴─────────┘              │
│                                                 │
│  [▶ Run DAPR Bucket Analysis]                  │
│                                                 │
│  📊 Analysis Results                           │
│  [Interactive AG Grid Table]                   │
│                                                 │
└─────────────────────────────────────────────────┘
```

## 📊 DAPR Bucket Analysis

### Parameters

| Parameter | Default | Type | Description |
|-----------|---------|------|-------------|
| **Start Date** | 20250801 | string | Start date in YYYYMMDD format |
| **End Date** | 20251031 | string | End date in YYYYMMDD format |
| City | delhi | string | City name (lowercase) |
| Service Category | bike_taxi | string | Service category type |
| Low DAPR | 0.6 | number | Low DAPR threshold |
| High DAPR | 0.8 | number | High DAPR threshold |
| Presto Username | krishna.poddar@rapido.bike | string | Presto connection username |

### Date Filters
Now includes **Start Date** and **End Date** inputs:
- YYYYMMDD format (e.g., 20250801)
- Flexible date range selection
- Used in Presto query for filtering

### Results

Shows daily distribution across DAPR buckets:
- **BAD**: DAPR ≤ low_dapr
- **AVG**: low_dapr < DAPR < high_dapr  
- **GOOD**: DAPR ≥ high_dapr
- **less_than_20_pings**: Insufficient data

Includes metrics:
- Active captains per bucket
- Total pings, dropped rides, cancelled rides
- Percentage distributions
- Average DAPR per bucket

## 🗺️ Navigation Flow

### User Journey

```
1. User opens app
   ↓
2. Sees "Captain Dashboards" card at top
   ↓
3. Clicks "Quality" section card
   ↓
4. Sees Quality tabs appear
   ↓
5. "DAPR Distribution" tab is active
   ↓
6. Sees parameter form with date filters
   ↓
7. Configures start/end dates, city, thresholds
   ↓
8. Clicks "Run DAPR Bucket Analysis"
   ↓
9. Results appear in interactive table
   ↓
10. Sorts, filters, exports data as needed
```

## 📦 Component Hierarchy

```typescript
App.tsx
└── CaptainDashboards.tsx
    ├── Section Cards (Quality, Performance, Retention)
    └── Quality Section
        ├── Tab Navigation (DAPR, Ratings, Cancellations)
        └── DAPR Tab Content
            └── DaprBucketAnalysis.tsx
                ├── Parameters Form
                │   ├── Date Range (Start/End)
                │   ├── City
                │   ├── Service Category
                │   ├── DAPR Thresholds
                │   └── Username
                ├── Run Button
                └── Results Display
                    └── FunnelDataGrid (AG Grid)
```

## 🎨 Design System

### Section Cards (Level 1)
```css
Default: border-slate-200 bg-white
Hover: border-purple-300 shadow-md
Active: border-purple-500 bg-purple-50 shadow-lg
```

### Tabs (Level 2)
```css
Default: text-slate-600
Hover: bg-slate-50
Active: bg-purple-100 text-purple-700 border-b-2 border-purple-500
```

### Content Cards (Level 3)
```css
.glass-card with .card-header
Same styling as Cohort Analyzer
```

## 🚀 File Organization

```
frontend/src/components/
├── CaptainDashboards.tsx (NEW)
│   └── Main navigation container
│       - Section selection
│       - Tab management
│       - Content rendering
│
├── DaprBucketAnalysis.tsx (NEW)
│   └── DAPR analysis tool
│       - Parameter form with dates
│       - Run analysis
│       - Results display
│
└── FunnelAnalysis.tsx (UPDATED)
    └── DAPR moved out, cleaner focus
```

## 🔧 Adding New Sections

### Add New Section (Level 1)

```typescript
// In CaptainDashboards.tsx
const sections = [
    { id: 'quality', label: 'Quality', icon: '⭐' },
    { id: 'performance', label: 'Performance', icon: '🚀' }, // NEW
];

// Add section content
{activeSection === 'performance' && (
    <PerformanceSection />
)}
```

### Add New Tab (Level 2)

```typescript
// In Quality section
const qualityTabs = [
    { id: 'dapr', label: 'DAPR Distribution', icon: '📊' },
    { id: 'ratings', label: 'Ratings Analysis', icon: '⭐' }, // NEW
];

// Add tab content
{activeQualityTab === 'ratings' && (
    <RatingsAnalysis />
)}
```

### Add New Analysis Tool (Level 3)

1. Create component: `MyAnalysis.tsx`
2. Add backend endpoint
3. Add API function
4. Add tab to appropriate section
5. Render component in tab content

## 💡 Benefits of This Structure

### ✅ Organized
- Clear hierarchy (Dashboards → Section → Tool)
- Logical grouping of related analytics
- Easy to find specific tools

### ✅ Scalable
- Easy to add new sections
- Easy to add new tabs
- Easy to add new analysis tools
- No cluttering of single component

### ✅ Maintainable
- Each tool in separate file
- Clear separation of concerns
- Modular architecture
- Independent components

### ✅ User-Friendly
- Familiar file-system metaphor
- Visual navigation with icons
- Clear active states
- Smooth transitions

### ✅ Professional
- Matches Cohort Analyzer theme
- Consistent styling throughout
- Beautiful animations
- Production-ready quality

## 📋 Current Features

### Captain Dashboards → Quality → DAPR

**Parameters with Date Filters**:
- ✅ Start Date (YYYYMMDD)
- ✅ End Date (YYYYMMDD)
- ✅ City
- ✅ Service Category
- ✅ Low DAPR Threshold
- ✅ High DAPR Threshold
- ✅ Presto Username

**Results**:
- ✅ Interactive AG Grid table
- ✅ Sortable columns
- ✅ Filterable data
- ✅ Pagination controls
- ✅ Export to CSV/Excel
- ✅ Professional formatting

## 🎯 Future Roadmap

### Quality Section
- [ ] Ratings Analysis
- [ ] Cancellation Patterns
- [ ] Service Quality Scores
- [ ] Customer Feedback Trends

### Performance Section
- [ ] Segment Analysis (UHP/HP/MP/LP/ZP)
- [ ] Consistency Trends (Daily/Weekly/Monthly)
- [ ] Productivity Metrics
- [ ] Utilization Rates

### Retention Section
- [ ] Cohort Retention
- [ ] Churn Prediction
- [ ] Reactivation Analysis
- [ ] Lifecycle Stages

## 📝 Usage Example

```typescript
// User navigates:
Captain Dashboards
→ Click "Quality" card
→ Tabs appear: [DAPR Distribution] [Ratings] [Cancellations]
→ DAPR tab active by default
→ Configure: Start Date, End Date, City, Thresholds
→ Click "Run DAPR Bucket Analysis"
→ Results shown in interactive table
→ Sort, filter, export as needed
```

## ✅ Summary

You now have:
- ✅ **Hierarchical navigation** (Dashboards → Quality → DAPR)
- ✅ **Date range filters** in DAPR analysis
- ✅ **Separated from Funnel Analysis** (cleaner organization)
- ✅ **File-system-like structure** (intuitive navigation)
- ✅ **Extensible framework** (easy to add sections/tabs)
- ✅ **Professional UI** (matches Cohort Analyzer)
- ✅ **Interactive tables** (AG Grid with full features)

---

**Captain Dashboards is now a professional, scalable analytics hub!** 👨‍✈️📊

