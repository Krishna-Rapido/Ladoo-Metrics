import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Play, Plus, X, ChevronDown, ChevronUp, Loader2, ChevronsUpDown, Trash2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FunnelDataGrid } from '@/components/FunnelDataGrid';
import { ChartBuilder } from '@/components/ChartBuilder';
import { useAuth } from '@/contexts/AuthContext';
import {
    getCustomDashboardBySlug,
    updateCustomDashboard,
    getGlobalParameterOptions,
    type CustomDashboard,
    type DashboardParameter,
    type GlobalParameterOption,
} from '@/lib/supabase';
import {
    executeCustomDashboardQuery,
    getSessionRows,
    type CustomDashboardQueryResponse,
} from '@/lib/api';
import { generateDashboardQuery } from '@/lib/knowledgeApi';
interface CustomDashboardViewProps {
    folder: string;
    slug: string;
}

/** Get today as YYYY-MM-DD. */
function todayISO(): string {
    return new Date().toISOString().slice(0, 10);
}

/** Get 30 days ago as YYYY-MM-DD. */
function thirtyDaysAgoISO(): string {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
}

const DEFAULT_PARAMS: DashboardParameter[] = [
    { name: 'start_date', type: 'date', default: thirtyDaysAgoISO(), label: 'Start Date' },
    { name: 'end_date', type: 'date', default: todayISO(), label: 'End Date' },
];

/** Extract unique {{ param_name }} references from a SQL string (handles optional spaces). */
function extractQueryParams(sql: string): string[] {
    const matches = sql.matchAll(/\{\{\s*(\w+)\s*\}\}/g);
    const seen = new Set<string>();
    for (const m of matches) {
        seen.add(m[1]);
    }
    return Array.from(seen);
}

/** Well-known params that should default to multiselect. */
const MULTISELECT_PARAM_NAMES = new Set(['city', 'service_category', 'mode_name']);

/** Guess a sensible type from a parameter name. */
function guessParamType(name: string): DashboardParameter['type'] {
    const lower = name.toLowerCase();
    if (MULTISELECT_PARAM_NAMES.has(lower)) return 'multiselect';
    if (lower.includes('date') || lower === 'yyyymmdd') return 'date';
    if (lower.includes('count') || lower.includes('num') || lower.includes('limit') || lower.includes('top_n')) return 'number';
    return 'string';
}

/** Turn snake_case param name into a human label. */
function labelFromName(name: string): string {
    return name
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

/** Multi-select parameter popover with checkboxes. */
function MultiSelectParam({
    options,
    selected,
    onChange,
    label,
}: {
    options: string[];
    selected: string[];
    onChange: (values: string[]) => void;
    label: string;
}) {
    const allSelected = options.length > 0 && selected.length === options.length;
    const noneSelected = selected.length === 0;

    const toggle = (item: string) => {
        if (selected.includes(item)) {
            onChange(selected.filter((s) => s !== item));
        } else {
            onChange([...selected, item]);
        }
    };

    const toggleAll = () => {
        if (allSelected) {
            onChange([]);
        } else {
            onChange([...options]);
        }
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="flex items-center justify-between w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                    <span className="truncate text-left">
                        {noneSelected
                            ? <span className="text-muted-foreground">Select {label}...</span>
                            : allSelected
                                ? <span>All selected ({options.length})</span>
                                : <span>{selected.length} selected</span>
                        }
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[240px] p-0 border-border/80 shadow-xl bg-card" align="start">
                <div className="flex flex-col max-h-[480px] overflow-hidden rounded-xl">
                    <div className="border-b border-border/60 px-3 py-2 shrink-0">
                        <button
                            type="button"
                            onClick={toggleAll}
                            className="text-xs font-medium text-primary hover:underline"
                        >
                            {allSelected ? 'Clear All' : 'Select All'}
                        </button>
                    </div>
                    <ScrollArea className="flex-1 overflow-hidden">
                        <div className="p-2 space-y-0.5">
                            {options.map((item) => {
                                const isChecked = selected.includes(item);
                                return (
                                    <label
                                        key={item}
                                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-muted/50"
                                    >
                                        <Checkbox
                                            checked={isChecked}
                                            onCheckedChange={() => toggle(item)}
                                        />
                                        <span className="truncate">{item}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </ScrollArea>
                    {selected.length > 0 && (
                        <div className="border-t border-border/60 px-3 py-2 flex flex-wrap gap-1 shrink-0">
                            {selected.slice(0, 3).map((item) => (
                                <Badge key={item} variant="secondary" className="text-xs truncate max-w-[80px]">
                                    {item}
                                </Badge>
                            ))}
                            {selected.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                    +{selected.length - 3}
                                </Badge>
                            )}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

/** Inline options editor for select/multiselect parameters in Manage mode. */
function OptionsEditor({
    options,
    onChange,
}: {
    options: string[];
    onChange: (options: string[]) => void;
}) {
    const [inputValue, setInputValue] = useState('');

    const addOptions = () => {
        const newItems = inputValue
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s && !options.includes(s));
        if (newItems.length > 0) {
            onChange([...options, ...newItems]);
        }
        setInputValue('');
    };

    return (
        <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Options
            </label>
            <div className="flex gap-1">
                <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            addOptions();
                        }
                    }}
                    placeholder="Add option (comma-separated)"
                    className="text-xs h-7 flex-1"
                />
                <Button
                    variant="outline"
                    size="sm"
                    onClick={addOptions}
                    disabled={!inputValue.trim()}
                    className="h-7 text-xs px-2"
                >
                    Add
                </Button>
            </div>
            {options.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {options.map((opt) => (
                        <Badge
                            key={opt}
                            variant="secondary"
                            className="text-xs gap-1 pr-1"
                        >
                            {opt}
                            <button
                                type="button"
                                onClick={() => onChange(options.filter((o) => o !== opt))}
                                className="hover:bg-destructive/20 rounded-full p-0.5"
                            >
                                <X className="h-2.5 w-2.5" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}
        </div>
    );
}

export function CustomDashboardView({ folder, slug }: CustomDashboardViewProps) {
    const { user } = useAuth();

    // Dashboard config state
    const [dashboard, setDashboard] = useState<CustomDashboard | null>(null);
    const [loadingConfig, setLoadingConfig] = useState(true);
    const [notFound, setNotFound] = useState(false);

    // Editor state
    const [sqlQuery, setSqlQuery] = useState('');
    const [parameters, setParameters] = useState<DashboardParameter[]>(DEFAULT_PARAMS);
    const [paramValues, setParamValues] = useState<Record<string, string | string[] | null>>({});
    const [username, setUsername] = useState('');

    // Global parameter options for multiselect
    const [globalOptions, setGlobalOptions] = useState<Record<string, string[]>>({});

    // Query execution state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<CustomDashboardQueryResponse | null>(null);
    const [showChart, setShowChart] = useState(false);

    // Save state
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [dirty, setDirty] = useState(false);

    // Calculated columns state
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [appliedCalcColumns, setAppliedCalcColumns] = useState<string[]>([]);

    // UI state
    const [showQueryEditor, setShowQueryEditor] = useState(true);
    const [showParamManager, setShowParamManager] = useState(false);

    // AI query generator state
    const [showAiPanel, setShowAiPanel] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    const isOwner = dashboard?.user_id === user?.id;

    // Auto-fill username from auth
    useEffect(() => {
        if (user?.email) {
            setUsername(user.email);
        }
    }, [user]);

    // Fetch global parameter options for multiselect defaults
    useEffect(() => {
        getGlobalParameterOptions()
            .then((opts) => {
                const map: Record<string, string[]> = {};
                for (const o of opts) {
                    map[o.param_key] = o.options;
                }
                setGlobalOptions(map);
            })
            .catch((err) => console.warn('Failed to load global parameter options:', err));
    }, []);

    // Load dashboard config from Supabase
    useEffect(() => {
        setLoadingConfig(true);
        setNotFound(false);
        getCustomDashboardBySlug(folder, slug)
            .then((db) => {
                if (db) {
                    setDashboard(db);
                    setSqlQuery(db.sql_query || '');
                    if (db.parameters.length > 0) {
                        setParameters(db.parameters);
                    }
                    // Initialize param values from defaults
                    const defaults: Record<string, string | string[] | null> = {};
                    const params = db.parameters.length > 0 ? db.parameters : DEFAULT_PARAMS;
                    for (const p of params) {
                        if (p.optional && !p.default) {
                            defaults[p.name] = null;
                        } else if (p.type === 'multiselect') {
                            defaults[p.name] = p.options || [];
                        } else {
                            defaults[p.name] = p.default || '';
                        }
                    }
                    setParamValues(defaults);
                    // Show editor expanded if no query yet
                    setShowQueryEditor(!db.sql_query);
                } else {
                    setNotFound(true);
                }
            })
            .catch((err) => {
                console.error('Failed to load dashboard:', err);
                setNotFound(true);
            })
            .finally(() => setLoadingConfig(false));
    }, [folder, slug]);

    // Initialize param values when parameters change
    useEffect(() => {
        setParamValues((prev) => {
            const updated = { ...prev };
            for (const p of parameters) {
                if (!(p.name in updated)) {
                    if (p.optional && !p.default) {
                        updated[p.name] = null;
                    } else if (p.type === 'multiselect') {
                        updated[p.name] = p.options || globalOptions[p.name] || [];
                    } else {
                        updated[p.name] = p.default || '';
                    }
                }
            }
            return updated;
        });
    }, [parameters, globalOptions]);

    // Auto-detect {{ param }} in the SQL query and sync with parameters list
    useEffect(() => {
        const detected = extractQueryParams(sqlQuery);
        if (detected.length === 0) return;

        setParameters((prev) => {
            const existingNames = new Set(prev.map((p) => p.name));
            const detectedSet = new Set(detected);

            // Add newly-detected params that don't already exist
            const toAdd: DashboardParameter[] = detected
                .filter((name) => !existingNames.has(name))
                .map((name) => {
                    const ptype = guessParamType(name);
                    return {
                        name,
                        type: ptype,
                        default: '',
                        label: labelFromName(name),
                        optional: false,
                        ...(ptype === 'multiselect' && globalOptions[name]
                            ? { options: globalOptions[name] }
                            : {}),
                    };
                });

            // Remove params that are no longer referenced in the query
            const filtered = prev.filter((p) => detectedSet.has(p.name));

            if (toAdd.length === 0 && filtered.length === prev.length) return prev;
            return [...filtered, ...toAdd];
        });
    }, [sqlQuery, globalOptions]);

    const handleAiGenerate = useCallback(async () => {
        if (!aiPrompt.trim()) return;
        setAiLoading(true);
        setAiError(null);
        try {
            const res = await generateDashboardQuery(aiPrompt.trim());
            if (res.success && res.sql) {
                setSqlQuery(res.sql);
                setDirty(true);
                setShowAiPanel(false);
                setAiPrompt('');
            } else {
                setAiError(res.error || 'Failed to generate query');
            }
        } catch (err: unknown) {
            setAiError(err instanceof Error ? err.message : 'Failed to generate query');
        } finally {
            setAiLoading(false);
        }
    }, [aiPrompt]);

    const handleRunQuery = useCallback(async () => {
        if (!sqlQuery.trim() || !username) return;

        setLoading(true);
        setError(null);
        try {
            // Build a type map so the backend knows how to quote each param
            const typeMap: Record<string, string> = {};
            for (const p of parameters) {
                typeMap[p.name] = p.type;
            }
            const res = await executeCustomDashboardQuery({
                username,
                sql_query: sqlQuery,
                parameters: paramValues,
                parameter_types: typeMap,
            });
            setData(res);
            setSessionId(res.session_id || null);
            setAppliedCalcColumns([]);
        } catch (e: any) {
            const msg = e.message || 'Query execution failed';
            // Try to parse JSON error detail from backend
            try {
                const parsed = JSON.parse(msg);
                setError(parsed.detail || msg);
            } catch {
                setError(msg);
            }
        } finally {
            setLoading(false);
        }
    }, [sqlQuery, username, paramValues, parameters]);

    const handleSave = useCallback(async () => {
        if (!dashboard || !isOwner) return;

        setSaving(true);
        try {
            await updateCustomDashboard(dashboard.id, {
                sql_query: sqlQuery,
                parameters,
            });
            setSaveSuccess(true);
            setDirty(false);
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (e: any) {
            console.error('Failed to save:', e);
            alert('Failed to save dashboard. ' + (e.message || ''));
        } finally {
            setSaving(false);
        }
    }, [dashboard, isOwner, sqlQuery, parameters]);

    const handleColumnApplied = useCallback(async (columnName: string) => {
        if (!sessionId) return;
        try {
            const fresh = await getSessionRows(sessionId);
            setData({
                num_rows: fresh.num_rows,
                columns: fresh.columns,
                data: fresh.data,
                session_id: sessionId,
            });
            setAppliedCalcColumns((prev) => [...prev, columnName]);
        } catch (err) {
            console.error('Failed to refresh after apply:', err);
        }
    }, [sessionId]);

    const handleColumnRemoved = useCallback((columnName: string) => {
        setAppliedCalcColumns((prev) => prev.filter((c) => c !== columnName));
    }, []);

    const addParameter = () => {
        const newParam: DashboardParameter = {
            name: `param_${parameters.length + 1}`,
            type: 'string',
            default: '',
            label: `Parameter ${parameters.length + 1}`,
            optional: false,
        };
        setParameters([...parameters, newParam]);
        setDirty(true);
    };

    const removeParameter = (index: number) => {
        const param = parameters[index];
        setParameters(parameters.filter((_, i) => i !== index));
        setParamValues((prev) => {
            const { [param.name]: _, ...rest } = prev;
            return rest;
        });
        setDirty(true);
    };

    const updateParameter = (index: number, updates: Partial<DashboardParameter>) => {
        setParameters((prev) => {
            const updated = [...prev];
            const oldName = updated[index].name;
            updated[index] = { ...updated[index], ...updates };
            // If name changed, update paramValues key
            if (updates.name && updates.name !== oldName) {
                setParamValues((pv) => {
                    const { [oldName]: val, ...rest } = pv;
                    return { ...rest, [updates.name!]: val || '' };
                });
            }
            return updated;
        });
        setDirty(true);
    };

    // Loading state
    if (loadingConfig) {
        return (
            <div className="flex items-center justify-center min-h-[40vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // Not found state
    if (notFound) {
        return (
            <div className="glass-card">
                <div className="text-center py-16 text-slate-500">
                    <p className="text-5xl mb-4">🔍</p>
                    <p className="text-lg font-medium text-slate-700">Dashboard Not Found</p>
                    <p className="text-sm mt-2">
                        The dashboard "{folder}/{slug}" does not exist. It may have been deleted.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Query Editor Card */}
            <div className="glass-card">
                <div className="card-header">
                    <span className="card-icon">⚡</span>
                    <div className="flex-1">
                        <h3 className="card-title">{dashboard?.name || 'Custom Dashboard'}</h3>
                        <p className="card-subtitle">
                            {dashboard?.description || 'Write a Presto SQL query and configure parameters'}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowQueryEditor(!showQueryEditor)}
                        className="p-2 hover:bg-muted/50 rounded-lg transition-colors"
                    >
                        {showQueryEditor ? (
                            <ChevronUp className="h-4 w-4" />
                        ) : (
                            <ChevronDown className="h-4 w-4" />
                        )}
                    </button>
                </div>

                {/* Collapsible: SQL editor only */}
                <AnimatePresence>
                    {showQueryEditor && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="mt-6">
                                <div className="flex items-center justify-between mb-1">
                                    <Label className="text-sm font-medium text-slate-700">
                                        SQL Query
                                    </Label>
                                    <Button
                                        variant={showAiPanel ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setShowAiPanel(!showAiPanel)}
                                        className={showAiPanel
                                            ? 'bg-violet-600 hover:bg-violet-700 text-white text-xs gap-1.5'
                                            : 'text-xs gap-1.5 text-violet-600 border-violet-200 hover:bg-violet-50'}
                                    >
                                        <Sparkles className="h-3.5 w-3.5" />
                                        Generate with AI
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mb-2">
                                    Use {'{{param_name}}'} for template variables (e.g. {'{{start_date}}'}, {'{{end_date}}'}, {'{{city}}'})
                                </p>

                                {/* AI Generation Panel */}
                                <AnimatePresence>
                                    {showAiPanel && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="overflow-hidden mb-3"
                                        >
                                            <div className="border border-violet-200 bg-violet-50/50 rounded-lg p-3 space-y-2">
                                                <div className="flex gap-2">
                                                    <Input
                                                        value={aiPrompt}
                                                        onChange={(e) => setAiPrompt(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleAiGenerate();
                                                            }
                                                        }}
                                                        placeholder="Describe the query you want, e.g. 'daily captain count by city'"
                                                        className="flex-1 text-sm bg-white"
                                                        disabled={aiLoading}
                                                    />
                                                    <Button
                                                        size="sm"
                                                        onClick={handleAiGenerate}
                                                        disabled={aiLoading || !aiPrompt.trim()}
                                                        className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5 shrink-0"
                                                    >
                                                        {aiLoading ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <Sparkles className="h-3.5 w-3.5" />
                                                        )}
                                                        {aiLoading ? 'Generating…' : 'Generate'}
                                                    </Button>
                                                </div>
                                                <p className="text-[11px] text-violet-600/70">
                                                    Press <kbd className="px-1 py-0.5 bg-violet-100 rounded text-[10px] font-mono">⌘ Enter</kbd> to generate
                                                </p>
                                                {aiError && (
                                                    <p className="text-xs text-destructive">{aiError}</p>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <Textarea
                                    value={sqlQuery}
                                    onChange={(e) => {
                                        setSqlQuery(e.target.value);
                                        setDirty(true);
                                    }}
                                    placeholder={`SELECT yyyymmdd, count(*) as captain_count\nFROM datasets.captain_svo_daily_kpi\nWHERE yyyymmdd BETWEEN '{{start_date}}' AND '{{end_date}}'\nGROUP BY 1\nORDER BY 1`}
                                    className="font-mono text-sm min-h-[200px] resize-y"
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Always visible: Parameters + Actions */}
                <div className="mt-4 space-y-4">
                    {/* Parameters Section */}
                    <div className="border rounded-lg p-4 bg-muted/20">
                        <div className="flex items-center justify-between mb-3">
                            <Label className="text-sm font-medium text-slate-700">
                                Parameters
                            </Label>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowParamManager(!showParamManager)}
                                className="text-xs"
                            >
                                {showParamManager ? 'Done' : 'Manage'}
                            </Button>
                        </div>

                        {showParamManager ? (
                            /* ── Manage mode: table layout ── */
                            <div className="space-y-3">
                                <div className="border rounded-lg overflow-hidden bg-background">
                                    {/* Table header */}
                                    <div className="grid grid-cols-[1fr_1fr_140px_1fr_80px_40px] gap-3 px-4 py-2.5 bg-muted/40 border-b text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                        <span>Display Name</span>
                                        <span>Internal Key</span>
                                        <span>Data Type</span>
                                        <span>Default Value</span>
                                        <span className="text-center">Required</span>
                                        <span />
                                    </div>

                                    {/* Table rows */}
                                    {parameters.map((param, index) => (
                                        <div key={index}>
                                            <div className="grid grid-cols-[1fr_1fr_140px_1fr_80px_40px] gap-3 px-4 py-3 items-center border-b last:border-b-0">
                                                {/* Display Name */}
                                                <Input
                                                    value={param.label}
                                                    onChange={(e) => updateParameter(index, { label: e.target.value })}
                                                    placeholder="Display label"
                                                    className="text-sm h-9 font-medium"
                                                />

                                                {/* Internal Key */}
                                                <div>
                                                    <Input
                                                        value={param.name}
                                                        onChange={(e) => updateParameter(index, { name: e.target.value })}
                                                        placeholder="variable_name"
                                                        className="text-sm h-9 font-mono text-teal-700 bg-teal-50/50 border-teal-200"
                                                    />
                                                </div>

                                                {/* Data Type */}
                                                <select
                                                    value={param.type}
                                                    onChange={(e) => updateParameter(index, { type: e.target.value as DashboardParameter['type'] })}
                                                    className="w-full text-sm h-9 rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-2 focus:ring-ring"
                                                >
                                                    <option value="string">String</option>
                                                    <option value="number">Number</option>
                                                    <option value="date">Date</option>
                                                    <option value="select">Select</option>
                                                    <option value="multiselect">Multi-Select</option>
                                                </select>

                                                {/* Default Value */}
                                                {(param.type === 'select' || param.type === 'multiselect') ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <Badge variant="secondary" className="text-[10px] font-semibold shrink-0">
                                                            {param.options?.length || 0} options
                                                        </Badge>
                                                    </div>
                                                ) : (
                                                    <Input
                                                        value={param.default || ''}
                                                        onChange={(e) => updateParameter(index, { default: e.target.value || null })}
                                                        placeholder="Default value"
                                                        className="text-sm h-9"
                                                        type={param.type === 'date' ? 'date' : param.type === 'number' ? 'number' : 'text'}
                                                        disabled={param.optional === true}
                                                    />
                                                )}

                                                {/* Optional toggle */}
                                                {/* Required toggle: ON (teal) = required, OFF (grey) = optional */}
                                                <div className="flex justify-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const isCurrentlyRequired = !(param.optional === true);
                                                            const willBeOptional = isCurrentlyRequired;
                                                            updateParameter(index, {
                                                                optional: willBeOptional,
                                                                default: willBeOptional ? null : '',
                                                            });
                                                            if (willBeOptional) {
                                                                setParamValues((prev) => ({ ...prev, [param.name]: null }));
                                                            }
                                                        }}
                                                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                                                            param.optional ? 'bg-slate-400' : 'bg-teal-600'
                                                        }`}
                                                    >
                                                        <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform ${
                                                            param.optional ? 'translate-x-0' : 'translate-x-4'
                                                        }`} />
                                                    </button>
                                                </div>

                                                {/* Delete */}
                                                <button
                                                    onClick={() => removeParameter(index)}
                                                    className="flex justify-center p-1.5 hover:bg-destructive/10 rounded-md transition-colors"
                                                >
                                                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                                </button>
                                            </div>

                                            {/* Options editor row for select/multiselect */}
                                            {(param.type === 'select' || param.type === 'multiselect') && (
                                                <div className="px-4 py-2 bg-muted/20 border-b last:border-b-0">
                                                    <OptionsEditor
                                                        options={param.options || []}
                                                        onChange={(opts) => updateParameter(index, { options: opts })}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {parameters.length === 0 && (
                                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                                            No parameters defined. Add one below or use {'{{param_name}}'} in your SQL query.
                                        </div>
                                    )}
                                </div>

                                {/* Add Parameter */}
                                <button
                                    onClick={addParameter}
                                    className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-sm font-medium text-teal-700 hover:border-teal-400 hover:bg-teal-50/30 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add Parameter
                                </button>
                            </div>
                        ) : (
                            /* ── Runtime mode: parameter value inputs ── */
                            <div className="grid grid-cols-3 gap-3">
                                {parameters.map((param, index) => (
                                    <div key={index} className="space-y-1">
                                        <div className="flex items-center gap-1">
                                            <label className="block text-xs font-medium text-slate-600">
                                                {param.label}
                                            </label>
                                            <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">
                                                {param.type}
                                            </span>
                                        </div>
                                        <div className="space-y-1">
                                            {/* NULL toggle for optional params */}
                                            {param.optional && (
                                                <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
                                                    <Checkbox
                                                        checked={paramValues[param.name] === null}
                                                        onCheckedChange={(checked) => {
                                                            setParamValues((prev) => ({
                                                                ...prev,
                                                                [param.name]: checked ? null : (param.default || ''),
                                                            }));
                                                        }}
                                                    />
                                                    NULL
                                                </label>
                                            )}
                                            {/* Actual input — disabled when NULL */}
                                            {paramValues[param.name] === null && param.optional ? (
                                                <Input
                                                    value="NULL"
                                                    disabled
                                                    className="text-sm text-muted-foreground italic"
                                                />
                                            ) : param.type === 'multiselect' ? (
                                                <MultiSelectParam
                                                    options={param.options || globalOptions[param.name] || []}
                                                    selected={Array.isArray(paramValues[param.name]) ? paramValues[param.name] as string[] : []}
                                                    onChange={(values) =>
                                                        setParamValues((prev) => ({
                                                            ...prev,
                                                            [param.name]: values,
                                                        }))
                                                    }
                                                    label={param.label}
                                                />
                                            ) : param.type === 'select' && (param.options || globalOptions[param.name])?.length ? (
                                                <select
                                                    value={(paramValues[param.name] as string) || ''}
                                                    onChange={(e) =>
                                                        setParamValues((prev) => ({
                                                            ...prev,
                                                            [param.name]: e.target.value,
                                                        }))
                                                    }
                                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                                >
                                                    <option value="">Select {param.label}...</option>
                                                    {(param.options || globalOptions[param.name] || []).map((opt) => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            ) : param.type === 'date' ? (
                                                <Input
                                                    type="date"
                                                    value={(paramValues[param.name] as string) || ''}
                                                    onChange={(e) =>
                                                        setParamValues((prev) => ({
                                                            ...prev,
                                                            [param.name]: e.target.value,
                                                        }))
                                                    }
                                                    className="text-sm"
                                                />
                                            ) : param.type === 'number' ? (
                                                <Input
                                                    type="number"
                                                    value={(paramValues[param.name] as string) || ''}
                                                    onChange={(e) =>
                                                        setParamValues((prev) => ({
                                                            ...prev,
                                                            [param.name]: e.target.value,
                                                        }))
                                                    }
                                                    placeholder={param.default || param.name}
                                                    className="text-sm"
                                                />
                                            ) : (
                                                <Input
                                                    value={(paramValues[param.name] as string) || ''}
                                                    onChange={(e) =>
                                                        setParamValues((prev) => ({
                                                            ...prev,
                                                            [param.name]: e.target.value,
                                                        }))
                                                    }
                                                    placeholder={param.default || param.name}
                                                    className="text-sm"
                                                />
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {/* Username (always shown) */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-medium text-slate-600">
                                        Presto Username
                                    </label>
                                    <Input
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="your.name@rapido.bike"
                                        className="text-sm"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleRunQuery}
                            className="btn btn-primary flex-1"
                            disabled={loading || !sqlQuery.trim() || !username}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Running Query...</span>
                                </>
                            ) : (
                                <>
                                    <Play className="h-4 w-4" />
                                    <span>Run Query</span>
                                </>
                            )}
                        </button>
                        {isOwner && (
                            <Button
                                variant={saveSuccess ? 'default' : 'outline'}
                                onClick={handleSave}
                                disabled={saving || !dirty}
                                className={saveSuccess ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
                            >
                                {saving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4" />
                                )}
                                <span className="ml-1">
                                    {saveSuccess ? 'Saved!' : saving ? 'Saving...' : 'Save'}
                                </span>
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Error Display */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                            <div className="flex items-center gap-2">
                                <span className="text-red-500 text-xl">⚠️</span>
                                <span className="text-red-700 font-medium">Query Error</span>
                            </div>
                            <p className="text-red-600 text-sm mt-1 whitespace-pre-wrap font-mono">
                                {error}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Results Card */}
            {data && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                >
                    <div className="glass-card">
                        <div className="card-header">
                            <span className="card-icon">📊</span>
                            <div className="flex-1">
                                <h3 className="card-title">Query Results</h3>
                                <p className="card-subtitle">
                                    {data.num_rows.toLocaleString()} rows × {data.columns.length}{' '}
                                    columns
                                </p>
                            </div>
                            <button
                                onClick={() => setShowChart(!showChart)}
                                className={`btn ${showChart ? 'btn-primary' : 'btn-secondary'}`}
                            >
                                <span>{showChart ? '📊' : '📈'}</span>
                                <span>{showChart ? 'Hide Chart' : 'Visualize Data'}</span>
                            </button>
                        </div>

                        <div className="mt-6">
                            <FunnelDataGrid
                                data={data.data}
                                title=""
                                description=""
                            />
                        </div>
                    </div>

                    {/* Chart Builder */}
                    {showChart && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                        >
                            <ChartBuilder
                                data={data.data}
                                title={dashboard?.name || 'Custom Dashboard'}
                                calculatedColumns={appliedCalcColumns}
                                sessionId={sessionId}
                                onColumnApplied={handleColumnApplied}
                                onColumnRemoved={handleColumnRemoved}
                            />
                        </motion.div>
                    )}
                </motion.div>
            )}

            {/* Empty State */}
            {!data && !loading && !error && sqlQuery.trim() && (
                <div className="glass-card">
                    <div className="text-center py-16 text-slate-500">
                        <p className="text-5xl mb-4">📊</p>
                        <p className="text-lg font-medium text-slate-700">Ready to Query</p>
                        <p className="text-sm mt-2">
                            Configure your SQL query and parameters above, then click "Run Query"
                        </p>
                    </div>
                </div>
            )}

            {/* Welcome State - no query written yet */}
            {!data && !loading && !error && !sqlQuery.trim() && (
                <div className="glass-card">
                    <div className="text-center py-16 text-slate-500">
                        <p className="text-5xl mb-4">✏️</p>
                        <p className="text-lg font-medium text-slate-700">Write Your Query</p>
                        <p className="text-sm mt-2 max-w-md mx-auto">
                            Write a Presto SQL query in the editor above. Use {'{{param_name}}'}{' '}
                            syntax for template variables that will be filled from the parameter
                            inputs.
                        </p>
                    </div>
                </div>
            )}

        </div>
    );
}
