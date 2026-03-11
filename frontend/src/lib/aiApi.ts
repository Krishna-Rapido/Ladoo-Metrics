/**
 * AI Agent API client
 * All calls to the /ai/* backend routes.
 */

import axios from "axios"

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8001"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AIGenerateMetricRequest {
  description: string
  context?: string
  username: string
  function_catalog?: Array<Record<string, unknown>>
  test_immediately?: boolean
  default_params?: Record<string, string>
}

export interface AIGenerateMetricResponse {
  success: boolean
  code: string
  explanation: string
  alternatives: string[]
  parameters: Array<{ name: string; type: string; default: string; label: string }>
  output_columns: string[]
  preview: Array<Record<string, unknown>>
  error: string
  confidence: string
}

export interface AIRefineMetricRequest {
  original_code: string
  feedback: string
  username?: string
}

export interface AISuggestMetricsRequest {
  session_columns: string[]
  selected_metrics?: string[]
  experiment_type?: string
  cohort_sizes?: Record<string, number>
  date_range_days?: number
  extra_context?: string
}

export interface MetricSuggestionItem {
  label: string
  description: string
  why: string
  source: "existing_column" | "ratio" | "generate_function"
  column: string
  ratio_x: string
  ratio_y: string
  function_hint: string
  priority: "high" | "medium" | "low"
}

export interface AISuggestMetricsResponse {
  suggestions: MetricSuggestionItem[]
  behavioral_hypothesis: string
}

export interface AIDiscoverProblemsRequest {
  username: string
  city?: string
  service_category?: string
  lookback_days?: number
  check_types?: string[]
  enhance_with_llm?: boolean
}

export interface DiscoveryFindingItem {
  id: string
  title: string
  severity: "critical" | "warning" | "notice"
  segment: string
  metric: string
  finding: string
  hypothesis: string
  suggested_action: string
  z_score: number
  baseline: number
  recent: number
  pct_change: number
  data: { dates: string[]; values: number[] }
}

export interface AIDiscoverProblemsResponse {
  findings: DiscoveryFindingItem[]
  scan_timestamp: string
  checks_run: number
  city: string
  service_category: string
  narrative: string
}

export interface AIExplainInsightsRequest {
  summary_rows: Array<Record<string, unknown>>
  experiment_context?: {
    experiment_id?: string
    test_cohort_size?: number
    control_cohort_size?: number
    pre_days?: number
    post_days?: number
    city?: string
    service?: string
  }
}

export interface AIExplainInsightsResponse {
  narrative: string
  key_findings: string[]
  concerns: string[]
  recommended_next_metrics: string[]
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function generateMetric(req: AIGenerateMetricRequest): Promise<AIGenerateMetricResponse> {
  const { data } = await axios.post(`${BASE_URL}/ai/generate-metric`, req)
  return data
}

export async function refineMetric(req: AIRefineMetricRequest): Promise<AIGenerateMetricResponse> {
  const { data } = await axios.post(`${BASE_URL}/ai/refine-metric`, req)
  return data
}

export async function suggestMetrics(req: AISuggestMetricsRequest): Promise<AISuggestMetricsResponse> {
  const { data } = await axios.post(`${BASE_URL}/ai/suggest-metrics`, req)
  return data
}

export async function discoverProblems(req: AIDiscoverProblemsRequest): Promise<AIDiscoverProblemsResponse> {
  const { data } = await axios.post(`${BASE_URL}/ai/discover-problems`, req)
  return data
}

export async function explainInsights(req: AIExplainInsightsRequest): Promise<AIExplainInsightsResponse> {
  const { data } = await axios.post(`${BASE_URL}/ai/explain-insights`, req)
  return data
}
