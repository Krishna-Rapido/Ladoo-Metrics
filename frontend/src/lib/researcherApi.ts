/**
 * Researcher API client — Captain Segment Discovery Lab
 * All calls to the /researcher/* backend routes.
 */

import axios from "axios"

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8001"
const RESEARCHER_TIMEOUT_MS = 180_000 // 3 min — Presto queries can be slow

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FeatureComparison {
  feature: string
  group_a_mean: number
  group_b_mean: number
  effect_size: number
  p_value: number
  test_used: string
  significant: boolean
}

export interface ResponseProfileItem {
  captain_id: string
  incentive_elasticity: number | null
  incentive_persistence: number | null
  target_earning_score: number | null
  loss_response: number | null
  frustration_resilience: number | null
  behavioral_inertia: number | null
  efficiency_slope: number | null
  demand_supply_fit: number | null
}

export interface GateResult {
  gate: string
  passed: boolean
  value: number | null
  threshold: number | null
  detail: string
}

// --- Contrast Analysis ---

export interface ContrastAnalysisRequest {
  username: string
  city: string
  start_date: string
  end_date: string
  consistency_segment?: string
  performance_segment?: string
  splitting_outcome: string
  custom_column?: string
  custom_threshold?: number
  custom_direction?: string
  min_group_size?: number
}

export interface ContrastAnalysisResponse {
  success: boolean
  group_a_label: string
  group_b_label: string
  group_a_size: number
  group_b_size: number
  comparisons: FeatureComparison[]
  top_features: string[]
  queries: string[]
  error: string
}

// --- Stimulus-Response ---

export interface StimulusResponseRequest {
  username: string
  city: string
  start_date: string
  end_date: string
  axes?: string[]
  consistency_segment?: string
  performance_segment?: string
  min_active_days?: number
}

export interface StimulusResponseResponse {
  success: boolean
  captain_count: number
  profiles: ResponseProfileItem[]
  axis_stats: Record<string, { mean: number; median: number; std: number; min: number; max: number; count: number }>
  queries: string[]
  error: string
}

// --- Validation ---

export interface ValidateSegmentRequest {
  username: string
  city: string
  start_date: string
  end_date: string
  segment_name: string
  segment_definition: { feature: string; operator: string; threshold: number }
  consistency_segment?: string
  performance_segment?: string
  actionability_note?: string
}

export interface ValidateSegmentResponse {
  success: boolean
  segment_name: string
  segment_size: number
  population_size: number
  population_pct: number
  gates: GateResult[]
  gates_passed: number
  total_gates: number
  ready_to_publish: boolean
  error: string
}

// --- Segments ---

export interface SegmentCreateRequest {
  name: string
  description: string
  definition: string
  method: string
  city?: string
  population_context?: string
  validation?: Record<string, unknown>
  segment_size?: number
  population_pct?: number
  key_features?: string[]
  actionability_note?: string
  investigation_id?: string
}

export interface SegmentItem {
  id: string
  name: string
  description: string
  definition: string
  method: string
  city: string | null
  population_context: string | null
  validation: Record<string, unknown>
  segment_size: number | null
  population_pct: number | null
  key_features: string[]
  status: string
  actionability_note: string | null
  created_by: string
  created_at: string
  updated_at: string
}

// --- Investigations ---

export interface InvestigationCreateRequest {
  title: string
  description?: string
  method: string
  config?: Record<string, unknown>
}

export interface InvestigationItem {
  id: string
  user_id: string
  title: string
  description: string | null
  method: string
  status: string
  config: Record<string, unknown>
  results: Record<string, unknown> | null
  notebook: Array<Record<string, unknown>>
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

function authHeaders() {
  const token = localStorage.getItem("sb-access-token")
  const userId = localStorage.getItem("sb-user-id")
  const headers: Record<string, string> = {}
  if (token) headers["Authorization"] = `Bearer ${token}`
  if (userId) headers["X-User-Id"] = userId
  return headers
}

export async function runContrastAnalysis(
  req: ContrastAnalysisRequest,
): Promise<ContrastAnalysisResponse> {
  const { data } = await axios.post(`${BASE_URL}/researcher/contrast`, req, {
    timeout: RESEARCHER_TIMEOUT_MS,
  })
  return data
}

export async function runStimulusResponse(
  req: StimulusResponseRequest,
): Promise<StimulusResponseResponse> {
  const { data } = await axios.post(
    `${BASE_URL}/researcher/stimulus-response`,
    req,
    { timeout: RESEARCHER_TIMEOUT_MS },
  )
  return data
}

export async function validateSegment(
  req: ValidateSegmentRequest,
): Promise<ValidateSegmentResponse> {
  const { data } = await axios.post(`${BASE_URL}/researcher/validate`, req, {
    timeout: RESEARCHER_TIMEOUT_MS,
  })
  return data
}

export async function listSegments(): Promise<SegmentItem[]> {
  const { data } = await axios.get(`${BASE_URL}/researcher/segments`, {
    headers: authHeaders(),
    timeout: 30_000,
  })
  return data.segments
}

export async function createSegment(
  req: SegmentCreateRequest,
): Promise<SegmentItem> {
  const { data } = await axios.post(`${BASE_URL}/researcher/segments`, req, {
    headers: authHeaders(),
    timeout: 30_000,
  })
  return data
}

export async function listInvestigations(): Promise<InvestigationItem[]> {
  const { data } = await axios.get(
    `${BASE_URL}/researcher/investigations`,
    { headers: authHeaders(), timeout: 30_000 },
  )
  return data.investigations
}

export async function createInvestigation(
  req: InvestigationCreateRequest,
): Promise<InvestigationItem> {
  const { data } = await axios.post(
    `${BASE_URL}/researcher/investigations`,
    req,
    { headers: authHeaders(), timeout: 30_000 },
  )
  return data
}

// ---------------------------------------------------------------------------
// Chat (Conversational Agent — SSE)
// ---------------------------------------------------------------------------

export interface ChatRule {
  type: string
  content: string
  scope: string
}

export function createChatStream(
  messages: { role: string; content: string }[],
  username: string,
  signal?: AbortSignal,
  rules?: ChatRule[],
): Promise<Response> {
  return fetch(`${BASE_URL}/researcher/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, username, rules: rules || [] }),
    signal,
  })
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Presto Connection Test
// ---------------------------------------------------------------------------

export interface TableTestResult {
  table: string
  accessible: boolean
  row_count: number | null
  columns_found: string[]
  error: string | null
  query_ms: number
}

export interface PrestoTestResponse {
  connected: boolean
  username: string
  presto_host: string
  presto_port: number
  basic_query_ok: boolean
  basic_query_error: string | null
  tables: TableTestResult[]
  summary: string
}

export async function testPrestoConnection(
  username: string,
): Promise<PrestoTestResponse> {
  const { data } = await axios.post<PrestoTestResponse>(
    `${BASE_URL}/researcher/test-connection`,
    { username },
    { timeout: 60_000 },
  )
  return data
}

// ---------------------------------------------------------------------------

export async function updateInvestigation(
  id: string,
  updates: Partial<{
    title: string
    description: string
    status: string
    config: Record<string, unknown>
    results: Record<string, unknown>
    notebook_entry: Record<string, unknown>
  }>,
): Promise<InvestigationItem> {
  const { data } = await axios.patch(
    `${BASE_URL}/researcher/investigations/${id}`,
    updates,
    { headers: authHeaders(), timeout: 30_000 },
  )
  return data
}
