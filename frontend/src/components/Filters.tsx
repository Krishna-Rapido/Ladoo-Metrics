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
    confirmed?: string; // optional confirmation filter flag/value
};

export function Filters({
    value,
    onChange,
    onApply,
    onAddMetricsToSelection
}: {
    value: FiltersState;
    onChange: (v: FiltersState) => void;
    onApply?: () => void;
    onAddMetricsToSelection?: (metrics: string[]) => void;
}) {
    const [meta, setMeta] = useState<MetaResponse | null>(null);

    useEffect(() => {
        getMeta().then(setMeta).catch(() => { });
    }, []);

    const cohorts = meta?.cohorts ?? [];
    const metrics = meta?.metrics ?? [];

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
                            placeholder="20250928"
                            className="glass-input"
                            value={value.post_period?.end_date ?? '20250928'}
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

                {/* Confirmation Filter */}
                <div className="input-group">
                    <label className="input-label">Confirmation Filter (Optional)</label>
                    <select
                        className="glass-select"
                        value={value.confirmed ?? ''}
                        onChange={(e) => onChange({ ...value, confirmed: e.target.value })}
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
                                confirmed: ''
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
        </div>
    );
}
