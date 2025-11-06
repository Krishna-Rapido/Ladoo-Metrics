import { useMemo, useState } from 'react';

const BASE_METRICS = [
    'ao_days',
    'online_days',
    'gross_days',
    'accepted_days',
    'net_days',
    'total_lh',
    'dapr',
];

const RATIO_METRICS = [
    'dapr',
    'ao_days2online_days',
    'ao_days2gross_days',
    'ao_days2accepted_days',
    'ao_days2net_days',
    'online_days2gross_days',
    'online_days2accepted_days',
    'online_days2net_days',
    'gross_days2accepted_days',
    'gross_days2net_days',
    'accepted_days2net_days',
];

export function MetricBar({
    selected,
    onChange,
    onPlot,
    additionalMetrics = [],
    onAdditionalMetricsChange,
    aggByMetric = {},
    onAggChange,
    categoricalColumns = [],
    seriesBreakout = '',
    onSeriesBreakoutChange,
}: {
    selected: string[];
    onChange: (next: string[]) => void;
    onPlot: () => void;
    additionalMetrics?: string[];
    onAdditionalMetricsChange?: (metrics: string[]) => void;
    aggByMetric?: Record<string, 'sum' | 'mean' | 'count'>;
    onAggChange?: (metric: string, agg: 'sum' | 'mean' | 'count') => void;
    categoricalColumns?: string[];
    seriesBreakout?: string;
    onSeriesBreakoutChange?: (col: string) => void;
}) {
    const [current, setCurrent] = useState<string>(BASE_METRICS[0]);
    const options = useMemo(() => ({
        base: BASE_METRICS,
        ratios: RATIO_METRICS,
        additional: additionalMetrics
    }), [additionalMetrics]);

    function addMetric(metric: string) {
        if (!metric) return;
        if (selected.includes(metric)) return;
        onChange([...selected, metric]);
    }

    function removeMetric(metric: string) {
        onChange(selected.filter((m) => m !== metric));
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
                <select
                    className="glass-select"
                    style={{ minWidth: '200px' }}
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                >
                    <optgroup label="Base Metrics">
                        {options.base.map((m) => (
                            <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
                        ))}
                    </optgroup>
                    <optgroup label="Ratio Metrics">
                        {options.ratios.map((m) => (
                            <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
                        ))}
                    </optgroup>
                    {options.additional.length > 0 && (
                        <optgroup label="Additional Metrics">
                            {options.additional.map((m) => (
                                <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
                            ))}
                        </optgroup>
                    )}
                </select>
                <button
                    className="btn btn-secondary"
                    onClick={() => addMetric(current)}
                    title="Add metric to selection"
                    disabled={!current || selected.includes(current)}
                >
                    + Add Metric
                </button>
            </div>

            {/* Additional Metrics Section */}
            {additionalMetrics.length > 0 && (
                <div>
                    <label className="input-label">Additional Metrics from Available List</label>
                    <div className="metric-pills">
                        {additionalMetrics.map((m) => (
                            <span key={m} className="metric-pill" style={{ background: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.2)', color: '#15803d' }}>
                                {m.replace(/_/g, ' ')}
                                <div className="flex items-center gap-2 ml-2">
                                    <select
                                        className="glass-select"
                                        style={{ minWidth: '120px' }}
                                        value={aggByMetric[m] ?? 'sum'}
                                        onChange={(e) => onAggChange && onAggChange(m, e.target.value as 'sum' | 'mean' | 'count')}
                                        title="Aggregation"
                                    >
                                        <option value="sum">sum</option>
                                        <option value="mean">mean</option>
                                        <option value="count">count</option>
                                    </select>
                                    <button
                                        className="text-xs px-1 py-0.5 bg-green-200 hover:bg-green-300 text-green-800 rounded transition-colors"
                                        onClick={() => addMetric(m)}
                                        disabled={selected.includes(m)}
                                        title="Add to plotting selection"
                                    >
                                        +
                                    </button>
                                    <button
                                        className="metric-pill-remove"
                                        onClick={() => {
                                            // Remove from additional metrics
                                            if (onAdditionalMetricsChange) {
                                                const newAdditional = additionalMetrics.filter(metric => metric !== m);
                                                onAdditionalMetricsChange(newAdditional);
                                            }
                                            // Also remove from selected if it's there
                                            removeMetric(m);
                                        }}
                                        aria-label={`Remove ${m}`}
                                    >
                                        ×
                                    </button>
                                </div>
                            </span>
                        ))}
                    </div>

                    {/* Bulk Actions for Additional Metrics */}
                    <div className="flex gap-2 mt-3">
                        <button
                            className="btn btn-secondary"
                            onClick={() => {
                                const metricsToAdd = additionalMetrics.filter(m => !selected.includes(m));
                                onChange([...selected, ...metricsToAdd]);
                            }}
                            disabled={additionalMetrics.every(m => selected.includes(m))}
                            title="Add all additional metrics to plotting selection"
                        >
                            Add All to Selection
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => {
                                if (onAdditionalMetricsChange) {
                                    onAdditionalMetricsChange([]);
                                }
                                // Remove any additional metrics from selected as well
                                const newSelected = selected.filter(m => !additionalMetrics.includes(m));
                                onChange(newSelected);
                            }}
                            title="Clear all additional metrics"
                        >
                            Clear All Additional
                        </button>
                    </div>
                </div>
            )}

            {selected.length > 0 && (
                <div>
                    <label className="input-label">Selected Metrics for Plotting</label>
                    <div className="metric-pills">
                        {selected.map((m) => (
                            <span key={m} className="metric-pill">
                                {m.replace(/_/g, ' ')}
                                <button
                                    className="metric-pill-remove"
                                    onClick={() => removeMetric(m)}
                                    aria-label={`Remove ${m}`}
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Series Breakout Selector */}
            {categoricalColumns.length > 0 && (
                <div>
                    <label className="input-label">Series Breakout (Group By)</label>
                    <div className="flex items-center gap-3">
                        <select
                            className="glass-select"
                            style={{ minWidth: '250px' }}
                            value={seriesBreakout}
                            onChange={(e) => onSeriesBreakoutChange && onSeriesBreakoutChange(e.target.value)}
                        >
                            <option value="">None (No Group By)</option>
                            {categoricalColumns.map((col) => (
                                <option key={col} value={col}>
                                    {col.replace(/_/g, ' ')}
                                </option>
                            ))}
                        </select>
                        {seriesBreakout && (
                            <button
                                className="btn btn-secondary"
                                onClick={() => onSeriesBreakoutChange && onSeriesBreakoutChange('')}
                                title="Clear series breakout"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    {seriesBreakout && (
                        <p className="mt-2 text-sm text-purple-600">
                            📊 Chart will show separate lines for each unique value in "{seriesBreakout.replace(/_/g, ' ')}"
                        </p>
                    )}
                </div>
            )}

            <div className="action-bar">
                {selected.length > 0 && (
                    <button
                        className="btn btn-secondary"
                        onClick={() => onChange([])}
                        title="Clear all selected metrics"
                    >
                        Clear All
                    </button>
                )}
                <button
                    className="btn btn-primary"
                    onClick={() => onPlot()}
                    disabled={selected.length === 0}
                    title="Generate charts for selected metrics"
                >
                    {selected.length === 0 ? 'Select Metrics to Plot' : `Plot ${selected.length} Metric${selected.length > 1 ? 's' : ''}`}
                </button>
            </div>
        </div>
    );
}
