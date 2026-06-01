-- =============================================================================
-- MIGRATION: Add chart_configs column to custom_dashboards
-- Supports saving multiple visualization templates per dashboard.
-- =============================================================================
-- Run this in your Supabase Dashboard SQL Editor:
-- https://supabase.com/dashboard/project/croniadpudboidlouhuu/sql/new
-- =============================================================================

ALTER TABLE public.custom_dashboards
    ADD COLUMN IF NOT EXISTS chart_configs JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.custom_dashboards.chart_configs IS
    'Array of ChartConfig objects (chartType, xAxis, yAxes, seriesColumns, aggregation) saved as a visualization template.';
