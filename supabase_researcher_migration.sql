-- =============================================================================
-- Researcher: Captain Segment Discovery Lab — Supabase Migration
-- =============================================================================
-- Run this in the Supabase SQL Editor to create the tables needed
-- for the Researcher feature.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Investigations — each research session / notebook
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.investigations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    method TEXT NOT NULL CHECK (method IN ('contrast', 'stimulus_response', 'residual', 'combined')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'exploring', 'validating', 'completed', 'archived')),

    -- Method-specific configuration (stored as JSONB for flexibility)
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- e.g. for contrast: { city, base_population_filters, splitting_outcome, ... }
    -- e.g. for stimulus_response: { city, stimulus_type, date_range, ... }

    -- Results snapshot (populated after exploration)
    results JSONB DEFAULT NULL,

    -- Lab notebook — append-only log of observations
    notebook JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Array of { timestamp, type: 'observation'|'chart'|'note', content, metadata }

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. Discovered Segments — validated and published segments
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.discovered_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id UUID REFERENCES public.investigations(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    name TEXT NOT NULL,
    description TEXT NOT NULL,
    definition TEXT NOT NULL,  -- Human-readable definition (e.g. "correlation(eph, login_hours) < -0.25")

    -- Discovery metadata
    method TEXT NOT NULL CHECK (method IN ('contrast', 'stimulus_response', 'residual', 'combined')),
    city TEXT,
    population_context TEXT,  -- "Daily-HP captains" etc.

    -- Validation scorecard (6-gate results)
    validation JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- { size: {passed, value, threshold}, separation: {passed, features: [...]}, ... }

    -- Segment statistics
    segment_size INTEGER,
    population_pct DOUBLE PRECISION,
    key_features JSONB DEFAULT '[]'::jsonb,  -- Top discriminating features

    -- Status
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'published', 'deprecated')),
    actionability_note TEXT,  -- Gate 6: "For this segment, we would do X differently"

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. Row-Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.investigations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovered_segments ENABLE ROW LEVEL SECURITY;

-- Investigations: all authenticated users can view; only owner can mutate
CREATE POLICY "Anyone can view investigations"
    ON public.investigations FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "Owner can create investigations"
    ON public.investigations FOR INSERT
    TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update investigations"
    ON public.investigations FOR UPDATE
    TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Owner can delete investigations"
    ON public.investigations FOR DELETE
    TO authenticated USING (auth.uid() = user_id);

-- Discovered segments: all authenticated users can view; only creator can mutate
CREATE POLICY "Anyone can view segments"
    ON public.discovered_segments FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "Creator can create segments"
    ON public.discovered_segments FOR INSERT
    TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator can update segments"
    ON public.discovered_segments FOR UPDATE
    TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "Creator can delete segments"
    ON public.discovered_segments FOR DELETE
    TO authenticated USING (auth.uid() = created_by);

-- ---------------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_investigations_user_id ON public.investigations(user_id);
CREATE INDEX IF NOT EXISTS idx_investigations_status ON public.investigations(status);
CREATE INDEX IF NOT EXISTS idx_discovered_segments_status ON public.discovered_segments(status);
CREATE INDEX IF NOT EXISTS idx_discovered_segments_created_by ON public.discovered_segments(created_by);

-- ---------------------------------------------------------------------------
-- 5. Updated_at trigger (reuse if exists, else create)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.investigations;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.investigations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.discovered_segments;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.discovered_segments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
