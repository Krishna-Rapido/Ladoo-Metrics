# Quick Start: Captain-Level Aggregation

## What You Can Do Now

Analyze captain-level metrics grouped by categorical segments (like `consistency_segment`) with:
- **Pie Charts**: Show percentage distributions across segments
- **Bar Charts**: Compare aggregated values across test/control and pre/post periods

## Quick Example

### Scenario
You want to analyze how captains in different consistency segments (e.g., "high", "medium", "low") behave differently between test and control cohorts.

### Steps

1. **Upload Your Data** (must include):
   - `cohort` column
   - `date` or `time` column
   - Categorical column like `consistency_segment`
   - Metric columns like `totalExpCaps`, `total_lh`, etc.

2. **Set Basic Filters**:
   ```
   Test Cohort: your_test_cohort_name
   Control Cohort: your_control_cohort_name
   Pre Period: 20250804 to 20250913
   Post Period: 20250914 to 20250928
   ```

3. **Configure Captain-Level Analysis**:
   - Group By: `consistency_segment`
   - Add Metrics:
     - `totalExpCaps` with `nunique` (count unique captains)
     - `total_lh` with `mean` (average lifetime hours)
     - Any other metric with desired aggregation

4. **Generate Charts**:
   Click "Generate Captain-Level Charts"

### Result

You'll see:
- **Bar chart** comparing all metrics across segments for:
  - Pre Test
  - Post Test  
  - Pre Control
  - Post Control

- **4 Pie charts** showing percentage breakdown:
  - Test Pre: What % of test captains were in each segment during pre period?
  - Test Post: What % of test captains were in each segment during post period?
  - Control Pre: What % of control captains were in each segment during pre period?
  - Control Post: What % of control captains were in each segment during post period?

## Available Aggregation Functions

- **nunique**: Count unique values (for captain IDs)
- **sum**: Total sum
- **mean**: Average value
- **count**: Total count of records
- **median**: Middle value
- **std**: Standard deviation
- **min**: Minimum value
- **max**: Maximum value

## Tips

1. **Multiple Metrics**: You can add as many metrics as you want - each will create a new aggregated column
2. **Confirmation Filters**: Use these to filter only captains who reached certain funnel stages
3. **Switching Metrics**: Use the dropdown in the charts view to switch between different aggregated metrics
4. **Percentages**: The pie charts automatically calculate percentages based on the total for each period/cohort

## Troubleshooting

**"Group by column not found"**: Make sure your CSV has the column you're trying to group by

**"No data found for cohort"**: Check that your cohort names match exactly what's in the uploaded data

**"Metric column not found"**: Verify the metric column exists in your dataset

**Empty charts**: Ensure your date ranges include actual data points

