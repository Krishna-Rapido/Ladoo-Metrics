# Captain-Level Aggregation Feature

## Overview
This feature allows you to analyze captain-level metrics grouped by categorical segments (e.g., `consistency_segment`) with visual representations through pie and bar charts.

## How It Works

### Backend Implementation

#### 1. New Endpoint: `/captain-level-aggregation` (POST)
Located in `backend/main.py`, this endpoint:
- Filters data by test and control cohorts
- Applies optional confirmation filters for each cohort separately
- Groups data by date and a user-selected categorical column
- Aggregates multiple metrics with various aggregation functions
- Returns data for both pre and post periods

#### 2. New Schemas (in `backend/schemas.py`)
- `MetricAggregation`: Defines a metric column and aggregation function
- `CaptainLevelRequest`: Request payload with cohorts, periods, grouping column, and metrics
- `CaptainLevelAggregationRow`: Individual data point with period, cohort type, date, group value, and aggregations
- `CaptainLevelResponse`: Response containing all aggregated data

### Frontend Implementation

#### 1. API Integration (`frontend/src/lib/api.ts`)
- Added TypeScript types matching backend schemas
- Added `fetchCaptainLevelAggregation()` function

#### 2. UI Controls (`frontend/src/components/Filters.tsx`)
New section for captain-level aggregation with:
- **Group By Column**: Select the categorical column to group by (e.g., `consistency_segment`)
- **Metrics to Aggregate**: Add multiple metrics with their aggregation functions
  - Available aggregations: Sum, Mean, Count, Unique Count, Median, Std Dev, Min, Max
- **Generate Button**: Triggers the analysis when all required fields are filled

#### 3. Visualization Component (`frontend/src/components/CaptainLevelCharts.tsx`)
Creates comprehensive visualizations:
- **Metric Selection Dropdown**: Choose which aggregated metric to visualize
- **Bar Chart**: Side-by-side comparison of all four combinations (Pre Test, Post Test, Pre Control, Post Control)
- **Pie Charts**: Four pie charts showing percentage distributions:
  - Test Cohort - Pre Period
  - Test Cohort - Post Period
  - Control Cohort - Pre Period
  - Control Cohort - Post Period

#### 4. App Integration (`frontend/src/App.tsx`)
- Added state management for captain-level data
- Connected the Filters component with the analysis handler
- Renders the charts when data is available

## Usage Example

### Step 1: Select Filters
1. Choose **Test Cohort** and **Control Cohort**
2. Set **Pre Period** and **Post Period** dates
3. (Optional) Set **Test Confirmation Filter** and **Control Confirmation Filter**

### Step 2: Configure Captain-Level Analysis
1. Select a **Group By Column** (e.g., `consistency_segment`)
2. Add metrics to aggregate:
   - Click metric dropdown, select a metric (e.g., `totalExpCaps`)
   - Choose aggregation function (e.g., `nunique`)
   - Click "Add Metric"
   - Repeat for additional metrics (e.g., `total_lh` with `mean`)
3. Click **"Generate Captain-Level Charts"**

### Step 3: View Results
The system will display:
- A comparison bar chart showing all metrics across all groups
- Pie charts showing distribution percentages for each period/cohort combination
- Interactive tooltips with exact values and percentages

## Example Code Reference

This implementation is based on your analysis code:

```python
def put_filter_captain_level(test_cohort, control_cohort, adoption_level):
    test_cohort_df = ao_cohort.loc[ao_cohort.cohort == test_cohort]
    control_cohort_df = ao_cohort.loc[ao_cohort.cohort == control_cohort]

    test_cohort_df = test_cohort_df.loc[~test_cohort_df[adoption_level].isna()]
    control_cohort_df = control_cohort_df.loc[~control_cohort_df[adoption_level].isna()]

    return test_cohort_df, control_cohort_df

test_cohort_df.groupby(['time', 'consistency_segment']).agg({
    'totalExpCaps': 'nunique',
    'total_lh': 'mean'
}).reset_index()
```

## Technical Details

### Backend Logic Flow
1. Validate that all required columns exist
2. Filter test cohort data with optional test confirmation filter
3. Filter control cohort data with optional control confirmation filter
4. Apply date range filters for pre and post periods
5. Group by date and the selected categorical column
6. Apply all specified aggregations
7. Return structured data for all combinations

### Frontend Chart Logic
- **Bar Chart**: Aggregates values across all dates within each period/cohort combination
- **Pie Charts**: Calculates percentages based on the sum of values for each group within a period/cohort
- **Interactive Tooltips**: Shows raw values and percentage breakdowns

## Error Handling
- Validates that test and control cohorts have data
- Checks that group by column exists
- Verifies all metric columns are present
- Displays clear error messages if validation fails

## Future Enhancements
- Add export functionality for chart data
- Support for additional chart types (stacked bars, line charts)
- Time series view for tracking changes over specific dates
- Statistical significance testing between distributions

