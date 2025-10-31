import { useEffect, useState } from 'react';
import { getMeta } from '../lib/api';
import type { DateRange, MetaResponse } from '../lib/api';

export type FiltersState = {
    pre_period?: DateRange;
    post_period?: DateRange;
    test_cohort?: string;
    control_cohort?: string;
    metric?: string;
    metrics?: string[]; // multi-select
    confirmed?: string; // legacy single confirmation filter
    test_confirmed?: string; // per-test confirmation filter
    control_confirmed?: string; // per-control confirmation filter
    // Captain-level aggregation fields
    captain_group_by?: string; // e.g., consistency_segment
    captain_metrics?: Array<{ column: string; agg_func: 'sum' | 'mean' | 'count' | 'nunique' | 'median' | 'std' | 'min' | 'max' }>; // metrics to aggregate
};

export function Filters({
    value,
    onChange,
    onApply,
    onAddMetricsToSelection,
    onApplyCaptainLevel
}: {
    value: FiltersState;
    onChange: (v: FiltersState) => void;
    onApply?: () => void;
    onAddMetricsToSelection?: (metrics: string[]) => void;
    onApplyCaptainLevel?: () => void;
}) {
    const [meta, setMeta] = useState<MetaResponse | null>(null);
    const [captainMetricColumn, setCaptainMetricColumn] = useState<string>('');
    const [captainMetricAgg, setCaptainMetricAgg] = useState<'sum' | 'mean' | 'count' | 'nunique' | 'median' | 'std' | 'min' | 'max'>('nunique');

    useEffect(() => {
        getMeta().then(setMeta).catch(() => { });
    }, []);

    const cohorts = meta?.cohorts ?? [];
    const metrics = meta?.metrics ?? [];

    // Add metric to captain-level aggregation list
    const addCaptainMetric = () => {
        if (!captainMetricColumn) return;
        const newMetric = { column: captainMetricColumn, agg_func: captainMetricAgg };
        const existing = value.captain_metrics || [];
        onChange({
            ...value,
            captain_metrics: [...existing, newMetric]
        });
        setCaptainMetricColumn('');
    };

    // Remove metric from captain-level aggregation list
    const removeCaptainMetric = (index: number) => {
        const updated = [...(value.captain_metrics || [])];
        updated.splice(index, 1);
        onChange({ ...value, captain_metrics: updated });
    };

    return (
        <div className="space-y-8">
            {/* Date Range Filters Section */}
            <section>
                <div className="card-header">
                    <span className="card-icon">🗓️</span>
                    <div>
                        <h2 className="card-title">Date Range Filters</h2>
                        <p className="card-subtitle">Set the pre and post period dates for your cohort comparison</p>
                    </div>
                </div>
                <div className="grid-2">
                    <div className="input-group">
                        <label className="input-label">Pre Period Start Date</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            placeholder="20250804"
                            className="glass-input"
                            value={value.pre_period?.start_date ?? '20250804'}
                            onChange={(e) => onChange({ ...value, pre_period: { ...value.pre_period, start_date: e.target.value } })}
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Pre Period End Date</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            placeholder="20250913"
                            className="glass-input"
                            value={value.pre_period?.end_date ?? '20250913'}
                            onChange={(e) => onChange({ ...value, pre_period: { ...value.pre_period, end_date: e.target.value } })}
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Post Period Start Date</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            placeholder="20250914"
                            className="glass-input"
                            value={value.post_period?.start_date ?? '20250914'}
                            onChange={(e) => onChange({ ...value, post_period: { ...value.post_period, start_date: e.target.value } })}
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Post Period End Date</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            placeholder="20251027"
                            className="glass-input"
                            value={value.post_period?.end_date ?? '20251027'}
                            onChange={(e) => onChange({ ...value, post_period: { ...value.post_period, end_date: e.target.value } })}
                        />
                    </div>
                </div>
            </section>

            {/* Cohort Selection Section */}
            <section>
                <div className="card-header">
                    <span className="card-icon">👥</span>
                    <div>
                        <h2 className="card-title">Cohort Selection</h2>
                        <p className="card-subtitle">Choose your test and control cohorts for comparison</p>
                    </div>
                </div>
                <div className="grid-2">
                    <div className="input-group">
                        <label className="input-label">Test Cohort</label>
                        <select
                            className="glass-select"
                            value={value.test_cohort ?? ''}
                            onChange={(e) => onChange({ ...value, test_cohort: e.target.value })}
                        >
                            <option value="">Select test cohort...</option>
                            {cohorts.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                    <div className="input-group">
                        <label className="input-label">Control Cohort</label>
                        <select
                            className="glass-select"
                            value={value.control_cohort ?? ''}
                            onChange={(e) => onChange({ ...value, control_cohort: e.target.value })}
                        >
                            <option value="">Select control cohort...</option>
                            {cohorts.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Metrics Multi-select */}
                <div className="input-group">
                    <label className="input-label">Available Metrics</label>
                    <select
                        multiple
                        className="glass-select"
                        style={{ minHeight: '120px' }}
                        value={value.metrics ?? []}
                        onChange={(e) => {
                            const opts = Array.from(e.target.selectedOptions).map(o => o.value);
                            onChange({ ...value, metrics: opts });
                        }}
                    >
                        {metrics.map((m) => (
                            <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
                        ))}
                    </select>

                    {/* Selected Metrics Pills */}
                    {value.metrics && value.metrics.length > 0 && (
                        <div className="space-y-3 mt-4">
                            <div className="metric-pills">
                                {value.metrics.map((m) => (
                                    <span key={m} className="metric-pill">
                                        {m.replace(/_/g, ' ')}
                                        <button
                                            className="metric-pill-remove"
                                            onClick={() => onChange({
                                                ...value,
                                                metrics: value.metrics?.filter(metric => metric !== m)
                                            })}
                                            aria-label={`Remove ${m}`}
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>

                            {/* Add to Selection Button */}
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => {
                                        if (onAddMetricsToSelection && value.metrics) {
                                            onAddMetricsToSelection(value.metrics);
                                            onChange({ ...value, metrics: [] }); // Clear selection after adding
                                        }
                                    }}
                                    disabled={!value.metrics || value.metrics.length === 0}
                                >
                                    Add {value.metrics?.length || 0} Metric{(value.metrics?.length || 0) !== 1 ? 's' : ''} to Selection
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Confirmation Filters */}
                <div className="grid-2">
                    <div className="input-group">
                        <label className="input-label">Test Confirmation Filter (Optional)</label>
                        <select
                            className="glass-select"
                            value={value.test_confirmed ?? ''}
                            onChange={(e) => onChange({ ...value, test_confirmed: e.target.value })}
                        >
                            <option value="">No Confirmation Filter</option>
                            <option value="visitedCaps">Visited Caps</option>
                            <option value="exploredCaptains">Explored Captains</option>
                            <option value="exploredCaptains_Subs">Explored Captains - Subs</option>
                            <option value="exploredCaptains_EPKM">Explored Captains - EPKM</option>
                            <option value="exploredCaptains_FlatCommission">Explored Captains - Flat Commission</option>
                            <option value="exploredCaptains_CM">Explored Captains - CM</option>
                            <option value="confirmedCaptains">Confirmed Captains</option>
                            <option value="confirmedCaptains_Subs">Confirmed Captains - Subs</option>
                            <option value="confirmedCaptains_Subs_purchased">Confirmed Captains - Subs Purchased</option>
                            <option value="confirmedCaptains_Subs_purchased_weekend">Confirmed Captains - Subs Purchased Weekend</option>
                            <option value="confirmedCaptains_EPKM">Confirmed Captains - EPKM</option>
                            <option value="confirmedCaptains_FlatCommission">Confirmed Captains - Flat Commission</option>
                            <option value="confirmedCaptains_CM">Confirmed Captains - CM</option>
                            <option value="clickedCaptain">Clicked Captains - CT </option>
                            <option value="count_captain_pitch_centre_card_clicked_city">Clicked Captains - Pitch Center</option>
                            <option value="count_captain_pitch_centre_card_visible_city">Viewed Captains - Pitch Center</option>
                        </select>
                    </div>
                    <div className="input-group">
                        <label className="input-label">Control Confirmation Filter (Optional)</label>
                        <select
                            className="glass-select"
                            value={value.control_confirmed ?? ''}
                            onChange={(e) => onChange({ ...value, control_confirmed: e.target.value })}
                        >
                            <option value="">No Confirmation Filter</option>
                            <option value="visitedCaps">Visited Caps</option>
                            <option value="exploredCaptains">Explored Captains</option>
                            <option value="exploredCaptains_Subs">Explored Captains - Subs</option>
                            <option value="exploredCaptains_EPKM">Explored Captains - EPKM</option>
                            <option value="exploredCaptains_FlatCommission">Explored Captains - Flat Commission</option>
                            <option value="exploredCaptains_CM">Explored Captains - CM</option>
                            <option value="confirmedCaptains">Confirmed Captains</option>
                            <option value="confirmedCaptains_Subs">Confirmed Captains - Subs</option>
                            <option value="confirmedCaptains_Subs_purchased">Confirmed Captains - Subs Purchased</option>
                            <option value="confirmedCaptains_Subs_purchased_weekend">Confirmed Captains - Subs Purchased Weekend</option>
                            <option value="confirmedCaptains_EPKM">Confirmed Captains - EPKM</option>
                            <option value="confirmedCaptains_FlatCommission">Confirmed Captains - Flat Commission</option>
                            <option value="confirmedCaptains_CM">Confirmed Captains - CM</option>
                            <option value="clickedCaptain">Clicked Captains</option>
                        </select>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="action-bar">
                    <button
                        className="btn btn-secondary"
                        onClick={() => {
                            onChange({
                                pre_period: { start_date: '20250804', end_date: '20250913' },
                                post_period: { start_date: '20250914', end_date: '20250928' },
                                test_cohort: '',
                                control_cohort: '',
                                metrics: [],
                                confirmed: '',
                                captain_group_by: '',
                                captain_metrics: []
                            });
                        }}
                    >
                        Clear Filters
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={() => onApply?.()}
                        disabled={!value.test_cohort || !value.control_cohort}
                    >
                        Apply Filters
                    </button>
                </div>
            </section>

            {/* Captain-Level Aggregation Section */}
            <section>
                <div className="card-header">
                    <span className="card-icon">🎯</span>
                    <div>
                        <h2 className="card-title">Captain-Level Aggregation</h2>
                        <p className="card-subtitle">Analyze metrics grouped by categorical segments (e.g., consistency_segment)</p>
                    </div>
                </div>

                {/* Group By Column */}
                <div className="input-group">
                    <label className="input-label">Group By Column</label>
                    <select
                        className="glass-select"
                        value={value.captain_group_by ?? ''}
                        onChange={(e) => onChange({ ...value, captain_group_by: e.target.value })}
                    >
                        <option value="">Select grouping column...</option>
                        {metrics.map((m) => (
                            <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
                        ))}
                    </select>
                </div>

                {/* Add Metrics to Aggregate */}
                <div className="space-y-3">
                    <label className="input-label">Metrics to Aggregate</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <select
                            className="glass-select"
                            value={captainMetricColumn}
                            onChange={(e) => setCaptainMetricColumn(e.target.value)}
                        >
                            <option value="">Select metric...</option>
                            {metrics.map((m) => (
                                <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
                            ))}
                        </select>
                        <select
                            className="glass-select"
                            value={captainMetricAgg}
                            onChange={(e) => setCaptainMetricAgg(e.target.value as 'sum' | 'mean' | 'count' | 'nunique' | 'median' | 'std' | 'min' | 'max')}
                        >
                            <option value="sum">Sum</option>
                            <option value="mean">Mean</option>
                            <option value="count">Count</option>
                            <option value="nunique">Unique Count</option>
                            <option value="median">Median</option>
                            <option value="std">Std Dev</option>
                            <option value="min">Min</option>
                            <option value="max">Max</option>
                        </select>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={addCaptainMetric}
                            disabled={!captainMetricColumn}
                        >
                            Add Metric
                        </button>
                    </div>

                    {/* Display selected metrics */}
                    {value.captain_metrics && value.captain_metrics.length > 0 && (
                        <div className="space-y-2 mt-3">
                            <p className="text-sm font-medium text-gray-700">Selected Metrics:</p>
                            <div className="space-y-2">
                                {value.captain_metrics.map((m, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-blue-50 p-2 rounded">
                                        <span className="text-sm">
                                            {m.column.replace(/_/g, ' ')} ({m.agg_func})
                                        </span>
                                        <button
                                            className="text-red-600 hover:text-red-800 font-bold text-lg"
                                            onClick={() => removeCaptainMetric(idx)}
                                            aria-label="Remove metric"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Apply Captain-Level Analysis Button */}
                <div className="flex justify-end mt-4">
                    <button
                        className="btn btn-primary"
                        onClick={() => onApplyCaptainLevel?.()}
                        disabled={
                            !value.test_cohort ||
                            !value.control_cohort ||
                            !value.captain_group_by ||
                            !value.captain_metrics ||
                            value.captain_metrics.length === 0
                        }
                    >
                        Generate Captain-Level Charts
                    </button>
                </div>
            </section>
        </div>
    );
}
