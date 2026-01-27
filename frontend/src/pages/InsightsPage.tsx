import { useMemo, useState, useEffect } from "react"
import type { DateRange as DayPickerRange } from "react-day-picker"

import { PrimarySidebar } from "@/components/nav/PrimarySidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { InsightsConfigSidebar } from "@/features/insights/InsightsConfigSidebar"
import { InsightsTopBar } from "@/features/insights/InsightsTopBar"
import { ExecutiveSummaryTable } from "@/features/insights/components/ExecutiveSummaryTable"
import { PerformanceTrends } from "@/features/insights/components/PerformanceTrends"
import { StatCards } from "@/features/insights/components/StatCards"
import { PivotBuilder } from "@/features/insights/pivot/PivotBuilder"
import { InsightsReportTab } from "@/features/insights/report/InsightsReportTab"
import { AddMetricsTab } from "@/features/insights/AddMetricsTab"

import {
  computeExecutiveSummary,
  computeExecutiveSummaryByBreakout,
  computeTotalParticipants,
  computeTrendSeries,
} from "@/features/insights/analysis/computeExecutiveSummary"
import { computePValue } from "@/features/insights/analysis/computePValue"
import { ladooDerivedRatioMetrics } from "@/features/insights/metrics/metricCatalog"
import { getSessionId } from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"
import type { AggMethod, InsightMetric, MetricKey, ParsedCsv, TrendChartType } from "@/features/insights/types"

type AnalysisParams = {
  testCohort: string
  controlCohort: string
  pre: { start: Date; end: Date }
  post: { start: Date; end: Date }
  selections: Array<{ metricKey: MetricKey; agg: AggMethod }>
}

function toDateRange(r: DayPickerRange | undefined): { start: Date; end: Date } | null {
  if (!r?.from || !r?.to) return null
  return { start: r.from, end: r.to }
}

function minDate(a: Date, b: Date) {
  return a < b ? a : b
}
function maxDate(a: Date, b: Date) {
  return a > b ? a : b
}

export function InsightsPage() {
  const { user } = useAuth()
  const [parsed, setParsed] = useState<ParsedCsv | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(getSessionId())

  // Update session ID when parsed data changes
  useEffect(() => {
    setSessionId(getSessionId())
  }, [parsed])

  const [testCohort, setTestCohort] = useState("")
  const [controlCohort, setControlCohort] = useState("")

  const [preRange, setPreRange] = useState<DayPickerRange | undefined>({
    from: new Date("2025-12-01T00:00:00"),
    to: new Date("2025-12-10T00:00:00"),
  })
  const [postRange, setPostRange] = useState<DayPickerRange | undefined>({
    from: new Date("2025-12-10T00:00:00"),
    to: new Date("2025-12-23T00:00:00"),
  })

  const [selectedMetricKeys, setSelectedMetricKeys] = useState<MetricKey[]>([])
  const [metricAggs, setMetricAggs] = useState<Record<string, AggMethod>>({})

  const [analysisParams, setAnalysisParams] = useState<AnalysisParams | null>(null)
  const [runError, setRunError] = useState<string | null>(null)

  const [execBreakoutCol, setExecBreakoutCol] = useState<string>("")

  const [trendMetricKey, setTrendMetricKey] = useState<string | null>(null)
  const [trendAgg, setTrendAgg] = useState<AggMethod>("sum_per_captain")
  const [trendBreakoutCol, setTrendBreakoutCol] = useState<string>("")
  const [trendChartType, setTrendChartType] = useState<TrendChartType>("line")

  const metricsByKey = useMemo<Record<string, InsightMetric>>(() => {
    if (!parsed) return {}
    const m: Record<string, InsightMetric> = {}
    for (const col of parsed.metricColumns) {
      m[col] = { key: col, label: col, type: "column", column: col }
    }
    for (const r of ladooDerivedRatioMetrics) {
      m[r.key] = r
    }
    return m
  }, [parsed])

  const computed = useMemo(() => {
    if (!parsed || !analysisParams) return null

    const execInput = {
      rows: parsed.rows,
      testCohort: analysisParams.testCohort,
      controlCohort: analysisParams.controlCohort,
      pre: analysisParams.pre,
      post: analysisParams.post,
      metricsByKey,
      selections: analysisParams.selections,
    }

    const execRows = computeExecutiveSummary(execInput)
    const execGroups = execBreakoutCol
      ? computeExecutiveSummaryByBreakout({ ...execInput, breakoutCol: execBreakoutCol })
      : null

    const unionRange = {
      start: minDate(analysisParams.pre.start, analysisParams.post.start),
      end: maxDate(analysisParams.pre.end, analysisParams.post.end),
    }

    const metricForTrend =
      metricsByKey[trendMetricKey ?? ""] ??
      metricsByKey[analysisParams.selections[0]?.metricKey ?? ""]
    const series = metricForTrend
      ? computeTrendSeries({
          rows: parsed.rows,
          testCohort: analysisParams.testCohort,
          controlCohort: analysisParams.controlCohort,
          metric: metricForTrend,
          agg: metricForTrend.type === "ratio" ? "ratio" : trendAgg,
          dateRange: unionRange,
          pre: analysisParams.pre,
          post: analysisParams.post,
          breakoutCol: trendBreakoutCol || null,
        })
      : { data: [], lines: [] }

    const totalParticipants = computeTotalParticipants(parsed.rows, [
      { cohort: analysisParams.testCohort, range: analysisParams.pre },
      { cohort: analysisParams.testCohort, range: analysisParams.post },
      { cohort: analysisParams.controlCohort, range: analysisParams.pre },
      { cohort: analysisParams.controlCohort, range: analysisParams.post },
    ])

    const pValue = computePValue({})

    return { execRows, execGroups, series, totalParticipants, pValue }
  }, [analysisParams, execBreakoutCol, metricsByKey, parsed, trendAgg, trendBreakoutCol, trendMetricKey])

  const availableCohorts = parsed?.cohorts ?? []
  const metricOptions = parsed?.metricColumns ?? []
  const numericColumns = parsed?.numericColumns ?? []
  const categoricalColumns = parsed?.categoricalColumns ?? []

  const tabDefault = "analysis"

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="flex w-full">
        <PrimarySidebar activeOverride="insights" />
        <InsightsConfigSidebar
          fileName={parsed?.fileName ?? null}
          cohorts={availableCohorts}
          testCohort={testCohort}
          controlCohort={controlCohort}
          onTestCohortChange={setTestCohort}
          onControlCohortChange={setControlCohort}
          preRange={preRange}
          onPreRangeChange={setPreRange}
          postRange={postRange}
          onPostRangeChange={setPostRange}
          metricOptions={metricOptions}
          numericColumns={numericColumns}
          selectedMetricKeys={selectedMetricKeys}
          metricAggs={metricAggs}
          onToggleMetric={(k) => {
            setSelectedMetricKeys((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]))
            setMetricAggs((prev) => {
              if (prev[k]) return prev
              const isNumeric = numericColumns.includes(k)
              const next = { ...prev }
              next[k] = k === "captain_id" ? "count_distinct" : isNumeric ? "sum_per_captain" : "count"
              return next
            })
          }}
          onMetricAggChange={(k, agg) => setMetricAggs((prev) => ({ ...prev, [k]: agg }))}
          onUploaded={(p) => {
            setParsed(p)
            // sensible defaults
            setTestCohort((prev) => prev || p.cohorts[0] || "")
            setControlCohort((prev) => prev || p.cohorts[1] || p.cohorts[0] || "")
            const defaults = Array.from(new Set(["captain_id", ...p.numericColumns.slice(0, 5)])).filter((x) =>
              p.metricColumns.includes(x)
            )
            setSelectedMetricKeys(defaults)
            setMetricAggs(() => {
              const next: Record<string, AggMethod> = {}
              for (const k of defaults) {
                const isNumeric = p.numericColumns.includes(k)
                next[k] = k === "captain_id" ? "count_distinct" : isNumeric ? "sum_per_captain" : "count"
              }
              return next
            })
            setRunError(null)
            setAnalysisParams(null)
            setExecBreakoutCol("")
            setTrendMetricKey(null)
            setTrendAgg("sum_per_captain")
            setTrendBreakoutCol("")
            setTrendChartType("line")
          }}
          onReset={() => {
            setParsed(null)
            setTestCohort("")
            setControlCohort("")
            setSelectedMetricKeys([])
            setMetricAggs({})
            setAnalysisParams(null)
            setExecBreakoutCol("")
            setTrendMetricKey(null)
            setTrendAgg("sum_per_captain")
            setTrendBreakoutCol("")
            setTrendChartType("line")
            setRunError(null)
          }}
          onRun={() => {
            const pre = toDateRange(preRange)
            const post = toDateRange(postRange)
            if (!parsed) {
              setRunError("Upload a CSV first.")
              return
            }
            if (!testCohort || !controlCohort) {
              setRunError("Select both test and control cohorts.")
              return
            }
            if (!pre || !post) {
              setRunError("Select both pre and post date ranges.")
              return
            }
            if (selectedMetricKeys.length === 0) {
              setRunError("Select at least one metric.")
              return
            }

            setRunError(null)
            const selections = selectedMetricKeys.map((k) => ({
              metricKey: k,
              agg: metricsByKey[k]?.type === "ratio" ? ("ratio" as const) : (metricAggs[k] ?? "sum_per_captain"),
            }))
            setAnalysisParams({
              testCohort,
              controlCohort,
              pre,
              post,
              selections,
            })

            // trend defaults to first selected metric
            setTrendMetricKey((prev) => prev || selectedMetricKeys[0] || null)
            const firstKey = selectedMetricKeys[0]
            const metric = metricsByKey[firstKey]
            if (metric?.type === "ratio") setTrendAgg("ratio")
            else setTrendAgg(metricAggs[firstKey] ?? "sum_per_captain")
          }}
        />

        <main className="flex-1">
          <div className="px-8 py-6">
            <div className="mx-auto max-w-6xl">
              <InsightsTopBar fileName={parsed?.fileName ?? null} />

              {runError ? (
                <div className="mb-6 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                  {runError}
                </div>
              ) : null}

              <Tabs defaultValue={tabDefault} className="w-full">
                <TabsList className="mb-6 rounded-xl">
                  <TabsTrigger value="analysis">Analysis</TabsTrigger>
                  <TabsTrigger value="pivot">Pivot</TabsTrigger>
                  <TabsTrigger value="add-metrics">Add Metrics</TabsTrigger>
                  <TabsTrigger value="report">Report</TabsTrigger>
                </TabsList>

                <TabsContent value="analysis">
                  <div className="flex flex-col gap-6">
                    <ExecutiveSummaryTable
                      rows={computed?.execRows ?? []}
                      groups={computed?.execGroups ?? null}
                      metricsByKey={metricsByKey}
                      breakoutCol={execBreakoutCol}
                      onBreakoutColChange={setExecBreakoutCol}
                      breakoutOptions={categoricalColumns}
                    />

                    <PerformanceTrends
                      metricKey={trendMetricKey}
                      onMetricKeyChange={setTrendMetricKey}
                      agg={trendAgg}
                      onAggChange={setTrendAgg}
                      breakoutCol={trendBreakoutCol}
                      onBreakoutColChange={setTrendBreakoutCol}
                      chartType={trendChartType}
                      onChartTypeChange={setTrendChartType}
                      metricOptions={
                        analysisParams
                          ? analysisParams.selections
                              .map((s) => metricsByKey[s.metricKey])
                              .filter(Boolean)
                              .map((m) => ({ key: m.key, label: m.label }))
                          : []
                      }
                      aggOptions={["sum","sum_per_captain","avg","median","count","count_distinct","ratio"] as AggMethod[]}
                      breakoutOptions={categoricalColumns}
                      series={computed?.series ?? { data: [], lines: [] }}
                    />

                    <StatCards totalParticipants={computed?.totalParticipants ?? null} pValue={computed?.pValue ?? null} />

                    {!analysisParams ? (
                      <div className="text-sm text-muted-foreground">
                        Configure and click <span className="font-medium text-foreground">Run Analysis</span> to view results.
                      </div>
                    ) : null}
                  </div>
                </TabsContent>

                <TabsContent value="pivot">
                  {parsed ? (
                    <PivotBuilder rows={parsed.rows} columns={parsed.columns} />
                  ) : (
                    <div className="rounded-2xl border border-border/60 bg-background p-10 text-center text-sm text-muted-foreground">
                      Upload a CSV to start building pivot tables.
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="add-metrics">
                  <AddMetricsTab
                    sessionId={sessionId}
                    username={user?.email || "anonymous"}
                    onMetricsAdded={(columns) => {
                      // Refresh the parsed data to include new columns
                      if (parsed) {
                        setParsed({
                          ...parsed,
                          metricColumns: [...new Set([...parsed.metricColumns, ...columns])],
                          numericColumns: [...new Set([...parsed.numericColumns, ...columns])],
                          columns: [...new Set([...parsed.columns, ...columns])],
                        })
                      }
                    }}
                  />
                </TabsContent>

                <TabsContent value="report">
                  <InsightsReportTab />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

