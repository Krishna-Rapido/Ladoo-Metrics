-- =============================================================================
-- SUPABASE MIGRATION: Knowledge Graph tables
-- =============================================================================
-- Run this SQL in your Supabase Dashboard SQL Editor:
-- https://supabase.com/dashboard/project/croniadpudboidlouhuu/sql/new
-- =============================================================================
-- Fully idempotent — safe to re-run.
-- RLS: all operations restricted to authenticated users only.
-- =============================================================================

-- Ensure the updated_at trigger function exists (idempotent)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SCHEMA TABLES — Registered table metadata
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.schema_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL UNIQUE,
    friendly_name TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    grain TEXT NOT NULL DEFAULT '',
    time_column TEXT NOT NULL DEFAULT '',
    time_format TEXT NOT NULL DEFAULT '',
    default_filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schema_tables_user_id ON public.schema_tables(user_id);
CREATE INDEX IF NOT EXISTS idx_schema_tables_table_name ON public.schema_tables(table_name);

ALTER TABLE public.schema_tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "All users can view schema tables" ON public.schema_tables;
DROP POLICY IF EXISTS "Authenticated users can create schema tables" ON public.schema_tables;
DROP POLICY IF EXISTS "Creators can update own schema tables" ON public.schema_tables;
DROP POLICY IF EXISTS "Creators can delete own schema tables" ON public.schema_tables;

CREATE POLICY "All users can view schema tables"
    ON public.schema_tables FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create schema tables"
    ON public.schema_tables FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "Creators can update own schema tables"
    ON public.schema_tables FOR UPDATE TO authenticated
    USING (true);

CREATE POLICY "Creators can delete own schema tables"
    ON public.schema_tables FOR DELETE TO authenticated
    USING (true);

DROP TRIGGER IF EXISTS set_schema_tables_updated_at ON public.schema_tables;
CREATE TRIGGER set_schema_tables_updated_at
    BEFORE UPDATE ON public.schema_tables
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- SCHEMA COLUMNS — Column metadata per table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.schema_columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES public.schema_tables(id) ON DELETE CASCADE,
    column_name TEXT NOT NULL,
    data_type TEXT NOT NULL DEFAULT '',
    friendly_name TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'dimension',
    is_nullable BOOLEAN NOT NULL DEFAULT true,
    sample_values JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(table_id, column_name)
);

CREATE INDEX IF NOT EXISTS idx_schema_columns_table_id ON public.schema_columns(table_id);

ALTER TABLE public.schema_columns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "All users can view schema columns" ON public.schema_columns;
DROP POLICY IF EXISTS "All users can create schema columns" ON public.schema_columns;
DROP POLICY IF EXISTS "All users can update schema columns" ON public.schema_columns;
DROP POLICY IF EXISTS "All users can delete schema columns" ON public.schema_columns;

CREATE POLICY "All users can view schema columns"
    ON public.schema_columns FOR SELECT TO authenticated USING (true);

CREATE POLICY "All users can create schema columns"
    ON public.schema_columns FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All users can update schema columns"
    ON public.schema_columns FOR UPDATE TO authenticated USING (true);

CREATE POLICY "All users can delete schema columns"
    ON public.schema_columns FOR DELETE TO authenticated USING (true);

DROP TRIGGER IF EXISTS set_schema_columns_updated_at ON public.schema_columns;
CREATE TRIGGER set_schema_columns_updated_at
    BEFORE UPDATE ON public.schema_columns
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- SCHEMA RELATIONSHIPS — Join relationships between tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.schema_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_table_id UUID NOT NULL REFERENCES public.schema_tables(id) ON DELETE CASCADE,
    from_column TEXT NOT NULL,
    to_table_id UUID NOT NULL REFERENCES public.schema_tables(id) ON DELETE CASCADE,
    to_column TEXT NOT NULL,
    join_type TEXT NOT NULL DEFAULT 'inner',
    confidence FLOAT NOT NULL DEFAULT 0.0,
    is_approved BOOLEAN NOT NULL DEFAULT false,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    inference_reason TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(from_table_id, from_column, to_table_id, to_column)
);

CREATE INDEX IF NOT EXISTS idx_schema_relationships_from ON public.schema_relationships(from_table_id);
CREATE INDEX IF NOT EXISTS idx_schema_relationships_to ON public.schema_relationships(to_table_id);

ALTER TABLE public.schema_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "All users can view schema relationships" ON public.schema_relationships;
DROP POLICY IF EXISTS "All users can create schema relationships" ON public.schema_relationships;
DROP POLICY IF EXISTS "All users can update schema relationships" ON public.schema_relationships;
DROP POLICY IF EXISTS "All users can delete schema relationships" ON public.schema_relationships;

CREATE POLICY "All users can view schema relationships"
    ON public.schema_relationships FOR SELECT TO authenticated USING (true);

CREATE POLICY "All users can create schema relationships"
    ON public.schema_relationships FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All users can update schema relationships"
    ON public.schema_relationships FOR UPDATE TO authenticated USING (true);

CREATE POLICY "All users can delete schema relationships"
    ON public.schema_relationships FOR DELETE TO authenticated USING (true);

DROP TRIGGER IF EXISTS set_schema_relationships_updated_at ON public.schema_relationships;
CREATE TRIGGER set_schema_relationships_updated_at
    BEFORE UPDATE ON public.schema_relationships
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- NL QUERIES — Query history and feedback
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.nl_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    interpreted_intent TEXT NOT NULL DEFAULT '',
    generated_sql TEXT NOT NULL DEFAULT '',
    final_sql TEXT NOT NULL DEFAULT '',
    was_executed BOOLEAN NOT NULL DEFAULT false,
    execution_time_ms INT,
    row_count INT,
    result_preview JSONB,
    error TEXT,
    feedback TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nl_queries_user_id ON public.nl_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_nl_queries_created_at ON public.nl_queries(created_at DESC);

ALTER TABLE public.nl_queries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own queries" ON public.nl_queries;
DROP POLICY IF EXISTS "Users can create own queries" ON public.nl_queries;
DROP POLICY IF EXISTS "Users can update own queries" ON public.nl_queries;

CREATE POLICY "Users can view own queries"
    ON public.nl_queries FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Users can create own queries"
    ON public.nl_queries FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "Users can update own queries"
    ON public.nl_queries FOR UPDATE TO authenticated
    USING (true);
