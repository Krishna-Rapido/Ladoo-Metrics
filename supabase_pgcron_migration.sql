-- =============================================================================
-- Supabase pg_cron Migration for Scheduled Dashboard Precomputation
-- =============================================================================
-- Run this in the Supabase SQL Editor AFTER supabase_scheduler_migration.sql
--
-- How it works:
--   pg_cron manages the TIMING (visible in Supabase Cron dashboard).
--   Each scheduled_job gets a pg_cron entry that runs a simple SQL UPDATE
--   to set next_run_at = now(), which flags the job as "due".
--   The backend's asyncio scheduler polls every 60s, picks up due jobs,
--   and executes them against Presto.
-- =============================================================================

-- 1. Enable pg_cron (should already be enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Add cron_job_id column to track the pg_cron entry per job
ALTER TABLE public.scheduled_jobs
    ADD COLUMN IF NOT EXISTS cron_job_id BIGINT;

-- 3. Function to schedule a pg_cron entry for a job
--    Creates a cron entry that sets next_run_at = now() on the matching job
CREATE OR REPLACE FUNCTION public.schedule_cron_job(
    p_job_id UUID,
    p_cron_expression TEXT
) RETURNS BIGINT AS $$
DECLARE
    v_job_name TEXT;
    v_cron_id BIGINT;
BEGIN
    v_job_name := 'sched_' || p_job_id::TEXT;

    -- Try to unschedule existing entry (ignore error if not found)
    BEGIN
        PERFORM cron.unschedule(v_job_name);
    EXCEPTION WHEN OTHERS THEN
        -- Job didn't exist yet, that's fine
    END;

    -- Schedule: on cron fire, set next_run_at = now() so the backend picks it up
    SELECT cron.schedule(
        v_job_name,
        p_cron_expression,
        format(
            $SQL$UPDATE public.scheduled_jobs SET next_run_at = now() WHERE id = %L AND enabled = true AND locked_by IS NULL$SQL$,
            p_job_id::TEXT
        )
    ) INTO v_cron_id;

    -- Store the cron_job_id
    UPDATE public.scheduled_jobs SET cron_job_id = v_cron_id WHERE id = p_job_id;

    RETURN v_cron_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Function to unschedule a pg_cron entry
CREATE OR REPLACE FUNCTION public.unschedule_cron_job(p_job_id UUID)
RETURNS VOID AS $$
DECLARE
    v_job_name TEXT;
BEGIN
    v_job_name := 'sched_' || p_job_id::TEXT;
    BEGIN
        PERFORM cron.unschedule(v_job_name);
    EXCEPTION WHEN OTHERS THEN
        -- Ignore if not found
    END;
    UPDATE public.scheduled_jobs SET cron_job_id = NULL WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger to auto-manage pg_cron entries on job changes
--    Catches all errors so job CRUD never fails due to pg_cron issues
CREATE OR REPLACE FUNCTION public.sync_cron_on_job_change()
RETURNS TRIGGER AS $$
BEGIN
    BEGIN
        IF TG_OP = 'INSERT' AND NEW.enabled THEN
            PERFORM public.schedule_cron_job(NEW.id, NEW.cron_expression);
        END IF;

        IF TG_OP = 'UPDATE' THEN
            IF NEW.enabled AND (OLD.cron_expression != NEW.cron_expression OR NOT OLD.enabled) THEN
                PERFORM public.schedule_cron_job(NEW.id, NEW.cron_expression);
            ELSIF NOT NEW.enabled AND OLD.enabled THEN
                PERFORM public.unschedule_cron_job(NEW.id);
            END IF;
        END IF;

        IF TG_OP = 'DELETE' THEN
            PERFORM public.unschedule_cron_job(OLD.id);
            RETURN OLD;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'sync_cron_on_job_change: %', SQLERRM;
    END;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_cron_on_job_change ON public.scheduled_jobs;
CREATE TRIGGER trg_sync_cron_on_job_change
    AFTER INSERT OR UPDATE OR DELETE ON public.scheduled_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_cron_on_job_change();

-- =============================================================================
-- 6. Bootstrap: create pg_cron entries for all existing enabled jobs
-- =============================================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, cron_expression FROM public.scheduled_jobs WHERE enabled = true
    LOOP
        BEGIN
            PERFORM public.schedule_cron_job(r.id, r.cron_expression);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to schedule job %: %', r.id, SQLERRM;
        END;
    END LOOP;
END;
$$;
