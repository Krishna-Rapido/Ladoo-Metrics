# Captain Dashboards - Data Visualization

## 📈 Overview
All Captain Dashboard analyses now include a powerful chart builder that lets users create custom visualizations with configurable X-axis, Y-axis, and series grouping.

## ✨ Features

### 1. **Chart Builder Component**
A reusable visualization tool integrated into all dashboard analyses.

#### Chart Types Supported
- **📈 Line Chart** - Trends over time or categories
- **📊 Bar Chart** - Comparisons across categories
- **📉 Area Chart** - Volume trends with fill
- **🔵 Scatter Chart** - Correlation analysis

#### Configuration Options
1. **X-Axis**: Choose any column (categorical or numeric)
2. **Y-Axis**: Choose any numeric column
3. **Series (Group By)**: Optional - split data by a categorical column

### 2. **Smart Column Detection**

The chart builder automatically:
- ✅ Identifies numeric vs categorical columns
- ✅ Suggests appropriate Y-axis options (numeric only)
- ✅ Allows any column for X-axis
- ✅ Offers categorical columns for series grouping
- ✅ Filters out "Unnamed" columns

### 3. **Integration in All Analyses**

#### Available In:
- ✅ **Quality → DAPR Bucket Distribution**
- ✅ **Retention → FE2Net Funnel**
- ✅ All future dashboard analyses

#### Access Method:
```
Run Analysis → Results Appear → Click "📈 Visualize Data" button
```

### 4. **UI/UX Design**

#### Visualize Data Button
Located in Results card header (top-right):
```
┌─────────────────────────────────────────┐
│ 📊 Analysis Results  [📈 Visualize Data]│
│ 1,234 rows × 15 columns                 │
└─────────────────────────────────────────┘
```

**States**:
- Inactive: `.btn-secondary` - "📈 Visualize Data"
- Active: `.btn-primary` - "📊 Hide Chart"

#### Chart Configuration Panel

```
┌────────────────────────────────────────────┐
│ 📈 DAPR Bucket Visualization               │
├────────────────────────────────────────────┤
│ Choose a visualization                     │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐              │
│ │📈  │ │📊  │ │📉  │ │🔵  │              │
│ │Line│ │Bar │ │Area│ │Scat│              │
│ └────┘ └────┘ └────┘ └────┘              │
│                                            │
│ ┌─────────┬─────────┬──────────┐         │
│ │X-axis   │Y-axis   │Series    │         │
│ │[Select] │[Select] │[None]    │         │
│ └─────────┴─────────┴──────────┘         │
│                                            │
│ [Chart Rendering Area]                     │
│                                            │
│ X: yyyymmdd  Y: active_caps  Series: None │
│ 50 data points                             │
└────────────────────────────────────────────┘
```

### 5. **Chart Type Selector**

Visual card-style buttons:
- Large emoji icons (3xl)
- Label below
- Border highlights when selected
- Hover scale animation
- 4-column grid layout

### 6. **Axis Configuration**

#### X-Axis Dropdown
- Shows all columns
- Supports both numeric and categorical
- Formatted column names (Title Case, spaces)
- Icon indicator: 📝 Categorical or 🔢 Numeric

#### Y-Axis Dropdown  
- Shows only numeric columns
- Filtered automatically
- Used for values to plot
- Icon indicator: 🔢 Numeric

#### Series Dropdown
- Shows categorical columns only
- Optional (defaults to "None")
- Creates multiple lines/bars per category
- Shows count: "📊 3 series"

### 7. **Data Transformation**

#### Without Series (Single Series)
```javascript
Data: [
  { date: '20250801', value: 100 },
  { date: '20250802', value: 150 }
]
→ Chart: Single line/bar
```

#### With Series (Multiple Series)
```javascript
Data: [
  { date: '20250801', bucket: 'GOOD', value: 100 },
  { date: '20250801', bucket: 'BAD', value: 50 },
  { date: '20250802', bucket: 'GOOD', value: 120 },
  { date: '20250802', bucket: 'BAD', value: 40 }
]
→ Groups by: bucket
→ Chart: One line for 'GOOD', one for 'BAD'
```

### 8. **Color Scheme**

10 distinct colors for series:
```javascript
[
  '#8b5cf6', // Purple
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#ec4899', // Pink
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#84cc16', // Lime
]
```

Cycles through colors if more than 10 series.

### 9. **Chart Features**

#### Interactive Elements
- **Tooltip**: Hover to see exact values
- **Legend**: Click to toggle series visibility
- **Grid**: Dashed grid lines for readability
- **Responsive**: Adjusts to container width

#### Customization
- Angled X-axis labels (-45°) for readability
- Proper margins for labels
- Font size optimization
- White background tooltip with border

### 10. **Usage Examples**

#### Example 1: DAPR Trends Over Time
```
Chart Type: Line
X-axis: yyyymmdd
Y-axis: active_caps
Series: Dapr_bucket
Result: One line per bucket (GOOD, AVG, BAD) showing captain trends
```

#### Example 2: Service Category Comparison
```
Chart Type: Bar
X-axis: city
Y-axis: net_orders
Series: (None)
Result: Bar chart comparing cities
```

#### Example 3: Multi-Dimensional Analysis
```
Chart Type: Area
X-axis: Time Value
Y-axis: fe2net
Series: Geo Value
Result: Stacked areas showing funnel by geography
```

#### Example 4: Correlation Analysis
```
Chart Type: Scatter
X-axis: gross_pings
Y-axis: accepted_orders
Series: (None)
Result: Scatter plot showing correlation
```

## 📊 Technical Implementation

### Dependencies
```json
{
  "recharts": "^2.x.x"
}
```

### Component Structure
```typescript
ChartBuilder
├── Chart Type Selector (4 buttons)
├── Axis Configuration (3 dropdowns)
│   ├── X-axis (all columns)
│   ├── Y-axis (numeric only)
│   └── Series (categorical only)
└── Chart Display Area
    ├── Line Chart (Recharts)
    ├── Bar Chart (Recharts)
    ├── Area Chart (Recharts)
    └── Scatter Chart (Recharts)
```

### Data Processing
```typescript
1. Detect column types (numeric vs categorical)
2. User selects X, Y, Series
3. Group data by X-axis and Series
4. Aggregate Y values (sum)
5. Transform to Recharts format
6. Render appropriate chart type
```

### Integration Pattern
```typescript
// In any analysis component
import { ChartBuilder } from './ChartBuilder';

const [showChart, setShowChart] = useState(false);

// Toggle button in card header
<button onClick={() => setShowChart(!showChart)}>
  Visualize Data
</button>

// Render chart builder
{showChart && (
  <ChartBuilder data={analysisData} title="My Visualization" />
)}
```

## 🎨 Visual Design

### Chart Card
```css
.glass-card styling
Purple gradient accents
Smooth animations
Responsive container
```

### Selection Buttons
```css
Chart Type Cards:
- Default: border-slate-200 bg-white
- Active: border-purple-500 bg-purple-50 shadow-md
- Hover: scale-105
```

### Dropdowns
```css
Same as other inputs:
- border-slate-300
- focus:ring-2 focus:ring-purple-500
- rounded-lg
```

### Chart Display
```css
- White background
- Slate-200 border
- Rounded-lg
- Padding: p-6
- Height: 400px
```

## 🚀 Usage Workflow

### Step 1: Run Analysis
```
Captain Dashboards → Quality → DAPR
→ Configure parameters
→ Click "Run DAPR Bucket Analysis"
→ Results table appears
```

### Step 2: Open Chart Builder
```
Click "📈 Visualize Data" button
→ Chart builder appears below table
```

### Step 3: Configure Chart
```
1. Select chart type: Line / Bar / Area / Scatter
2. Select X-axis: yyyymmdd
3. Select Y-axis: active_caps
4. Select Series: Dapr_bucket (optional)
```

### Step 4: View Visualization
```
Chart updates in real-time
→ Hover for tooltips
→ Click legend to toggle series
→ Responsive to window size
```

### Step 5: Iterate
```
Change X/Y/Series → Chart updates instantly
Switch chart type → View same data differently
Hide when done → Click "Hide Chart"
```

## 📊 Available Analyses with Charts

### Quality → DAPR Bucket Distribution

**Common Visualizations**:
1. **Daily Trend**: X=yyyymmdd, Y=active_caps, Series=Dapr_bucket
2. **Bucket Comparison**: X=Dapr_bucket, Y=total_pings, Series=None
3. **Percentage Analysis**: X=yyyymmdd, Y=per_caps, Series=Dapr_bucket

### Retention → FE2Net Funnel

**Common Visualizations**:
1. **Funnel Over Time**: X=Time Value, Y=net_orders, Series=Geo Value
2. **Conversion Rates**: X=Time Value, Y=fe2net, Series=None
3. **Geographic Comparison**: X=Geo Value, Y=online_captains, Series=None
4. **Multi-Metric Trend**: X=Time Value, Y=rph, Series=Service

## 🎯 Key Features

### Automatic Type Detection
- ✅ Numeric columns → Available for Y-axis
- ✅ Categorical columns → Available for Series
- ✅ All columns → Available for X-axis
- ✅ Smart filtering and validation

### Real-Time Updates
- ✅ Chart updates immediately on selection
- ✅ No "Apply" button needed
- ✅ Smooth transitions
- ✅ Responsive rendering

### Professional Styling
- ✅ Matches Cohort Analyzer theme
- ✅ Purple gradient accents
- ✅ Smooth animations
- ✅ Clean, modern design

### Data Handling
- ✅ Aggregates when series selected
- ✅ Handles missing values
- ✅ Formats numbers properly
- ✅ Optimized for performance

## 💡 Tips for Best Visualizations

### Line Charts
- Best for: Time series trends
- X-axis: Date/time fields
- Y-axis: Metrics that change over time
- Series: Categories to compare

### Bar Charts
- Best for: Category comparisons
- X-axis: Categorical fields
- Y-axis: Counts or totals
- Series: Sub-categories

### Area Charts
- Best for: Volume trends
- X-axis: Time fields
- Y-axis: Cumulative metrics
- Series: Components of total

### Scatter Charts
- Best for: Correlations
- X-axis: Independent variable
- Y-axis: Dependent variable
- Series: Usually none (or small categories)

## 🔧 Advanced Features

### Grouping Logic
When series is selected:
```javascript
1. Group data by [X-axis, Series]
2. Aggregate Y-axis values (sum)
3. Pivot: X-axis becomes chart X, Series values become multiple lines/bars
4. Result: Multi-series visualization
```

### Color Assignment
```javascript
seriesValues.map((value, idx) => 
  COLORS[idx % COLORS.length]
)
```

### Legend Interaction
- Click series name to hide/show
- Double-click to isolate single series
- Built-in Recharts functionality

## ✅ Complete Feature Set

**Chart Builder Includes**:
- ✅ 4 chart types (Line, Bar, Area, Scatter)
- ✅ X-axis selector (all columns)
- ✅ Y-axis selector (numeric columns)
- ✅ Series selector (categorical columns)
- ✅ Automatic data transformation
- ✅ Multi-series support (unlimited)
- ✅ Interactive tooltips
- ✅ Clickable legends
- ✅ Responsive design
- ✅ Professional styling
- ✅ Smooth animations
- ✅ Real-time updates

**Integrated Into**:
- ✅ DAPR Bucket Analysis
- ✅ FE2Net Funnel Analysis
- ✅ All future dashboard analyses

## 🎯 Result

Every Captain Dashboard analysis now provides:
1. **Data Table** (sortable, filterable, exportable)
2. **Visualization** (configurable, interactive charts)
3. **Toggle Button** (show/hide chart builder)
4. **Professional UI** (matches Cohort Analyzer)

---

**Users can now explore data both tabularly AND visually in Captain Dashboards!** 📊📈✨

