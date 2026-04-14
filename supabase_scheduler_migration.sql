-- =============================================================================
-- Scheduled Dashboard Precomputation — Supabase Migration
-- =============================================================================
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New Query)
-- Requires: custom_dashboards table to exist (for FK on custom_dashboard_id)
-- =============================================================================

-- 1. materialized_results (created first because job_runs references it)
CREATE TABLE IF NOT EXISTS public.materialized_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL,  -- FK added after scheduled_jobs exists

    -- Cache key
    dashboard_type TEXT NOT NULL,
    params_hash TEXT NOT NULL,        -- SHA256(dashboard_type:query_version:sorted_params_json)
    query_version INT NOT NULL DEFAULT 1,

    -- Result
    result_data JSONB NOT NULL,       -- { num_rows, columns, data }
    result_rows INT NOT NULL DEFAULT 0,
    result_bytes INT NOT NULL DEFAULT 0,

    -- TTL
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. scheduled_jobs
CREATE TABLE IF NOT EXISTS public.scheduled_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- What to execute
    dashboard_type TEXT NOT NULL,  -- 'dapr_bucket'|'fe2net'|'rtu_performance'|'r2a'|'r2a_percentage'|'a2phh_summary'|'custom'
    custom_dashboard_id UUID,
    params JSONB NOT NULL DEFAULT '{}'::jsonb,
    presto_username TEXT NOT NULL,

    -- Schedule
    cron_expression TEXT NOT NULL,            -- 5-field cron: '0 6 * * *'
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    enabled BOOLEAN NOT NULL DEFAULT true,

    -- Execution control
    next_run_at TIMESTAMPTZ,                 -- precomputed next run time in UTC
    last_run_at TIMESTAMPTZ,
    locked_by TEXT,                           -- worker_id (NULL = unlocked)
    locked_at TIMESTAMPTZ,                   -- for stale lock detection

    -- Retry
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    timeout_seconds INT NOT NULL DEFAULT 300,

    -- Result control
    result_ttl_seconds INT NOT NULL DEFAULT 86400,  -- 24 hours

    -- Metadata
    name TEXT NOT NULL DEFAULT '',
    description TEXT,
    query_version INT NOT NULL DEFAULT 1,   -- bumped on param/SQL change

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK from materialized_results to scheduled_jobs
ALTER TABLE public.materialized_results
    ADD CONSTRAINT fk_mr_job_id
    FOREIGN KEY (job_id) REFERENCES public.scheduled_jobs(id) ON DELETE CASCADE;

-- 3. job_runs
CREATE TABLE IF NOT EXISTS public.job_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.scheduled_jobs(id) ON DELETE CASCADE,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','running','success','failed','timeout','cancelled')),
    worker_id TEXT,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    duration_ms INT,

    result_id UUID REFERENCES public.materialized_results(id) ON DELETE SET NULL,
    result_rows INT,
    result_bytes INT,

    error_message TEXT,
    error_traceback TEXT,
    retry_attempt INT NOT NULL DEFAULT 0,

    -- Snapshot for debuggability
    params_snapshot JSONB,
    query_version INT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Indexes
-- =============================================================================

-- scheduled_jobs
CREATE INDEX IF NOT EXISTS idx_sj_enabled_next_run
    ON scheduled_jobs(enabled, next_run_at) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_sj_locked
    ON scheduled_jobs(locked_by) WHERE locked_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sj_user
    ON scheduled_jobs(user_id);

-- job_runs
CREATE INDEX IF NOT EXISTS idx_jr_job_id ON job_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_jr_job_status ON job_runs(job_id, status, created_at DESC);

-- materialized_results
CREATE UNIQUE INDEX IF NOT EXISTS idx_mr_cache_key
    ON materialized_results(dashboard_type, params_hash, query_version);
CREATE INDEX IF NOT EXISTS idx_mr_expires ON materialized_results(expires_at);
CREATE INDEX IF NOT EXISTS idx_mr_job ON materialized_results(job_id);

-- =============================================================================
-- Eviction function
-- =============================================================================

CREATE OR REPLACE FUNCTION public.evict_expired_results() RETURNS INT AS $$
DECLARE deleted_count INT;
BEGIN
    DELETE FROM public.materialized_results WHERE expires_at < now();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Updated_at trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_scheduled_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_scheduled_jobs_updated_at
    BEFORE UPDATE ON public.scheduled_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_scheduled_jobs_updated_at();

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE public.scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materialized_results ENABLE ROW LEVEL SECURITY;

-- scheduled_jobs: users CRUD their own jobs
CREATE POLICY "Users manage own scheduled jobs"
    ON public.scheduled_jobs
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- job_runs: users can read and write runs for their own jobs
CREATE POLICY "Users read own job runs"
    ON public.job_runs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.scheduled_jobs sj
            WHERE sj.id = job_runs.job_id AND sj.user_id = auth.uid()
        )
    );

CREATE POLICY "Users write own job runs"
    ON public.job_runs
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.scheduled_jobs sj
            WHERE sj.id = job_runs.job_id AND sj.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.scheduled_jobs sj
            WHERE sj.id = job_runs.job_id AND sj.user_id = auth.uid()
        )
    );

-- materialized_results: authenticated users can read; owners can write
CREATE POLICY "Authenticated users read cached results"
    ON public.materialized_results
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Users write own materialized results"
    ON public.materialized_results
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.scheduled_jobs sj
            WHERE sj.id = materialized_results.job_id AND sj.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.scheduled_jobs sj
            WHERE sj.id = materialized_results.job_id AND sj.user_id = auth.uid()
        )
    );

-- Service role (backend) bypasses RLS automatically
