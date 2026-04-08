/**
 * Knowledge Graph + NL Query API client
 * All calls to the /knowledge/* backend routes.
 */

import axios from "axios"

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8001"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SchemaTableCreate {
  table_name: string
  friendly_name?: string
  description?: string
  grain?: string
  time_column?: string
  time_format?: string
  default_filters?: Record<string, unknown>
  tags?: string[]
}

export interface SchemaTableUpdate {
  friendly_name?: string
  description?: string
  grain?: string
  time_column?: string
  time_format?: string
  default_filters?: Record<string, unknown>
  tags?: string[]
}

export interface SchemaColumn {
  id: string
  table_id: string
  column_name: string
  data_type: string
  friendly_name: string
  description: string
  category: "dimension" | "measure" | "time" | "identifier"
  is_nullable: boolean
  sample_values: unknown[]
}

export interface SchemaTable {
  id: string
  table_name: string
  friendly_name: string
  description: string
  grain: string
  time_column: string
  time_format: string
  default_filters: Record<string, unknown>
  tags: string[]
  columns: SchemaColumn[]
  created_at?: string
  updated_at?: string
}

export interface SchemaColumnCreate {
  column_name: string
  data_type?: string
  friendly_name?: string
  description?: string
  category?: string
  is_nullable?: boolean
  sample_values?: unknown[]
}

export interface SchemaColumnUpdate {
  friendly_name?: string
  description?: string
  category?: string
  data_type?: string
  is_nullable?: boolean
  sample_values?: unknown[]
}

export interface SchemaRelationship {
  id: string
  from_table_id: string
  from_column: string
  to_table_id: string
  to_column: string
  join_type: string
  confidence: number
  is_approved: boolean
  approved_by: string | null
  inference_reason: string
  from_table_name?: string
  to_table_name?: string
  created_at?: string
}

export interface SchemaRelationshipCreate {
  from_table_id: string
  from_column: string
  to_table_id: string
  to_column: string
  join_type?: string
  confidence?: number
  is_approved?: boolean
  inference_reason?: string
}

export interface AutoDetectResponse {
  table_name: string
  columns: SchemaColumnCreate[]
  error: string
}

export interface NLQueryRequest {
  question: string
  execute?: boolean
  sql_override?: string
  username?: string
}

export interface NLQueryResponse {
  success: boolean
  intent: string
  sql: string
  explanation: string
  rows: Array<Record<string, unknown>>
  columns: string[]
  row_count: number
  execution_time_ms: number
  query_id: string
  error: string
}

export interface NLQueryHistoryItem {
  id: string
  question: string
  interpreted_intent: string
  generated_sql: string
  was_executed: boolean
  row_count: number | null
  feedback: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { supabase } from "./supabase"

/** Build headers with user ID + Supabase access token for authenticated RLS. */
async function authHeaders(userId?: string) {
  const hdrs: Record<string, string> = {}
  if (userId) hdrs["X-User-Id"] = userId

  // Attach the user's Supabase access token so the backend Supabase client
  // operates as 'authenticated' role (required by RLS policies).
  try {
    const { data } = await supabase.auth.getSession()
    if (data.session?.access_token) {
      hdrs["Authorization"] = `Bearer ${data.session.access_token}`
    }
  } catch {
    // ignore — will fail RLS gracefully
  }
  return hdrs
}

const TIMEOUT_MS = 120_000

// ---------------------------------------------------------------------------
// Schema Tables
// ---------------------------------------------------------------------------

export async function createSchemaTable(
  userId: string,
  payload: SchemaTableCreate
): Promise<SchemaTable> {
  const { data } = await axios.post(`${BASE_URL}/knowledge/tables`, payload, {
    headers: await authHeaders(userId),
    timeout: TIMEOUT_MS,
  })
  return data
}

export async function listSchemaTables(): Promise<SchemaTable[]> {
  const { data } = await axios.get(`${BASE_URL}/knowledge/tables`, {
    headers: await authHeaders(),
    timeout: TIMEOUT_MS,
  })
  return Array.isArray(data) ? data : []
}

export async function getSchemaTable(tableId: string): Promise<SchemaTable> {
  const { data } = await axios.get(`${BASE_URL}/knowledge/tables/${tableId}`, {
    headers: await authHeaders(),
    timeout: TIMEOUT_MS,
  })
  return data
}

export async function updateSchemaTable(
  tableId: string,
  payload: SchemaTableUpdate
): Promise<SchemaTable> {
  const { data } = await axios.put(
    `${BASE_URL}/knowledge/tables/${tableId}`,
    payload,
    { headers: await authHeaders(), timeout: TIMEOUT_MS }
  )
  return data
}

export async function deleteSchemaTable(
  tableId: string,
  userId: string
): Promise<void> {
  await axios.delete(`${BASE_URL}/knowledge/tables/${tableId}`, {
    headers: await authHeaders(userId),
    timeout: TIMEOUT_MS,
  })
}

// ---------------------------------------------------------------------------
// Schema Columns
// ---------------------------------------------------------------------------

export async function bulkAddColumns(
  tableId: string,
  columns: SchemaColumnCreate[]
): Promise<{ inserted: number }> {
  const { data } = await axios.post(
    `${BASE_URL}/knowledge/tables/${tableId}/columns`,
    { columns },
    { headers: await authHeaders(), timeout: TIMEOUT_MS }
  )
  return data
}

export async function updateColumn(
  columnId: string,
  payload: SchemaColumnUpdate
): Promise<SchemaColumn> {
  const { data } = await axios.put(
    `${BASE_URL}/knowledge/columns/${columnId}`,
    payload,
    { headers: await authHeaders(), timeout: TIMEOUT_MS }
  )
  return data
}

export async function deleteColumn(columnId: string): Promise<void> {
  await axios.delete(`${BASE_URL}/knowledge/columns/${columnId}`, {
    headers: await authHeaders(),
    timeout: TIMEOUT_MS,
  })
}

// ---------------------------------------------------------------------------
// Auto-detect
// ---------------------------------------------------------------------------

export async function autoDetectTable(
  tableName: string,
  username: string
): Promise<AutoDetectResponse> {
  const { data } = await axios.post(
    `${BASE_URL}/knowledge/tables/auto-detect`,
    { table_name: tableName, username },
    { headers: await authHeaders(), timeout: TIMEOUT_MS }
  )
  return data
}

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------

export async function listRelationships(): Promise<SchemaRelationship[]> {
  const { data } = await axios.get(`${BASE_URL}/knowledge/relationships`, {
    headers: await authHeaders(),
    timeout: TIMEOUT_MS,
  })
  return Array.isArray(data) ? data : []
}

export async function createRelationship(
  userId: string,
  payload: SchemaRelationshipCreate
): Promise<SchemaRelationship> {
  const { data } = await axios.post(
    `${BASE_URL}/knowledge/relationships`,
    payload,
    { headers: await authHeaders(userId), timeout: TIMEOUT_MS }
  )
  return data
}

export async function updateRelationship(
  relId: string,
  userId: string,
  payload: { join_type?: string; is_approved?: boolean; confidence?: number }
): Promise<SchemaRelationship> {
  const { data } = await axios.put(
    `${BASE_URL}/knowledge/relationships/${relId}`,
    payload,
    { headers: await authHeaders(userId), timeout: TIMEOUT_MS }
  )
  return data
}

export async function deleteRelationship(relId: string): Promise<void> {
  await axios.delete(`${BASE_URL}/knowledge/relationships/${relId}`, {
    headers: await authHeaders(),
    timeout: TIMEOUT_MS,
  })
}

export async function inferRelationships(
  tableIds: string[] = []
): Promise<{ inferred: SchemaRelationship[]; count: number }> {
  const { data } = await axios.post(
    `${BASE_URL}/knowledge/relationships/infer`,
    { table_ids: tableIds },
    { headers: await authHeaders(), timeout: TIMEOUT_MS }
  )
  return data
}

// ---------------------------------------------------------------------------
// NL Query
// ---------------------------------------------------------------------------

export async function nlQuery(
  userId: string,
  payload: NLQueryRequest
): Promise<NLQueryResponse> {
  const { data } = await axios.post(`${BASE_URL}/knowledge/query`, payload, {
    headers: await authHeaders(userId),
    timeout: TIMEOUT_MS,
  })
  return data
}

export async function listQueryHistory(
  userId: string
): Promise<NLQueryHistoryItem[]> {
  const { data } = await axios.get(`${BASE_URL}/knowledge/queries`, {
    headers: await authHeaders(userId),
    timeout: TIMEOUT_MS,
  })
  return Array.isArray(data) ? data : []
}

export async function submitQueryFeedback(
  queryId: string,
  userId: string,
  feedback: "thumbs_up" | "thumbs_down"
): Promise<void> {
  await axios.post(
    `${BASE_URL}/knowledge/query/${queryId}/feedback`,
    { feedback },
    { headers: await authHeaders(userId), timeout: TIMEOUT_MS }
  )
}

// ---------------------------------------------------------------------------
// Dashboard Query Generation
// ---------------------------------------------------------------------------

export interface GenerateDashboardQueryResponse {
  success: boolean
  sql: string
  explanation: string
  detected_params: string[]
  error: string
}

export async function generateDashboardQuery(
  prompt: string
): Promise<GenerateDashboardQueryResponse> {
  const { data } = await axios.post(
    `${BASE_URL}/knowledge/generate-dashboard-query`,
    { prompt },
    { headers: await authHeaders(), timeout: TIMEOUT_MS }
  )
  return data
}
