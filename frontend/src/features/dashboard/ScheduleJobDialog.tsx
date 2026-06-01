import { useState, useEffect } from 'react';
import { Clock, Loader2, Zap } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
    createScheduledJob,
    CRON_PRESETS,
    type ScheduledJobCreate,
} from '@/lib/schedulerApi';
import { useAuth } from '@/contexts/AuthContext';

interface ScheduleJobDialogProps {
    dashboardType: string;
    dashboardName: string;
    params: Record<string, unknown>;
    prestoUsername: string;
    customDashboardId?: string | null;
    onCreated?: () => void;
}

/** Date-related param keys that get dynamic date presets */
const DATE_PARAM_KEYS = new Set(['start_date', 'end_date']);

const DATE_PRESETS = [
    { label: 'current_date', value: 'current_date' },
    { label: 'current_date - 7', value: 'current_date - 7' },
    { label: 'current_date - 14', value: 'current_date - 14' },
    { label: 'current_date - 30', value: 'current_date - 30' },
    { label: 'current_date - 60', value: 'current_date - 60' },
    { label: 'current_date - 90', value: 'current_date - 90' },
    { label: 'Custom value', value: '__custom__' },
] as const;

/**
 * For custom dashboards, params are nested: { parameters: {...}, parameter_types: {...} }
 * For built-in dashboards, params are flat: { city: "...", start_date: "...", ... }
 * This helper extracts the editable fields.
 */
function extractEditableParams(params: Record<string, unknown>, isCustom: boolean): Record<string, string> {
    if (isCustom && params.parameters && typeof params.parameters === 'object') {
        const inner = params.parameters as Record<string, unknown>;
        const result: Record<string, string> = {};
        for (const [k, v] of Object.entries(inner)) {
            result[k] = String(v ?? '');
        }
        return result;
    }
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
        result[k] = String(v ?? '');
    }
    return result;
}

export function ScheduleJobDialog({
    dashboardType,
    dashboardName,
    params,
    prestoUsername,
    customDashboardId,
    onCreated,
}: ScheduleJobDialogProps) {
    const { user, session } = useAuth();
    const token = session?.access_token;
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isCustom = dashboardType === 'custom';

    const [name, setName] = useState(dashboardName);
    const [cronPreset, setCronPreset] = useState('0 6 * * *');
    const [customCron, setCustomCron] = useState('');
    const [timezone] = useState('Asia/Kolkata');
    const [ttlHours, setTtlHours] = useState(24);
    const [timeoutSeconds, setTimeoutSeconds] = useState(300);

    // Editable params — initialize from incoming params
    const [editableParams, setEditableParams] = useState<Record<string, string>>({});
    // Track which date params are using presets vs custom
    const [datePresets, setDatePresets] = useState<Record<string, string>>({});

    useEffect(() => {
        if (open) {
            const init = extractEditableParams(params, isCustom);
            const presets: Record<string, string> = {};

            // Default date params to dynamic expressions
            for (const k of Object.keys(init)) {
                if (k === 'end_date') {
                    init[k] = 'current_date';
                    presets[k] = 'current_date';
                } else if (k === 'start_date') {
                    init[k] = 'current_date - 30';
                    presets[k] = 'current_date - 30';
                }
            }

            setEditableParams(init);
            setDatePresets(presets);
            setName(dashboardName);
            setError(null);
        }
    }, [open, params, dashboardName, isCustom]);

    const effectiveCron = cronPreset === '__custom__' ? customCron : cronPreset;

    const updateParam = (key: string, value: string) => {
        setEditableParams(prev => ({ ...prev, [key]: value }));
    };

    const updateDatePreset = (key: string, preset: string) => {
        if (preset === '__custom__') {
            setDatePresets(prev => ({ ...prev, [key]: '__custom__' }));
        } else {
            setDatePresets(prev => ({ ...prev, [key]: preset }));
            setEditableParams(prev => ({ ...prev, [key]: preset }));
        }
    };

    const handleCreate = async () => {
        if (!user?.id) return;
        if (!effectiveCron) {
            setError('Please select or enter a cron expression');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            let finalParams: Record<string, unknown>;

            if (isCustom) {
                // Reconstruct nested structure for custom dashboards
                const editedValues: Record<string, unknown> = {};
                for (const [k, v] of Object.entries(editableParams)) {
                    editedValues[k] = v;
                }
                finalParams = {
                    parameters: editedValues,
                    parameter_types: (params.parameter_types as Record<string, unknown>) ?? {},
                };
            } else {
                // Flat params for built-in dashboards
                finalParams = {};
                for (const [k, v] of Object.entries(editableParams)) {
                    if (!DATE_PARAM_KEYS.has(k) && v !== '' && !isNaN(Number(v)) && !v.includes(' ')) {
                        finalParams[k] = Number(v);
                    } else {
                        finalParams[k] = v;
                    }
                }
            }

            const payload: ScheduledJobCreate = {
                dashboard_type: dashboardType,
                custom_dashboard_id: customDashboardId ?? undefined,
                params: finalParams,
                presto_username: prestoUsername,
                cron_expression: effectiveCron,
                timezone,
                name,
                timeout_seconds: timeoutSeconds,
                result_ttl_seconds: ttlHours * 3600,
                enabled: true,
            };

            await createScheduledJob(payload, user.id, token);
            setOpen(false);
            onCreated?.();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to create job');
        } finally {
            setLoading(false);
        }
    };

    const isDynamic = (key: string) => {
        const val = editableParams[key];
        return val && /^current_date/i.test(val.trim());
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Schedule
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-amber-500" />
                        Schedule Dashboard Precomputation
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                    {/* Job Name */}
                    <div className="space-y-1.5">
                        <Label htmlFor="sched-name">Name</Label>
                        <Input
                            id="sched-name"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. FE2Net Delhi Auto Daily"
                        />
                    </div>

                    {/* Schedule */}
                    <div className="space-y-1.5">
                        <Label>Schedule</Label>
                        <Select value={cronPreset} onValueChange={v => { setCronPreset(v); if (v !== '__custom__') setCustomCron(''); }}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select schedule" />
                            </SelectTrigger>
                            <SelectContent>
                                {CRON_PRESETS.map(p => (
                                    <SelectItem key={p.value || 'custom'} value={p.value || '__custom__'}>
                                        {p.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {cronPreset === '__custom__' && (
                            <Input
                                placeholder="0 6 * * * (5-field cron)"
                                value={customCron}
                                onChange={e => setCustomCron(e.target.value)}
                                className="mt-1.5"
                            />
                        )}
                    </div>

                    {/* TTL + Timeout */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label>Cache TTL (hours)</Label>
                            <Input
                                type="number"
                                min={1}
                                max={168}
                                value={ttlHours}
                                onChange={e => setTtlHours(Number(e.target.value))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Timeout (seconds)</Label>
                            <Input
                                type="number"
                                min={30}
                                max={600}
                                value={timeoutSeconds}
                                onChange={e => setTimeoutSeconds(Number(e.target.value))}
                            />
                        </div>
                    </div>

                    {/* Editable Parameters */}
                    <div className="space-y-2">
                        <Label>Parameters</Label>
                        <div className="rounded-md border p-3 space-y-3">
                            {Object.entries(editableParams).map(([key, value]) => {
                                const isDateParam = DATE_PARAM_KEYS.has(key);

                                return (
                                    <div key={key} className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium text-muted-foreground min-w-[100px]">{key}</span>
                                            {isDynamic(key) && (
                                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0">dynamic</Badge>
                                            )}
                                        </div>
                                        {isDateParam ? (
                                            <div className="flex gap-2">
                                                <Select
                                                    value={datePresets[key] || '__custom__'}
                                                    onValueChange={v => updateDatePreset(key, v)}
                                                >
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {DATE_PRESETS.map(p => (
                                                            <SelectItem key={p.value} value={p.value} className="text-xs">
                                                                {p.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {datePresets[key] === '__custom__' && (
                                                    <Input
                                                        className="h-8 text-xs font-mono flex-1"
                                                        value={value}
                                                        onChange={e => updateParam(key, e.target.value)}
                                                        placeholder="YYYYMMDD or current_date - N"
                                                    />
                                                )}
                                            </div>
                                        ) : (
                                            <Input
                                                className="h-8 text-xs font-mono"
                                                value={value}
                                                onChange={e => updateParam(key, e.target.value)}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                            Date params support dynamic expressions: <code className="bg-muted px-1 rounded">current_date</code>, <code className="bg-muted px-1 rounded">current_date - 30</code> — resolved at execution time.
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="text-sm text-destructive">{error}</div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={loading || !effectiveCron}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                            Create Schedule
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
