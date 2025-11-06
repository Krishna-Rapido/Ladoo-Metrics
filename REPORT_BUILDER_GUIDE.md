# 📝 Report Builder Guide

## Overview

The Report Builder allows you to create comprehensive experiment documentation by saving charts, tables, and adding comments as you work through your analysis. Build a professional HTML report that can be exported and shared with stakeholders.

## ✨ Key Features

- **Save Any Visualization**: Add charts and tables from any section of the app
- **Add Comments**: Write observations, insights, and interpretations for each item
- **Live Report Building**: See your report grow in real-time as you add items
- **HTML Export**: Export as a styled HTML document ready for sharing or printing
- **Persistent Session**: Report persists across page refreshes (stored in browser localStorage)
- **Easy Management**: Edit comments, delete items, or clear entire report with one click

## 🚀 Getting Started

### 1. Accessing the Report Builder

The Report Builder appears as a floating button in the bottom-right corner of the screen:

```
📝 Report Builder (n items)
```

Click it to open the report panel on the right side of your screen.

### 2. Adding Items to Your Report

Throughout the application, you'll find **"📝 Add to Report"** buttons on:

#### Charts
- Cohort Analysis Charts (in main workflow)
- ChartBuilder visualizations (in all Captain Dashboards)
- Custom multi-metric charts

**Location**: Top-right corner of chart cards

#### Tables
- All AG Grid data tables
- DAPR Bucket Distribution results
- FE2Net, RTU Performance, R2A%, A2PHH Summary results
- Funnel Analysis data previews

**Location**: Header section of each table

### 3. Adding Comments

For each saved item, you can add detailed comments:

1. **For new items**: Click the "+ Add comment" button
2. **For existing comments**: Click on the comment text to edit
3. Write your observations, insights, or interpretations
4. Click "Save" to store the comment

**💡 Tip**: Use comments to:
- Explain trends you observe
- Note anomalies or surprising findings
- Document hypotheses or next steps
- Add context for stakeholders

## 📊 Report Structure

Each report item includes:

```
┌─────────────────────────────────────────┐
│ [TYPE BADGE] #1                    [🗑️] │
│ Item Title                               │
│ ─────────────────────────────────────── │
│ [Preview/Summary]                        │
│ ─────────────────────────────────────── │
│ 💬 Your comment here                     │
│ Added: 2025-11-05 14:32:15              │
└─────────────────────────────────────────┘
```

### Item Types

**📊 CHART**
- Chart type (Line, Bar, Area, Scatter)
- X-axis and Y-axes configuration
- Series breakout (if applicable)
- Number of data points

**📋 TABLE**
- Row count and column count
- First 50 rows displayed in export
- Full table structure preserved

**📝 TEXT**
- Custom text notes
- Formatted with rich styling in export

## 🎯 Workflow Example

### Typical Experiment Analysis Flow

```
1. Upload Data
   └─ Run initial cohort analysis

2. Analyze Metrics
   ├─ View chart for metric_1
   │  └─ 📝 Add to Report
   │     └─ 💬 "Significant 15% increase in test cohort"
   │
   ├─ View chart for metric_2
   │  └─ 📝 Add to Report
   │     └─ 💬 "Control cohort stable, validates A/B test"
   │
   └─ Run statistical test
      └─ 📝 Add results table
         └─ 💬 "P-value < 0.05, statistically significant"

3. Captain Dashboard Analysis
   ├─ FE2Net Funnel
   │  ├─ 📝 Add data table
   │  │  └─ 💬 "Funnel conversion: 78% across all stages"
   │  │
   │  └─ 📝 Add multi-metric chart
   │     └─ 💬 "Login hours correlate with net orders (r=0.82)"
   │
   └─ RTU Performance
      └─ 📝 Add aggregated metrics
         └─ 💬 "Daily RTU improved 22% MoM"

4. Export Report
   └─ Click "📄 Export HTML"
   └─ Share with team/stakeholders
```

## 📤 Exporting Your Report

### Export as HTML

1. Open Report Builder panel
2. Click **"📄 Export HTML"** button
3. File downloads automatically: `experiment_report_YYYY-MM-DD.html`

### HTML Report Features

✅ **Professional Styling**
- Purple gradient theme matching the app
- Clean, readable typography
- Responsive tables
- Page breaks for printing

✅ **Complete Content**
- All saved charts and tables
- Comments displayed prominently
- Timestamps for each item
- Numbered sections

✅ **Print-Ready**
- Optimized for A4/Letter paper
- Automatic page breaks every 2 items
- High-quality rendering

### Sharing Options

The exported HTML file can be:
- **Emailed** as an attachment
- **Uploaded** to Google Drive, Confluence, etc.
- **Printed** as PDF (File → Print → Save as PDF in browser)
- **Converted** to Word using online converters or Word's "Open" function

## 🔧 Report Management

### Clear All Items

1. Open Report Builder panel
2. Click **"🗑️ Clear"** button
3. Confirm deletion
4. Report is reset (empty)

### Delete Individual Items

1. Hover over any report item
2. Click the **🗑️** icon in top-right corner
3. Item is removed immediately

### Edit Comments

1. Click on any existing comment text
2. Modify the content
3. Click "Save" or "Cancel"

## 💡 Best Practices

### 1. Add Context Early
Add items to your report as you discover insights, not at the end. This captures your thought process and reasoning.

### 2. Use Descriptive Titles
When charts/tables are added, they include the section title. Make sure section titles are clear and descriptive.

### 3. Write Detailed Comments
Good comments include:
- What the data shows
- Why it matters
- What actions or decisions it supports
- Any caveats or limitations

### 4. Organize Chronologically
Items are added in the order you discover insights, which naturally creates a narrative flow in your exported report.

### 5. Review Before Export
Scroll through your report items before exporting to ensure:
- All key insights are captured
- Comments are clear and complete
- Items are in logical order

## 🎨 UI Elements

### Report Builder Panel

**Location**: Right sidebar (500px wide)
**State**: Collapsible (button at bottom-right when closed)
**Behavior**: Overlays main content when open

**Header Section**:
- Total items count
- Export HTML button
- Clear all button
- Close button (✕)

**Items Section**:
- Scrollable list
- Each item shows:
  - Type badge (CHART/TABLE/TEXT)
  - Title and timestamp
  - Preview/summary
  - Comment (editable)
  - Delete button

### Add to Report Buttons

**Charts**: Purple gradient button with "📝 Add to Report"
**Tables**: Purple gradient button with "📝 Add to Report"

**Success Feedback**: Green "✓ Added!" badge appears briefly when item is saved

## 🔍 Technical Details

### Data Storage

- **Session Management**: Each report has a unique `report_id`
- **Persistence**: Report ID stored in browser localStorage
- **Server-Side**: Items stored in-memory on backend (FastAPI)
- **Auto-Restore**: Report reloads when you refresh the page

### Content Preservation

**Charts**:
- Chart type and configuration
- All data points
- Axis configurations
- Series breakout settings

**Tables**:
- Full dataset (all rows and columns)
- Original data structure
- Numeric formatting preserved

**Comments**:
- Markdown-ready text
- Timestamps
- Editing history

### Export Format

**HTML Structure**:
```html
<!DOCTYPE html>
<html>
  <head>
    <style>/* Professional styling */</style>
  </head>
  <body>
    <div class="container">
      <h1>📊 Experiment Report</h1>
      <p>Generated on: 2025-11-05</p>
      
      <!-- Item 1 -->
      <div class="report-item">
        <span class="item-type">CHART</span>
        <div class="item-header">1. Chart Title</div>
        <div class="chart-config">...</div>
        <div class="item-comment">💬 Comment</div>
      </div>
      
      <!-- Item 2 -->
      <div class="report-item">...</div>
    </div>
  </body>
</html>
```

## 📱 Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open/Close Report Builder | (Button click only) |
| Save Comment | Enter (in comment textarea) |
| Cancel Edit | Escape (in comment textarea) |

## 🐛 Troubleshooting

### Report Items Not Appearing

**Issue**: Clicked "Add to Report" but item doesn't show
**Solution**: 
- Check if Report Builder panel is open
- Refresh the report by clicking the Report Builder button
- Check browser console for errors

### Export Button Disabled

**Issue**: Cannot click "Export HTML"
**Solution**: 
- Ensure you have at least one item in the report
- Close and reopen the Report Builder panel

### Report Lost After Refresh

**Issue**: Report cleared after page refresh
**Solution**: 
- Check if localStorage is enabled in browser
- Ensure backend server is running continuously
- Note: Backend restarts will clear in-memory reports

### Comments Not Saving

**Issue**: Comments disappear after editing
**Solution**: 
- Click "Save" button after editing (don't just close)
- Ensure network connection to backend
- Check backend logs for errors

## 🌟 Advanced Features

### Multiple Reports (Future Enhancement)

Currently, one report per session. Future versions may support:
- Multiple named reports
- Report templates
- Collaborative reports
- Version history

### Enhanced Export Formats (Future Enhancement)

Planned export formats:
- **PDF**: Direct PDF generation with charts rendered as images
- **Word (.docx)**: Native Word document format
- **Markdown**: For documentation systems
- **PowerPoint**: Slide deck with one item per slide

### Real-Time Collaboration (Future Enhancement)

Share report builder session across team members for collaborative documentation.

## 📞 Support

For issues or feature requests related to Report Builder:
1. Check this guide for solutions
2. Review browser console for error messages
3. Contact analytics team with:
   - Screenshot of the issue
   - Steps to reproduce
   - Browser and OS information

---

**Built for**: Experiment documentation and knowledge sharing
**Integration**: Works across all app sections seamlessly
**Last Updated**: November 5, 2025

