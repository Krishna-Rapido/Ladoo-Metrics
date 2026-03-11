/**
 * AIMetricGenerator
 *
 * A floating panel that lets any user describe a metric in plain English
 * and get a validated compute_metrics() function back from Claude.
 *
 * Entry points:
 *   - "✨ Generate with AI" button in FunctionEditor
 *   - "✨ Generate with AI" button in InsightsConfigSidebar (Add Metrics tab)
 */

import { useState } from "react"
import { Sparkles, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Copy, Check } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { generateMetric, refineMetric, type AIGenerateMetricResponse } from "@/lib/aiApi"

interface AIMetricGeneratorProps {
  /** Called when user clicks "Use this metric" — passes code + metadata back */
  onUse: (result: {
    code: string
    name: string
    description: string
    parameters: Array<{ name: string; type: string; default: string; label: string }>
    output_columns: string[]
  }) => void
  /** Pre-populated context about the current session */
  sessionContext?: string
  functionCatalog?: Array<Record<string, unknown>>
}

export function AIMetricGenerator({ onUse, sessionContext = "", functionCatalog = [] }: AIMetricGeneratorProps) {
  const { user } = useAuth()
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AIGenerateMetricResponse | null>(null)
  const [showCode, setShowCode] = useState(false)
  const [showAlternatives, setShowAlternatives] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [refining, setRefining] = useState(false)
  const [copied, setCopied] = useState(false)

  const username = user?.email ?? ""

  async function handleGenerate() {
    if (!description.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res = await generateMetric({
        description: description.trim(),
        context: sessionContext,
        username,
        function_catalog: functionCatalog,
        test_immediately: false,
      })
      setResult(res)
      setShowCode(false)
    } catch (e) {
      setResult({ success: false, error: String(e), code: "", explanation: "", alternatives: [], parameters: [], output_columns: [], preview: [], confidence: "low" })
    } finally {
      setLoading(false)
    }
  }

  async function handleRefine() {
    if (!result?.code || !feedback.trim()) return
    setRefining(true)
    try {
      const res = await refineMetric({
        original_code: result.code,
        feedback: feedback.trim(),
        username,
      })
      setResult(res)
      setFeedback("")
    } catch (e) {
      setResult({ success: false, error: `Refinement failed: ${e}`, code: result.code, explanation: result.explanation, alternatives: [], parameters: [], output_columns: [], preview: [], confidence: "low" })
    } finally {
      setRefining(false)
    }
  }

  function handleCopyCode() {
    if (!result?.code) return
    navigator.clipboard.writeText(result.code).catch(() => {
      // Clipboard API may fail in insecure contexts or if denied
    })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleUse() {
    if (!result?.code) return
    // Derive a metric name from the description (first 5 words, snake_case)
    const derived = description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 5)
      .join("_")
    const name = derived || "ai_generated_metric"
    onUse({
      code: result.code,
      name,
      description: description,
      parameters: (result.parameters ?? []) as Array<{ name: string; type: string; default: string; label: string }>,
      output_columns: result.output_columns ?? [],
    })
  }

  const confidenceColor =
    result?.confidence === "high" ? "text-green-600" :
    result?.confidence === "low" ? "text-amber-500" :
    "text-blue-600"

  return (
    <div className="border rounded-xl bg-gradient-to-b from-violet-50/60 to-white p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-violet-500 shrink-0" />
        <span className="font-medium text-sm text-violet-700">Generate Metric with AI</span>
      </div>

      {/* Input */}
      <div className="space-y-2">
        <textarea
          className="w-full text-sm border rounded-lg px-3 py-2 min-h-[72px] resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder:text-muted-foreground"
          placeholder="Describe the metric you want…&#10;e.g. &quot;Captains who were active in morning peak but not evening peak&quot;&#10;or &quot;Ping acceptance rate variance across days per captain&quot;"
          value={description}
          onChange={e => setDescription(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && e.metaKey) handleGenerate() }}
        />
        <button
          onClick={handleGenerate}
          disabled={!description.trim() || loading}
          className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-3 py-2 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? "Generating…" : "Generate"}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="space-y-3 pt-1">
          {/* Status */}
          <div className="flex items-start gap-2">
            {result.success
              ? <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
              : <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            }
            <div className="space-y-0.5 min-w-0">
              {result.success
                ? <p className="text-sm font-medium text-green-700">Metric generated</p>
                : <p className="text-sm font-medium text-red-700">Generation failed</p>
              }
              {result.error && (
                <p className="text-xs text-red-600 break-words">{result.error}</p>
              )}
            </div>
            {result.success && (
              <span className={`ml-auto text-xs font-medium shrink-0 ${confidenceColor}`}>
                {result.confidence} confidence
              </span>
            )}
          </div>

          {/* Explanation */}
          {result.explanation && (
            <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-violet-300 pl-3">
              {result.explanation}
            </p>
          )}

          {/* Output columns */}
          {result.output_columns && result.output_columns.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {result.output_columns.map(col => (
                <span key={col} className="text-xs bg-violet-100 text-violet-700 rounded px-2 py-0.5 font-mono">
                  {col}
                </span>
              ))}
            </div>
          )}

          {/* Code toggle */}
          {result.code && (
            <div className="border rounded-lg overflow-hidden">
              <div className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 text-xs font-medium text-gray-600">
                <button
                  onClick={() => setShowCode(v => !v)}
                  className="flex items-center gap-1 hover:text-gray-900 transition-colors"
                >
                  <span>View generated code</span>
                  {showCode ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1 hover:text-gray-900 transition-colors"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              {showCode && (
                <pre className="text-xs p-3 bg-[#1e1e1e] text-gray-200 overflow-x-auto max-h-64 overflow-y-auto leading-relaxed">
                  {result.code}
                </pre>
              )}
            </div>
          )}

          {/* Alternatives */}
          {result.alternatives && result.alternatives.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <button
                onClick={() => setShowAlternatives(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-xs font-medium text-gray-600 transition-colors"
              >
                <span>{result.alternatives.length} alternative metrics</span>
                {showAlternatives ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showAlternatives && (
                <ul className="px-3 py-2 space-y-1.5">
                  {result.alternatives.map((alt, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex gap-2">
                      <span className="text-violet-400 shrink-0">→</span>
                      <span>{alt}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Refine */}
          {result.success && result.code && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Not quite right? Refine it:</p>
              <div className="flex gap-2">
                <input
                  className="flex-1 text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-400"
                  placeholder='e.g. "add a city filter" or "normalize per captain"'
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleRefine() }}
                />
                <button
                  onClick={handleRefine}
                  disabled={!feedback.trim() || refining}
                  className="text-xs bg-violet-100 hover:bg-violet-200 text-violet-700 font-medium rounded px-3 py-1.5 disabled:opacity-50 transition-colors"
                >
                  {refining ? <Loader2 className="w-3 h-3 animate-spin" /> : "Refine"}
                </button>
              </div>
            </div>
          )}

          {/* Use button */}
          {result.success && result.code && (
            <button
              onClick={handleUse}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg px-3 py-2 transition-colors"
            >
              Use this metric →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
