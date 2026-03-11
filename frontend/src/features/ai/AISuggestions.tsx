/**
 * AISuggestions
 *
 * Collapsible panel shown in InsightsConfigSidebar once cohorts + dates are set.
 * Calls /ai/suggest-metrics and renders ranked suggestions the analyst can add
 * to their metric selection with one click.
 */

import { useEffect, useState } from "react"
import { Sparkles, Loader2, Plus, ChevronDown, ChevronUp, Zap } from "lucide-react"
import { suggestMetrics, type MetricSuggestionItem } from "@/lib/aiApi"

interface AISuggestionsProps {
  sessionColumns: string[]
  selectedMetrics: string[]
  experimentType?: string
  cohortSizes?: Record<string, number>
  dateRangeDays?: number
  onAddMetric: (suggestion: MetricSuggestionItem) => void
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }
const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-gray-100 text-gray-600",
}
const SOURCE_BADGE: Record<string, string> = {
  existing_column: "bg-green-100 text-green-700",
  ratio: "bg-blue-100 text-blue-700",
  generate_function: "bg-violet-100 text-violet-700",
}
const SOURCE_LABEL: Record<string, string> = {
  existing_column: "In dataset",
  ratio: "Ratio",
  generate_function: "Generate",
}

export function AISuggestions({
  sessionColumns,
  selectedMetrics,
  experimentType = "unknown",
  cohortSizes,
  dateRangeDays = 14,
  onAddMetric,
}: AISuggestionsProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<MetricSuggestionItem[]>([])
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [error, setError] = useState("")

  // Auto-fetch when panel is opened for the first time
  useEffect(() => {
    if (open && suggestions.length === 0 && !loading) {
      fetchSuggestions()
    }
  }, [open])

  async function fetchSuggestions() {
    setLoading(true)
    setError("")
    try {
      const res = await suggestMetrics({
        session_columns: sessionColumns,
        selected_metrics: selectedMetrics,
        experiment_type: experimentType,
        cohort_sizes: cohortSizes,
        date_range_days: dateRangeDays,
      })
      const sorted = [...res.suggestions].sort(
        (a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)
      )
      setSuggestions(sorted)
    } catch (e) {
      setError("Failed to load suggestions. Try again.")
    } finally {
      setLoading(false)
    }
  }

  function handleAdd(s: MetricSuggestionItem) {
    onAddMetric(s)
    setAdded(prev => new Set([...prev, s.label]))
  }

  const highPriority = suggestions.filter(s => s.priority === "high")

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-violet-50 hover:bg-violet-100 transition-colors text-left"
      >
        <Sparkles className="w-3.5 h-3.5 text-violet-500 shrink-0" />
        <span className="text-xs font-medium text-violet-700 flex-1">
          AI Metric Suggestions
        </span>
        {!open && highPriority.length > 0 && (
          <span className="text-xs bg-red-100 text-red-700 rounded px-1.5 py-0.5 font-medium">
            {highPriority.length} high priority
          </span>
        )}
        {loading && <Loader2 className="w-3 h-3 animate-spin text-violet-500" />}
        {open ? <ChevronUp className="w-3 h-3 text-violet-500" /> : <ChevronDown className="w-3 h-3 text-violet-500" />}
      </button>

      {open && (
        <div className="p-3 space-y-2">
          {loading && (
            <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Analyzing your experiment…</span>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-600 text-center py-2">
              {error}
              <button onClick={fetchSuggestions} className="ml-2 underline">Retry</button>
            </div>
          )}

          {!loading && suggestions.length === 0 && !error && (
            <p className="text-xs text-muted-foreground text-center py-2">No suggestions yet.</p>
          )}

          {suggestions.map((s, i) => {
            const isAdded = added.has(s.label)
            return (
              <div key={i} className={`border rounded-lg p-2.5 space-y-1.5 transition-colors ${isAdded ? "opacity-50 bg-gray-50" : "hover:border-violet-300"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap gap-1 items-center min-w-0">
                    <span className="text-xs font-medium text-gray-800 truncate">{s.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${PRIORITY_BADGE[s.priority] ?? PRIORITY_BADGE.medium}`}>
                      {s.priority}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${SOURCE_BADGE[s.source] ?? ""}`}>
                      {SOURCE_LABEL[s.source] ?? s.source}
                    </span>
                  </div>
                  <button
                    onClick={() => !isAdded && handleAdd(s)}
                    disabled={isAdded}
                    className="shrink-0 flex items-center gap-1 text-xs bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 text-white rounded px-2 py-1 transition-colors"
                  >
                    {isAdded ? "Added" : <><Plus className="w-3 h-3" />Add</>}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground leading-snug">{s.description}</p>
                {s.why && (
                  <p className="text-[10px] text-violet-600 flex gap-1 items-start">
                    <Zap className="w-3 h-3 shrink-0 mt-0.5" />
                    {s.why}
                  </p>
                )}
              </div>
            )
          })}

          {!loading && suggestions.length > 0 && (
            <button
              onClick={fetchSuggestions}
              className="w-full text-xs text-violet-600 hover:text-violet-800 py-1 transition-colors"
            >
              Refresh suggestions
            </button>
          )}
        </div>
      )}
    </div>
  )
}
