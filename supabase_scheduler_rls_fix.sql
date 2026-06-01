-- Run this in the Supabase SQL Editor to add missing write policies
-- (needed for on-demand job execution via the user's JWT)

-- job_runs: allow users to INSERT/UPDATE/DELETE runs for their own jobs
CREATE POLICY IF NOT EXISTS "Users write own job runs"
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

-- materialized_results: allow users to INSERT/UPDATE/DELETE results for their own jobs
CREATE POLICY IF NOT EXISTS "Users write own materialized results"
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
