-- =============================================================================
-- SUPABASE MIGRATION: Create custom_dashboards table
-- =============================================================================
-- Run this SQL in your Supabase Dashboard SQL Editor:
-- https://supabase.com/dashboard/project/croniadpudboidlouhuu/sql/new
-- =============================================================================

-- =============================================================================
-- CUSTOM DASHBOARDS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.custom_dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    folder TEXT NOT NULL,
    description TEXT,
    sql_query TEXT NOT NULL DEFAULT '',
    parameters JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique slug per folder to prevent URL collisions
CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_dashboards_folder_slug
    ON public.custom_dashboards(folder, slug);
CREATE INDEX IF NOT EXISTS idx_custom_dashboards_user_id
    ON public.custom_dashboards(user_id);

-- Enable RLS
ALTER TABLE public.custom_dashboards ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for clean migration)
DROP POLICY IF EXISTS "All users can view custom dashboards" ON public.custom_dashboards;
DROP POLICY IF EXISTS "Users can insert own custom dashboards" ON public.custom_dashboards;
DROP POLICY IF EXISTS "Users can update own custom dashboards" ON public.custom_dashboards;
DROP POLICY IF EXISTS "Users can delete own custom dashboards" ON public.custom_dashboards;

-- All authenticated users can view all custom dashboards (shared library)
CREATE POLICY "All users can view custom dashboards"
    ON public.custom_dashboards
    FOR SELECT
    TO authenticated
    USING (true);

-- Users can insert their own dashboards
CREATE POLICY "Users can insert own custom dashboards"
    ON public.custom_dashboards
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Only creator can update
CREATE POLICY "Users can update own custom dashboards"
    ON public.custom_dashboards
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Only creator can delete
CREATE POLICY "Users can delete own custom dashboards"
    ON public.custom_dashboards
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Auto-update updated_at timestamp
DROP TRIGGER IF EXISTS set_updated_at_custom_dashboards ON public.custom_dashboards;
CREATE TRIGGER set_updated_at_custom_dashboards
    BEFORE UPDATE ON public.custom_dashboards
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
