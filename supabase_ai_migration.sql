-- =============================================================================
-- SUPABASE MIGRATION: AI Agent tables
-- Run in Supabase Dashboard SQL Editor:
-- https://supabase.com/dashboard/project/croniadpudboidlouhuu/sql/new
-- =============================================================================

-- =============================================================================
-- AI DISCOVERIES TABLE
-- Stores results of ProblemDiscovery scans so all users see the same feed
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_discoveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    triggered_by UUID REFERENCES auth.users(id),
    city TEXT,
    service_category TEXT,
    lookback_days INTEGER DEFAULT 35,
    findings JSONB NOT NULL DEFAULT '[]',
    narrative TEXT,
    checks_run INTEGER DEFAULT 0,
    is_scheduled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_discoveries_scan_timestamp ON public.ai_discoveries(scan_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ai_discoveries_triggered_by ON public.ai_discoveries(triggered_by);

ALTER TABLE public.ai_discoveries ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view all discoveries
CREATE POLICY "All users can view discoveries"
    ON public.ai_discoveries FOR SELECT
    TO authenticated USING (true);

-- Any authenticated user can create a discovery scan
CREATE POLICY "Authenticated users can create discoveries"
    ON public.ai_discoveries FOR INSERT
    TO authenticated WITH CHECK (auth.uid() = triggered_by OR triggered_by IS NULL);


-- =============================================================================
-- AI GENERATED METRICS TABLE
-- Tracks AI-generated functions: provenance, usage, quality signal
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_generated_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- The generated function (mirrors metric_functions structure)
    name TEXT NOT NULL,
    description TEXT,
    code TEXT NOT NULL,
    parameters JSONB NOT NULL DEFAULT '[]',
    output_columns JSONB NOT NULL DEFAULT '[]',

    -- AI provenance
    prompt TEXT NOT NULL,                        -- original description the user typed
    explanation TEXT,                            -- AI's explanation of the metric
    alternatives JSONB DEFAULT '[]',             -- alternative metrics AI suggested
    confidence TEXT DEFAULT 'medium',            -- high / medium / low

    -- Quality signal (updated when analyst uses this metric)
    times_used INTEGER DEFAULT 0,
    saved_to_library BOOLEAN DEFAULT false,
    library_function_id UUID REFERENCES public.metric_functions(id),
    user_rating INTEGER                          -- 1-5 thumbs up/down from analyst
);

CREATE INDEX IF NOT EXISTS idx_ai_generated_metrics_created_by ON public.ai_generated_metrics(created_by);
CREATE INDEX IF NOT EXISTS idx_ai_generated_metrics_created_at ON public.ai_generated_metrics(created_at DESC);

ALTER TABLE public.ai_generated_metrics ENABLE ROW LEVEL SECURITY;

-- Users can see their own generated metrics
CREATE POLICY "Users can view own generated metrics"
    ON public.ai_generated_metrics FOR SELECT
    TO authenticated USING (auth.uid() = created_by);

-- Anyone can view high-rated metrics (saved to library) — useful for suggestions
CREATE POLICY "Anyone can view saved metrics"
    ON public.ai_generated_metrics FOR SELECT
    TO authenticated USING (saved_to_library = true);

CREATE POLICY "Users can create generated metrics"
    ON public.ai_generated_metrics FOR INSERT
    TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own generated metrics"
    ON public.ai_generated_metrics FOR UPDATE
    TO authenticated USING (auth.uid() = created_by);


-- Trigger for updated_at
CREATE TRIGGER handle_ai_generated_metrics_updated_at
    BEFORE UPDATE ON public.ai_generated_metrics
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
