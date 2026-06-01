import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Clock,
    Play,
    Trash2,
    ToggleLeft,
    ToggleRight,
    Loader2,
    RefreshCw,
    CheckCircle2,
    XCircle,
    Timer,
    AlertCircle,
    ChevronDown,
    Calendar,
    Database,
    BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
    listScheduledJobs,
    listJobRuns,
    triggerJobNow,
    updateScheduledJob,
    deleteScheduledJob,
    getJobCachedResult,
    getJobAnalytics,
    DASHBOARD_TYPE_LABELS,
    type ScheduledJob,
    type JobRun,
    type TriggerJobResult,
    type CachedResult,
    type JobAnalytics,
} from '@/lib/schedulerApi';
import { FunnelDataGrid } from '@/components/FunnelDataGrid';
import { ChartBuilder } from '@/components/ChartBuilder';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
    switch (status) {
        case 'success':
            return <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-500/5 gap-1"><CheckCircle2 className="h-3 w-3" />{status}</Badge>;
        case 'running':
        case 'pending':
            return <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-500/5 gap-1"><Loader2 className="h-3 w-3 animate-spin" />{status}</Badge>;
        case 'failed':
            return <Badge variant="outline" className="text-destructive border-red-300 bg-red-500/5 gap-1"><XCircle className="h-3 w-3" />{status}</Badge>;
        case 'timeout':
            return <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-500/5 gap-1"><Timer className="h-3 w-3" />{status}</Badge>;
        default:
            return <Badge variant="outline">{status}</Badge>;
    }
}

function formatDuration(ms: number | null | undefined): string {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
}

function formatRelativeTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d ago`;
}

function formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Extract displayable param entries from job params.
 * Custom dashboards have nested { parameters: {...}, parameter_types: {...} },
 * built-in dashboards have flat params.
 */
function getDisplayParams(params: Record<string, unknown>): [string, string][] {
    if (params.parameters && typeof params.parameters === 'object' && !Array.isArray(params.parameters)) {
        // Custom dashboard — show the inner parameters
        return Object.entries(params.parameters as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')]);
    }
    // Built-in dashboard — show flat params
    return Object.entries(params).map(([k, v]) => [k, String(v ?? '')]);
}

// Map dashboard_type to a route path for built-in dashboards
const DASHBOARD_ROUTES: Record<string, string> = {
    dapr_bucket: '/dashboard/quality/dapr',
    fe2net: '/dashboard/retention/fe2net',
    rtu_performance: '/dashboard/retention/rtu',
    r2a: '/dashboard/acquisition/r2a',
    r2a_percentage: '/dashboard/acquisition/r2a-percentage',
    a2phh_summary: '/dashboard/acquisition/a2phh',
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export function ScheduledJobsPage() {
    const { user, session } = useAuth();
    const navigate = useNavigate();
    const token = session?.access_token;

    const [jobs, setJobs] = useState<ScheduledJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [triggerResult, setTriggerResult] = useState<TriggerJobResult | null>(null);

    // Expanded job state
    const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
    const [runs, setRuns] = useState<JobRun[]>([]);
    const [loadingRuns, setLoadingRuns] = useState(false);

    // Cached result viewer
    const [viewingJobId, setViewingJobId] = useState<string | null>(null);
    const [cachedResult, setCachedResult] = useState<CachedResult | null>(null);
    const [loadingCached, setLoadingCached] = useState(false);
    const [cachedError, setCachedError] = useState<string | null>(null);
    const [showChart, setShowChart] = useState(false);

    // Per-run data expansion
    const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
    const [runShowChart, setRunShowChart] = useState(false);

    // Analytics
    const [analytics, setAnalytics] = useState<JobAnalytics | null>(null);
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);

    const fetchJobs = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const data = await listScheduledJobs(user.id, token);
            setJobs(data);
        } catch (e) {
            console.error('Failed to fetch jobs:', e);
        } finally {
            setLoading(false);
        }
    }, [user?.id, token]);

    const fetchRuns = useCallback(async (jobId: string) => {
        if (!user?.id) return;
        setLoadingRuns(true);
        try {
            const data = await listJobRuns(jobId, user.id, 20, token);
            setRuns(data);
        } catch (e) {
            console.error('Failed to fetch runs:', e);
        } finally {
            setLoadingRuns(false);
        }
    }, [user?.id, token]);

    useEffect(() => {
        fetchJobs();
    }, [fetchJobs]);

    const fetchAnalytics = useCallback(async (jobId: string) => {
        if (!user?.id) return;
        setLoadingAnalytics(true);
        try {
            const data = await getJobAnalytics(jobId, user.id, token);
            setAnalytics(data);
        } catch {
            setAnalytics(null);
        } finally {
            setLoadingAnalytics(false);
        }
    }, [user?.id, token]);

    useEffect(() => {
        if (expandedJobId) {
            fetchRuns(expandedJobId);
            fetchAnalytics(expandedJobId);
            setExpandedRunId(null);
            setRunShowChart(false);
        }
    }, [expandedJobId, fetchRuns, fetchAnalytics]);

    const handleTrigger = async (job: ScheduledJob) => {
        if (!user?.id) return;
        setActionLoading(job.id);
        setTriggerResult(null);
        try {
            const result = await triggerJobNow(job.id, user.id, token);
            setTriggerResult(result);
            setExpandedJobId(job.id);
            await fetchJobs();
            await fetchRuns(job.id);
        } catch (e: unknown) {
            setTriggerResult({ ok: false, message: e instanceof Error ? e.message : 'Failed' });
        } finally {
            setActionLoading(null);
        }
    };

    const handleToggle = async (job: ScheduledJob) => {
        if (!user?.id) return;
        setActionLoading(job.id);
        try {
            await updateScheduledJob(job.id, { enabled: !job.enabled }, user.id, token);
            await fetchJobs();
        } catch (e) {
            console.error(e);
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = async (jobId: string) => {
        if (!user?.id) return;
        if (!confirm('Delete this scheduled job and all its cached results?')) return;
        setActionLoading(jobId);
        try {
            await deleteScheduledJob(jobId, user.id, token);
            if (expandedJobId === jobId) {
                setExpandedJobId(null);
                setRuns([]);
            }
            if (viewingJobId === jobId) {
                setViewingJobId(null);
                setCachedResult(null);
            }
            await fetchJobs();
        } catch (e) {
            console.error(e);
        } finally {
            setActionLoading(null);
        }
    };

    const handleViewCached = async (job: ScheduledJob) => {
        if (viewingJobId === job.id) {
            setViewingJobId(null);
            setCachedResult(null);
            setCachedError(null);
            return;
        }
        setViewingJobId(job.id);
        setLoadingCached(true);
        setCachedError(null);
        setShowChart(false);
        try {
            const result = await getJobCachedResult(job.id, user!.id, token);
            setCachedResult(result);
        } catch (e: unknown) {
            setCachedError(e instanceof Error ? e.message : 'Failed to load cached result');
            setCachedResult(null);
        } finally {
            setLoadingCached(false);
        }
    };

    const handleNavigateToDashboard = async (job: ScheduledJob) => {
        const route = DASHBOARD_ROUTES[job.dashboard_type];
        if (route) {
            navigate(route);
            return;
        }
        // Custom dashboards: look up folder/slug from custom_dashboards table
        if (job.dashboard_type === 'custom' && job.custom_dashboard_id) {
            try {
                const { data } = await supabase
                    .from('custom_dashboards')
                    .select('folder, slug')
                    .eq('id', job.custom_dashboard_id)
                    .single();
                if (data) {
                    navigate(`/dashboard/${data.folder}/${data.slug}`);
                }
            } catch {
                // Fallback: view cached data inline
                handleViewCached(job);
            }
        }
    };

    return (
        <div className="min-h-screen bg-muted/20">
            <div className="max-w-6xl mx-auto px-4 py-8 md:px-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <Clock className="h-6 w-6 text-slate-600" />
                            Scheduled Jobs
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Manage your scheduled dashboard precomputations. Click a job to view its cached results.
                        </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchJobs} className="gap-1.5">
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh
                    </Button>
                </div>

                {/* Trigger result feedback */}
                {triggerResult && (
                    <div className={`mb-4 text-sm px-4 py-3 rounded-lg ${triggerResult.ok ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-200' : 'bg-red-500/10 text-destructive border border-red-200'}`}>
                        {triggerResult.ok ? (
                            <span className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4" />
                                {triggerResult.message}
                                {triggerResult.result_rows != null && (
                                    <span className="text-muted-foreground">({triggerResult.result_rows} rows, {formatDuration(triggerResult.duration_ms)})</span>
                                )}
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <AlertCircle className="h-4 w-4" />
                                {triggerResult.message}
                            </span>
                        )}
                    </div>
                )}

                {/* Loading */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : jobs.length === 0 ? (
                    /* Empty state */
                    <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
                        <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <h2 className="text-lg font-semibold text-slate-700">No Scheduled Jobs</h2>
                        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                            Create a scheduled job from any dashboard by clicking the "Schedule" button.
                            Jobs will precompute results on a cron schedule for instant loading.
                        </p>
                    </div>
                ) : (
                    /* Job list */
                    <div className="space-y-3">
                        {jobs.map(job => {
                            const isExpanded = expandedJobId === job.id;
                            const isViewing = viewingJobId === job.id;

                            return (
                                <div key={job.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                    {/* Job header row */}
                                    <div className="p-4 flex items-start gap-4">
                                        {/* Info section */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-semibold text-slate-900 truncate">
                                                    {job.name || DASHBOARD_TYPE_LABELS[job.dashboard_type] || job.dashboard_type}
                                                </h3>
                                                <Badge variant="secondary" className="text-xs shrink-0">
                                                    {DASHBOARD_TYPE_LABELS[job.dashboard_type] || job.dashboard_type}
                                                </Badge>
                                                {!job.enabled && (
                                                    <Badge variant="outline" className="text-amber-700 border-amber-300 text-xs">Paused</Badge>
                                                )}
                                            </div>
                                            <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                                                <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{job.cron_expression}</span>
                                                <span>Next: {formatRelativeTime(job.next_run_at)}</span>
                                                {job.last_run_at && <span>Last: {formatRelativeTime(job.last_run_at)}</span>}
                                                {job.retry_count > 0 && (
                                                    <span className="text-amber-600">Retries: {job.retry_count}/{job.max_retries}</span>
                                                )}
                                            </div>
                                            {/* Param badges */}
                                            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                                {getDisplayParams(job.params as Record<string, unknown>).map(([k, v]) => (
                                                    <Badge key={k} variant="outline" className="text-[10px] font-mono text-slate-500">
                                                        {k}: {v}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1 shrink-0">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="gap-1.5 text-xs"
                                                onClick={() => handleViewCached(job)}
                                                disabled={loadingCached && viewingJobId === job.id}
                                            >
                                                {loadingCached && viewingJobId === job.id ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <Database className="h-3.5 w-3.5" />
                                                )}
                                                {isViewing ? 'Hide' : 'View Data'}
                                            </Button>
                                            {(DASHBOARD_ROUTES[job.dashboard_type] || (job.dashboard_type === 'custom' && job.custom_dashboard_id)) && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="gap-1.5 text-xs"
                                                    onClick={() => handleNavigateToDashboard(job)}
                                                    title="Go to dashboard"
                                                >
                                                    <BarChart3 className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost" size="icon" className="h-8 w-8"
                                                onClick={() => handleTrigger(job)}
                                                disabled={actionLoading === job.id}
                                                title="Run now"
                                            >
                                                {actionLoading === job.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Play className="h-4 w-4" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="ghost" size="icon" className="h-8 w-8"
                                                onClick={() => handleToggle(job)}
                                                disabled={actionLoading === job.id}
                                                title={job.enabled ? 'Pause' : 'Enable'}
                                            >
                                                {job.enabled ? (
                                                    <ToggleRight className="h-4 w-4 text-emerald-600" />
                                                ) : (
                                                    <ToggleLeft className="h-4 w-4" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                                                onClick={() => handleDelete(job.id)}
                                                disabled={actionLoading === job.id}
                                                title="Delete"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost" size="icon" className="h-8 w-8"
                                                onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                                                title="Execution history"
                                            >
                                                <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Cached result viewer */}
                                    {isViewing && (
                                        <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                                            {loadingCached ? (
                                                <div className="flex items-center justify-center py-8">
                                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                                    <span className="ml-2 text-sm text-muted-foreground">Loading cached results...</span>
                                                </div>
                                            ) : cachedError ? (
                                                <div className="text-center py-8">
                                                    <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                                    <p className="text-sm text-muted-foreground">{cachedError}</p>
                                                    <p className="text-xs text-muted-foreground mt-1">Try clicking "Run Now" to generate results.</p>
                                                </div>
                                            ) : cachedResult?.result ? (
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3 text-sm">
                                                            <span className="font-medium text-slate-700">
                                                                {cachedResult.result.num_rows.toLocaleString()} rows x {cachedResult.result.columns.length} columns
                                                            </span>
                                                            {cachedResult.stale && (
                                                                <Badge variant="outline" className="text-amber-700 border-amber-300 text-xs">Stale</Badge>
                                                            )}
                                                            <span className="text-xs text-muted-foreground">
                                                                Computed: {formatDateTime(cachedResult.computed_at)}
                                                            </span>
                                                        </div>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="gap-1.5 text-xs"
                                                            onClick={() => setShowChart(!showChart)}
                                                        >
                                                            <BarChart3 className="h-3.5 w-3.5" />
                                                            {showChart ? 'Hide Chart' : 'Visualize'}
                                                        </Button>
                                                    </div>
                                                    <FunnelDataGrid
                                                        data={cachedResult.result.data as Record<string, unknown>[]}
                                                        title=""
                                                        description=""
                                                        fileName={job.name || job.dashboard_type}
                                                    />
                                                    {showChart && cachedResult.result.data.length > 0 && (
                                                        <ChartBuilder
                                                            data={cachedResult.result.data as Record<string, unknown>[]}
                                                            title={job.name || DASHBOARD_TYPE_LABELS[job.dashboard_type] || job.dashboard_type}
                                                        />
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-center py-8">
                                                    <Database className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                                    <p className="text-sm text-muted-foreground">No cached results available.</p>
                                                    <p className="text-xs text-muted-foreground mt-1">Click "Run Now" to execute this job and generate results.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Execution history + Analytics */}
                                    {isExpanded && (
                                        <div className="border-t border-slate-100 bg-slate-50/30 px-4 py-3 space-y-4">
                                            {/* Analytics summary */}
                                            {loadingAnalytics ? (
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <Loader2 className="h-3 w-3 animate-spin" /> Loading analytics...
                                                </div>
                                            ) : analytics && analytics.total_runs > 0 && (
                                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                                                    <div className="bg-white rounded-lg border border-slate-100 px-3 py-2">
                                                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Runs</div>
                                                        <div className="text-lg font-semibold text-slate-900">{analytics.total_runs}</div>
                                                    </div>
                                                    <div className="bg-white rounded-lg border border-slate-100 px-3 py-2">
                                                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Success Rate</div>
                                                        <div className={`text-lg font-semibold ${analytics.success_rate >= 90 ? 'text-emerald-600' : analytics.success_rate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                                            {analytics.success_rate}%
                                                        </div>
                                                    </div>
                                                    <div className="bg-white rounded-lg border border-slate-100 px-3 py-2">
                                                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg Duration</div>
                                                        <div className="text-lg font-semibold text-slate-900">{formatDuration(analytics.avg_duration_ms)}</div>
                                                    </div>
                                                    <div className="bg-white rounded-lg border border-slate-100 px-3 py-2">
                                                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">p95 Duration</div>
                                                        <div className="text-lg font-semibold text-slate-900">{formatDuration(analytics.p95_duration_ms)}</div>
                                                    </div>
                                                    <div className="bg-white rounded-lg border border-slate-100 px-3 py-2">
                                                        <div className="text-[10px] uppercase tracking-wider text-emerald-600">Success</div>
                                                        <div className="text-lg font-semibold text-emerald-600">{analytics.success_count}</div>
                                                    </div>
                                                    <div className="bg-white rounded-lg border border-slate-100 px-3 py-2">
                                                        <div className="text-[10px] uppercase tracking-wider text-red-600">Failed</div>
                                                        <div className="text-lg font-semibold text-red-600">{analytics.failed_count + analytics.timeout_count}</div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Run history */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Execution History</span>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { fetchRuns(job.id); fetchAnalytics(job.id); }}>
                                                        <RefreshCw className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                                {loadingRuns ? (
                                                    <div className="flex items-center justify-center py-4">
                                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                                    </div>
                                                ) : runs.length === 0 ? (
                                                    <p className="text-xs text-muted-foreground text-center py-3">No executions yet</p>
                                                ) : (
                                                    <div className="space-y-1.5">
                                                        {runs.map(run => {
                                                            const isRunExpanded = expandedRunId === run.id;
                                                            const hasData = run.result_data && run.result_data.data && run.result_data.data.length > 0;

                                                            return (
                                                                <div key={run.id} className="rounded-lg bg-white border border-slate-100 overflow-hidden">
                                                                    <div
                                                                        className={`flex items-center justify-between text-xs px-3 py-2 ${hasData ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                                                                        onClick={() => {
                                                                            if (hasData) {
                                                                                setExpandedRunId(isRunExpanded ? null : run.id);
                                                                                setRunShowChart(false);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <div className="flex items-center gap-3">
                                                                            {hasData && (
                                                                                <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${isRunExpanded ? 'rotate-180' : ''}`} />
                                                                            )}
                                                                            <StatusBadge status={run.status} />
                                                                            <span className="text-muted-foreground">{formatDateTime(run.started_at)}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-4 text-muted-foreground">
                                                                            {run.result_rows != null && <span>{run.result_rows} rows</span>}
                                                                            <span>{formatDuration(run.duration_ms)}</span>
                                                                            {run.error_message && (
                                                                                <span className="text-destructive max-w-[300px] truncate" title={run.error_message}>
                                                                                    {run.error_message}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* Expanded run data */}
                                                                    {isRunExpanded && hasData && run.result_data && (
                                                                        <div className="border-t border-slate-100 p-3 space-y-3">
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="text-xs text-muted-foreground">
                                                                                    {run.result_data.num_rows} rows x {run.result_data.columns.length} columns
                                                                                </span>
                                                                                <Button
                                                                                    variant="outline"
                                                                                    size="sm"
                                                                                    className="gap-1.5 text-xs h-7"
                                                                                    onClick={(e) => { e.stopPropagation(); setRunShowChart(!runShowChart); }}
                                                                                >
                                                                                    <BarChart3 className="h-3 w-3" />
                                                                                    {runShowChart ? 'Hide Chart' : 'Visualize'}
                                                                                </Button>
                                                                            </div>
                                                                            <FunnelDataGrid
                                                                                data={run.result_data.data as Record<string, unknown>[]}
                                                                                title=""
                                                                                description=""
                                                                                fileName={`${job.name || job.dashboard_type}_${run.started_at?.split('T')[0] ?? ''}`}
                                                                            />
                                                                            {runShowChart && (
                                                                                <ChartBuilder
                                                                                    data={run.result_data.data as Record<string, unknown>[]}
                                                                                    title={`Run: ${formatDateTime(run.started_at)}`}
                                                                                />
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
