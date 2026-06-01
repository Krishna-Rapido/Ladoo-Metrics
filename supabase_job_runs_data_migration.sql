-- =============================================================================
-- Add result_data to job_runs — stores each execution's full data
-- =============================================================================
-- Run this in the Supabase SQL Editor

-- 1. Add result_data column to job_runs
ALTER TABLE public.job_runs
    ADD COLUMN IF NOT EXISTS result_data JSONB;

-- 2. Function to clean up old run data (keep last 10 per job)
--    Called after each successful run to prevent unbounded storage growth
CREATE OR REPLACE FUNCTION public.cleanup_old_run_data(p_job_id UUID, p_keep INT DEFAULT 10)
RETURNS INT AS $$
DECLARE
    cleaned INT;
BEGIN
    WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) AS rn
        FROM public.job_runs
        WHERE job_id = p_job_id AND result_data IS NOT NULL
    )
    UPDATE public.job_runs
    SET result_data = NULL
    WHERE id IN (SELECT id FROM ranked WHERE rn > p_keep);

    GET DIAGNOSTICS cleaned = ROW_COUNT;
    RETURN cleaned;
END;
$$ LANGUAGE plpgsql;
