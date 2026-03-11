/**
 * DiscoveryPage — Agentic Problem Discovery
 *
 * Users scan for anomalies across captain segments. The ProblemDiscoveryAgent
 * runs statistical checks (z-score, trend break) and returns ranked findings
 * with plain-English hypotheses and suggested actions.
 *
 * Route: /discovery
 */

import { useState } from "react"
import {
  Radar,
  Loader2,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  TrendingUp,
  ArrowRight,
  RefreshCw,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { discoverProblems, type DiscoveryFindingItem } from "@/lib/aiApi"

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertCircle,
    bg: "bg-red-50 border-red-200",
    badge: "bg-red-100 text-red-700",
    iconColor: "text-red-500",
    label: "Critical",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-50 border-amber-200",
    badge: "bg-amber-100 text-amber-700",
    iconColor: "text-amber-500",
    label: "Warning",
  },
  notice: {
    icon: Info,
    bg: "bg-blue-50 border-blue-200",
    badge: "bg-blue-100 text-blue-700",
    iconColor: "text-blue-500",
    label: "Notice",
  },
}

const CITIES = [
  "", "bangalore", "delhi", "mumbai", "hyderabad", "chennai",
  "kolkata", "pune", "ahmedabad", "jaipur", "lucknow",
]
const SERVICES = ["auto", "bike_taxi", "cab", "delivery", "c2c"]

function FindingCard({ finding }: { finding: DiscoveryFindingItem }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = SEVERITY_CONFIG[finding.severity] ?? SEVERITY_CONFIG.notice
  const Icon = cfg.icon
  const isUp = finding.pct_change > 0
  const TrendIcon = isUp ? TrendingUp : TrendingDown
  const trendColor = isUp ? "text-red-500" : "text-green-500" // up = bad for churn, down = bad for activity

  return (
    <div className={`border rounded-xl overflow-hidden ${cfg.bg}`}>
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${cfg.iconColor}`} />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start gap-2 flex-wrap">
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${cfg.badge}`}>
              {cfg.label}
            </span>
            <span className="text-xs text-muted-foreground">{finding.segment}</span>
          </div>
          <p className="text-sm font-medium text-gray-800 leading-snug">{finding.title}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
            <TrendIcon className="w-3 h-3" />
            {finding.pct_change > 0 ? "+" : ""}{finding.pct_change.toFixed(1)}%
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-white/60">
          {/* Stats row */}
          <div className="flex gap-4 text-xs">
            <div>
              <span className="text-muted-foreground">Baseline </span>
              <span className="font-mono font-medium">{finding.baseline.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Recent </span>
              <span className="font-mono font-medium">{finding.recent.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Z-score </span>
              <span className={`font-mono font-medium ${Math.abs(finding.z_score) > 3 ? "text-red-600" : Math.abs(finding.z_score) > 2 ? "text-amber-600" : "text-blue-600"}`}>
                {finding.z_score > 0 ? "+" : ""}{finding.z_score.toFixed(2)}σ
              </span>
            </div>
          </div>

          {/* Finding text */}
          <p className="text-xs text-gray-700 leading-relaxed">{finding.finding}</p>

          {/* Hypothesis */}
          <div className="rounded-lg bg-white/70 px-3 py-2 space-y-1">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Hypothesis</p>
            <p className="text-xs text-gray-700 leading-relaxed">{finding.hypothesis}</p>
          </div>

          {/* Action */}
          <div className="flex items-start gap-2">
            <ArrowRight className="w-3.5 h-3.5 text-violet-500 shrink-0 mt-0.5" />
            <p className="text-xs text-violet-700 font-medium">{finding.suggested_action}</p>
          </div>

          {/* Mini sparkline — just the last 14 points as text bars */}
          {finding.data?.values?.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Trend (last {Math.min(finding.data.values.length, 14)} days)</p>
              <MiniSparkline values={finding.data.values.slice(-14)} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MiniSparkline({ values }: { values: number[] }) {
  if (!values.length) return null
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const heights = values.map(v => Math.round(((v - min) / range) * 24) + 4)

  return (
    <div className="flex items-end gap-0.5 h-8">
      {heights.map((h, i) => {
        const isRecent = i >= heights.length - 7
        return (
          <div
            key={i}
            className={`flex-1 rounded-sm transition-all ${isRecent ? "bg-violet-400" : "bg-gray-300"}`}
            style={{ height: `${h}px` }}
            title={`${values[i]?.toFixed(2)}`}
          />
        )
      })}
    </div>
  )
}

export function DiscoveryPage() {
  const { user } = useAuth()
  const [city, setCity] = useState("")
  const [service, setService] = useState("auto")
  const [lookback, setLookback] = useState(35)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ findings: DiscoveryFindingItem[]; narrative: string; scan_timestamp: string; checks_run: number } | null>(null)
  const [error, setError] = useState("")

  const username = user?.email ?? ""

  async function handleScan() {
    setLoading(true)
    setError("")
    try {
      const res = await discoverProblems({
        username,
        city,
        service_category: service,
        lookback_days: lookback,
        enhance_with_llm: true,
      })
      setResult(res)
    } catch (e) {
      setError("Scan failed. Check that the backend is running and Presto is reachable.")
    } finally {
      setLoading(false)
    }
  }

  const findings = result?.findings ?? []
  const critical = findings.filter(f => f.severity === "critical")
  const warnings = findings.filter(f => f.severity === "warning")
  const notices = findings.filter(f => f.severity === "notice")

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Radar className="w-5 h-5 text-violet-500" />
          <h1 className="text-xl font-semibold">Problem Discovery</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Scan for anomalies across captain segments. Statistical checks against 3-week baselines — ranked by severity.
        </p>
      </div>

      {/* Config */}
      <div className="border rounded-xl p-4 bg-white space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">City</label>
            <select
              value={city}
              onChange={e => setCity(e.target.value)}
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400"
            >
              <option value="">All cities</option>
              {CITIES.filter(Boolean).map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">Service</label>
            <select
              value={service}
              onChange={e => setService(e.target.value)}
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400"
            >
              {SERVICES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">Lookback (days)</label>
            <select
              value={lookback}
              onChange={e => setLookback(Number(e.target.value))}
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400"
            >
              <option value={21}>21 days</option>
              <option value={35}>35 days</option>
              <option value={56}>56 days</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleScan}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Scanning…</>
          ) : result ? (
            <><RefreshCw className="w-4 h-4" /> Re-scan</>
          ) : (
            <><Radar className="w-4 h-4" /> Scan for Issues</>
          )}
        </button>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 rounded-xl p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex items-center gap-3 text-sm flex-wrap">
            <span className="text-muted-foreground">
              Scanned {result.checks_run} checks · {new Date(result.scan_timestamp).toLocaleDateString()}
            </span>
            {critical.length > 0 && (
              <span className="bg-red-100 text-red-700 rounded px-2 py-0.5 text-xs font-medium">
                {critical.length} critical
              </span>
            )}
            {warnings.length > 0 && (
              <span className="bg-amber-100 text-amber-700 rounded px-2 py-0.5 text-xs font-medium">
                {warnings.length} warnings
              </span>
            )}
            {notices.length > 0 && (
              <span className="bg-blue-100 text-blue-700 rounded px-2 py-0.5 text-xs font-medium">
                {notices.length} notices
              </span>
            )}
            {findings.length === 0 && (
              <span className="text-green-700 font-medium">All clear — no anomalies detected</span>
            )}
          </div>

          {/* AI narrative */}
          {result.narrative && (
            <div className="border rounded-xl bg-violet-50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Radar className="w-3.5 h-3.5 text-violet-500" />
                <span className="text-xs font-semibold text-violet-700 uppercase tracking-wide">AI Summary</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{result.narrative}</p>
            </div>
          )}

          {/* Findings list */}
          {findings.length > 0 && (
            <div className="space-y-3">
              {[...critical, ...warnings, ...notices].map(f => (
                <FindingCard key={f.id} finding={f} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
