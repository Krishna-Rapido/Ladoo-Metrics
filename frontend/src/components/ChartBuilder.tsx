import { useState, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
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

type ChartType = 'line' | 'bar' | 'area' | 'scatter';

interface ChartBuilderProps {
    data: Record<string, any>[];
    title?: string;
}

const COLORS = [
    '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#84cc16',
];

export function ChartBuilder({ data, title = 'Visualization' }: ChartBuilderProps) {
    const [chartType, setChartType] = useState<ChartType>('line');
    const [xAxis, setXAxis] = useState<string>('');
    const [yAxes, setYAxes] = useState<string[]>([]);
    const [series, setSeries] = useState<string>('');
    const { addItem } = useReport();
    const [showSuccess, setShowSuccess] = useState(false);
    const chartRef = useRef<HTMLDivElement>(null);

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
            // Capture the chart as an image
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
                    seriesBy: series || null,
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

        // Convert to CSV
        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row =>
                headers.map(header => {
                    const value = row[header];
                    // Escape values with commas or quotes
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value ?? '';
                }).join(',')
            )
        ].join('\n');

        // Download file
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

    // Transform data based on series selection and multiple Y-axes
    const chartData = useMemo(() => {
        if (!xAxis || yAxes.length === 0 || !data) return [];

        if (!series) {
            // No series grouping - aggregate by X-axis for multiple metrics
            const grouped: Record<string, any> = {};

            data.forEach(row => {
                const xValue = String(row[xAxis]);
                if (!grouped[xValue]) {
                    grouped[xValue] = { [xAxis]: xValue };
                    yAxes.forEach(yAxis => {
                        grouped[xValue][yAxis] = 0;
                    });
                }
                yAxes.forEach(yAxis => {
                    grouped[xValue][yAxis] += Number(row[yAxis]) || 0;
                });
            });

            return Object.values(grouped);
        }

        // Group by series - each metric × series combination becomes a line
        const grouped: Record<string, Record<string, any>> = {};

        data.forEach(row => {
            const xValue = String(row[xAxis]);
            const seriesValue = String(row[series]);

            if (!grouped[xValue]) {
                grouped[xValue] = { [xAxis]: xValue };
            }

            yAxes.forEach(yAxis => {
                const yValue = Number(row[yAxis]) || 0;
                const key = `${yAxis}_${seriesValue}`;
                grouped[xValue][key] = (grouped[xValue][key] || 0) + yValue;
            });
        });

        return Object.values(grouped);
    }, [data, xAxis, yAxes, series]);

    // Get unique series values for legend
    const seriesValues = useMemo(() => {
        if (!series || !data) return [];
        return Array.from(new Set(data.map(row => String(row[series])))).filter(Boolean);
    }, [data, series]);

    // Get all line keys for rendering
    const lineKeys = useMemo(() => {
        if (!series) {
            // No series - just the Y-axis metrics
            return yAxes;
        }
        // With series - create combinations of metric_seriesValue
        const keys: string[] = [];
        yAxes.forEach(yAxis => {
            seriesValues.forEach(seriesValue => {
                keys.push(`${yAxis}_${seriesValue}`);
            });
        });
        return keys;
    }, [yAxes, series, seriesValues]);

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
                {/* Chart Type Selection */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                        Choose a visualization
                    </label>
                    <div className="grid grid-cols-4 gap-3">
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
                    </div>
                </div>

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
                                                    ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-purple-300'
                                                }
                                            `}
                                        >
                                            {isSelected && <span>✓</span>}
                                            <span>{col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </div>
                        {yAxes.length === 0 && (
                            <p className="mt-1 text-xs text-amber-600">
                                💡 Click metrics to add them to the chart
                            </p>
                        )}
                    </div>

                    {/* Series (Group By) */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Series (Group By)
                        </label>
                        <select
                            value={series}
                            onChange={(e) => setSeries(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="">None</option>
                            {categoricalColumns.map((col) => (
                                <option key={col} value={col}>
                                    {col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                </option>
                            ))}
                        </select>
                        {series && (
                            <p className="mt-1 text-xs text-purple-600">
                                📊 {seriesValues.length} series
                            </p>
                        )}
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
                            {series && (
                                <span>
                                    <strong>Series:</strong> {series.replace(/_/g, ' ')} ({seriesValues.length} groups)
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

