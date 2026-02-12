import { useState, useMemo, useEffect } from 'react';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    AreaChart,
    Area,
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { BarChart3, Loader2 } from 'lucide-react';
import { getVisualizationData, getSessionId, type VisualizationRequest } from '@/lib/api';

type ChartType = 'line' | 'bar' | 'area' | 'scatter';

interface DiscoverVisualizationProps {
    sessionId: string | null;
    columns: string[];
    numericColumns: string[];
    categoricalColumns: string[];
}

const COLORS = [
    '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#84cc16',
];

type AggregationType = 'sum' | 'mean' | 'count' | 'median';

export function DiscoverVisualization({
    sessionId,
    columns,
    numericColumns,
    categoricalColumns
}: DiscoverVisualizationProps) {
    const [chartType, setChartType] = useState<ChartType>('line');
    const [xAxis, setXAxis] = useState<string>('');
    const [yAxes, setYAxes] = useState<string[]>([]);
    const [series, setSeries] = useState<string>('__none__');
    const [aggregations, setAggregations] = useState<Record<string, AggregationType>>({});

    // Aggregated chart data from backend
    const [chartData, setChartData] = useState<Record<string, any>[]>([]);
    const [isLoadingChart, setIsLoadingChart] = useState(false);
    const [chartError, setChartError] = useState<string | null>(null);

    // Helper to get actual series value (convert __none__ to empty string)
    const actualSeries = series === '__none__' ? '' : series;

    // Helper to get aggregation for a metric (default to 'sum')
    const getAggregation = (metric: string): AggregationType => {
        return aggregations[metric] || 'sum';
    };

    // Fetch aggregated data from backend when visualization params change
    useEffect(() => {
        if (!sessionId || !xAxis || yAxes.length === 0) {
            setChartData([]);
            setChartError(null);
            return;
        }

        let cancelled = false;
        setIsLoadingChart(true);
        setChartError(null);

        const request: VisualizationRequest = {
            x_axis: xAxis,
            y_axes: yAxes,
            aggregations: Object.fromEntries(
                yAxes.map(y => [y, getAggregation(y)])
            ),
            series: actualSeries || undefined,
            chart_type: chartType,
        };

        getVisualizationData(sessionId, request)
            .then((result) => {
                if (cancelled) return;
                if (result.success) {
                    setChartData(result.data || []);
                } else {
                    setChartError(result.error || 'Failed to aggregate data');
                    setChartData([]);
                }
            })
            .catch((err) => {
                if (cancelled) return;
                const errorMessage = err instanceof Error ? err.message : 'Failed to load visualization data';
                setChartError(errorMessage);
                setChartData([]);
            })
            .finally(() => {
                if (!cancelled) setIsLoadingChart(false);
            });

        return () => {
            cancelled = true;
        };
    }, [sessionId, xAxis, yAxes, actualSeries, aggregations, chartType]);

    // Get unique series values for legend from chart data
    const seriesValues = useMemo(() => {
        if (!actualSeries || !chartData || chartData.length === 0) return [];
        const values = new Set<string>();
        chartData.forEach(row => {
            Object.keys(row).forEach(key => {
                if (key.includes('_') && key !== xAxis) {
                    const parts = key.split('_');
                    if (parts.length > 1) {
                        values.add(parts.slice(1).join('_'));
                    }
                }
            });
        });
        return Array.from(values);
    }, [chartData, actualSeries, xAxis]);

    // Get all line keys for rendering
    const lineKeys = useMemo(() => {
        if (!actualSeries) {
            return yAxes;
        }
        const keys: string[] = [];
        yAxes.forEach(yAxis => {
            seriesValues.forEach(seriesValue => {
                keys.push(`${yAxis}_${seriesValue}`);
            });
        });
        return keys;
    }, [yAxes, actualSeries, seriesValues]);

    const renderChart = () => {
        if (!xAxis || yAxes.length === 0) {
            return (
                <div className="h-96 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                        <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="font-medium">Select X-axis and at least one Y-axis metric</p>
                    </div>
                </div>
            );
        }

        if (isLoadingChart) {
            return (
                <div className="h-96 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                        <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-emerald-600" />
                        <p className="font-medium">Aggregating data...</p>
                        <p className="text-sm text-muted-foreground mt-2">Processing full dataset on server</p>
                    </div>
                </div>
            );
        }

        if (chartError) {
            return (
                <div className="h-96 flex items-center justify-center text-destructive">
                    <div className="text-center">
                        <p className="font-medium mb-2">Error loading chart data</p>
                        <p className="text-sm">{chartError}</p>
                    </div>
                </div>
            );
        }

        if (!chartData || chartData.length === 0) {
            return (
                <div className="h-96 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                        <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="font-medium">No data available</p>
                    </div>
                </div>
            );
        }

        const commonProps = {
            data: chartData,
            margin: { top: 20, right: 30, left: 20, bottom: 60 },
        };

        const xAxisProps = {
            dataKey: xAxis,
            angle: -45,
            textAnchor: 'end' as const,
            height: 100,
            tick: { fontSize: 12 },
        };

        const yAxisProps = {
            tick: { fontSize: 12 },
        };

        const renderDataLines = () => {
            return lineKeys.map((key, idx) => (
                <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={key.replace(/_/g, ' ')}
                    stroke={COLORS[idx % COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                />
            ));
        };

        const renderDataBars = () => {
            return lineKeys.map((key, idx) => (
                <Bar
                    key={key}
                    dataKey={key}
                    name={key.replace(/_/g, ' ')}
                    fill={COLORS[idx % COLORS.length]}
                />
            ));
        };

        const renderDataAreas = () => {
            return lineKeys.map((key, idx) => (
                <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={key.replace(/_/g, ' ')}
                    stroke={COLORS[idx % COLORS.length]}
                    fill={COLORS[idx % COLORS.length]}
                    fillOpacity={0.6}
                />
            ));
        };

        return (
            <ResponsiveContainer width="100%" height={400}>
                {chartType === 'line' ? (
                    <LineChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis {...xAxisProps} />
                        <YAxis {...yAxisProps} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e2e8f0' }} />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        {renderDataLines()}
                    </LineChart>
                ) : chartType === 'bar' ? (
                    <BarChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis {...xAxisProps} />
                        <YAxis {...yAxisProps} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e2e8f0' }} />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        {renderDataBars()}
                    </BarChart>
                ) : chartType === 'area' ? (
                    <AreaChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis {...xAxisProps} />
                        <YAxis {...yAxisProps} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e2e8f0' }} />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        {renderDataAreas()}
                    </AreaChart>
                ) : (
                    <ScatterChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis {...xAxisProps} />
                        <YAxis {...yAxisProps} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e2e8f0' }} />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        {lineKeys.map((key, idx) => (
                            <Scatter
                                key={key}
                                name={key.replace(/_/g, ' ')}
                                data={chartData.map(d => ({ x: d[xAxis], y: d[key] }))}
                                fill={COLORS[idx % COLORS.length]}
                            />
                        ))}
                    </ScatterChart>
                )}
            </ResponsiveContainer>
        );
    };

    if (!columns || columns.length === 0) {
        return (
            <Card className="rounded-2xl">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium mb-2">No Data Available</p>
                    <p className="text-sm text-muted-foreground">Data will appear here once available</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="rounded-2xl">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">Visualize Data</CardTitle>
                </div>
                <CardDescription>Build custom visualizations from your dataset</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Chart Type Selection */}
                <div>
                    <Label className="text-sm font-medium mb-3">Choose a visualization</Label>
                    <div className="grid grid-cols-4 gap-3">
                        {[
                            { type: 'line', icon: '📈', label: 'Line' },
                            { type: 'bar', icon: '📊', label: 'Bar' },
                            { type: 'area', icon: '📉', label: 'Area' },
                            { type: 'scatter', icon: '🔵', label: 'Scatter' },
                        ].map(({ type, icon, label }) => (
                            <button
                                key={type}
                                onClick={() => setChartType(type as ChartType)}
                                className={`p-4 rounded-xl border-2 transition-all ${chartType === type
                                        ? 'border-emerald-500 bg-emerald-50 shadow-md'
                                        : 'border-slate-200 bg-white hover:border-emerald-300'
                                    }`}
                            >
                                <div className="text-3xl mb-2">{icon}</div>
                                <div className="text-sm font-medium text-slate-700">{label}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Axis Configuration */}
                <div className="grid grid-cols-3 gap-4">
                    {/* X-Axis */}
                    <div>
                        <Label className="text-sm font-medium mb-2">X-axis</Label>
                        <Select value={xAxis} onValueChange={setXAxis}>
                            <SelectTrigger className="rounded-lg">
                                <SelectValue placeholder="Select a field" />
                            </SelectTrigger>
                            <SelectContent>
                                {columns.map((col) => (
                                    <SelectItem key={col} value={col}>
                                        {col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {xAxis && (
                            <p className="mt-1 text-xs text-muted-foreground">
                                {categoricalColumns.includes(xAxis) ? '📝 Categorical' : '🔢 Numeric'}
                            </p>
                        )}
                    </div>

                    {/* Y-Axes (Multiple Selection with Pills and Aggregation) */}
                    <div className="col-span-2">
                        <Label className="text-sm font-medium mb-2">
                            Y-axis Metrics {yAxes.length > 0 && (
                                <span className="text-xs text-emerald-600 ml-2">
                                    ({yAxes.length} selected)
                                </span>
                            )}
                        </Label>
                        <div className="border border-slate-300 rounded-lg p-4 min-h-[100px] max-h-96 overflow-y-auto bg-white space-y-3">
                            {/* Available metrics */}
                            <div className="flex flex-wrap gap-3">
                                {numericColumns.map((col) => {
                                    const isSelected = yAxes.includes(col);
                                    return (
                                        <button
                                            key={col}
                                            onClick={() => {
                                                if (isSelected) {
                                                    setYAxes(yAxes.filter(y => y !== col));
                                                    // Remove aggregation when metric is deselected
                                                    const newAggs = { ...aggregations };
                                                    delete newAggs[col];
                                                    setAggregations(newAggs);
                                                } else {
                                                    setYAxes([...yAxes, col]);
                                                    // Set default aggregation to 'sum'
                                                    setAggregations({ ...aggregations, [col]: 'sum' });
                                                }
                                            }}
                                            className={`
                                                inline-flex items-center gap-2 px-4 py-2
                                                text-sm font-semibold transition-all whitespace-nowrap
                                                rounded-full border
                                                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2
                                                ${isSelected
                                                    ? 'bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200'
                                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-emerald-300'
                                                }
                                            `}
                                        >
                                            {isSelected && <span>✓</span>}
                                            <span>{col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Selected metrics with aggregation selectors */}
                            {yAxes.length > 0 && (
                                <div className="pt-3 border-t border-slate-200 space-y-2">
                                    <p className="text-xs font-medium text-slate-600 mb-2">Aggregation for selected metrics:</p>
                                    {yAxes.map((col) => (
                                        <div key={col} className="flex items-center gap-3">
                                            <span className="text-sm text-slate-700 min-w-[120px]">
                                                {col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}:
                                            </span>
                                            <Select
                                                value={getAggregation(col)}
                                                onValueChange={(value: AggregationType) => {
                                                    setAggregations({ ...aggregations, [col]: value });
                                                }}
                                            >
                                                <SelectTrigger className="w-32 h-8 text-xs rounded-lg">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="sum">Sum</SelectItem>
                                                    <SelectItem value="mean">Mean</SelectItem>
                                                    <SelectItem value="count">Count</SelectItem>
                                                    <SelectItem value="median">Median</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {yAxes.length === 0 && (
                            <p className="mt-1 text-xs text-amber-600">
                                💡 Click metrics to add them to the chart
                            </p>
                        )}
                    </div>

                    {/* Series (Group By) */}
                    <div>
                        <Label className="text-sm font-medium mb-2">Series (Group By)</Label>
                        <Select value={series} onValueChange={setSeries}>
                            <SelectTrigger className="rounded-lg">
                                <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">None</SelectItem>
                                {categoricalColumns.map((col) => (
                                    <SelectItem key={col} value={col}>
                                        {col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {actualSeries && (
                            <p className="mt-1 text-xs text-emerald-600">
                                📊 {seriesValues.length} series
                            </p>
                        )}
                    </div>
                </div>

                {/* Chart Display */}
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                    {renderChart()}
                </div>

                {/* Chart Info */}
                {xAxis && yAxes.length > 0 && (
                    <div className="flex items-center justify-between text-sm text-slate-600 bg-slate-50 rounded-lg p-4">
                        <div className="flex items-center gap-6 flex-wrap">
                            <span>
                                <strong>X:</strong> {xAxis.replace(/_/g, ' ')}
                            </span>
                            <span>
                                <strong>Y:</strong> {yAxes.map(y => {
                                    const agg = getAggregation(y);
                                    return `${y.replace(/_/g, ' ')} (${agg})`;
                                }).join(', ')}
                            </span>
                            {actualSeries && (
                                <span>
                                    <strong>Series:</strong> {actualSeries.replace(/_/g, ' ')} ({seriesValues.length} groups)
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-slate-500">
                            {chartData.length} data points × {lineKeys.length} lines
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
