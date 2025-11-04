# Funnel Analysis to Cohort Analysis Integration

## Overview
The AO Funnel data can now be seamlessly transferred to the main cohort analysis workflow, eliminating the need for a separate CSV upload. This allows you to directly use the funnel metrics for plotting, statistical testing, and further analysis.

## How It Works

### Workflow
1. **Complete Funnel Analysis** (3 steps):
   - Upload mobile numbers CSV
   - Fetch captain IDs from Presto
   - Get AO funnel metrics

2. **Transfer to Cohort Analysis**:
   - Click "📊 Use for Cohort Analysis" button
   - Funnel data is automatically transferred to the main session
   - All cohort analysis features become available

3. **Use Analysis Features**:
   - Date range filters
   - Cohort selection
   - Captain-level aggregation
   - Metrics plotting
   - Statistical testing

## Data Transformation

When you click "Use for Cohort Analysis", the system automatically:

### ✅ Date Column Formatting
- Converts `time` column (YYYYMMDD) to proper `date` format
- Ensures compatibility with date range filters
- Validates all dates are in correct format

### ✅ Cohort Column Handling
- Uses existing `cohort` column from mobile numbers CSV (if provided)
- Creates default `all_captains` cohort if none exists
- Ensures cohort values are properly formatted as strings

### ✅ Metric Identification
- Automatically identifies all metric columns
- Excludes identifier columns: `mobile_number`, `captain_id`, `city`, `time`, `date`
- Makes all metrics available for selection and plotting

## Available Features After Transfer

### 1. Cohort Data Grid
View aggregated cohort-level metrics:
- Total experimental captains
- Visited captains
- Explored and confirmed captains
- Conversion ratios

### 2. Date Range Filters
- **Pre-Period**: Select start and end dates for baseline
- **Post-Period**: Select start and end dates for test period
- Filter data for before/after comparisons

### 3. Cohort Selection
- **Test Cohort**: Select cohort for testing
- **Control Cohort**: Select cohort for comparison
- **Confirmation Filters**: Optional filters for confirmed captains

### 4. Metrics Selection
Choose from 20+ AO funnel metrics:
- `online_events` - Total online events
- `online_days` - Days captain was online
- `net_days` - Days with net rides
- `net_rides_taxi` - Taxi net rides
- `net_rides_c2c` - C2C net rides
- `net_rides_delivery` - Delivery net rides
- `accepted_days` - Days with accepted orders
- `accepted_orders` - Total accepted orders
- `gross_days` - Days with gross pings
- `ao_days` - App open days
- `total_lh` - Total logged hours
- `idle_lh` - Idle logged hours
- `gross_pings` - Total gross pings
- `accepted_pings` - Total accepted pings
- `dapr` - Daily acceptance rate
- And more...

### 5. Captain-Level Aggregation
- **Group By**: City, consistency_segment, performance_segment, etc.
- **Aggregations**: Sum, mean, count, nunique, median, std, min, max
- **Time Series**: View metrics over time by group

### 6. Time Series Plotting
- Line charts for metrics over time
- Compare test vs control cohorts
- Pre/post period visualization
- Multiple metrics on same chart

### 7. Statistical Testing
- **Parametric Tests**:
  - Independent T-Test
  - Welch's T-Test
  - Paired T-Test
  - ANOVA
- **Non-Parametric Tests**:
  - Mann-Whitney U Test
  - Wilcoxon Signed-Rank Test
  - Kruskal-Wallis H Test
- **Effect Size Calculations**:
  - Cohen's d
  - Hedges' g
  - Glass's delta
- **Power Analysis**:
  - Sample size calculations
  - Statistical power estimation

## Technical Implementation

### Backend Changes

#### New Endpoint
```
POST /funnel-analysis/use-for-analysis
```
- Transfers funnel data from `FUNNEL_SESSION_STORE` to `SESSION_STORE`
- Formats date and cohort columns
- Returns `UploadResponse` with session metadata

#### Data Validation
- Ensures date column exists and is properly formatted
- Creates cohort column if missing
- Validates metric columns
- Removes rows with invalid dates

### Frontend Changes

#### FunnelAnalysis Component
- Added `onDataReady` callback prop
- New "Use for Cohort Analysis" button in complete step
- Loading states and error handling
- Automatic session transfer on button click

#### App Component
- Receives callback from FunnelAnalysis
- Sets uploaded state with funnel data
- Enables all cohort analysis features
- Seamless transition to analysis workflow

#### API Integration
- New `useFunnelForAnalysis()` function
- Transfers funnel session to main session
- Updates localStorage with new session ID
- Returns upload response with metadata

## Example Use Case

### Scenario: Analyzing Captain Performance by City

1. **Upload Mobile Numbers**:
```csv
mobile_number,cohort
9876543210,delhi_test
9876543211,delhi_control
9876543212,delhi_test
```

2. **Get AO Funnel** (date range: 2025-08-01 to 2025-10-31):
   - Fetches 20+ metrics per captain per day
   - Includes: online_days, net_rides, accepted_orders, etc.

3. **Use for Analysis**:
   - Click "Use for Cohort Analysis"
   - Data automatically formatted with date and cohort columns

4. **Captain-Level Aggregation**:
   - Group By: `city`
   - Metrics: `online_days`, `net_rides_taxi`, `accepted_orders`
   - Aggregation: `sum`, `mean`
   - Pre-Period: 2025-08-01 to 2025-08-31
   - Post-Period: 2025-09-01 to 2025-10-31

5. **View Results**:
   - Time series charts showing metrics by city
   - Compare test vs control cohorts
   - Statistical tests for significance
   - Export results as needed

## Benefits

### ✅ No CSV Export/Import
- Direct data flow from Presto to analysis
- No intermediate file handling
- Faster workflow

### ✅ Consistent Data Format
- Automatic date/cohort formatting
- Validation and error handling
- Ready for analysis immediately

### ✅ Full Feature Access
- All cohort analysis features available
- Date range filtering
- Multiple metric plotting
- Statistical testing

### ✅ Flexible Analysis
- Can still upload separate CSV if needed
- Funnel analysis independent from main flow
- Multiple analysis sessions supported

## Session Management

### Separate Sessions
- **Funnel Session**: Stored in `FUNNEL_SESSION_STORE`
  - Mobile numbers → Captain IDs → AO Funnel
  - Persists during wizard flow
  
- **Main Session**: Stored in `SESSION_STORE`
  - Cohort analysis data
  - Used for plotting and statistical testing

### Data Transfer
When you click "Use for Cohort Analysis":
1. Funnel data is **copied** (not moved) to main session
2. New session ID is generated for main session
3. Funnel session remains intact
4. Can start new funnel analysis without affecting current analysis

### LocalStorage
- `funnel_session_id` - Current funnel analysis session
- `session_id` - Current main cohort analysis session
- Both persist across page refreshes

## Notes

- The funnel data structure is preserved during transfer
- All original columns are retained (mobile_number, captain_id, city, etc.)
- Metric columns are automatically identified and made available
- Date formatting is handled automatically
- Cohort column is created if missing
- Invalid data is filtered out before transfer

## Troubleshooting

### Issue: No metrics showing after transfer
**Solution**: Ensure the AO funnel query returned data with metric columns. Check the preview in step 3.

### Issue: Date filtering not working
**Solution**: The system automatically converts time columns to date format. If issues persist, check that the original data has valid time values.

### Issue: Can't see cohorts in dropdown
**Solution**: If no cohort column was in the original CSV, all data will be in the `all_captains` cohort. Upload CSV with cohort column for multiple cohorts.

### Issue: Analysis features not appearing
**Solution**: Make sure you clicked "Use for Cohort Analysis" button. The main analysis section only appears after data is transferred.

## Future Enhancements

Possible improvements for future versions:
- Export funnel data as CSV from the UI
- Multiple cohort creation from funnel data
- Custom metric calculations on funnel data
- Time-based cohort splitting (e.g., by week)
- Automated analysis templates

