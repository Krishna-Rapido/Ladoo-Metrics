/**
 * InsightsNarrative
 *
 * "✨ Explain this" panel rendered below the Executive Summary table.
 * Sends the DiD rows to /ai/explain-insights and streams back a
 * plain-English explanation with key findings, concerns, and next steps.
 */

import { useState } from "react"
import { Sparkles, Loader2, AlertTriangle, ChevronRight, ArrowRight } from "lucide-react"
import { explainInsights, type AIExplainInsightsResponse } from "@/lib/aiApi"

interface InsightsNarrativeProps {
  summaryRows: Array<Record<string, unknown>>
  experimentContext?: {
    experiment_id?: string
    test_cohort_size?: number
    control_cohort_size?: number
    pre_days?: number
    post_days?: number
    city?: string
    service?: string
  }
}

export function InsightsNarrative({ summaryRows, experimentContext }: InsightsNarrativeProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AIExplainInsightsResponse | null>(null)
  const [error, setError] = useState("")
  const [expanded, setExpanded] = useState(false)

  async function handleExplain() {
    setLoading(true)
    setError("")
    try {
      const res = await explainInsights({
        summary_rows: summaryRows,
        experiment_context: experimentContext,
      })
      setResult(res)
      setExpanded(true)
    } catch (e) {
      setError("Failed to generate explanation. Try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border rounded-xl overflow-hidden">
      {/* Trigger bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-violet-50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-500" />
          <span className="text-sm font-medium text-violet-700">AI Explanation</span>
          {result && (
            <span className="text-xs text-muted-foreground">
              — plain English breakdown of this result
            </span>
          )}
        </div>
        {!result ? (
          <button
            onClick={handleExplain}
            disabled={loading || summaryRows.length === 0}
            className="flex items-center gap-1.5 text-sm bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium rounded-lg px-3 py-1.5 transition-colors"
          >
            {loading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Explaining…</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5" /> Explain this</>
            )}
          </button>
        ) : (
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1"
          >
            {expanded ? "Hide" : "Show"}
            <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>
        )}
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-50 text-xs text-red-600">{error}</div>
      )}

      {result && expanded && (
        <div className="p-4 space-y-4 bg-white">
          {/* Narrative */}
          <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed text-sm whitespace-pre-line">
            {result.narrative}
          </div>

          {/* Key findings */}
          {result.key_findings.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Key Findings</p>
              <ul className="space-y-1">
                {result.key_findings.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <ArrowRight className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Concerns */}
          {result.concerns.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Concerns</p>
              <ul className="space-y-1">
                {result.concerns.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommended next metrics */}
          {result.recommended_next_metrics.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Look at next</p>
              <div className="flex flex-wrap gap-2">
                {result.recommended_next_metrics.map((m, i) => (
                  <span key={i} className="text-xs bg-violet-100 text-violet-700 rounded-full px-3 py-1">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Regenerate */}
          <button
            onClick={handleExplain}
            disabled={loading}
            className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1 pt-1"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Regenerate explanation
          </button>
        </div>
      )}
    </div>
  )
}
