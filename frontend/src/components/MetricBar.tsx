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
}: {
    selected: string[];
    onChange: (next: string[]) => void;
    onPlot: () => void;
}) {
    const [current, setCurrent] = useState<string>(BASE_METRICS[0]);
    const options = useMemo(() => ({ base: BASE_METRICS, ratios: RATIO_METRICS }), []);

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

            {selected.length > 0 && (
                <div>
                    <label className="input-label">Selected Metrics</label>
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
                    onClick={onPlot}
                    disabled={selected.length === 0}
                    title="Generate charts for selected metrics"
                >
                    {selected.length === 0 ? 'Select Metrics to Plot' : `Plot ${selected.length} Metric${selected.length > 1 ? 's' : ''}`}
                </button>
            </div>
        </div>
    );
}
