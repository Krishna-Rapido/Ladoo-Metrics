# Ladoo Metrics - Captain Analytics Platform

A comprehensive analytics platform for Rapido captain data analysis, featuring cohort analysis, funnel metrics, statistical tests, and specialized captain dashboards.

## 🚀 Features

### Core Analytics
- **CSV Upload & Analysis**: Upload and analyze captain data with automatic preprocessing
- **Cohort Analysis**: Track and compare different captain cohorts over time
- **Date Range Filtering**: Flexible date range selection for time-series analysis
- **Metrics Visualization**: Interactive charts with multiple visualization types
- **Statistical Testing**: Built-in statistical tests (T-test, Chi-square, Mann-Whitney U)

### Captain Dashboards
- **Quality Metrics**: DAPR bucket distribution analysis
- **Retention Analytics**: FE2Net funnel and RTU performance metrics
- **Acquisition Funnels**: R2A% tracking and A2PHH summary metrics

### Advanced Features
- **Funnel Analysis**: Mobile number to captain ID mapping with AO funnel metrics
- **Captain Level Aggregation**: Detailed captain-level performance metrics
- **Interactive Tables**: Sortable, filterable AG Grid tables with export capabilities
- **Chart Builder**: Custom chart creation with multiple metrics and grouping options
- **Data Export**: CSV/Excel export for all analysis results
- **Report Builder**: 📝 Create professional experiment reports by saving charts, tables, and adding comments - export as HTML documents

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **Python** (v3.8 or higher)
- **pip** (Python package manager)

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd internal_tools_v1
```

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will be available at `http://localhost:5173`

### 3. Backend Setup

Open a new terminal window/tab:

```bash
# Navigate to backend directory
cd backend

# Install Python dependencies
pip install -r requirements.txt

# For PDF and Word export functionality, also install:
pip install reportlab python-docx Pillow

# Start the FastAPI server
python main.py
```

The backend API will be available at `http://localhost:8000`

## 🏃 Running the Application

### Development Mode

1. **Start Backend** (Terminal 1):
   ```bash
   cd backend
   python main.py
   ```

2. **Start Frontend** (Terminal 2):
   ```bash
   cd frontend
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:5173`

### Production Build

```bash
# Build frontend
cd frontend
npm run build

# The built files will be in frontend/dist/
```

## 📁 Project Structure

```
internal_tools_v1/
├── backend/
│   ├── main.py                 # FastAPI application
│   ├── funnel.py              # Presto query functions
│   ├── schemas.py             # Pydantic data models
│   ├── transformations.py     # Data transformation utilities
│   ├── statistical_analysis.py # Statistical test implementations
│   ├── requirements.txt       # Python dependencies
│   └── test.json              # Test data
│
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── CaptainDashboards.tsx
│   │   │   ├── FunnelAnalysis.tsx
│   │   │   ├── ChartBuilder.tsx
│   │   │   ├── CohortAggregation.tsx
│   │   │   └── ...
│   │   ├── lib/
│   │   │   └── api.ts         # API client
│   │   ├── types/
│   │   │   └── dataframe.ts   # TypeScript types
│   │   ├── App.tsx            # Main application
│   │   └── main.tsx           # Entry point
│   ├── package.json
│   └── vite.config.ts
│
└── README.md
```

## 🔧 Configuration

### Backend Configuration

The backend connects to Presto for data queries. Update the Presto connection in `backend/funnel.py`:

```python
def get_presto_connection(username: str):
    return presto.connect(
        host='your-presto-host',
        port='80',
        username=username
    )
```

### Frontend Configuration

Update the API base URL in `frontend/src/lib/api.ts`:

```typescript
const BASE_URL = 'http://localhost:8000';
```

## 📊 Usage

### 1. CSV Upload Analysis
- Upload a CSV file with captain metrics
- Select cohort column (optional)
- Apply date range filters
- View metrics and charts

### 2. Funnel Analysis
- Upload CSV with mobile numbers
- Map to captain IDs
- Retrieve AO funnel metrics
- Analyze activation patterns

### 3. Captain Dashboards
- Navigate to Captain Dashboards section
- Select category (Quality/Retention/Acquisition)
- Choose specific dashboard
- Configure parameters and run analysis

### 4. Statistical Testing
- Upload two datasets or select cohorts
- Choose statistical test
- View results with p-values and interpretations

### 5. Building Experiment Reports

**NEW**: Document your analysis journey with the Report Builder!

1. **Click "📝 Add to Report"** on any chart or table
2. **Add comments** to explain insights and observations
3. **Add text notes** using the "✍️ Add Note to Report" button (bottom-left)
4. **Open Report Builder** (bottom-right floating button)
5. **Review and edit** all saved items and comments
6. **Export as HTML** for sharing with stakeholders

See [REPORT_BUILDER_GUIDE.md](./REPORT_BUILDER_GUIDE.md) for detailed documentation.

## 🎨 Features Highlights

### Interactive Data Tables
- Sort by any column
- Filter with sidebar
- Pagination controls
- CSV/Excel export
- Column visibility toggle

### Chart Builder
- 4 chart types: Line, Bar, Area, Scatter
- Multi-metric Y-axis selection
- Optional series grouping
- Real-time chart updates
- Export functionality

### Captain Level Analysis
- Performance segments
- Consistency segments
- Detailed metrics breakdown
- Time-series aggregation

## 🔍 Available Dashboards

### Quality
- **DAPR Bucket Distribution**: Analyze DAPR metrics by bucket

### Retention
- **FE2Net Funnel**: First engagement to net order funnel
- **RTU Performance**: Ride-taking unit performance metrics

### Acquisition
- **R2A% Dashboard**: Registration to activation metrics
- **R2A%**: Activation percentages
- **A2PHH-Summary-M0**: Activation to productive happy hour

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Kill process on port 8000 (backend)
lsof -ti:8000 | xargs kill -9

# Kill process on port 5173 (frontend)
lsof -ti:5173 | xargs kill -9
```

### Python Dependencies Issues
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Node Modules Issues
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## 📝 API Documentation

Once the backend is running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📄 License

Internal use only - Rapido

## 👥 Support

For issues or questions, contact the analytics team.

---

**Built with**: React, TypeScript, FastAPI, Python, AG Grid, Recharts, Tailwind CSS

