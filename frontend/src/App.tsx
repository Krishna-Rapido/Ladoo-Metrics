import { useState, Component } from 'react';
import type { ReactNode } from 'react';
import './App.css';
import { Upload } from './components/Upload';
import { Filters } from './components/Filters';
import type { FiltersState } from './components/Filters';
import { Charts } from './components/Charts';
import { MetricBar } from './components/MetricBar';
import { StatisticalTests } from './components/StatisticalTests';
import { fetchFunnel } from './lib/api';
import type { FunnelResponse, UploadResponse } from './lib/api';

// Simple Error Boundary Component
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Statistical Tests Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200">
          <div className="flex items-center gap-2">
            <span className="text-red-500">⚠️</span>
            <span className="text-red-700 font-medium">Statistical Analysis Error</span>
          </div>
          <p className="text-red-600 text-sm mt-1">
            An error occurred while rendering the statistical tests. Please try refreshing the page.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [uploaded, setUploaded] = useState<UploadResponse | null>(null);
  const [filters, setFilters] = useState<FiltersState>({});
  const [funnels, setFunnels] = useState<Record<string, FunnelResponse>>({});
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [additionalMetrics, setAdditionalMetrics] = useState<string[]>([]);
  const [aggByMetric, setAggByMetric] = useState<Record<string, 'sum' | 'mean' | 'count'>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle adding metrics from Available Metrics to Additional Metrics
  const handleAddMetricsToSelection = (metricsToAdd: string[]) => {
    const newMetrics = metricsToAdd.filter(metric => !additionalMetrics.includes(metric));
    setAdditionalMetrics(prev => [...prev, ...newMetrics]);
  };

  const handleAggChange = (metric: string, agg: 'sum' | 'mean' | 'count') => {
    setAggByMetric((prev) => ({ ...prev, [metric]: agg }));
  };

  async function loadFunnel() {
    if (!filters.test_cohort || !filters.control_cohort) return;
    setLoading(true);
    setError(null);
    try {
      let metricsToLoad = (selectedMetrics.length > 0
        ? selectedMetrics
        : (filters.metrics && filters.metrics.length > 0 ? filters.metrics : (filters.metric ? [filters.metric] : []))
      );
      if (!metricsToLoad || metricsToLoad.length === 0) {
        metricsToLoad = ['ao_days'];
        if (selectedMetrics.length === 0) setSelectedMetrics(['ao_days']);
      }
      const next: Record<string, FunnelResponse> = {};
      for (const m of metricsToLoad) {
        console.log('loading funnel for metric', m);
        const res = await fetchFunnel({
          pre_period: filters.pre_period,
          post_period: filters.post_period,
          test_cohort: filters.test_cohort,
          control_cohort: filters.control_cohort,
          metric: m,
          confirmed: filters.confirmed,
          test_confirmed: filters.test_confirmed,
          control_confirmed: filters.control_confirmed,
          agg: additionalMetrics.includes(m) ? (aggByMetric[m] ?? 'sum') : undefined,
        });
        next[m] = res;
      }
      setFunnels(next);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load funnel');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="app-container">
        {/* Title Bar */}
        <div className="title-bar">
          <h1 className="title-text">Cohort Comparison Dashboard</h1>
        </div>

        {/* Data Upload Card */}
        {!uploaded ? (
          <div className="glass-card slide-in">
            <div className="card-header">
              <span className="card-icon">📊</span>
              <div>
                <h2 className="card-title">Data Upload</h2>
                <p className="card-subtitle">Upload your CSV file to get started with cohort analysis</p>
              </div>
            </div>
            <Upload onUploaded={(res) => setUploaded(res)} />
          </div>
        ) : (
          <>
            {/* Filters Card */}
            <div className="glass-card slide-in">
              <Filters
                value={filters}
                onChange={setFilters}
                onApply={loadFunnel}
                onAddMetricsToSelection={handleAddMetricsToSelection}
              />
            </div>

            {/* Metrics Selection Card */}
            <div className="glass-card slide-in">
              <div className="card-header">
                <span className="card-icon">📈</span>
                <div>
                  <h2 className="card-title">Metrics Selection</h2>
                  <p className="card-subtitle">Select the metrics you want to analyze and compare</p>
                </div>
              </div>
              <MetricBar
                selected={selectedMetrics}
                onChange={setSelectedMetrics}
                onPlot={loadFunnel}
                additionalMetrics={additionalMetrics}
                onAdditionalMetricsChange={setAdditionalMetrics}
                aggByMetric={aggByMetric}
                onAggChange={handleAggChange}
              />
            </div>
          </>
        )}

        {/* Loading State */}
        {loading && (
          <div className="glass-card slide-in">
            <div className="flex items-center justify-center py-8">
              <div className="loading-spinner"></div>
              <span className="ml-3 text-slate-600">Loading analysis...</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="glass-card slide-in" style={{ borderColor: '#fecaca', background: 'rgba(254, 226, 226, 0.9)' }}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="font-semibold text-red-800">Error</h3>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Charts Section */}
        {Object.entries(funnels).map(([metric, funnel]) => {
          const testLabel = filters.test_cohort ? `TEST: ${filters.test_cohort}` : undefined;
          const controlLabel = filters.control_cohort ? `CONTROL: ${filters.control_cohort}` : undefined;
          return (
            <div key={metric} className="glass-card slide-in">
              <div className="card-header">
                <span className="card-icon">📊</span>
                <div>
                  <h2 className="card-title">{metric.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} Over Time</h2>
                  <p className="card-subtitle">Comparison of test vs control cohorts across pre and post periods</p>
                </div>
              </div>
              <div className="chart-container">
                <Charts
                  preData={funnel.pre_series.map(p => ({ date: p.date, cohort: p.cohort, value: p.value }))}
                  postData={funnel.post_series.map(p => ({ date: p.date, cohort: p.cohort, value: p.value }))}
                  testCohort={testLabel}
                  controlCohort={controlLabel}
                  title={metric}
                  legendSuffix={metric.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                />
              </div>

              {/* Statistical Analysis Section */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <ErrorBoundary>
                  <StatisticalTests
                    preData={funnel.pre_series.map(p => ({ date: p.date, cohort: p.cohort, value: p.value }))}
                    postData={funnel.post_series.map(p => ({ date: p.date, cohort: p.cohort, value: p.value }))}
                    testCohort={testLabel}
                    controlCohort={controlLabel}
                    metric={metric}
                  />
                </ErrorBoundary>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;
