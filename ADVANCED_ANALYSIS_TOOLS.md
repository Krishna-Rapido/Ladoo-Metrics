# Advanced Analysis Tools

## 🔬 Overview
A new extensible framework for running specialized analysis functions on Presto data directly from the Funnel Analysis interface.

## ✨ Features

### 1. **DAPR Bucket Distribution**
First advanced analysis tool added to demonstrate the pattern.

#### What It Does
Analyzes Daily Acceptance Rate (DAPR) distribution across different buckets:
- **BAD**: DAPR ≤ low_dapr threshold
- **AVG**: low_dapr < DAPR < high_dapr
- **GOOD**: DAPR ≥ high_dapr threshold
- **less_than_20_pings**: Captains with < 20 accepted pings

#### Parameters
| Parameter | Default | Description |
|-----------|---------|-------------|
| Username | krishna.poddar@rapido.bike | Presto username |
| Start Date | 20250801 | Start date (YYYYMMDD) |
| End Date | 20251031 | End date (YYYYMMDD) |
| City | delhi | City name (lowercase) |
| Service Category | bike_taxi | Service category |
| Low DAPR | 0.6 | Low DAPR threshold |
| High DAPR | 0.8 | High DAPR threshold |

#### Returns
Daily distribution showing:
- Active captains per bucket
- Total pings per bucket
- Dropped rides per bucket
- Cancelled rides per bucket
- Percentages and average DAPR

### 2. **UI/UX Design**

#### Button Location
**Top of Funnel Analysis** (above progress steps):
```
┌─────────────────────────────────────────┐
│ 🔬 Advanced Analysis Tools              │
│ Run specialized analysis functions      │
│                  [📊 DAPR Bucket...]    │
└─────────────────────────────────────────┘
```

#### Modal Interface
**Full-Screen Modal** with:
- Glassmorphic backdrop (black/50 with blur)
- White card with rounded corners
- Animated entrance (scale + fade)
- Click outside to close
- Close button (✕) in header

#### Parameter Form
Grid layout (3 columns) with:
- City input
- Service category input
- Presto username input
- Low DAPR input (number)
- High DAPR input (number)
- Run Analysis button

#### Results Display
Interactive AG Grid table with:
- Sortable columns
- Filterable data
- Pagination
- Column visibility toggle
- Export to CSV/Excel

### 3. **Technical Implementation**

#### Backend (`backend/funnel.py`)
```python
def dapr_bucket(
    username: str,
    start_date: str,
    end_date: str,
    city: str,
    service_category: str,
    low_dapr: float,
    high_dapr: float
) -> pd.DataFrame:
    """Fetch DAPR bucket distribution from Presto"""
```

#### API Endpoint (`backend/main.py`)
```python
@app.post("/funnel-analysis/dapr-bucket")
async def get_dapr_bucket(payload: DaprBucketRequest):
    """Run DAPR bucket analysis"""
```

#### Frontend API (`frontend/src/lib/api.ts`)
```typescript
export async function getDaprBucket(
    req: DaprBucketRequest
): Promise<DaprBucketResponse>
```

#### UI Component (`frontend/src/components/FunnelAnalysis.tsx`)
- Button in Advanced Analysis Tools section
- Modal with parameter form
- Interactive results table
- Loading states and error handling

### 4. **Workflow**

```
1. Click "DAPR Bucket Distribution" button
   ↓
2. Modal opens with parameter form
   ↓
3. Configure parameters (city, thresholds, etc.)
   ↓
4. Click "Run Analysis"
   ↓
5. Backend executes Presto query
   ↓
6. Results shown in interactive AG Grid table
   ↓
7. Sort, filter, export data as needed
```

### 5. **Adding New Analysis Tools**

This pattern makes it easy to add more functions:

#### Step 1: Add Function to `funnel.py`
```python
def my_new_analysis(username: str, param1: str, param2: int) -> pd.DataFrame:
    """Your analysis logic"""
    presto_connection = get_presto_connection(username)
    query = f"""
        SELECT ...
        FROM ...
        WHERE ...
    """
    return pd.read_sql_query(query, presto_connection)
```

#### Step 2: Add Schemas to `schemas.py`
```python
class MyAnalysisRequest(BaseModel):
    username: str
    param1: str = "default"
    param2: int = 100

class MyAnalysisResponse(BaseModel):
    num_rows: int
    columns: List[str]
    data: List[Dict[str, Any]]
```

#### Step 3: Add Endpoint to `main.py`
```python
@app.post("/funnel-analysis/my-analysis")
async def get_my_analysis(payload: MyAnalysisRequest):
    from funnel import my_new_analysis
    result_df = my_new_analysis(payload.username, payload.param1, payload.param2)
    return MyAnalysisResponse(
        num_rows=len(result_df),
        columns=list(result_df.columns),
        data=result_df.to_dict('records')
    )
```

#### Step 4: Add Frontend API to `api.ts`
```typescript
export async function getMyAnalysis(req: MyAnalysisRequest) {
    const res = await fetch(`${BASE_URL}/funnel-analysis/my-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
    });
    return await res.json();
}
```

#### Step 5: Add Button & Modal to `FunnelAnalysis.tsx`
```typescript
// Add button to Advanced Analysis Tools section
<button onClick={() => setShowMyModal(true)}>
    My Analysis
</button>

// Add modal following same pattern as DAPR modal
```

### 6. **Design System**

#### Advanced Tools Section
```css
bg-gradient-to-r from-amber-50 to-orange-50
border-amber-200
text-amber-900
```

#### Modal
```css
Backdrop: bg-black/50 backdrop-blur-sm z-50
Card: bg-white rounded-2xl shadow-2xl max-w-6xl
Header: bg-gradient-to-r from-amber-50 to-orange-50
```

#### Buttons
- Open Modal: `.btn-secondary`
- Run Analysis: `.btn-primary`
- Close: Text button with hover

### 7. **Future Analysis Tools**

Ideas for additional tools to add:

1. **Captain Segmentation**
   - Consistency segments (daily/weekly/monthly/quarterly)
   - Performance segments (UHP/HP/MP/LP/ZP)

2. **Cohort Analysis**
   - Registration cohorts
   - Activity cohorts
   - Performance cohorts

3. **Retention Analysis**
   - N-day retention rates
   - Churn prediction
   - Reactivation rates

4. **Marketplace Metrics**
   - Supply-demand ratio
   - Utilization rates
   - Idle time analysis

5. **Custom Queries**
   - Free-form SQL input
   - Template-based queries
   - Saved query library

### 8. **Benefits**

✅ **Modular**: Each analysis is independent
✅ **Reusable**: Same pattern for all tools
✅ **Interactive**: Sortable, filterable tables
✅ **Exportable**: CSV/Excel export built-in
✅ **Flexible**: Easy to add new tools
✅ **User-Friendly**: Modal interface with clear parameters
✅ **Professional**: Matches Cohort Analyzer theme

### 9. **Usage Example**

```typescript
// User clicks "DAPR Bucket Distribution"
→ Modal opens

// User configures:
City: "delhi"
Service Category: "bike_taxi"
Low DAPR: 0.6
High DAPR: 0.8

// User clicks "Run Analysis"
→ Query executes on Presto
→ Results shown in AG Grid table

// User can:
→ Sort by any column
→ Filter data in sidebar
→ Export to CSV/Excel
→ Close modal when done
```

### 10. **Performance Considerations**

- Results are returned as full dataset (not preview)
- AG Grid handles large result sets efficiently
- Pagination limits DOM rendering
- Virtual scrolling for smooth performance
- Export downloads full results

## 🎯 Result

You now have:
- ✅ **DAPR Bucket Distribution** analysis tool
- ✅ **Extensible framework** for adding more tools
- ✅ **Professional UI** with modal interface
- ✅ **Interactive tables** with AG Grid
- ✅ **Export functionality** built-in
- ✅ **Easy to maintain** and extend

**Adding new analysis tools is now as simple as following the 5-step pattern!** 🚀

