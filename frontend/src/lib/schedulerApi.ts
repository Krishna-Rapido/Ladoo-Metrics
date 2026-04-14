/**
 * API client for Scheduled Dashboard Precomputation
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8001';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScheduledJob = {
    id: string;
    dashboard_type: string;
    custom_dashboard_id?: string | null;
    params: Record<string, unknown>;
    presto_username: string;
    cron_expression: string;
    timezone: string;
    enabled: boolean;
    name: string;
    description?: string | null;
    next_run_at?: string | null;
    last_run_at?: string | null;
    retry_count: number;
    max_retries: number;
    timeout_seconds: number;
    result_ttl_seconds: number;
    query_version: number;
    created_at: string;
    updated_at: string;
};

export type ScheduledJobCreate = {
    dashboard_type: string;
    custom_dashboard_id?: string | null;
    params: Record<string, unknown>;
    presto_username: string;
    cron_expression: string;
    timezone?: string;
    name?: string;
    description?: string | null;
    timeout_seconds?: number;
    result_ttl_seconds?: number;
    max_retries?: number;
    enabled?: boolean;
};

export type ScheduledJobUpdate = {
    params?: Record<string, unknown>;
    cron_expression?: string;
    timezone?: string;
    name?: string;
    description?: string | null;
    enabled?: boolean;
    timeout_seconds?: number;
    result_ttl_seconds?: number;
    max_retries?: number;
};

export type JobRun = {
    id: string;
    job_id: string;
    status: 'pending' | 'running' | 'success' | 'failed' | 'timeout' | 'cancelled';
    worker_id?: string | null;
    started_at?: string | null;
    finished_at?: string | null;
    duration_ms?: number | null;
    result_rows?: number | null;
    result_bytes?: number | null;
    result_data?: { num_rows: number; columns: string[]; data: Record<string, unknown>[] } | null;
    error_message?: string | null;
    retry_attempt: number;
    params_snapshot?: Record<string, unknown> | null;
    query_version?: number | null;
    created_at: string;
};

export type JobAnalytics = {
    total_runs: number;
    success_count: number;
    failed_count: number;
    timeout_count: number;
    success_rate: number;
    avg_duration_ms?: number | null;
    p50_duration_ms?: number | null;
    p95_duration_ms?: number | null;
    avg_result_rows?: number | null;
    last_success_at?: string | null;
    last_failure_at?: string | null;
};

export type CachedResult = {
    cached: boolean;
    stale: boolean;
    computed_at?: string | null;
    expires_at?: string | null;
    result?: {
        num_rows: number;
        columns: string[];
        data: Record<string, unknown>[];
    } | null;
};

export type SnapshotAddRequest = {
    dashboard_type: string;
    params: Record<string, unknown>;
    dashboard_name: string;
    result_data: Record<string, unknown>;
    computed_at: string;
    job_id?: string | null;
    auto_refresh?: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getHeaders(userId: string, accessToken?: string): HeadersInit {
    const h: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
    };
    if (accessToken) {
        h['Authorization'] = `Bearer ${accessToken}`;
    }
    return h;
}

// ---------------------------------------------------------------------------
// CRUD: Scheduled Jobs
// ---------------------------------------------------------------------------

export async function createScheduledJob(
    payload: ScheduledJobCreate,
    userId: string,
    accessToken?: string,
): Promise<ScheduledJob> {
    const res = await fetch(`${BASE_URL}/scheduled-jobs`, {
        method: 'POST',
        headers: getHeaders(userId, accessToken),
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Failed to create scheduled job');
    }
    return res.json();
}

export async function listScheduledJobs(userId: string, accessToken?: string): Promise<ScheduledJob[]> {
    const res = await fetch(`${BASE_URL}/scheduled-jobs`, {
        headers: getHeaders(userId, accessToken),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Failed to list scheduled jobs');
    }
    return res.json();
}

export async function updateScheduledJob(
    jobId: string,
    payload: ScheduledJobUpdate,
    userId: string,
    accessToken?: string,
): Promise<ScheduledJob> {
    const res = await fetch(`${BASE_URL}/scheduled-jobs/${jobId}`, {
        method: 'PATCH',
        headers: getHeaders(userId, accessToken),
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Failed to update scheduled job');
    }
    return res.json();
}

export async function deleteScheduledJob(jobId: string, userId: string, accessToken?: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/scheduled-jobs/${jobId}`, {
        method: 'DELETE',
        headers: getHeaders(userId, accessToken),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Failed to delete scheduled job');
    }
}

export async function listJobRuns(
    jobId: string,
    userId: string,
    limit = 20,
    accessToken?: string,
): Promise<JobRun[]> {
    const res = await fetch(`${BASE_URL}/scheduled-jobs/${jobId}/runs?limit=${limit}`, {
        headers: getHeaders(userId, accessToken),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Failed to list job runs');
    }
    return res.json();
}

export async function getJobAnalytics(
    jobId: string,
    userId: string,
    accessToken?: string,
): Promise<JobAnalytics> {
    const res = await fetch(`${BASE_URL}/scheduled-jobs/${jobId}/analytics`, {
        headers: getHeaders(userId, accessToken),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Failed to fetch analytics');
    }
    return res.json();
}

export type TriggerJobResult = {
    ok: boolean;
    message: string;
    result_rows?: number | null;
    duration_ms?: number | null;
};

export async function triggerJobNow(jobId: string, userId: string, accessToken?: string): Promise<TriggerJobResult> {
    const res = await fetch(`${BASE_URL}/scheduled-jobs/${jobId}/run-now`, {
        method: 'POST',
        headers: getHeaders(userId, accessToken),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Failed to trigger job');
    }
    return res.json();
}

// ---------------------------------------------------------------------------
// Cache Read
// ---------------------------------------------------------------------------

/** Get the latest cached result for a scheduled job by job_id. */
export async function getJobCachedResult(
    jobId: string,
    userId: string,
    accessToken?: string,
    staleOk = true,
): Promise<CachedResult> {
    const url = `${BASE_URL}/scheduled-jobs/${jobId}/result?stale_ok=${staleOk}`;
    const res = await fetch(url, { headers: getHeaders(userId, accessToken) });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Failed to fetch cached result');
    }
    return res.json();
}

export async function getCachedDashboardResult(
    dashboardType: string,
    params: Record<string, unknown>,
    queryVersion = 1,
    staleOk = true,
): Promise<CachedResult> {
    const paramsJson = encodeURIComponent(JSON.stringify(params));
    const url = `${BASE_URL}/dashboard/${dashboardType}/cached?params=${paramsJson}&query_version=${queryVersion}&stale_ok=${staleOk}`;
    const res = await fetch(url);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Failed to fetch cached result');
    }
    return res.json();
}

// ---------------------------------------------------------------------------
// Report Snapshot
// ---------------------------------------------------------------------------

export async function addDashboardSnapshot(
    payload: SnapshotAddRequest,
    userId: string,
): Promise<{ ok: boolean; item: Record<string, unknown> }> {
    const res = await fetch(`${BASE_URL}/reports/add-snapshot`, {
        method: 'POST',
        headers: getHeaders(userId),
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Failed to add dashboard snapshot');
    }
    return res.json();
}

// ---------------------------------------------------------------------------
// Cron Presets
// ---------------------------------------------------------------------------

export const CRON_PRESETS = [
    { label: 'Every 6 hours', value: '0 */6 * * *' },
    { label: 'Daily at 6:00 AM', value: '0 6 * * *' },
    { label: 'Daily at midnight', value: '0 0 * * *' },
    { label: 'Every 12 hours', value: '0 */12 * * *' },
    { label: 'Weekly (Monday 6 AM)', value: '0 6 * * 1' },
    { label: 'Custom', value: '' },
] as const;

export const DASHBOARD_TYPE_LABELS: Record<string, string> = {
    dapr_bucket: 'DAPR Bucket',
    fe2net: 'FE2Net',
    rtu_performance: 'RTU Performance',
    r2a: 'R2A',
    r2a_percentage: 'R2A %',
    a2phh_summary: 'A2PHH Summary',
    custom: 'Custom Dashboard',
};
