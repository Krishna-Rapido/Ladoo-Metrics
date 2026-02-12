import { useState, useEffect } from 'react';
import { Calendar, Filter, BarChart3, Code, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { listAllFunctions, getFunction, type MetricFunction, type FunctionParameter } from '@/lib/supabase';
import { initSessionFromFunction } from '@/lib/api';

interface DiscoverSecondaryFiltersProps {
    onApply?: () => void;
    /** When true, hide the "Discover" / "Filters" header (e.g. when used inside a tab). */
    hideHeader?: boolean;
}

// Sample segments and metrics for demonstration
const defaultSegments = [
    { id: 'new-users', label: 'New Users' },
    { id: 'returning-users', label: 'Returning Users' },
    { id: 'high-value', label: 'High Value' },
    { id: 'at-risk', label: 'At Risk' },
    { id: 'churned', label: 'Churned' },
    { id: 'activated', label: 'Activated' },
];

const defaultMetrics = [
    { id: 'conversion-rate', label: 'Conversion Rate' },
    { id: 'avg-order-value', label: 'Avg. Order Value' },
    { id: 'retention-d30', label: 'Retention (Day 30)' },
    { id: 'churn-rate', label: 'Churn Rate' },
    { id: 'ltv', label: 'Lifetime Value' },
    { id: 'arpu', label: 'ARPU' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'orders', label: 'Total Orders' },
];

export function DiscoverSecondaryFilters({ onApply, hideHeader }: DiscoverSecondaryFiltersProps) {
    const { user } = useAuth();
    const username = user?.email ?? 'anonymous';

    // Start dataset from function
    const [functions, setFunctions] = useState<MetricFunction[]>([]);
    const [selectedFunctionId, setSelectedFunctionId] = useState<string | null>(null);
    const [selectedFunction, setSelectedFunction] = useState<MetricFunction | null>(null);
    const [parameterValues, setParameterValues] = useState<Record<string, string>>({});
    const [isLoadingFunctions, setIsLoadingFunctions] = useState(true);
    const [isStarting, setIsStarting] = useState(false);
    const [initSuccess, setInitSuccess] = useState<{ row_count: number; columns: string[] } | null>(null);
    const [initError, setInitError] = useState<string | null>(null);

    const [startDate, setStartDate] = useState('2024-01-01');
    const [endDate, setEndDate] = useState('2024-03-31');
    const [selectedSegments, setSelectedSegments] = useState<string[]>(['new-users', 'returning-users']);
    const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['conversion-rate', 'avg-order-value']);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setIsLoadingFunctions(true);
            try {
                const data = await listAllFunctions();
                if (!cancelled) setFunctions(data);
            } catch (err) {
                console.error('Failed to load functions:', err);
            } finally {
                if (!cancelled) setIsLoadingFunctions(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!selectedFunctionId) {
            setSelectedFunction(null);
            setParameterValues({});
            return;
        }
        let cancelled = false;
        getFunction(selectedFunctionId).then((func) => {
            if (cancelled) return;
            setSelectedFunction(func ?? null);
            if (func?.parameters) {
                const defaults: Record<string, string> = {};
                func.parameters.forEach((param: FunctionParameter) => {
                    defaults[param.name] = param.default ?? '';
                });
                setParameterValues(defaults);
            }
        });
        return () => { cancelled = true; };
    }, [selectedFunctionId]);

    const updateParameterValue = (name: string, value: string) => {
        setParameterValues((prev) => ({ ...prev, [name]: value }));
    };

    const handleRunFunctionToStartDataset = async () => {
        if (!selectedFunction) {
            setInitError('Please select a function');
            return;
        }
        setInitError(null);
        setInitSuccess(null);
        setIsStarting(true);
        try {
            const data = await initSessionFromFunction({
                code: selectedFunction.code,
                parameters: parameterValues,
                username,
            });
            setInitSuccess({ row_count: data.row_count, columns: data.columns });
        } catch (err) {
            setInitError(err instanceof Error ? err.message : 'Failed to create session from function');
        } finally {
            setIsStarting(false);
        }
    };

    const renderParameterInput = (param: FunctionParameter) => {
        const value = parameterValues[param.name] ?? '';
        if (param.type === 'select' && param.options) {
            return (
                <Select value={value} onValueChange={(v) => updateParameterValue(param.name, v)}>
                    <SelectTrigger className="h-9">
                        <SelectValue placeholder={`Select ${param.label}`} />
                    </SelectTrigger>
                    <SelectContent>
                        {param.options.map((option) => (
                            <SelectItem key={option} value={option}>
                                {option}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            );
        }
        return (
            <Input
                type={param.type === 'number' ? 'number' : 'text'}
                value={value}
                onChange={(e) => updateParameterValue(param.name, e.target.value)}
                placeholder={param.default ?? `Enter ${param.label}`}
                className="h-9"
            />
        );
    };

    const toggleSegment = (segmentId: string) => {
        setSelectedSegments((prev) =>
            prev.includes(segmentId) ? prev.filter((id) => id !== segmentId) : [...prev, segmentId]
        );
    };

    const toggleMetric = (metricId: string) => {
        setSelectedMetrics((prev) =>
            prev.includes(metricId) ? prev.filter((id) => id !== metricId) : [...prev, metricId]
        );
    };

    const clearFilters = () => {
        setStartDate('2024-01-01');
        setEndDate('2024-03-31');
        setSelectedSegments([]);
        setSelectedMetrics([]);
    };

    const handleApply = () => {
        // In a real app, this would dispatch filters to a context or make an API call
        console.log('Applying filters:', {
            startDate,
            endDate,
            selectedSegments,
            selectedMetrics,
        });
        onApply?.();
    };

    return (
        <div className="flex flex-col h-full w-full">
            {!hideHeader && (
                <div className="p-4 border-b">
                    <h2 className="text-lg font-semibold">Discover</h2>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
                        Filters
                    </p>
                </div>
            )}

            {/* Scrollable Content */}
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                    {/* Start dataset from function */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Code className="h-4 w-4 text-muted-foreground" />
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Start dataset
                            </Label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Choose a saved function to build your initial dataset.
                        </p>
                        {isLoadingFunctions ? (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : functions.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No saved functions. Create one in Functions.</p>
                        ) : (
                            <>
                                <Select
                                    value={selectedFunctionId ?? ''}
                                    onValueChange={(v) => setSelectedFunctionId(v || null)}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Select a function..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {functions.map((func) => (
                                            <SelectItem key={func.id} value={func.id}>
                                                {func.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {selectedFunction && selectedFunction.parameters && selectedFunction.parameters.length > 0 && (
                                    <div className="space-y-2">
                                        {selectedFunction.parameters.map((param) => (
                                            <div key={param.name} className="space-y-1">
                                                <Label className="text-xs text-muted-foreground">{param.label}</Label>
                                                {renderParameterInput(param)}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <Button
                                    onClick={handleRunFunctionToStartDataset}
                                    disabled={isStarting || !selectedFunction}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                                >
                                    {isStarting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Running...
                                        </>
                                    ) : (
                                        'Run function to start dataset'
                                    )}
                                </Button>
                                {initSuccess && (
                                    <div className="flex items-center gap-2 text-sm text-emerald-600">
                                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                                        <span>Dataset created: {initSuccess.row_count.toLocaleString()} rows, {initSuccess.columns.length} columns</span>
                                    </div>
                                )}
                                {initError && (
                                    <p className="text-xs text-destructive">{initError}</p>
                                )}
                            </>
                        )}
                    </div>

                    <Separator />

                    {/* Time Period */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Time Period
                            </Label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="start-date" className="text-xs text-muted-foreground">
                                    Start Date
                                </Label>
                                <Input
                                    id="start-date"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="end-date" className="text-xs text-muted-foreground">
                                    End Date
                                </Label>
                                <Input
                                    id="end-date"
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="h-9"
                                />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Segments */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Segments
                            </Label>
                            <span className="ml-auto text-xs text-muted-foreground">
                                {selectedSegments.length} selected
                            </span>
                        </div>
                        <div className="space-y-2">
                            {defaultSegments.map((segment) => (
                                <div key={segment.id} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={segment.id}
                                        checked={selectedSegments.includes(segment.id)}
                                        onCheckedChange={() => toggleSegment(segment.id)}
                                    />
                                    <label
                                        htmlFor={segment.id}
                                        className="text-sm cursor-pointer flex-1 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                        {segment.label}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Separator />

                    {/* Metrics */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-muted-foreground" />
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Metrics
                            </Label>
                            <span className="ml-auto text-xs text-muted-foreground">
                                {selectedMetrics.length} selected
                            </span>
                        </div>
                        <div className="space-y-2">
                            {defaultMetrics.map((metric) => (
                                <div key={metric.id} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={metric.id}
                                        checked={selectedMetrics.includes(metric.id)}
                                        onCheckedChange={() => toggleMetric(metric.id)}
                                    />
                                    <label
                                        htmlFor={metric.id}
                                        className="text-sm cursor-pointer flex-1 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                        {metric.label}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </ScrollArea>

            {/* Action Buttons */}
            <div className="p-4 border-t space-y-2">
                <Button onClick={handleApply} className="w-full bg-emerald-600 hover:bg-emerald-700">
                    Apply Filters
                </Button>
                <Button variant="outline" onClick={clearFilters} className="w-full">
                    Clear Filters
                </Button>
            </div>
        </div>
    );
}
