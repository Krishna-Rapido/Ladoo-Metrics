# Multi-Metric Visualization & CSV Export

## 📊 Enhanced Features

The Chart Builder has been enhanced with powerful multi-metric visualization and full dataset export capabilities.

## ✨ New Features

### 1. **Multiple Y-Axis Metrics**
Plot multiple metrics on the same chart for easy comparison.

#### How It Works
- **Before**: Single Y-axis dropdown (one metric at a time)
- **After**: Multi-select checkbox list (unlimited metrics)

#### UI Design
```
┌─────────────────────────────┐
│ Y-axis Metrics              │
├─────────────────────────────┤
│ ☑ active_caps               │
│ ☑ dropped                   │
│ ☑ total_pings               │
│ ☐ cancelled                 │
│ ☐ per_caps                  │
│ ☐ avg_dapr                  │
├─────────────────────────────┤
│ 📊 3 metrics selected       │
└─────────────────────────────┘
```

**Features**:
- Scrollable checkbox list (max-height: 192px)
- Hover highlight on rows
- Check/uncheck any combination
- Live count of selected metrics
- All numeric columns available

### 2. **Full Dataset CSV Export**
Export complete analysis results directly from the chart builder.

#### Export Button
Located in card header (top-right):
```
┌────────────────────────────────────────────┐
│ 📈 Visualization  [📥 Export Full Data...] │
└────────────────────────────────────────────┘
```

**Features**:
- ✅ Exports ALL rows (not just preview)
- ✅ Exports ALL columns
- ✅ Proper CSV escaping (commas, quotes)
- ✅ Automatic filename from title
- ✅ Direct browser download
- ✅ No backend call needed

#### Filename Format
```
{title}_data.csv

Examples:
- dapr_bucket_visualization_data.csv
- fe2net_funnel_visualization_data.csv
```

### 3. **Multi-Line Chart Combinations**

#### Without Series (Simple Multi-Metric)
```javascript
X-axis: yyyymmdd
Y-axes: [active_caps, dropped, total_pings]
Series: None

Result: 3 lines on same chart
- Line 1: active_caps (purple)
- Line 2: dropped (blue)
- Line 3: total_pings (green)
```

#### With Series (Metric × Series Matrix)
```javascript
X-axis: yyyymmdd
Y-axes: [active_caps, dropped]
Series: Dapr_bucket (GOOD, AVG, BAD)

Result: 6 lines (2 metrics × 3 buckets)
- Line 1: active_caps_GOOD (purple)
- Line 2: active_caps_AVG (blue)
- Line 3: active_caps_BAD (green)
- Line 4: dropped_GOOD (amber)
- Line 5: dropped_AVG (red)
- Line 6: dropped_BAD (pink)
```

### 4. **Data Transformation Logic**

#### Multi-Metric Without Series
```javascript
// Input data
[
  { date: '20250801', metric1: 100, metric2: 50 },
  { date: '20250802', metric1: 150, metric2: 60 }
]

// Transformed for chart
[
  { date: '20250801', metric1: 100, metric2: 50 },
  { date: '20250802', metric1: 150, metric2: 60 }
]

// Renders as 2 separate lines
```

#### Multi-Metric With Series
```javascript
// Input data
[
  { date: '20250801', bucket: 'GOOD', metric1: 100, metric2: 50 },
  { date: '20250801', bucket: 'BAD', metric1: 80, metric2: 40 },
]

// Transformed for chart
[
  { 
    date: '20250801',
    metric1_GOOD: 100,
    metric1_BAD: 80,
    metric2_GOOD: 50,
    metric2_BAD: 40
  }
]

// Renders as 4 separate lines
```

### 5. **Color Assignment**

**10 Distinct Colors** cycle through lines:
```
Line 1: Purple (#8b5cf6)
Line 2: Blue (#3b82f6)
Line 3: Green (#10b981)
Line 4: Amber (#f59e0b)
Line 5: Red (#ef4444)
Line 6: Pink (#ec4899)
Line 7: Indigo (#6366f1)
Line 8: Teal (#14b8a6)
Line 9: Orange (#f97316)
Line 10: Lime (#84cc16)
Line 11+: Cycles back to purple
```

### 6. **Use Cases**

#### Compare Multiple Metrics Over Time
```
Chart Type: Line
X-axis: yyyymmdd
Y-axes: [active_caps, net_orders, gross_orders]
Series: None

Use: See trends of multiple metrics together
```

#### Multi-Dimensional Analysis
```
Chart Type: Area
X-axis: Time Value
Y-axes: [online_captains, net_captains]
Series: Geo Value

Use: Compare online vs net captains across zones
```

#### Performance Comparison
```
Chart Type: Bar
X-axis: city
Y-axes: [fe2net, fe2rr, gsr2net]
Series: None

Use: Compare conversion rates across cities
```

#### Bucket Analysis
```
Chart Type: Line
X-axis: yyyymmdd
Y-axes: [active_caps, total_pings, cancelled]
Series: Dapr_bucket

Use: Track multiple metrics per DAPR bucket
```

## 🔧 Technical Implementation

### Multi-Select Checkbox List

```typescript
<div className="border rounded-lg p-2 max-h-48 overflow-y-auto">
  {numericColumns.map(col => (
    <label className="flex items-center hover:bg-slate-50 rounded cursor-pointer">
      <input
        type="checkbox"
        checked={yAxes.includes(col)}
        onChange={handleToggle}
      />
      <span>{col}</span>
    </label>
  ))}
</div>
```

### CSV Export Logic

```typescript
const handleExportCsv = () => {
  // 1. Extract headers
  const headers = Object.keys(data[0]);
  
  // 2. Convert rows to CSV
  const rows = data.map(row => 
    headers.map(h => escapeValue(row[h])).join(',')
  );
  
  // 3. Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const link = document.createElement('a');
  link.download = `${title}_data.csv`;
  link.click();
};
```

**CSV Escaping**:
- Values with commas → Wrapped in quotes
- Values with quotes → Escaped as ""
- Null/undefined → Empty string

### Line Key Generation

```typescript
// Without series
lineKeys = ['metric1', 'metric2', 'metric3']

// With series
lineKeys = [
  'metric1_GOOD', 'metric1_AVG', 'metric1_BAD',
  'metric2_GOOD', 'metric2_AVG', 'metric2_BAD'
]
```

### Dynamic Rendering

```typescript
renderDataLines = () => {
  return lineKeys.map((key, idx) => (
    <Line
      dataKey={key}
      name={formatName(key)}
      stroke={COLORS[idx % COLORS.length]}
    />
  ));
};
```

## 📊 Visual Examples

### Example 1: DAPR Multi-Metric Trend

**Configuration**:
```
Chart: Line
X: yyyymmdd
Y: [active_caps, dropped, cancelled]
Series: None
```

**Result**:
- 3 lines showing daily trends
- Purple line: Active captains
- Blue line: Dropped rides
- Green line: Cancelled rides
- All on same time axis for easy comparison

### Example 2: Bucket Comparison Across Metrics

**Configuration**:
```
Chart: Bar
X: Dapr_bucket
Y: [active_caps, total_pings]
Series: None
```

**Result**:
- Grouped bars per bucket
- Purple bars: Active captains
- Blue bars: Total pings
- Easy comparison across buckets

### Example 3: Geographic Multi-Metric Analysis

**Configuration**:
```
Chart: Line
X: Time Value
Y: [fe2net, fe2rr, gsr2net]
Series: Geo Value
```

**Result**:
- 3 metrics × N zones = 3N lines
- Each metric shown for each zone
- Different colors per metric-zone combination

## 🎯 Benefits

### Multiple Metrics on Same Chart
✅ **Compare Related Metrics**: See trends together
✅ **Correlation Analysis**: Identify relationships
✅ **Comprehensive View**: All metrics at once
✅ **Flexible Selection**: Choose any combination
✅ **No Chart Limit**: Plot as many metrics as needed

### Full Dataset Export
✅ **Complete Data**: All rows, all columns
✅ **Quick Access**: One-click export
✅ **Proper Formatting**: CSV-compliant
✅ **No Backend Call**: Instant download
✅ **Named Files**: Descriptive filenames

## 📋 Updated Workflow

```
1. Run analysis (DAPR or FE2Net)
   ↓
2. Results table appears
   ↓
3. Click "Visualize Data"
   ↓
4. Chart builder opens
   ↓
5. Select chart type (Line/Bar/Area/Scatter)
   ↓
6. Select X-axis (e.g., yyyymmdd)
   ↓
7. Select MULTIPLE Y-axes (check all desired metrics)
   ↓
8. Optional: Select Series for grouping
   ↓
9. Chart renders with all metrics
   ↓
10. Hover for tooltips, click legend
    ↓
11. Click "Export Full Data (CSV)" to download
```

## 💡 Best Practices

### Selecting Metrics
- **Related metrics**: Choose metrics that share similar scales
- **Different units**: Can still plot but may need separate charts
- **3-5 metrics**: Optimal for readability
- **10+ metrics**: Still works but legend gets crowded

### Chart Types
- **Line**: Best for time series with multiple metrics
- **Bar**: Good for 2-3 metrics comparison
- **Area**: Use when showing composition/volume
- **Scatter**: Usually stick to 1-2 metrics

### Series Grouping
- **Without series**: Simple multi-metric view
- **With series**: Powerful but can create many lines
- **Calculation**: N metrics × M series = N×M lines

## 🚀 Examples

### DAPR Analysis: Track Multiple KPIs

```
X: yyyymmdd
Y: [active_caps, total_pings, cancelled, per_caps]
Series: Dapr_bucket

Creates: 4 metrics × 3 buckets = 12 lines
Shows: Comprehensive bucket performance over time
```

### FE2Net: Conversion Funnel Stages

```
X: Time Value
Y: [fe_sessions, gross_orders, net_orders]
Series: None

Creates: 3 lines showing funnel progression
Shows: Where drop-offs occur in funnel
```

### Geographic Performance Comparison

```
X: city
Y: [online_captains, net_captains, login_hours]
Series: None

Creates: 3 bars per city
Shows: Multi-dimensional city comparison
```

## ✅ Complete Feature Set

**Chart Builder Now Includes**:
- ✅ 4 chart types (Line, Bar, Area, Scatter)
- ✅ X-axis selector (all columns)
- ✅ **Multi-select Y-axes** (multiple metrics)
- ✅ Series selector (optional grouping)
- ✅ **CSV export** (full dataset)
- ✅ Automatic aggregation
- ✅ Dynamic color assignment
- ✅ Interactive tooltips
- ✅ Clickable legends
- ✅ Responsive design
- ✅ Real-time updates

**Available In**:
- ✅ Quality → DAPR Bucket Distribution
- ✅ Retention → FE2Net Funnel
- ✅ All future Captain Dashboard analyses

## 📥 Export Capabilities

### Chart Builder Export
- **What**: Full dataset used for visualization
- **Format**: CSV with all rows and columns
- **Location**: Chart builder card header
- **Button**: "📥 Export Full Data (CSV)"

### AG Grid Export
- **What**: Current table view with filters applied
- **Format**: CSV or Excel
- **Location**: AG Grid built-in controls
- **Button**: Sidebar export menu

**Both exports available** - choose based on need!

## 🎯 Result

Users can now:
- ✅ **Plot unlimited metrics** on same X-axis
- ✅ **Compare trends** side-by-side
- ✅ **Group by series** for deeper insights
- ✅ **Export full data** with one click
- ✅ **Professional visualizations** with Recharts
- ✅ **Interactive exploration** with tooltips/legend

---

**Captain Dashboards now support enterprise-grade multi-metric analysis!** 📊📈✨

