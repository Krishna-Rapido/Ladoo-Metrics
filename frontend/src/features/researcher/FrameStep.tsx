import { useState } from "react"
import {
  ArrowRight,
  FlaskConical,
  Loader2,
  Zap,
  GitCompare,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  runContrastAnalysis,
  runStimulusResponse,
} from "@/lib/researcherApi"
import type {
  ContrastAnalysisResponse,
  StimulusResponseResponse,
} from "@/lib/researcherApi"
import type { ResearcherConfig } from "./ResearcherShell"

const CITIES = [
  "bangalore", "delhi", "mumbai", "hyderabad", "chennai", "kolkata",
  "pune", "ahmedabad", "jaipur", "lucknow", "kochi", "coimbatore",
]

const CONSISTENCY_SEGMENTS = ["daily", "weekly", "monthly", "quarterly", "rest"]
const PERFORMANCE_SEGMENTS = ["UHP", "HP", "MP", "LP", "ZP"]
const SPLITTING_OUTCOMES = [
  { value: "churn_28d", label: "Churn (Low activity)" },
  { value: "incentive_response", label: "Incentive Dependency" },
  { value: "efficiency", label: "Earnings Efficiency" },
]

const RESPONSE_AXES = [
  { value: "incentive_elasticity", label: "Incentive Elasticity" },
  { value: "target_earning", label: "Target Earning" },
  { value: "frustration_resilience", label: "Frustration Resilience" },
  { value: "behavioral_inertia", label: "Behavioral Inertia" },
  { value: "efficiency_trajectory", label: "Efficiency Trajectory" },
  { value: "demand_supply_fit", label: "Demand-Supply Fit" },
]

type Props = {
  onConfigReady: (config: ResearcherConfig) => void
  onExploreComplete: (
    contrast: ContrastAnalysisResponse | null,
    stimulus: StimulusResponseResponse | null,
  ) => void
}

export function FrameStep({ onConfigReady, onExploreComplete }: Props) {
  const [method, setMethod] = useState<"contrast" | "stimulus_response">(
    "contrast",
  )
  const [city, setCity] = useState("bangalore")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [consistencySegment, setConsistencySegment] = useState("")
  const [performanceSegment, setPerformanceSegment] = useState("")
  const [splittingOutcome, setSplittingOutcome] = useState("churn_28d")
  const [selectedAxes, setSelectedAxes] = useState<string[]>(
    RESPONSE_AXES.map((a) => a.value),
  )
  const [minActiveDays, setMinActiveDays] = useState(14)
  const [username, setUsername] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleRun = async () => {
    if (!city || !startDate || !endDate || !username) {
      setError("Please fill in all required fields.")
      return
    }
    setError("")
    setLoading(true)

    const config: ResearcherConfig = {
      method,
      username,
      city,
      start_date: startDate.replace(/-/g, ""),
      end_date: endDate.replace(/-/g, ""),
      consistency_segment: consistencySegment || undefined,
      performance_segment: performanceSegment || undefined,
    }

    try {
      if (method === "contrast") {
        config.splitting_outcome = splittingOutcome
        onConfigReady(config)
        const result = await runContrastAnalysis({
          username,
          city,
          start_date: config.start_date,
          end_date: config.end_date,
          consistency_segment: config.consistency_segment,
          performance_segment: config.performance_segment,
          splitting_outcome: splittingOutcome,
        })
        if (!result.success) {
          setError(result.error || "Analysis failed.")
        } else {
          onExploreComplete(result, null)
        }
      } else {
        config.axes = selectedAxes
        config.min_active_days = minActiveDays
        onConfigReady(config)
        const result = await runStimulusResponse({
          username,
          city,
          start_date: config.start_date,
          end_date: config.end_date,
          axes: selectedAxes,
          consistency_segment: config.consistency_segment,
          performance_segment: config.performance_segment,
          min_active_days: minActiveDays,
        })
        if (!result.success) {
          setError(result.error || "Analysis failed.")
        } else {
          onExploreComplete(null, result)
        }
      }
    } catch (err: unknown) {
      // Extract backend error detail from axios 500 responses
      let msg = "Request failed"
      if (err && typeof err === "object" && "response" in err) {
        const resp = (err as { response?: { data?: { detail?: string } } }).response
        if (resp?.data?.detail) {
          msg = resp.data.detail
        } else if (err instanceof Error) {
          msg = err.message
        }
      } else if (err instanceof Error) {
        msg = err.message
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Method selection */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card
          className={`cursor-pointer transition-all ${method === "contrast" ? "ring-2 ring-violet-500 bg-violet-50/30" : "hover:border-slate-300"}`}
          onClick={() => setMethod("contrast")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <GitCompare className="h-5 w-5 text-violet-600" />
              Contrast Analysis
            </CardTitle>
            <CardDescription>
              Compare two groups that look the same but behave differently.
              Find the hidden features that separate them.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Best for: "Why did these captains churn while others didn't?"
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${method === "stimulus_response" ? "ring-2 ring-violet-500 bg-violet-50/30" : "hover:border-slate-300"}`}
          onClick={() => setMethod("stimulus_response")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-5 w-5 text-amber-500" />
              Stimulus-Response
            </CardTitle>
            <CardDescription>
              Profile how captains respond to incentives, frustration, and
              earnings shocks. Discover behavioral types.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Best for: "How do captains react to changes?"
          </CardContent>
        </Card>
      </div>

      {/* Configuration form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Row 1: Username + City */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="username">Presto Username *</Label>
              <Input
                id="username"
                placeholder="your.name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>City *</Label>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CITIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Date range */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="start_date">Start Date *</Label>
              <Input
                id="start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_date">End Date *</Label>
              <Input
                id="end_date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Row 3: Population filters */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Consistency Segment (optional)</Label>
              <Select
                value={consistencySegment}
                onValueChange={setConsistencySegment}
              >
                <SelectTrigger><SelectValue placeholder="All segments" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  {CONSISTENCY_SEGMENTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Performance Segment (optional)</Label>
              <Select
                value={performanceSegment}
                onValueChange={setPerformanceSegment}
              >
                <SelectTrigger><SelectValue placeholder="All segments" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  {PERFORMANCE_SEGMENTS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Method-specific config */}
          {method === "contrast" && (
            <div className="space-y-1.5">
              <Label>Splitting Outcome</Label>
              <Select
                value={splittingOutcome}
                onValueChange={setSplittingOutcome}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SPLITTING_OUTCOMES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {method === "stimulus_response" && (
            <>
              <div className="space-y-1.5">
                <Label>Response Axes</Label>
                <div className="flex flex-wrap gap-2">
                  {RESPONSE_AXES.map((axis) => {
                    const isSelected = selectedAxes.includes(axis.value)
                    return (
                      <button
                        key={axis.value}
                        type="button"
                        onClick={() =>
                          setSelectedAxes((prev) =>
                            isSelected
                              ? prev.filter((a) => a !== axis.value)
                              : [...prev, axis.value],
                          )
                        }
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          isSelected
                            ? "bg-violet-100 text-violet-800 ring-1 ring-violet-300"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {axis.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="w-48 space-y-1.5">
                <Label htmlFor="min_days">Min Active Days</Label>
                <Input
                  id="min_days"
                  type="number"
                  min={5}
                  max={28}
                  value={minActiveDays}
                  onChange={(e) =>
                    setMinActiveDays(Number(e.target.value) || 14)
                  }
                />
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            onClick={handleRun}
            disabled={loading}
            className="gap-2"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running analysis...
              </>
            ) : (
              <>
                <FlaskConical className="h-4 w-4" />
                Run Analysis
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
