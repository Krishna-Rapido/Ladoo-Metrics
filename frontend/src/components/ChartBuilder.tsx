import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { useReport } from '../contexts/ReportContext';
import { toPng } from 'html-to-image';
import { CalculatedColumnPanel } from './CalculatedColumnPanel';
import type { ChartConfig } from '@/lib/supabase';

type ChartType = ChartConfig['chartType'];
type AggregationType = ChartConfig['aggregation'];

const AGG_OPTIONS: { value: AggregationType; label: string }[] = [
    { value: 'sum', label: 'Sum' },
    { value: 'mean', label: 'Mean' },
    { value: 'count', label: 'Count' },
    { value: 'unique_count', label: 'Unique Count' },
    { value: 'median', label: 'Median' },
    { value: 'p25', label: '25th Percentile' },
    { value: 'p75', label: '75th Percentile' },
    { value: 'p90', label: '90th Percentile' },
];

function aggregate(values: number[], method: AggregationType): number {
    if (values.length === 0) return 0;
    switch (method) {
        case 'sum':
            return values.reduce((a, b) => a + b, 0);
        case 'mean':
            return values.reduce((a, b) => a + b, 0) / values.length;
        case 'count':
            return values.length;
        case 'unique_count':
            return new Set(values).size;
        case 'median':
            return percentile(values, 0.5);
        case 'p25':
            return percentile(values, 0.25);
        case 'p75':
            return percentile(values, 0.75);
        case 'p90':
            return percentile(values, 0.9);
    }
}

function percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const idx = p * (sorted.length - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

interface ChartBuilderProps {
    data: Record<string, any>[];
    title?: string;
    calculatedColumns?: string[];
    sessionId?: string | null;
    onColumnApplied?: (columnName: string) => void;
    onColumnRemoved?: (columnName: string) => void;
    // Template feature props
    configId?: string;
    initialConfig?: ChartConfig;
    onConfigChange?: (config: ChartConfig) => void;
}

const COLORS = [
    '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#84cc16',
];

export function ChartBuilder({
    data,
    title = 'Visualization',
    calculatedColumns = [],
    sessionId,
    onColumnApplied,
    onColumnRemoved,
    configId,
    initialConfig,
    onConfigChange,
}: ChartBuilderProps) {
    const [chartType, setChartType] = useState<ChartType>(initialConfig?.chartType ?? 'line');
    const [xAxis, setXAxis] = useState<string>(initialConfig?.xAxis ?? '');
    const [yAxes, setYAxes] = useState<string[]>(initialConfig?.yAxes ?? []);
    const [seriesColumns, setSeriesColumns] = useState<string[]>(initialConfig?.seriesColumns ?? []);
    const [aggregation, setAggregation] = useState<AggregationType>(initialConfig?.aggregation ?? 'sum');
    const { addItem } = useReport();
    const [showSuccess, setShowSuccess] = useState(false);
    const chartRef = useRef<HTMLDivElement>(null);
    const [showCalcBuilder, setShowCalcBuilder] = useState(false);

    // Keep onConfigChange ref stable to avoid stale closures in effects
    const onConfigChangeRef = useRef(onConfigChange);
    useEffect(() => { onConfigChangeRef.current = onConfigChange; });

    // Skip first render so loading from a saved config doesn't mark the dashboard dirty
    const isFirstRender = useRef(true);

    // Report config changes upward whenever relevant state changes
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        if (!onConfigChangeRef.current || !configId) return;
        onConfigChangeRef.current({
            id: configId,
            title: title || 'Visualization',
            chartType,
            xAxis,
            yAxes,
            seriesColumns,
            aggregation,
        });
    }, [chartType, xAxis, yAxes, seriesColumns, aggregation, configId, title]);

    // Add chart to report
    const handleAddToReport = async () => {
        if (!xAxis || yAxes.length === 0) {
            alert('Please configure X-axis and at least one Y-axis metric before adding to report');
            return;
        }

        if (!chartRef.current) {
            alert('Chart not ready. Please wait a moment and try again.');
            return;
        }

        try {
            const dataUrl = await toPng(chartRef.current, {
                backgroundColor: '#ffffff',
                quality: 1.0,
                pixelRatio: 2,
            });

            await addItem({
                type: 'chart',
                title: title || 'Chart Visualization',
                content: {
                    chartType,
                    xAxis,
                    yAxes,
                    seriesBy: seriesColumns.length > 0 ? seriesColumns.join(' | ') : null,
                    data: chartData,
                    imageDataUrl: dataUrl,
                },
                comment: '',
            });

            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
        } catch (error) {
            console.error('Failed to add chart to report:', error);
            alert('Failed to capture chart image. Please try again.');
        }
    };

    // Export full dataset as CSV
    const handleExportCsv = () => {
        if (!data || data.length === 0) return;

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row =>
                headers.map(header => {
                    const value = row[header];
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value ?? '';
                }).join(',')
            )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${title.replace(/\s+/g, '_').toLowerCase()}_data.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Extract column names
    const columns = useMemo(() => {
        if (!data || data.length === 0) return [];
        return Object.keys(data[0]).filter(col => !col.toLowerCase().includes('unnamed'));
    }, [data]);

    // Identify numeric and non-numeric columns
    const { numericColumns, categoricalColumns } = useMemo(() => {
        if (!data || data.length === 0) return { numericColumns: [], categoricalColumns: [] };

        const firstRow = data[0];
        const numeric: string[] = [];
        const categorical: string[] = [];

        columns.forEach(col => {
            const value = firstRow[col];
            if (typeof value === 'number' || !isNaN(Number(value))) {
                numeric.push(col);
            } else {
                categorical.push(col);
            }
        });

        return { numericColumns: numeric, categoricalColumns: categorical };
    }, [data, columns]);

    // Transform data based on seriesColumns and multiple Y-axes
    const chartData = useMemo(() => {
        if (!xAxis || yAxes.length === 0 || !data) return [];

        if (seriesColumns.length === 0) {
            // No series grouping - collect values per X-axis group, then aggregate
            const collected: Record<string, Record<string, number[]>> = {};

            data.forEach(row => {
                const xValue = String(row[xAxis]);
                if (!collected[xValue]) {
                    collected[xValue] = {};
                    yAxes.forEach(yAxis => { collected[xValue][yAxis] = []; });
                }
                yAxes.forEach(yAxis => {
                    collected[xValue][yAxis].push(Number(row[yAxis]) || 0);
                });
            });

            return Object.entries(collected).map(([xValue, metrics]) => {
                const point: Record<string, any> = { [xAxis]: xValue };
                yAxes.forEach(yAxis => {
                    point[yAxis] = aggregate(metrics[yAxis], aggregation);
                });
                return point;
            });
        }

        // Multi-column group by: combine series column values into a single key
        const collected: Record<string, Record<string, number[]>> = {};

        data.forEach(row => {
            const xValue = String(row[xAxis]);
            const seriesKey = seriesColumns.map(col => String(row[col] ?? '')).join(' | ');

            if (!collected[xValue]) {
                collected[xValue] = {};
            }

            yAxes.forEach(yAxis => {
                const key = `${yAxis}_${seriesKey}`;
                if (!collected[xValue][key]) collected[xValue][key] = [];
                collected[xValue][key].push(Number(row[yAxis]) || 0);
            });
        });

        return Object.entries(collected).map(([xValue, metrics]) => {
            const point: Record<string, any> = { [xAxis]: xValue };
            Object.entries(metrics).forEach(([key, values]) => {
                point[key] = aggregate(values, aggregation);
            });
            return point;
        });
    }, [data, xAxis, yAxes, seriesColumns, aggregation]);

    // Get unique combined series values for legend
    const seriesValues = useMemo(() => {
        if (seriesColumns.length === 0 || !data) return [];
        return Array.from(new Set(
            data.map(row => seriesColumns.map(col => String(row[col] ?? '')).join(' | '))
        )).filter(Boolean);
    }, [data, seriesColumns]);

    // Get all line keys for rendering
    const lineKeys = useMemo(() => {
        if (seriesColumns.length === 0) {
            return yAxes;
        }
        const keys: string[] = [];
        yAxes.forEach(yAxis => {
            seriesValues.forEach(seriesValue => {
                keys.push(`${yAxis}_${seriesValue}`);
            });
        });
        return keys;
    }, [yAxes, seriesColumns, seriesValues]);

    const renderChart = () => {
        if (!xAxis || yAxes.length === 0) {
            return (
                <div className="h-96 flex items-center justify-center text-slate-500">
                    <div className="text-center">
                        <p className="text-4xl mb-4">📊</p>
                        <p className="font-medium">Select X-axis and at least one Y-axis metric</p>
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

    if (!data || data.length === 0) {
        return (
            <div className="glass-card">
                <div className="text-center py-16 text-slate-500">
                    <p className="text-5xl mb-4">📈</p>
                    <p className="text-lg font-medium">No Data Available</p>
                    <p className="text-sm mt-2">Run an analysis to visualize results</p>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-card">
            <div className="card-header">
                <span className="card-icon">📈</span>
                <div className="flex-1">
                    <h3 className="card-title">{title}</h3>
                    <p className="card-subtitle">Build custom visualizations from your data</p>
                </div>
                <div className="flex gap-2">
                    {showSuccess && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium text-sm flex items-center gap-2"
                        >
                            <span>✓</span>
                            <span>Added to Report!</span>
                        </motion.div>
                    )}
                    <button
                        onClick={handleAddToReport}
                        className="btn btn-success"
                        disabled={!xAxis || yAxes.length === 0}
                    >
                        <span>📝</span>
                        <span>Add to Report</span>
                    </button>
                    <button
                        onClick={handleExportCsv}
                        className="btn btn-secondary"
                    >
                        <span>📥</span>
                        <span>Export CSV</span>
                    </button>
                </div>
            </div>

            <div className="mt-6 space-y-6">
                {/* Chart Type Selection + Calculated Column Card */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                        Choose a visualization
                    </label>
                    <div className={`grid gap-3 ${sessionId ? 'grid-cols-5' : 'grid-cols-4'}`}>
                        {[
                            { type: 'line', icon: '📈', label: 'Line' },
                            { type: 'bar', icon: '📊', label: 'Bar' },
                            { type: 'area', icon: '📉', label: 'Area' },
                            { type: 'scatter', icon: '🔵', label: 'Scatter' },
                        ].map(({ type, icon, label }) => (
                            <motion.button
                                key={type}
                                onClick={() => setChartType(type as ChartType)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className={`p-4 rounded-lg border-2 transition-all ${chartType === type
                                    ? 'border-purple-500 bg-purple-50 shadow-md'
                                    : 'border-slate-200 bg-white hover:border-purple-300'
                                    }`}
                            >
                                <div className="text-3xl mb-2">{icon}</div>
                                <div className="text-sm font-medium text-slate-700">{label}</div>
                            </motion.button>
                        ))}

                        {/* Calculated Column Card — only shown when sessionId exists */}
                        {sessionId && (
                            <motion.button
                                onClick={() => setShowCalcBuilder(!showCalcBuilder)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className={`p-4 rounded-lg border-2 transition-all relative ${
                                    showCalcBuilder
                                        ? 'border-purple-500 bg-purple-50 shadow-md'
                                        : 'border-dashed border-purple-300 bg-purple-50/30 hover:border-purple-400 hover:bg-purple-50/60'
                                }`}
                            >
                                <div className="text-3xl mb-2">
                                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-purple-100 text-purple-700 text-base font-bold">
                                        fx
                                    </span>
                                </div>
                                <div className="text-sm font-medium text-purple-700">
                                    {showCalcBuilder ? 'Hide Builder' : '+ Column'}
                                </div>
                                {calculatedColumns.length > 0 && (
                                    <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center">
                                        {calculatedColumns.length}
                                    </span>
                                )}
                            </motion.button>
                        )}
                    </div>
                </div>

                {/* Inline Calculated Column Builder */}
                <AnimatePresence>
                    {showCalcBuilder && sessionId && onColumnApplied && onColumnRemoved && (
                        <CalculatedColumnPanel
                            sessionId={sessionId}
                            availableColumns={columns}
                            appliedColumns={calculatedColumns}
                            onColumnApplied={onColumnApplied}
                            onColumnRemoved={onColumnRemoved}
                        />
                    )}
                </AnimatePresence>

                {/* Axis Configuration */}
                <div className="grid grid-cols-3 gap-4">
                    {/* X-Axis */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            X-axis
                        </label>
                        <select
                            value={xAxis}
                            onChange={(e) => setXAxis(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="">Select a field</option>
                            {columns.map((col) => (
                                <option key={col} value={col}>
                                    {col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                </option>
                            ))}
                        </select>
                        {xAxis && (
                            <p className="mt-1 text-xs text-slate-500">
                                {categoricalColumns.includes(xAxis) ? '📝 Categorical' : '🔢 Numeric'}
                            </p>
                        )}
                    </div>

                    {/* Y-Axes (Multiple Selection with Pills) */}
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Y-axis Metrics {yAxes.length > 0 && (
                                <span className="text-xs text-purple-600 ml-2">
                                    ({yAxes.length} selected)
                                </span>
                            )}
                        </label>
                        <div className="border border-slate-300 rounded-lg p-4 min-h-[100px] max-h-64 overflow-y-auto bg-white">
                            <div className="flex flex-wrap gap-3">
                                {numericColumns.map((col) => {
                                    const isSelected = yAxes.includes(col);
                                    const isCalc = calculatedColumns.includes(col);
                                    return (
                                        <motion.button
                                            key={col}
                                            onClick={() => {
                                                if (isSelected) {
                                                    setYAxes(yAxes.filter(y => y !== col));
                                                } else {
                                                    setYAxes([...yAxes, col]);
                                                }
                                            }}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            className={`
                                                inline-flex items-center gap-2 px-4 py-2
                                                text-sm font-semibold transition-all whitespace-nowrap
                                                rounded-full border
                                                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white
                                                ${isSelected
                                                    ? isCalc
                                                        ? 'bg-purple-50 text-purple-800 border-purple-300 hover:bg-purple-100'
                                                        : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                                                    : isCalc
                                                        ? 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50 hover:border-purple-300'
                                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-purple-300'
                                                }
                                            `}
                                        >
                                            {isSelected && <span>✓</span>}
                                            {isCalc && (
                                                <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-1 rounded">fx</span>
                                            )}
                                            <span>{col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </div>
                        {yAxes.length === 0 && (
                            <p className="mt-1 text-xs text-amber-600">
                                Click metrics to add them to the chart
                            </p>
                        )}
                    </div>

                    {/* Group By (Multi-column Series) */}
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Group By (Series)
                            {seriesColumns.length > 0 && (
                                <span className="text-xs text-teal-600 ml-2">
                                    ({seriesColumns.length} column{seriesColumns.length > 1 ? 's' : ''} · {seriesValues.length} groups)
                                </span>
                            )}
                        </label>
                        <div className="border border-slate-300 rounded-lg p-3 min-h-[60px] max-h-40 overflow-y-auto bg-white">
                            {categoricalColumns.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {categoricalColumns.map((col) => {
                                        const isSelected = seriesColumns.includes(col);
                                        return (
                                            <motion.button
                                                key={col}
                                                onClick={() => {
                                                    if (isSelected) {
                                                        setSeriesColumns(seriesColumns.filter(s => s !== col));
                                                    } else {
                                                        setSeriesColumns([...seriesColumns, col]);
                                                    }
                                                }}
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full border transition-all ${
                                                    isSelected
                                                        ? 'bg-teal-50 text-teal-800 border-teal-400 shadow-sm'
                                                        : 'bg-white text-slate-700 border-slate-200 hover:border-teal-300 hover:bg-teal-50/40'
                                                }`}
                                            >
                                                {isSelected && <span className="text-teal-600">✓</span>}
                                                <span>{col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                                            </motion.button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground py-1">No categorical columns available</p>
                            )}
                        </div>
                        {seriesColumns.length > 1 && (
                            <p className="mt-1 text-xs text-teal-600">
                                Groups combined as: {seriesColumns.join(' × ')}
                            </p>
                        )}
                        {seriesColumns.length === 0 && categoricalColumns.length > 0 && (
                            <p className="mt-1 text-xs text-slate-400">
                                Click columns to group data into series
                            </p>
                        )}
                    </div>

                    {/* Aggregation */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Aggregation
                        </label>
                        <select
                            value={aggregation}
                            onChange={(e) => setAggregation(e.target.value as AggregationType)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            {AGG_OPTIONS.map(({ value, label }) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Chart Display */}
                <div ref={chartRef} className="bg-white rounded-lg border border-slate-200 p-6">
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
                                <strong>Y:</strong> {yAxes.map(y => y.replace(/_/g, ' ')).join(', ')}
                            </span>
                            <span>
                                <strong>Agg:</strong> {AGG_OPTIONS.find(o => o.value === aggregation)?.label}
                            </span>
                            {seriesColumns.length > 0 && (
                                <span>
                                    <strong>Group By:</strong> {seriesColumns.join(' × ')} ({seriesValues.length} groups)
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-slate-500">
                            {chartData.length} data points × {lineKeys.length} lines
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
