import { useState, Component } from 'react';
import type { ReactNode } from 'react';
import './App.css';
import { Upload } from './components/Upload';
import { Filters } from './components/Filters';
import type { FiltersState } from './components/Filters';
import { Charts } from './components/Charts';
import { MetricBar } from './components/MetricBar';
import { StatisticalTests } from './components/StatisticalTests';
import { CohortDataGrid } from './components/CohortDataGrid';
import { SummaryStatsTable } from './components/SummaryStatsTable';
import { CaptainLevelCharts } from './components/CaptainLevelCharts';
import { FunnelAnalysis } from './components/FunnelAnalysis';
import { CaptainDashboards } from './components/CaptainDashboards';
import { ReportBuilder } from './components/ReportBuilder';
import { AddTextToReport } from './components/AddTextToReport';
import { fetchFunnel, fetchCohortAggregation, fetchCaptainLevelAggregation } from './lib/api';
import type { FunnelResponse, UploadResponse, CohortAggregationResponse, CaptainLevelResponse } from './lib/api';

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
  const [cohortAggregation, setCohortAggregation] = useState<CohortAggregationResponse | null>(null);
  const [captainLevelData, setCaptainLevelData] = useState<CaptainLevelResponse | null>(null);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [additionalMetrics, setAdditionalMetrics] = useState<string[]>([]);
  const [aggByMetric, setAggByMetric] = useState<Record<string, 'sum' | 'mean' | 'count'>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleSummaries, setVisibleSummaries] = useState<Set<string>>(new Set());

  // Handle adding metrics from Available Metrics to Additional Metrics
  const handleAddMetricsToSelection = (metricsToAdd: string[]) => {
    const newMetrics = metricsToAdd.filter(metric => !additionalMetrics.includes(metric));
    setAdditionalMetrics(prev => [...prev, ...newMetrics]);
  };

  const handleAggChange = (metric: string, agg: 'sum' | 'mean' | 'count') => {
    setAggByMetric((prev) => ({ ...prev, [metric]: agg }));
  };

  // Load cohort aggregation data
  const loadCohortAggregation = async () => {
    if (!uploaded) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCohortAggregation();
      setCohortAggregation(res);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load cohort aggregation');
    } finally {
      setLoading(false);
    }
  };

  // Calculate summary statistics for a metric
  const calculateSummaryStats = (funnel: FunnelResponse, _metric: string) => {
    const preTestData = funnel.pre_series
      .filter(p => p.cohort.includes('TEST') || p.cohort.includes('test'))
      .map(p => p.value)
      .filter(v => !isNaN(v));

    const postTestData = funnel.post_series
      .filter(p => p.cohort.includes('TEST') || p.cohort.includes('test'))
      .map(p => p.value)
      .filter(v => !isNaN(v));

    const preControlData = funnel.pre_series
      .filter(p => p.cohort.includes('CONTROL') || p.cohort.includes('control'))
      .map(p => p.value)
      .filter(v => !isNaN(v));

    const postControlData = funnel.post_series
      .filter(p => p.cohort.includes('CONTROL') || p.cohort.includes('control'))
      .map(p => p.value)
      .filter(v => !isNaN(v));

    const calculateStats = (data: number[]) => {
      if (data.length === 0) {
        return { mean: 0, median: 0, p25: 0, p75: 0, std: 0, count: 0 };
      }

      const sorted = [...data].sort((a, b) => a - b);
      const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
      const median = sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];

      const p25Index = Math.floor(sorted.length * 0.25);
      const p75Index = Math.floor(sorted.length * 0.75);
      const p25 = sorted[p25Index];
      const p75 = sorted[p75Index];

      const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
      const std = Math.sqrt(variance);

      return {
        mean: mean,
        median: median,
        p25: p25,
        p75: p75,
        std: std,
        count: data.length
      };
    };

    const preTestStats = calculateStats(preTestData);
    const postTestStats = calculateStats(postTestData);
    const preControlStats = calculateStats(preControlData);
    const postControlStats = calculateStats(postControlData);

    return [
      { group: 'Pre Test', ...preTestStats },
      { group: 'Post Test', ...postTestStats },
      { group: 'Pre Control', ...preControlStats },
      { group: 'Post Control', ...postControlStats }
    ];
  };

  // Toggle summary visibility for a metric
  const toggleSummaryVisibility = (metric: string) => {
    const newVisible = new Set(visibleSummaries);
    if (newVisible.has(metric)) {
      newVisible.delete(metric);
    } else {
      newVisible.add(metric);
    }
    setVisibleSummaries(newVisible);
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

  // Load captain-level aggregation
  const loadCaptainLevelAggregation = async () => {
    if (!filters.test_cohort || !filters.control_cohort || !filters.captain_group_by || !filters.captain_metrics || filters.captain_metrics.length === 0) {
      setError('Please select test cohort, control cohort, group by column, and at least one metric to aggregate');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCaptainLevelAggregation({
        pre_period: filters.pre_period,
        post_period: filters.post_period,
        test_cohort: filters.test_cohort,
        control_cohort: filters.control_cohort,
        test_confirmed: filters.test_confirmed,
        control_confirmed: filters.control_confirmed,
        group_by_column: filters.captain_group_by,
        metric_aggregations: filters.captain_metrics,
      });
      setCaptainLevelData(res);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load captain-level aggregation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="app-container">
        {/* Title Bar */}
        <div className="title-bar">
          <h1 className="title-text">Ladoo Metrics</h1>
        </div>

        {/* Captain Dashboards Section - Always visible */}
        <CaptainDashboards />

        {/* Funnel Analysis Section - Always visible */}
        <FunnelAnalysis onDataReady={(res) => setUploaded(res)} />

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
            {/* Cohort Aggregation Table - Always Visible */}
            <div className="glass-card slide-in">
              <div className="card-header">
                <span className="card-icon">📋</span>
                <div>
                  <h2 className="card-title">Cohort Aggregation Table</h2>
                  <p className="card-subtitle">Cohort-level aggregated metrics and ratios</p>
                </div>
              </div>
              <div className="mt-6">
                {cohortAggregation ? (
                  <CohortDataGrid
                    data={cohortAggregation.data}
                    title="Cohort Aggregation Data"
                  />
                ) : (
                  <div className="text-center py-8">
                    <button
                      className="btn btn-primary"
                      onClick={loadCohortAggregation}
                      disabled={loading}
                    >
                      {loading ? 'Loading...' : 'Load Cohort Aggregation Data'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Filters Card */}
            <div className="glass-card slide-in">
              <Filters
                value={filters}
                onChange={setFilters}
                onApply={loadFunnel}
                onAddMetricsToSelection={handleAddMetricsToSelection}
                onApplyCaptainLevel={loadCaptainLevelAggregation}
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

            {/* Captain-Level Charts Section */}
            {captainLevelData && (
              <div className="glass-card slide-in">
                <CaptainLevelCharts data={captainLevelData} />
              </div>
            )}

            {/* Charts Section */}
            {Object.entries(funnels).map(([metric, funnel]) => {
              const testLabel = filters.test_cohort ? `TEST: ${filters.test_cohort}` : undefined;
              const controlLabel = filters.control_cohort ? `CONTROL: ${filters.control_cohort}` : undefined;
              const summaryStats = calculateSummaryStats(funnel, metric);
              const showSummary = visibleSummaries.has(metric);

              return (
                <div key={metric} className="glass-card slide-in">
                  <div className="card-header">
                    <span className="card-icon">📊</span>
                    <div className="flex-1">
                      <h2 className="card-title">{metric.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} Over Time</h2>
                      <p className="card-subtitle">Comparison of test vs control cohorts across pre and post periods</p>
                    </div>
                    <button
                      onClick={() => toggleSummaryVisibility(metric)}
                      className={`btn btn-secondary ${showSummary ? 'bg-indigo-600 text-white' : ''}`}
                      title={showSummary ? 'Hide Summary Statistics' : 'Show Summary Statistics'}
                    >
                      📈 Stats
                    </button>
                  </div>
                  <div className="chart-container">
                    <Charts
                      preData={funnel.pre_series.map(p => ({ date: p.date, cohort: p.cohort, value: p.value }))}
                      postData={funnel.post_series.map(p => ({ date: p.date, cohort: p.cohort, value: p.value }))}
                      testCohort={testLabel}
                      controlCohort={controlLabel}
                      legendSuffix={metric.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    />
                  </div>

                  {/* Summary Statistics Section */}
                  {showSummary && (
                    <div className="mt-6 pt-4 border-t border-gray-200">
                      <SummaryStatsTable
                        data={summaryStats}
                        title={`${metric.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} Summary Statistics`}
                      />
                    </div>
                  )}

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
          </>
        )}
      </div>

      {/* Report Builder - Floating Panel */}
      <ReportBuilder />

      {/* Add Text Note to Report - Floating Button */}
      <AddTextToReport />
    </div>
  );
}

export default App;
