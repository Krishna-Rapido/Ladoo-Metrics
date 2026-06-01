import { useState, useEffect, useCallback } from 'react';
import { History, Loader2, Play, Trash2, ToggleLeft, ToggleRight, RefreshCw, AlertCircle, CheckCircle2, Clock, XCircle, Timer } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    listScheduledJobs,
    listJobRuns,
    triggerJobNow,
    updateScheduledJob,
    deleteScheduledJob,
    DASHBOARD_TYPE_LABELS,
    type ScheduledJob,
    type JobRun,
    type TriggerJobResult,
} from '@/lib/schedulerApi';
import { useAuth } from '@/contexts/AuthContext';

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

export function JobHistoryPanel() {
    const { user, session } = useAuth();
    const token = session?.access_token;
    const [open, setOpen] = useState(false);
    const [jobs, setJobs] = useState<ScheduledJob[]>([]);
    const [selectedJob, setSelectedJob] = useState<ScheduledJob | null>(null);
    const [runs, setRuns] = useState<JobRun[]>([]);
    const [loadingJobs, setLoadingJobs] = useState(false);
    const [loadingRuns, setLoadingRuns] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [triggerResult, setTriggerResult] = useState<TriggerJobResult | null>(null);

    const fetchJobs = useCallback(async () => {
        if (!user?.id) return;
        setLoadingJobs(true);
        try {
            const data = await listScheduledJobs(user.id, token);
            setJobs(data);
        } catch (e) {
            console.error('Failed to fetch jobs:', e);
        } finally {
            setLoadingJobs(false);
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
        if (open) fetchJobs();
    }, [open, fetchJobs]);

    useEffect(() => {
        if (selectedJob) fetchRuns(selectedJob.id);
    }, [selectedJob, fetchRuns]);

    const handleTrigger = async (job: ScheduledJob) => {
        if (!user?.id) return;
        setActionLoading(job.id);
        setTriggerResult(null);
        try {
            const result = await triggerJobNow(job.id, user.id, token);
            setTriggerResult(result);
            // Auto-expand this job's runs to show the new result
            setSelectedJob(job);
            await fetchJobs();
            await fetchRuns(job.id);
        } catch (e: unknown) {
            setTriggerResult({ ok: false, message: e instanceof Error ? e.message : 'Failed to trigger job' });
            console.error(e);
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
        if (!confirm('Delete this scheduled job?')) return;
        setActionLoading(jobId);
        try {
            await deleteScheduledJob(jobId, user.id, token);
            if (selectedJob?.id === jobId) {
                setSelectedJob(null);
                setRuns([]);
            }
            await fetchJobs();
        } catch (e) {
            console.error(e);
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                    <History className="h-3.5 w-3.5" />
                    Scheduled Jobs
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Scheduled Dashboard Jobs
                    </DialogTitle>
                </DialogHeader>

                {triggerResult && (
                    <div className={`text-sm px-3 py-2 rounded-md ${triggerResult.ok ? 'bg-emerald-500/10 text-emerald-700' : 'bg-red-500/10 text-destructive'}`}>
                        {triggerResult.ok ? (
                            <span className="flex items-center gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {triggerResult.message}
                                {triggerResult.result_rows != null && <span>({triggerResult.result_rows} rows, {formatDuration(triggerResult.duration_ms)})</span>}
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <AlertCircle className="h-3.5 w-3.5" />
                                {triggerResult.message}
                            </span>
                        )}
                    </div>
                )}

                <div className="flex-1 overflow-auto space-y-3 min-h-0">
                    {loadingJobs ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : jobs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            No scheduled jobs yet. Use the "Schedule" button on any dashboard to create one.
                        </div>
                    ) : (
                        jobs.map(job => (
                            <div
                                key={job.id}
                                className={`rounded-lg border p-3 transition-colors ${
                                    selectedJob?.id === job.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div
                                        className="flex-1 cursor-pointer"
                                        onClick={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}
                                    >
                                        <div className="font-medium text-sm flex items-center gap-2">
                                            {job.name || DASHBOARD_TYPE_LABELS[job.dashboard_type] || job.dashboard_type}
                                            {!job.enabled && <Badge variant="secondary" className="text-xs">Paused</Badge>}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
                                            <span className="font-mono">{job.cron_expression}</span>
                                            <span>Next: {formatRelativeTime(job.next_run_at)}</span>
                                            {job.last_run_at && <span>Last: {formatRelativeTime(job.last_run_at)}</span>}
                                            {job.retry_count > 0 && (
                                                <span className="text-amber-600">Retries: {job.retry_count}/{job.max_retries}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost" size="icon" className="h-7 w-7"
                                            onClick={() => handleTrigger(job)}
                                            disabled={actionLoading === job.id}
                                            title="Run now"
                                        >
                                            {actionLoading === job.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                                        </Button>
                                        <Button
                                            variant="ghost" size="icon" className="h-7 w-7"
                                            onClick={() => handleToggle(job)}
                                            disabled={actionLoading === job.id}
                                            title={job.enabled ? 'Pause' : 'Enable'}
                                        >
                                            {job.enabled ? <ToggleRight className="h-3.5 w-3.5 text-emerald-600" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                                        </Button>
                                        <Button
                                            variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                                            onClick={() => handleDelete(job.id)}
                                            disabled={actionLoading === job.id}
                                            title="Delete"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Expanded: show run history */}
                                {selectedJob?.id === job.id && (
                                    <div className="mt-3 pt-3 border-t">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-medium text-muted-foreground">Execution History</span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => fetchRuns(job.id)}>
                                                <RefreshCw className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        {loadingRuns ? (
                                            <div className="flex items-center justify-center py-4">
                                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                            </div>
                                        ) : runs.length === 0 ? (
                                            <div className="text-xs text-muted-foreground text-center py-3">
                                                No runs yet
                                            </div>
                                        ) : (
                                            <div className="space-y-1.5 max-h-48 overflow-auto">
                                                {runs.map(run => (
                                                    <div key={run.id} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/30">
                                                        <div className="flex items-center gap-2">
                                                            <StatusBadge status={run.status} />
                                                            <span className="text-muted-foreground">{formatRelativeTime(run.started_at)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-muted-foreground">
                                                            {run.result_rows != null && <span>{run.result_rows} rows</span>}
                                                            <span>{formatDuration(run.duration_ms)}</span>
                                                            {run.error_message && (
                                                                <span className="text-destructive max-w-[200px] truncate" title={run.error_message}>
                                                                    {run.error_message}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
