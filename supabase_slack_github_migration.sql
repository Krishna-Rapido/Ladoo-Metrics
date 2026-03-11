-- Migration: slack_github_mappings
-- Maps Slack threads to GitHub issues/PRs for the Ladoo development pipeline.

-- Ensure the updated_at trigger function exists
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.slack_github_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slack_channel TEXT NOT NULL,
    slack_thread_ts TEXT NOT NULL,
    slack_user TEXT,
    original_text TEXT,
    github_issue_number INTEGER NOT NULL,
    github_issue_url TEXT NOT NULL,
    github_pr_number INTEGER,
    github_pr_url TEXT,
    status TEXT NOT NULL DEFAULT 'issue_created'
        CHECK (status IN ('issue_created','in_progress','pr_opened',
                          'tests_passed','tests_failed','merged','closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgm_issue ON public.slack_github_mappings(github_issue_number);
CREATE INDEX IF NOT EXISTS idx_sgm_pr ON public.slack_github_mappings(github_pr_number);
CREATE INDEX IF NOT EXISTS idx_sgm_thread ON public.slack_github_mappings(slack_channel, slack_thread_ts);

ALTER TABLE public.slack_github_mappings ENABLE ROW LEVEL SECURITY;

-- Allow full access (internal service usage only)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'slack_github_mappings' AND policyname = 'Full access'
    ) THEN
        CREATE POLICY "Full access" ON public.slack_github_mappings FOR ALL USING (true) WITH CHECK (true);
    END IF;
END
$$;

CREATE OR REPLACE TRIGGER handle_slack_github_mappings_updated_at
    BEFORE UPDATE ON public.slack_github_mappings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
