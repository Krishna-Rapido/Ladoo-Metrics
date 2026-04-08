import { useState } from "react"
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  BarChart3,
  TrendingUp,
  Code2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  validateSegment,
} from "@/lib/researcherApi"
import type {
  ContrastAnalysisResponse,
  StimulusResponseResponse,
  ValidateSegmentResponse,
  FeatureComparison,
} from "@/lib/researcherApi"
import type { ResearcherConfig } from "./ResearcherShell"

type Props = {
  config: ResearcherConfig | null
  contrastResult: ContrastAnalysisResponse | null
  stimulusResult: StimulusResponseResponse | null
  onValidate: (result: ValidateSegmentResponse) => void
}

export function ExploreResults({
  config,
  contrastResult,
  stimulusResult,
  onValidate,
}: Props) {
  if (!contrastResult && !stimulusResult) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <BarChart3 className="mb-4 h-12 w-12 text-slate-300" />
        <h2 className="text-lg font-semibold text-slate-700">
          No results yet
        </h2>
        <p className="text-sm text-muted-foreground">
          Go to the Frame tab and run an analysis first.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {contrastResult && (
        <ContrastResults
          result={contrastResult}
          config={config}
          onValidate={onValidate}
        />
      )}
      {stimulusResult && (
        <StimulusResults
          result={stimulusResult}
          config={config}
          onValidate={onValidate}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Contrast results view
// ---------------------------------------------------------------------------

function ContrastResults({
  result,
  config,
  onValidate,
}: {
  result: ContrastAnalysisResponse
  config: ResearcherConfig | null
  onValidate: (r: ValidateSegmentResponse) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [validating, setValidating] = useState(false)
  const [selectedFeature, setSelectedFeature] = useState("")
  const [segmentName, setSegmentName] = useState("")
  const [threshold, setThreshold] = useState("")
  const [operator, setOperator] = useState("<")

  const displayComparisons = expanded
    ? result.comparisons
    : result.comparisons.slice(0, 10)

  const handleValidate = async () => {
    if (!config || !selectedFeature || !segmentName || !threshold) return
    setValidating(true)
    try {
      const res = await validateSegment({
        username: config.username,
        city: config.city,
        start_date: config.start_date,
        end_date: config.end_date,
        segment_name: segmentName,
        segment_definition: {
          feature: selectedFeature,
          operator,
          threshold: parseFloat(threshold),
        },
        consistency_segment: config.consistency_segment,
        performance_segment: config.performance_segment,
      })
      onValidate(res)
    } finally {
      setValidating(false)
    }
  }

  return (
    <>
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">
              {result.group_a_label}
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {result.group_a_size.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">captains</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">
              {result.group_b_label}
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {result.group_b_size.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">captains</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">
              Significant Features
            </div>
            <div className="text-2xl font-bold text-violet-600">
              {result.comparisons.filter((c) => c.significant).length}
            </div>
            <div className="text-xs text-muted-foreground">
              of {result.comparisons.length} tested
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature comparison table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Feature Comparison (ranked by effect size)
          </CardTitle>
          <CardDescription>
            Click a feature to use it as a segment definition
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="pb-2 pr-4">Feature</th>
                  <th className="pb-2 pr-4 text-right">
                    {result.group_a_label}
                  </th>
                  <th className="pb-2 pr-4 text-right">
                    {result.group_b_label}
                  </th>
                  <th className="pb-2 pr-4 text-right">Effect Size</th>
                  <th className="pb-2 pr-4 text-right">p-value</th>
                  <th className="pb-2 text-center">Sig</th>
                </tr>
              </thead>
              <tbody>
                {displayComparisons.map((c) => (
                  <FeatureRow
                    key={c.feature}
                    comparison={c}
                    selected={selectedFeature === c.feature}
                    onClick={() => {
                      setSelectedFeature(c.feature)
                      // Auto-suggest threshold: midpoint between group means
                      const mid = (c.group_a_mean + c.group_b_mean) / 2
                      setThreshold(mid.toFixed(4))
                      setOperator(
                        c.group_a_mean < c.group_b_mean ? "<" : ">",
                      )
                      if (!segmentName)
                        setSegmentName(
                          c.feature.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
                        )
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {result.comparisons.length > 10 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 gap-1"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  Show less <ChevronUp className="h-3 w-3" />
                </>
              ) : (
                <>
                  Show all {result.comparisons.length} features{" "}
                  <ChevronDown className="h-3 w-3" />
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Validate segment form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Define & Validate Segment
          </CardTitle>
          <CardDescription>
            Select a feature above, set a threshold, and run the 6-gate
            validation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Segment Name</Label>
              <Input
                value={segmentName}
                onChange={(e) => setSegmentName(e.target.value)}
                placeholder="e.g. Target Earners"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Feature</Label>
              <Input value={selectedFeature} readOnly className="bg-slate-50" />
            </div>
            <div className="space-y-1.5">
              <Label>Operator</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
              >
                <option value="<">&lt;</option>
                <option value=">">&gt;</option>
                <option value="<=">&lt;=</option>
                <option value=">=">&gt;=</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Threshold</Label>
              <Input
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="0.0"
              />
            </div>
          </div>
          <Button
            onClick={handleValidate}
            disabled={
              validating || !selectedFeature || !segmentName || !threshold
            }
            className="gap-2"
          >
            {validating ? "Validating..." : "Run 6-Gate Validation"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <QueriesPanel queries={result.queries} />
    </>
  )
}

function FeatureRow({
  comparison,
  selected,
  onClick,
}: {
  comparison: FeatureComparison
  selected: boolean
  onClick: () => void
}) {
  const effectColor =
    Math.abs(comparison.effect_size) > 0.5
      ? "text-violet-700 font-semibold"
      : Math.abs(comparison.effect_size) > 0.3
        ? "text-violet-600"
        : "text-slate-600"

  return (
    <tr
      className={`cursor-pointer border-b transition-colors last:border-0 ${
        selected
          ? "bg-violet-50"
          : "hover:bg-slate-50"
      }`}
      onClick={onClick}
    >
      <td className="py-2 pr-4 font-medium">{comparison.feature}</td>
      <td className="py-2 pr-4 text-right font-mono text-xs">
        {comparison.group_a_mean.toFixed(3)}
      </td>
      <td className="py-2 pr-4 text-right font-mono text-xs">
        {comparison.group_b_mean.toFixed(3)}
      </td>
      <td className={`py-2 pr-4 text-right font-mono text-xs ${effectColor}`}>
        {comparison.effect_size > 0 ? "+" : ""}
        {comparison.effect_size.toFixed(3)}
      </td>
      <td className="py-2 pr-4 text-right font-mono text-xs">
        {comparison.p_value < 0.001
          ? "<0.001"
          : comparison.p_value.toFixed(4)}
      </td>
      <td className="py-2 text-center">
        {comparison.significant ? (
          <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" />
        ) : (
          <XCircle className="mx-auto h-4 w-4 text-slate-300" />
        )}
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Queries panel — shows executed SQL for transparency
// ---------------------------------------------------------------------------

function QueriesPanel({ queries }: { queries: string[] }) {
  const [open, setOpen] = useState(false)

  if (!queries || queries.length === 0) return null

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <CardTitle className="flex items-center gap-2 text-sm">
          <Code2 className="h-4 w-4 text-slate-500" />
          Executed Queries ({queries.length})
          {open ? (
            <ChevronUp className="ml-auto h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="ml-auto h-4 w-4 text-slate-400" />
          )}
        </CardTitle>
        <CardDescription>
          Inspect the exact SQL that was run against Presto
        </CardDescription>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          {queries.map((q, i) => (
            <pre
              key={i}
              className="overflow-x-auto rounded-md bg-slate-50 p-3 text-xs leading-relaxed text-slate-700"
            >
              {q}
            </pre>
          ))}
        </CardContent>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Stimulus-Response results view
// ---------------------------------------------------------------------------

function StimulusResults({
  result,
  config,
  onValidate,
}: {
  result: StimulusResponseResponse
  config: ResearcherConfig | null
  onValidate: (r: ValidateSegmentResponse) => void
}) {
  const [selectedAxis, setSelectedAxis] = useState("")
  const [segmentName, setSegmentName] = useState("")
  const [threshold, setThreshold] = useState("")
  const [operator, setOperator] = useState("<")
  const [validating, setValidating] = useState(false)

  const handleValidate = async () => {
    if (!config || !selectedAxis || !segmentName || !threshold) return
    setValidating(true)
    try {
      const res = await validateSegment({
        username: config.username,
        city: config.city,
        start_date: config.start_date,
        end_date: config.end_date,
        segment_name: segmentName,
        segment_definition: {
          feature: selectedAxis,
          operator,
          threshold: parseFloat(threshold),
        },
        consistency_segment: config.consistency_segment,
        performance_segment: config.performance_segment,
      })
      onValidate(res)
    } finally {
      setValidating(false)
    }
  }

  const axisNames: Record<string, string> = {
    incentive_elasticity: "Incentive Elasticity",
    incentive_persistence: "Incentive Persistence",
    target_earning_score: "Target Earning Score",
    loss_response: "Loss Response",
    frustration_resilience: "Frustration Resilience",
    behavioral_inertia: "Behavioral Inertia",
    efficiency_slope: "Efficiency Slope",
    demand_supply_fit: "Demand-Supply Fit",
  }

  return (
    <>
      {/* Summary */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-sm text-muted-foreground">
                Captains Profiled
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {result.captain_count.toLocaleString()}
              </div>
            </div>
            <div className="h-10 w-px bg-slate-200" />
            <div>
              <div className="text-sm text-muted-foreground">
                Axes Computed
              </div>
              <div className="text-2xl font-bold text-violet-600">
                {Object.keys(result.axis_stats).length}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Axis stats cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(result.axis_stats).map(([axis, stats]) => (
          <Card
            key={axis}
            className={`cursor-pointer transition-all ${
              selectedAxis === axis
                ? "ring-2 ring-violet-500"
                : "hover:border-slate-300"
            }`}
            onClick={() => {
              setSelectedAxis(axis)
              // Auto-suggest: median as threshold
              setThreshold(stats.median.toFixed(4))
              setOperator(axis === "target_earning_score" ? "<" : ">")
              if (!segmentName) setSegmentName(axisNames[axis] || axis)
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-violet-600" />
                {axisNames[axis] || axis}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">Mean</div>
                  <div className="font-mono font-medium">
                    {stats.mean.toFixed(3)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Median</div>
                  <div className="font-mono font-medium">
                    {stats.median.toFixed(3)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Std</div>
                  <div className="font-mono font-medium">
                    {stats.std.toFixed(3)}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Range: [{stats.min.toFixed(2)}, {stats.max.toFixed(2)}]
                </span>
                <span>n={stats.count}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Validate segment form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Define & Validate Segment
          </CardTitle>
          <CardDescription>
            Click an axis card above, set a threshold, and validate.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Segment Name</Label>
              <Input
                value={segmentName}
                onChange={(e) => setSegmentName(e.target.value)}
                placeholder="e.g. Target Earners"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Response Axis</Label>
              <Input value={selectedAxis} readOnly className="bg-slate-50" />
            </div>
            <div className="space-y-1.5">
              <Label>Operator</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
              >
                <option value="<">&lt;</option>
                <option value=">">&gt;</option>
                <option value="<=">&lt;=</option>
                <option value=">=">&gt;=</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Threshold</Label>
              <Input
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={handleValidate}
            disabled={
              validating || !selectedAxis || !segmentName || !threshold
            }
            className="gap-2"
          >
            {validating ? "Validating..." : "Run 6-Gate Validation"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <QueriesPanel queries={result.queries} />
    </>
  )
}
