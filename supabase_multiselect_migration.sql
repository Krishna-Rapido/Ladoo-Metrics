-- =============================================================================
-- Migration: Global Parameter Options for Multi-Select Dashboard Parameters
-- =============================================================================
-- Run this in your Supabase SQL Editor to enable multi-select parameter support.
-- This creates a table storing default option lists for parameters like city,
-- service_category, and mode_name that are used in custom dashboard SQL queries.
-- =============================================================================

-- 1. Create the global_parameter_options table
CREATE TABLE IF NOT EXISTS global_parameter_options (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    param_key   TEXT NOT NULL UNIQUE,           -- e.g. 'city', 'service_category'
    display_label TEXT NOT NULL,                 -- e.g. 'City', 'Service Category'
    options     JSONB NOT NULL DEFAULT '[]'::jsonb,  -- array of string values
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_global_parameter_options_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_global_parameter_options_updated_at
    ON global_parameter_options;

CREATE TRIGGER trigger_update_global_parameter_options_updated_at
    BEFORE UPDATE ON global_parameter_options
    FOR EACH ROW
    EXECUTE FUNCTION update_global_parameter_options_updated_at();

-- 3. Seed default options
INSERT INTO global_parameter_options (param_key, display_label, options)
VALUES
    ('city', 'City', '["delhi", "bangalore", "hyderabad", "chennai", "mumbai", "kolkata", "pune", "jaipur", "lucknow", "ahmedabad"]'::jsonb),
    ('service_category', 'Service Category', '["bike", "auto", "cab", "parcel"]'::jsonb),
    ('mode_name', 'Mode Name', '["link", "roaming", "order"]'::jsonb)
ON CONFLICT (param_key) DO UPDATE
    SET options = EXCLUDED.options,
        display_label = EXCLUDED.display_label;

-- 4. RLS: all authenticated users can read
ALTER TABLE global_parameter_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read global_parameter_options"
    ON global_parameter_options;

CREATE POLICY "Authenticated users can read global_parameter_options"
    ON global_parameter_options
    FOR SELECT
    TO authenticated
    USING (true);

-- Done! Verify with:
-- SELECT * FROM global_parameter_options;
