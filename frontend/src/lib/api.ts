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

export type MetaResponse = { cohorts: string[]; date_min: string; date_max: string; metrics: string[] };

export type FunnelRequest = {
    pre_period?: DateRange;
    post_period?: DateRange;
    test_cohort?: string;
    control_cohort?: string;
    metric?: string;
    confirmed?: string;
};

export type FunnelPoint = { date: string; cohort: string; metric: string; value: number };
export type FunnelResponse = {
    metrics_available: string[];
    pre_series: FunnelPoint[];
    post_series: FunnelPoint[];
    pre_summary: Record<string, number>;
    post_summary: Record<string, number>;
};

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

function getSessionId(): string | null {
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
