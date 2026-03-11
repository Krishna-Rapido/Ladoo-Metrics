import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Play, Plus, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FunnelDataGrid } from '@/components/FunnelDataGrid';
import { ChartBuilder } from '@/components/ChartBuilder';
import { useAuth } from '@/contexts/AuthContext';
import {
    getCustomDashboardBySlug,
    updateCustomDashboard,
    type CustomDashboard,
    type DashboardParameter,
} from '@/lib/supabase';
import {
    executeCustomDashboardQuery,
    type CustomDashboardQueryResponse,
} from '@/lib/api';

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

/** Guess a sensible type from a parameter name. */
function guessParamType(name: string): DashboardParameter['type'] {
    const lower = name.toLowerCase();
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

export function CustomDashboardView({ folder, slug }: CustomDashboardViewProps) {
    const { user } = useAuth();

    // Dashboard config state
    const [dashboard, setDashboard] = useState<CustomDashboard | null>(null);
    const [loadingConfig, setLoadingConfig] = useState(true);
    const [notFound, setNotFound] = useState(false);

    // Editor state
    const [sqlQuery, setSqlQuery] = useState('');
    const [parameters, setParameters] = useState<DashboardParameter[]>(DEFAULT_PARAMS);
    const [paramValues, setParamValues] = useState<Record<string, string>>({});
    const [username, setUsername] = useState('');

    // Query execution state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<CustomDashboardQueryResponse | null>(null);
    const [showChart, setShowChart] = useState(false);

    // Save state
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [dirty, setDirty] = useState(false);

    // UI state
    const [showQueryEditor, setShowQueryEditor] = useState(true);
    const [showParamManager, setShowParamManager] = useState(false);

    const isOwner = dashboard?.user_id === user?.id;

    // Auto-fill username from auth
    useEffect(() => {
        if (user?.email) {
            setUsername(user.email);
        }
    }, [user]);

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
                    const defaults: Record<string, string> = {};
                    const params = db.parameters.length > 0 ? db.parameters : DEFAULT_PARAMS;
                    for (const p of params) {
                        defaults[p.name] = p.default || '';
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
                    updated[p.name] = p.default || '';
                }
            }
            return updated;
        });
    }, [parameters]);

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
                .map((name) => ({
                    name,
                    type: guessParamType(name),
                    default: '',
                    label: labelFromName(name),
                }));

            // Remove params that are no longer referenced in the query
            const filtered = prev.filter((p) => detectedSet.has(p.name));

            if (toAdd.length === 0 && filtered.length === prev.length) return prev;
            return [...filtered, ...toAdd];
        });
    }, [sqlQuery]);

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
    }, [sqlQuery, username, paramValues]);

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

    const addParameter = () => {
        const newParam: DashboardParameter = {
            name: `param_${parameters.length + 1}`,
            type: 'string',
            default: '',
            label: `Parameter ${parameters.length + 1}`,
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
                                <Label className="text-sm font-medium text-slate-700">
                                    SQL Query
                                </Label>
                                <p className="text-xs text-muted-foreground mb-2">
                                    Use {'{{param_name}}'} for template variables (e.g. {'{{start_date}}'}, {'{{end_date}}'}, {'{{city}}'})
                                </p>
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
                            <div className="flex gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowParamManager(!showParamManager)}
                                    className="text-xs"
                                >
                                    {showParamManager ? 'Done' : 'Manage'}
                                </Button>
                                {showParamManager && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={addParameter}
                                        className="text-xs"
                                    >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Add
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Parameter value inputs */}
                        <div className="grid grid-cols-3 gap-3">
                            {parameters.map((param, index) => (
                                <div key={param.name} className="space-y-1">
                                    <div className="flex items-center gap-1">
                                        <label className="block text-xs font-medium text-slate-600">
                                            {param.label}
                                        </label>
                                        <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">
                                            {param.type}
                                        </span>
                                        {showParamManager && (
                                            <button
                                                onClick={() => removeParameter(index)}
                                                className="p-0.5 hover:bg-destructive/10 rounded"
                                            >
                                                <X className="h-3 w-3 text-destructive" />
                                            </button>
                                        )}
                                    </div>
                                    {showParamManager ? (
                                        <div className="space-y-1">
                                            <Input
                                                value={param.name}
                                                onChange={(e) =>
                                                    updateParameter(index, {
                                                        name: e.target.value,
                                                    })
                                                }
                                                placeholder="Variable name"
                                                className="text-xs h-7"
                                            />
                                            <Input
                                                value={param.label}
                                                onChange={(e) =>
                                                    updateParameter(index, {
                                                        label: e.target.value,
                                                    })
                                                }
                                                placeholder="Display label"
                                                className="text-xs h-7"
                                            />
                                            <select
                                                value={param.type}
                                                onChange={(e) =>
                                                    updateParameter(index, {
                                                        type: e.target.value as DashboardParameter['type'],
                                                    })
                                                }
                                                className="w-full text-xs h-7 rounded-md border border-input bg-background px-2"
                                            >
                                                <option value="string">String (quoted)</option>
                                                <option value="number">Number (bare)</option>
                                                <option value="date">Date (timestamp)</option>
                                                <option value="select">Select</option>
                                            </select>
                                        </div>
                                    ) : param.type === 'date' ? (
                                        <Input
                                            type="date"
                                            value={paramValues[param.name] || ''}
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
                                            value={paramValues[param.name] || ''}
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
                                            value={paramValues[param.name] || ''}
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
