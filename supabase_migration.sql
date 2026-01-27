-- =============================================================================
-- SUPABASE MIGRATION: Create saved_reports and report_folders tables
-- =============================================================================
-- Run this SQL in your Supabase Dashboard SQL Editor:
-- https://supabase.com/dashboard/project/croniadpudboidlouhuu/sql/new
-- =============================================================================

-- Create trigger function for updated_at (shared by multiple tables)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- REPORT FOLDERS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.report_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    parent_id UUID REFERENCES public.report_folders(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for parent folder lookups
CREATE INDEX IF NOT EXISTS idx_report_folders_parent_id ON public.report_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_report_folders_created_by ON public.report_folders(created_by);

-- Enable RLS
ALTER TABLE public.report_folders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for clean migration)
DROP POLICY IF EXISTS "All users can view folders" ON public.report_folders;
DROP POLICY IF EXISTS "Authenticated users can create folders" ON public.report_folders;
DROP POLICY IF EXISTS "Creators can update own folders" ON public.report_folders;
DROP POLICY IF EXISTS "Creators can delete own folders" ON public.report_folders;

-- All authenticated users can view all folders
CREATE POLICY "All users can view folders"
    ON public.report_folders
    FOR SELECT
    TO authenticated
    USING (true);

-- Any authenticated user can create folders
CREATE POLICY "Authenticated users can create folders"
    ON public.report_folders
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- Only creator can update their folders
CREATE POLICY "Creators can update own folders"
    ON public.report_folders
    FOR UPDATE
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);

-- Only creator can delete their folders
CREATE POLICY "Creators can delete own folders"
    ON public.report_folders
    FOR DELETE
    USING (auth.uid() = created_by);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS set_updated_at_folders ON public.report_folders;
CREATE TRIGGER set_updated_at_folders
    BEFORE UPDATE ON public.report_folders
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- SAVED REPORTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.saved_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES public.report_folders(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_saved_reports_user_id ON public.saved_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_reports_folder_id ON public.saved_reports(folder_id);

-- Enable Row Level Security
ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for clean migration)
DROP POLICY IF EXISTS "Users can view own reports" ON public.saved_reports;
DROP POLICY IF EXISTS "Users can insert own reports" ON public.saved_reports;
DROP POLICY IF EXISTS "Users can update own reports" ON public.saved_reports;
DROP POLICY IF EXISTS "Users can delete own reports" ON public.saved_reports;
DROP POLICY IF EXISTS "All users can view all reports" ON public.saved_reports;

-- Policy: All authenticated users can view ALL reports (shared reports database)
CREATE POLICY "All users can view all reports"
    ON public.saved_reports
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Users can insert their own reports
CREATE POLICY "Users can insert own reports"
    ON public.saved_reports
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own reports
CREATE POLICY "Users can update own reports"
    ON public.saved_reports
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own reports
CREATE POLICY "Users can delete own reports"
    ON public.saved_reports
    FOR DELETE
    USING (auth.uid() = user_id);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS set_updated_at ON public.saved_reports;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.saved_reports
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- ADD folder_id COLUMN IF TABLE EXISTS (for existing installations)
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'saved_reports' 
        AND column_name = 'folder_id'
    ) THEN
        ALTER TABLE public.saved_reports 
        ADD COLUMN folder_id UUID REFERENCES public.report_folders(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_saved_reports_folder_id ON public.saved_reports(folder_id);
    END IF;
END $$;

-- =============================================================================
-- FUNCTION FOLDERS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.function_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    parent_id UUID REFERENCES public.function_folders(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_function_folders_parent_id ON public.function_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_function_folders_created_by ON public.function_folders(created_by);

ALTER TABLE public.function_folders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for clean migration)
DROP POLICY IF EXISTS "All users can view function folders" ON public.function_folders;
DROP POLICY IF EXISTS "Authenticated users can create function folders" ON public.function_folders;
DROP POLICY IF EXISTS "Creators can update own function folders" ON public.function_folders;
DROP POLICY IF EXISTS "Creators can delete own function folders" ON public.function_folders;

CREATE POLICY "All users can view function folders"
    ON public.function_folders FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create function folders"
    ON public.function_folders FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update own function folders"
    ON public.function_folders FOR UPDATE
    USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can delete own function folders"
    ON public.function_folders FOR DELETE USING (auth.uid() = created_by);

DROP TRIGGER IF EXISTS set_updated_at_function_folders ON public.function_folders;
CREATE TRIGGER set_updated_at_function_folders
    BEFORE UPDATE ON public.function_folders
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- METRIC FUNCTIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.metric_functions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES public.function_folders(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    code TEXT NOT NULL,
    parameters JSONB NOT NULL DEFAULT '[]'::jsonb,
    output_columns JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_validated BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Parameters structure: [{ "name": "start_date", "type": "date", "default": "20250101", "label": "Start Date" }, ...]
-- Output columns structure: [{ "name": "metric_name", "type": "float" }, ...]

CREATE INDEX IF NOT EXISTS idx_metric_functions_user_id ON public.metric_functions(user_id);
CREATE INDEX IF NOT EXISTS idx_metric_functions_folder_id ON public.metric_functions(folder_id);
CREATE INDEX IF NOT EXISTS idx_metric_functions_validated ON public.metric_functions(is_validated);

ALTER TABLE public.metric_functions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for clean migration)
DROP POLICY IF EXISTS "All users can view all functions" ON public.metric_functions;
DROP POLICY IF EXISTS "Users can insert own functions" ON public.metric_functions;
DROP POLICY IF EXISTS "Users can update own functions" ON public.metric_functions;
DROP POLICY IF EXISTS "Users can delete own functions" ON public.metric_functions;

-- All authenticated users can view ALL functions (shared library)
CREATE POLICY "All users can view all functions"
    ON public.metric_functions FOR SELECT TO authenticated USING (true);

-- Users can insert their own functions
CREATE POLICY "Users can insert own functions"
    ON public.metric_functions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Users can update their own functions
CREATE POLICY "Users can update own functions"
    ON public.metric_functions FOR UPDATE
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Users can delete their own functions
CREATE POLICY "Users can delete own functions"
    ON public.metric_functions FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_updated_at_metric_functions ON public.metric_functions;
CREATE TRIGGER set_updated_at_metric_functions
    BEFORE UPDATE ON public.metric_functions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- VERIFICATION: Run these to check the tables were created successfully
-- =============================================================================
-- SELECT * FROM public.report_folders LIMIT 5;
-- SELECT * FROM public.saved_reports LIMIT 5;
-- SELECT * FROM public.function_folders LIMIT 5;
-- SELECT * FROM public.metric_functions LIMIT 5;
