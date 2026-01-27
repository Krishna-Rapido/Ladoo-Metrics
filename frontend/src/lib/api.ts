export type UploadResponse = {
    session_id: string;
    num_rows: number;
    columns: string[];
    cohorts: string[];
    date_min?: string;
    date_max?: string;
    metrics: string[];
};

export type DateRange = { start_date?: string; end_date?: string };

export type MetricsRequest = {
    pre_period?: DateRange;
    post_period?: DateRange;
    test_cohort?: string;
    control_cohort?: string;
    aggregations?: Array<'sum' | 'mean' | 'count'>;
    rolling_windows?: number[];
    normalized_growth_baseline_date?: string;
};

export type TimeSeriesPoint = {
    date: string;
    cohort: string;
    metric_value: number;
    metric_value_roll_7?: number | null;
    metric_value_roll_30?: number | null;
    metric_value_pct_change?: number | null;
};

export type SummaryStats = {
    aggregation: 'sum' | 'mean' | 'count';
    test_value: number;
    control_value: number;
    mean_difference: number;
    pct_change?: number | null;
};

export type MetricsResponse = {
    time_series: TimeSeriesPoint[];
    summaries: SummaryStats[];
};

export type MetaResponse = { cohorts: string[]; date_min: string; date_max: string; metrics: string[]; categorical_columns?: string[] };

export type InsightAggregation = 'sum' | 'count' | 'nunique' | 'mean' | 'median';

export type InsightsMetricSpec = {
    column: string;
    agg_func: InsightAggregation;
};

export type InsightsRequest = {
    pre_period?: DateRange;
    post_period?: DateRange;
    test_cohort: string;
    control_cohort: string;
    metrics: InsightsMetricSpec[];
};

export type InsightsTimeSeriesPoint = {
    date: string; // YYYY-MM-DD
    cohort_type: 'test' | 'control';
    metric: string;
    agg_func: InsightAggregation;
    value: number;
};

export type InsightsSummaryRow = {
    metric: string;
    agg_func: InsightAggregation;
    control_pre: number;
    control_post: number;
    control_delta: number;
    control_delta_pct?: number | null;
    test_pre: number;
    test_post: number;
    test_delta: number;
    test_delta_pct?: number | null;
    diff_in_diff: number;
    diff_in_diff_pct?: number | null;
};

export type InsightsResponse = {
    time_series: InsightsTimeSeriesPoint[];
    summary: InsightsSummaryRow[];
};

export type FunnelRequest = {
    pre_period?: DateRange;
    post_period?: DateRange;
    test_cohort?: string;
    control_cohort?: string;
    metric?: string;
    confirmed?: string; // legacy
    test_confirmed?: string;
    control_confirmed?: string;
    agg?: 'sum' | 'mean' | 'count';
    series_breakout?: string; // categorical column to group by for series breakout
};

export type FunnelPoint = { date: string; cohort: string; metric: string; value: number; series_value?: string | null };
export type FunnelResponse = {
    metrics_available: string[];
    pre_series: FunnelPoint[];
    post_series: FunnelPoint[];
    pre_summary: Record<string, number>;
    post_summary: Record<string, number>;
};

export type CohortAggregationRow = {
    cohort: string;
    totalExpCaps: number;
    visitedCaps: number;
    clickedCaptain: number;
    pitch_centre_card_clicked: number;
    pitch_centre_card_visible: number;
    exploredCaptains: number;
    exploredCaptains_Subs: number;
    exploredCaptains_EPKM: number;
    exploredCaptains_FlatCommission: number;
    exploredCaptains_CM: number;
    confirmedCaptains: number;
    confirmedCaptains_Subs: number;
    confirmedCaptains_Subs_purchased: number;
    confirmedCaptains_Subs_purchased_weekend: number;
    confirmedCaptains_EPKM: number;
    confirmedCaptains_FlatCommission: number;
    confirmedCaptains_CM: number;
    Visit2Click: number;
    Base2Visit: number;
    Click2Confirm: number;
};

export type CohortAggregationResponse = {
    data: CohortAggregationRow[];
};

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8001';

export function getSessionId(): string | null {
    return localStorage.getItem('session_id');
}

function setSessionId(id: string) {
    localStorage.setItem('session_id', id);
}

function sessionHeaders(): Headers {
    const h = new Headers();
    const session = getSessionId();
    if (session) h.set('x-session-id', session);
    return h;
}

export async function uploadCsv(file: File): Promise<UploadResponse> {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE_URL}/upload`, {
        method: 'POST',
        body: form,
    });
    if (!res.ok) {
        throw new Error(await res.text());
    }
    const data = (await res.json()) as UploadResponse;
    setSessionId(data.session_id);
    return data;
}

export async function getMeta(): Promise<MetaResponse> {
    const res = await fetch(`${BASE_URL}/meta`, {
        headers: sessionHeaders(),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function fetchMetrics(payload: MetricsRequest): Promise<MetricsResponse> {
    const headers = sessionHeaders();
    headers.set('Content-Type', 'application/json');
    const res = await fetch(`${BASE_URL}/metrics`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function fetchInsights(payload: InsightsRequest): Promise<InsightsResponse> {
    const headers = sessionHeaders();
    headers.set('Content-Type', 'application/json');
    const res = await fetch(`${BASE_URL}/insights`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function fetchFunnel(payload: FunnelRequest): Promise<FunnelResponse> {
    const headers = sessionHeaders();
    headers.set('Content-Type', 'application/json');
    const res = await fetch(`${BASE_URL}/funnel`, { method: 'POST', headers, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function clearSession(): Promise<void> {
    const res = await fetch(`${BASE_URL}/session`, {
        method: 'DELETE',
        headers: sessionHeaders(),
    });
    if (!res.ok) throw new Error(await res.text());
    localStorage.removeItem('session_id');
}

export async function fetchCohortAggregation(): Promise<CohortAggregationResponse> {
    const res = await fetch(`${BASE_URL}/cohort-aggregation`, {
        headers: sessionHeaders(),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

// Statistical Tests API
export type StatTestRequest = {
    test_category: string;
    test_name: string;
    parameters: Record<string, any>;
    data: {
        pre_test: number[];
        post_test: number[];
        pre_control: number[];
        post_control: number[];
    };
};

export type StatTestResult = {
    test_name: string;
    category: string;
    statistic?: number;
    p_value?: number;
    effect_size?: number;
    confidence_interval?: [number, number];
    sample_size?: number;
    power?: number;
    summary: string;
    parameters_used: Record<string, any>;
    raw_output?: any;
};

export async function runStatisticalTest(req: StatTestRequest): Promise<StatTestResult> {
    const headers = sessionHeaders();
    headers.set('Content-Type', 'application/json');
    const res = await fetch(`${BASE_URL}/statistical-test`, {
        method: 'POST',
        headers,
        body: JSON.stringify(req),
    });
    if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Statistical test failed');
    }
    return await res.json();
}

// Captain-Level Aggregation API
export type MetricAggregation = {
    column: string;
    agg_func: 'sum' | 'mean' | 'count' | 'nunique' | 'median' | 'std' | 'min' | 'max';
};

export type CaptainLevelRequest = {
    pre_period?: DateRange;
    post_period?: DateRange;
    test_cohort: string;
    control_cohort: string;
    test_confirmed?: string;
    control_confirmed?: string;
    group_by_column: string;
    metric_aggregations: MetricAggregation[];
};

export type CaptainLevelAggregationRow = {
    period: string;  // "pre" or "post"
    cohort_type: string;  // "test" or "control"
    date?: string;
    group_value: string;
    aggregations: Record<string, number>;
};

export type CaptainLevelResponse = {
    data: CaptainLevelAggregationRow[];
    group_by_column: string;
    metrics: string[];
};

export async function fetchCaptainLevelAggregation(req: CaptainLevelRequest): Promise<CaptainLevelResponse> {
    const headers = sessionHeaders();
    headers.set('Content-Type', 'application/json');
    const res = await fetch(`${BASE_URL}/captain-level-aggregation`, {
        method: 'POST',
        headers,
        body: JSON.stringify(req),
    });
    if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Captain-level aggregation failed');
    }
    return await res.json();
}

// ============================================================================
// FUNNEL ANALYSIS API
// ============================================================================

export type MobileNumberUploadResponse = {
    funnel_session_id: string;
    num_rows: number;
    columns: string[];
    has_cohort: boolean;
    preview: Record<string, any>[];
    duplicates_removed?: number;
};

export type CaptainIdRequest = {
    username: string;
};

export type CaptainIdResponse = {
    num_rows: number;
    num_captains_found: number;
    preview: Record<string, any>[];
};

export type AOFunnelRequest = {
    username: string;
    start_date?: string;
    end_date?: string;
    time_level?: 'daily' | 'weekly' | 'monthly';
    tod_level?: 'daily' | 'afternoon' | 'evening' | 'morning' | 'night' | 'all';
};

export type AOFunnelResponse = {
    num_rows: number;
    columns: string[];
    preview: Record<string, any>[];
    metrics: string[];
    unique_captain_ids: number;
};

function getFunnelSessionId(): string | null {
    return localStorage.getItem('funnel_session_id');
}

function setFunnelSessionId(id: string) {
    localStorage.setItem('funnel_session_id', id);
}

function funnelSessionHeaders(): Headers {
    const h = new Headers();
    const session = getFunnelSessionId();
    if (session) h.set('x-funnel-session-id', session);
    return h;
}

export async function uploadMobileNumbers(file: File): Promise<MobileNumberUploadResponse> {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE_URL}/funnel-analysis/upload-mobile-numbers`, {
        method: 'POST',
        body: form,
    });
    if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Mobile numbers upload failed');
    }
    const data = (await res.json()) as MobileNumberUploadResponse;
    setFunnelSessionId(data.funnel_session_id);
    return data;
}

export async function getCaptainIds(username: string): Promise<CaptainIdResponse> {
    const headers = funnelSessionHeaders();
    headers.set('Content-Type', 'application/json');
    const res = await fetch(`${BASE_URL}/funnel-analysis/get-captain-ids`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ username }),
    });
    if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to fetch captain IDs');
    }
    return await res.json();
}

export async function getAOFunnel(req: AOFunnelRequest): Promise<AOFunnelResponse> {
    const headers = funnelSessionHeaders();
    headers.set('Content-Type', 'application/json');
    const res = await fetch(`${BASE_URL}/funnel-analysis/get-ao-funnel`, {
        method: 'POST',
        headers,
        body: JSON.stringify(req),
    });
    if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to fetch AO funnel data');
    }
    return await res.json();
}

export async function clearFunnelSession(): Promise<void> {
    const res = await fetch(`${BASE_URL}/funnel-analysis/session`, {
        method: 'DELETE',
        headers: funnelSessionHeaders(),
    });
    if (!res.ok) throw new Error(await res.text());
    localStorage.removeItem('funnel_session_id');
}

export async function exportFunnelCsv(): Promise<void> {
    const res = await fetch(`${BASE_URL}/funnel-analysis/export-csv`, {
        method: 'GET',
        headers: funnelSessionHeaders(),
    });
    if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to export CSV');
    }

    // Download the file
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'funnel_data.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

export async function useFunnelForAnalysis(): Promise<UploadResponse> {
    const res = await fetch(`${BASE_URL}/funnel-analysis/use-for-analysis`, {
        method: 'POST',
        headers: funnelSessionHeaders(),
    });
    if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to transfer funnel data to analysis session');
    }
    const data = (await res.json()) as UploadResponse;
    setSessionId(data.session_id);
    return data;
}

export type DaprBucketRequest = {
    username: string;
    start_date?: string;
    end_date?: string;
    city?: string;
    service_category?: string;
    low_dapr?: number;
    high_dapr?: number;
};

export type DaprBucketResponse = {
    num_rows: number;
    columns: string[];
    data: Record<string, any>[];
};

export async function getDaprBucket(req: DaprBucketRequest): Promise<DaprBucketResponse> {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    const res = await fetch(`${BASE_URL}/funnel-analysis/dapr-bucket`, {
        method: 'POST',
        headers,
        body: JSON.stringify(req),
    });
    if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to fetch DAPR bucket data');
    }
    return await res.json();
}

export type Fe2NetRequest = {
    username: string;
    start_date?: string;
    end_date?: string;
    city?: string;
    service_category?: string;
    geo_level?: string;
    time_level?: string;
};

export type Fe2NetResponse = {
    num_rows: number;
    columns: string[];
    data: Record<string, any>[];
};

export async function getFe2Net(req: Fe2NetRequest): Promise<Fe2NetResponse> {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    const res = await fetch(`${BASE_URL}/captain-dashboards/fe2net`, {
        method: 'POST',
        headers,
        body: JSON.stringify(req),
    });
    if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to fetch FE2Net data');
    }
    return await res.json();
}

export type RtuPerformanceRequest = {
    username: string;
    start_date?: string;
    end_date?: string;
    city?: string;
    perf_cut?: number;
    consistency_cut?: number;
    time_level?: string;
    tod_level?: string;
    service_category?: string;
};

export type RtuPerformanceResponse = {
    num_rows: number;
    columns: string[];
    data: Record<string, any>[];
};

export async function getRtuPerformance(req: RtuPerformanceRequest): Promise<RtuPerformanceResponse> {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    const res = await fetch(`${BASE_URL}/captain-dashboards/rtu-performance`, {
        method: 'POST',
        headers,
        body: JSON.stringify(req),
    });
    if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to fetch RTU Performance data');
    }
    return await res.json();
}

export type R2ARequest = {
    username: string;
    start_date?: string;
    end_date?: string;
    city?: string;
    service?: string;
    time_level?: string;
};

export type R2AResponse = {
    num_rows: number;
    columns: string[];
    data: Record<string, any>[];
};

export async function getR2A(req: R2ARequest): Promise<R2AResponse> {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    const res = await fetch(`${BASE_URL}/captain-dashboards/r2a`, {
        method: 'POST',
        headers,
        body: JSON.stringify(req),
    });
    if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to fetch R2A data');
    }
    return await res.json();
}

export type R2APercentageRequest = {
    username: string;
    start_date?: string;
    end_date?: string;
    city?: string;
    service?: string;
    time_level?: string;
};

export type R2APercentageResponse = {
    num_rows: number;
    columns: string[];
    data: Record<string, any>[];
};

export async function getR2APercentage(req: R2APercentageRequest): Promise<R2APercentageResponse> {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    const res = await fetch(`${BASE_URL}/captain-dashboards/r2a-percentage`, {
        method: 'POST',
        headers,
        body: JSON.stringify(req),
    });
    if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to fetch R2A% data');
    }
    return await res.json();
}

export type A2PhhSummaryRequest = {
    username: string;
    start_date?: string;
    end_date?: string;
    city?: string;
    service?: string;
    time_level?: string;
};

export type A2PhhSummaryResponse = {
    num_rows: number;
    columns: string[];
    data: Record<string, any>[];
};

export async function getA2PhhSummary(req: A2PhhSummaryRequest): Promise<A2PhhSummaryResponse> {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    const res = await fetch(`${BASE_URL}/captain-dashboards/a2phh-summary`, {
        method: 'POST',
        headers,
        body: JSON.stringify(req),
    });
    if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to fetch A2PHH Summary data');
    }
    return await res.json();
}

// ============================================================================
// REPORT BUILDER API
// ============================================================================

export type ReportItem = {
    id: string;
    type: 'chart' | 'table' | 'text';
    title: string;
    content: Record<string, any>;
    comment: string;
    timestamp: string;
};

export type ReportAddRequest = {
    type: string;
    title: string;
    content: Record<string, any>;
    comment?: string;
};

export async function createReport(): Promise<{ report_id: string }> {
    const res = await fetch(`${BASE_URL}/report/create`, {
        method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to create report');
    return await res.json();
}

export async function addReportItem(
    request: ReportAddRequest,
    reportId: string
): Promise<{ report_id: string; item_id: string; num_items: number }> {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('x-report-id', reportId);

    const res = await fetch(`${BASE_URL}/report/add-item`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
    });
    if (!res.ok) throw new Error('Failed to add report item');
    return await res.json();
}

export async function updateReportComment(
    itemId: string,
    comment: string,
    reportId: string
): Promise<{ ok: boolean }> {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('x-report-id', reportId);

    const res = await fetch(`${BASE_URL}/report/update-comment`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ item_id: itemId, comment }),
    });
    if (!res.ok) throw new Error('Failed to update comment');
    return await res.json();
}

export async function updateReportTitle(
    itemId: string,
    title: string,
    reportId: string
): Promise<{ ok: boolean }> {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('x-report-id', reportId);

    const res = await fetch(`${BASE_URL}/report/update-title`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ item_id: itemId, title }),
    });
    if (!res.ok) throw new Error('Failed to update title');
    return await res.json();
}

export async function deleteReportItem(
    itemId: string,
    reportId: string
): Promise<{ ok: boolean; num_items: number }> {
    const headers = new Headers();
    headers.set('x-report-id', reportId);

    const res = await fetch(`${BASE_URL}/report/item/${itemId}`, {
        method: 'DELETE',
        headers,
    });
    if (!res.ok) throw new Error('Failed to delete report item');
    return await res.json();
}

export async function listReportItems(reportId: string): Promise<{ report_id: string; items: ReportItem[] }> {
    const headers = new Headers();
    headers.set('x-report-id', reportId);

    const res = await fetch(`${BASE_URL}/report/list`, {
        method: 'GET',
        headers,
    });
    if (!res.ok) throw new Error('Failed to list report items');
    return await res.json();
}

export async function exportReport(reportId: string): Promise<{ report_html: string }> {
    const headers = new Headers();
    headers.set('x-report-id', reportId);

    const res = await fetch(`${BASE_URL}/report/export`, {
        method: 'GET',
        headers,
    });
    if (!res.ok) throw new Error('Failed to export report');
    return await res.json();
}

export async function clearReport(reportId: string): Promise<{ ok: boolean }> {
    const headers = new Headers();
    headers.set('x-report-id', reportId);

    const res = await fetch(`${BASE_URL}/report/clear`, {
        method: 'DELETE',
        headers,
    });
    if (!res.ok) throw new Error('Failed to clear report');
    return await res.json();
}

// =============================================================================
// METRIC FUNCTIONS API
// =============================================================================

export type FunctionTestRequest = {
    code: string;
    parameters: Record<string, string | number>;
    username: string;
};

export type FunctionTestResponse = {
    success: boolean;
    error?: string | null;
    preview?: Record<string, unknown>[] | null;
    columns?: string[] | null;
    output_columns?: string[] | null;
    row_count: number;
};

export type FunctionExecuteResponse = {
    success: boolean;
    error?: string | null;
    data?: Record<string, unknown>[] | null;
    columns?: string[] | null;
    output_columns?: string[] | null;
    row_count: number;
};

export type MetricStats = {
    type?: 'numeric' | 'categorical';
    count: number;
    mean?: number | null;
    std?: number | null;
    min?: number | null;
    max?: number | null;
    median?: number | null;
    null_count: number;
    unique?: number;
    top_values?: Record<string, number>;
};

export type FunctionPreviewResponse = {
    success: boolean;
    error?: string | null;
    preview?: Record<string, unknown>[] | null;
    columns?: string[] | null;
    row_count: number;
    stats?: Record<string, MetricStats> | null;
};

export type FunctionJoinRequest = {
    code: string;
    parameters: Record<string, unknown>;
    username: string;
    join_columns: string[];
    join_type: 'left' | 'inner';
};

export type FunctionJoinResponse = {
    success: boolean;
    error?: string | null;
    added_columns?: string[] | null;
    row_count: number;
    matched_rows: number;
    preview?: Record<string, unknown>[] | null;
    columns?: string[] | null;
    metrics_stats?: Record<string, MetricStats> | null;
};

export async function testFunction(request: FunctionTestRequest): Promise<FunctionTestResponse> {
    const res = await fetch(`${BASE_URL}/functions/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    });
    if (!res.ok) throw new Error('Failed to test function');
    return await res.json();
}

export async function executeFunction(request: FunctionTestRequest): Promise<FunctionExecuteResponse> {
    const res = await fetch(`${BASE_URL}/functions/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    });
    if (!res.ok) throw new Error('Failed to execute function');
    return await res.json();
}

export async function previewFunctionResult(
    request: FunctionTestRequest
): Promise<FunctionPreviewResponse> {
    const res = await fetch(`${BASE_URL}/functions/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    });
    if (!res.ok) throw new Error('Failed to preview function');
    return await res.json();
}

export async function joinFunctionWithCsv(
    request: FunctionJoinRequest,
    sessionId: string
): Promise<FunctionJoinResponse> {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('x-session-id', sessionId);

    const res = await fetch(`${BASE_URL}/functions/join`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
    });
    if (!res.ok) throw new Error('Failed to join function with CSV');
    return await res.json();
}

export async function getFunctionTemplate(): Promise<{ template: string }> {
    const res = await fetch(`${BASE_URL}/functions/template`);
    if (!res.ok) throw new Error('Failed to get function template');
    return await res.json();
}

export async function downloadSessionData(sessionId: string): Promise<void> {
    const headers = new Headers();
    headers.set('x-session-id', sessionId);

    const res = await fetch(`${BASE_URL}/data/download`, {
        method: 'GET',
        headers,
    });
    if (!res.ok) throw new Error('Failed to download data');
    
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data_with_metrics.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}
