import { useState, Component, useEffect } from 'react';
import type { ReactNode } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { ControlsPanel } from '../components/inputs/ControlsPanel';
import { CsvUploadCard } from '../components/inputs/CsvUploadCard';
import { Filters } from '../components/Filters';
import type { FiltersState } from '../components/Filters';
import { Charts } from '../components/Charts';
import { MetricBar } from '../components/MetricBar';
import { StatisticalTests } from '../components/StatisticalTests';
import { CohortDataGrid } from '../components/CohortDataGrid';
import { SummaryStatsTable } from '../components/SummaryStatsTable';
import { CaptainLevelCharts } from '../components/CaptainLevelCharts';
import { fetchFunnel, fetchCohortAggregation, fetchCaptainLevelAggregation, getMeta } from '../lib/api';
import type { FunnelResponse, UploadResponse, CohortAggregationResponse, CaptainLevelResponse, MetaResponse } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Download, RotateCcw } from 'lucide-react';

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
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <span className="text-destructive font-medium">Statistical Analysis Error</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              An error occurred while rendering the statistical tests. Please try refreshing the page.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => this.setState({ hasError: false })}
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

export function ExperimentsPage() {
  const [uploaded, setUploaded] = useState<UploadResponse | null>(null);
  const [filters, setFilters] = useState<FiltersState>({});
  const [funnels, setFunnels] = useState<Record<string, FunnelResponse>>({});
  const [cohortAggregation, setCohortAggregation] = useState<CohortAggregationResponse | null>(null);
  const [captainLevelData, setCaptainLevelData] = useState<CaptainLevelResponse | null>(null);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [additionalMetrics, setAdditionalMetrics] = useState<string[]>([]);
  const [aggByMetric, setAggByMetric] = useState<Record<string, 'sum' | 'mean' | 'count'>>({});
  const [seriesBreakout, setSeriesBreakout] = useState<string>('');
  const [categoricalColumns, setCategoricalColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleSummaries, setVisibleSummaries] = useState<Set<string>>(new Set());
  const [meta, setMeta] = useState<MetaResponse | null>(null);

  const handleAddMetricsToSelection = (metricsToAdd: string[]) => {
    const newMetrics = metricsToAdd.filter(metric => !additionalMetrics.includes(metric));
    setAdditionalMetrics(prev => [...prev, ...newMetrics]);
  };

  const handleAggChange = (metric: string, agg: 'sum' | 'mean' | 'count') => {
    setAggByMetric((prev) => ({ ...prev, [metric]: agg }));
  };

  useEffect(() => {
    getMeta().then(setMeta).catch(() => {});
  }, []);

  useEffect(() => {
    if (uploaded) {
      getMeta().then((meta) => {
        setCategoricalColumns(meta.categorical_columns || []);
      }).catch(() => {
        setCategoricalColumns([]);
      });
    } else {
      setCategoricalColumns([]);
    }
  }, [uploaded]);

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
          series_breakout: seriesBreakout || undefined,
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

  const handleReset = () => {
    setFilters({
      pre_period: { start_date: '20250804', end_date: '20250913' },
      post_period: { start_date: '20250914', end_date: '20251027' },
    });
    setSelectedMetrics([]);
    setAdditionalMetrics([]);
    setFunnels({});
    setCohortAggregation(null);
    setCaptainLevelData(null);
    setError(null);
  };

  const headerActions = (
    <>
      <Button variant="outline" size="sm" onClick={handleReset}>
        <RotateCcw className="mr-2 h-4 w-4" />
        Reset
      </Button>
      <Button variant="ghost" size="sm">
        <Download className="mr-2 h-4 w-4" />
        Export
      </Button>
    </>
  );

  return (
    <AppShell title="Funnel Analysis" actions={headerActions}>
      <div className="p-6">
        {!uploaded ? (
          <div className="max-w-2xl mx-auto">
            <CsvUploadCard onUploaded={setUploaded} />
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-6">
            {/* Left Column - Controls */}
            <div className="col-span-12 lg:col-span-4 space-y-6">
              <ControlsPanel
                filters={filters}
                onFiltersChange={setFilters}
                cohorts={meta?.cohorts ?? []}
                onRun={loadFunnel}
                onReset={handleReset}
              />

              {/* Metrics Selection */}
              <Card>
                <CardHeader>
                  <CardTitle>Metrics Selection</CardTitle>
                  <CardDescription>Select metrics to analyze</CardDescription>
                </CardHeader>
                <CardContent>
                  <MetricBar
                    selected={selectedMetrics}
                    onChange={setSelectedMetrics}
                    onPlot={loadFunnel}
                    additionalMetrics={additionalMetrics}
                    onAdditionalMetricsChange={setAdditionalMetrics}
                    aggByMetric={aggByMetric}
                    onAggChange={handleAggChange}
                    categoricalColumns={categoricalColumns}
                    seriesBreakout={seriesBreakout}
                    onSeriesBreakoutChange={setSeriesBreakout}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Results */}
            <div className="col-span-12 lg:col-span-8 space-y-6">
              <Tabs defaultValue="overview" className="w-full">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="table">Table</TabsTrigger>
                  <TabsTrigger value="charts">Charts</TabsTrigger>
                  <TabsTrigger value="data">Data</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6 mt-6">
                  {loading && (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-center py-8">
                          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          <span className="ml-3 text-sm text-muted-foreground">Loading analysis...</span>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {error && (
                    <Card className="border-destructive">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <div>
                            <h3 className="font-semibold text-destructive">Error</h3>
                            <p className="text-sm text-destructive/80 mt-1">{error}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {cohortAggregation && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Cohort Aggregation</CardTitle>
                        <CardDescription>Cohort-level aggregated metrics and ratios</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <CohortDataGrid
                          data={cohortAggregation.data}
                          title="Cohort Aggregation Data"
                        />
                      </CardContent>
                    </Card>)}

                  {captainLevelData && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Captain-Level Analysis</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CaptainLevelCharts data={captainLevelData} />
                      </CardContent>
                    </Card>
                  )}

                  {Object.keys(funnels).length === 0 && !loading && !error && (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center py-12">
                          <p className="text-sm text-muted-foreground">
                            Configure your filters and click "Run Analysis" to see results
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="table" className="space-y-6 mt-6">
                  {cohortAggregation ? (
                    <Card>
                      <CardHeader>
                        <CardTitle>Cohort Aggregation Table</CardTitle>
                        <CardDescription>Detailed cohort metrics</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <CohortDataGrid
                          data={cohortAggregation.data}
                          title="Cohort Aggregation Data"
                        />
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center py-12">
                          <p className="text-sm text-muted-foreground">
                            No table data available. Run an analysis first.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="charts" className="space-y-6 mt-6">
                  {Object.entries(funnels).map(([metric, funnel]) => {
                    const testLabel = filters.test_cohort ? `TEST: ${filters.test_cohort}` : undefined;
                    const controlLabel = filters.control_cohort ? `CONTROL: ${filters.control_cohort}` : undefined;
                    const summaryStats = calculateSummaryStats(funnel, metric);
                    const showSummary = visibleSummaries.has(metric);

                    return (
                      <Card key={metric}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle>
                                {metric.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} Over Time
                              </CardTitle>
                              <CardDescription>
                                Comparison of test vs control cohorts
                              </CardDescription>
                            </div>
                            <Button
                              variant={showSummary ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => toggleSummaryVisibility(metric)}
                            >
                              Stats
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <div className="bg-muted/50 rounded-lg p-6">
                            <Charts
                              preData={funnel.pre_series.map(p => ({ date: p.date, cohort: p.cohort, value: p.value, series_value: p.series_value }))}
                              postData={funnel.post_series.map(p => ({ date: p.date, cohort: p.cohort, value: p.value, series_value: p.series_value }))}
                              testCohort={testLabel}
                              controlCohort={controlLabel}
                              legendSuffix={metric.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            />
                          </div>

                          {showSummary && (
                            <div className="pt-6 border-t">
                              <SummaryStatsTable
                                data={summaryStats}
                                title={`${metric.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} Summary Statistics`}
                              />
                            </div>
                          )}

                          <div className="pt-6 border-t">
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
                        </CardContent>
                      </Card>
                    );
                  })}

                  {Object.keys(funnels).length === 0 && (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center py-12">
                          <p className="text-sm text-muted-foreground">
                            No charts available. Run an analysis to generate charts.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="data" className="space-y-6 mt-6">
                  <CsvUploadCard onUploaded={setUploaded} uploadedFile={uploaded} />
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Additional Filters</CardTitle>
                      <CardDescription>Advanced filtering options</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Filters
                        value={filters}
                        onChange={setFilters}
                        onApply={loadFunnel}
                        onAddMetricsToSelection={handleAddMetricsToSelection}
                        onApplyCaptainLevel={loadCaptainLevelAggregation}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
