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
import { getSessionId, getSessionData, fetchInsights, type InsightsRequest, type InsightsResponse, type InsightAggregation } from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"
import { useReport } from "@/contexts/ReportContext"
import type { RawRow } from "@/features/insights/types"
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

/** Format date as YYYY-MM-DD in local time (avoids UTC shift when sending to API). */
function formatDateLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function InsightsPage() {
  const { user } = useAuth()
  const { loadFromCloud } = useReport()
  const [parsed, setParsed] = useState<ParsedCsv | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(getSessionId())

  // Load report from Reports page when opened via "Open in Insights"
  useEffect(() => {
    const reportIdToLoad = localStorage.getItem("load_report_id")
    if (reportIdToLoad) {
      localStorage.removeItem("load_report_id")
      loadFromCloud(reportIdToLoad).catch((err) => console.error("Failed to load report:", err))
    }
  }, [loadFromCloud])

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
  const [backendResults, setBackendResults] = useState<InsightsResponse | null>(null)
  const [isLoadingBackend, setIsLoadingBackend] = useState(false)

  // Check if this is a large file (no local rows, analysis via backend)
  const isLargeFile = parsed && parsed.rows.length === 0

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

  // Map frontend agg to backend InsightAggregation (for request and for filtering time_series)
  const aggToBackend = (agg: AggMethod): InsightAggregation => {
    const map: Record<string, InsightAggregation> = {
      sum: 'sum',
      sum_per_captain: 'sum_per_captain',
      avg: 'mean',
      median: 'median',
      count: 'count',
      count_distinct: 'nunique',
      ratio: 'ratio',
    }
    return map[agg] ?? 'sum'
  }

  // Fetch backend insights when analysis params change for large files
  useEffect(() => {
    if (!isLargeFile || !analysisParams || !sessionId) {
      setBackendResults(null)
      return
    }

    const fetchBackendInsights = async () => {
      setIsLoadingBackend(true)
      setRunError(null)

      try {
        const baseMetrics = analysisParams.selections.map((s) => ({
          column: s.metricKey,
          agg_func: aggToBackend(s.agg),
        }))
        // Ensure chart metric+agg is requested so time_series includes the selected trend agg
        const chartMetricKey = trendMetricKey ?? analysisParams.selections[0]?.metricKey
        const chartAgg = chartMetricKey && metricsByKey[chartMetricKey]?.type === 'ratio' ? 'ratio' : trendAgg
        const chartSpec = chartMetricKey ? { column: chartMetricKey, agg_func: aggToBackend(chartAgg) } : null
        const hasChartSpec = chartSpec && baseMetrics.some((m) => m.column === chartSpec.column && m.agg_func === chartSpec.agg_func)
        const metrics = hasChartSpec || !chartSpec ? baseMetrics : [...baseMetrics, chartSpec]

        const request: InsightsRequest = {
          test_cohort: analysisParams.testCohort,
          control_cohort: analysisParams.controlCohort,
          pre_period: {
            start_date: formatDateLocal(analysisParams.pre.start),
            end_date: formatDateLocal(analysisParams.pre.end),
          },
          post_period: {
            start_date: formatDateLocal(analysisParams.post.start),
            end_date: formatDateLocal(analysisParams.post.end),
          },
          metrics,
          series_breakout: trendBreakoutCol || undefined,
        }

        const results = await fetchInsights(request)
        setBackendResults(results)
      } catch (err: any) {
        console.error('Backend insights error:', err)
        setRunError(err?.message ?? 'Failed to compute insights')
      } finally {
        setIsLoadingBackend(false)
      }
    }

    fetchBackendInsights()
  }, [isLargeFile, analysisParams, sessionId, trendMetricKey, trendAgg, trendBreakoutCol, metricsByKey])

  // Segment key and label helpers for 4-line (pre/post × test/control) and breakout
  const segmentKey = (cohort: string, period: string | null) =>
    `${cohort}_${period === 'pre' || period === 'post' ? period : 'all'}`
  const segmentLabel = (cohort: string, period: string | null) => {
    const c = cohort === 'test' ? 'Test' : 'Control'
    if (period === 'pre') return `${c} (Pre)`
    if (period === 'post') return `${c} (Post)`
    return c
  }
  const PALETTE_4 = ['#10b981', '#059669', '#6366f1', '#4f46e5'] // Test Pre, Test Post, Control Pre, Control Post
  const seriesKeyToColor = (key: string) => {
    if (key === 'test_pre') return PALETTE_4[0]
    if (key === 'test_post') return PALETTE_4[1]
    if (key === 'control_pre') return PALETTE_4[2]
    if (key === 'control_post') return PALETTE_4[3]
    const h = (key.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0) >>> 0) % 360
    return `hsl(${h}, 70%, 45%)`
  }

  // Transform backend results to match local computation format (4 lines + optional breakout)
  const backendComputed = useMemo(() => {
    if (!backendResults || !analysisParams) return null

    const execRows = backendResults.summary.map((row) => ({
      metricKey: row.metric,
      label: row.metric,
      agg: row.agg_func as AggMethod,
      controlPre: row.control_pre,
      controlPost: row.control_post,
      deltaControl: row.control_delta,
      testPre: row.test_pre,
      testPost: row.test_post,
      deltaTest: row.test_delta,
      did: row.diff_in_diff,
      liftPct: row.diff_in_diff_pct ?? null,
    }))

    const firstMetric = backendResults.summary[0]?.metric
    const metricForTrend = trendMetricKey ?? firstMetric
    const chartAggBackend = aggToBackend(metricsByKey[metricForTrend]?.type === 'ratio' ? 'ratio' : trendAgg)
    const filteredTimeSeries = (metricForTrend
      ? backendResults.time_series.filter((p) => p.metric === metricForTrend && p.agg_func === chartAggBackend)
      : backendResults.time_series.filter((p) => p.agg_func === chartAggBackend)) as typeof backendResults.time_series

    const hasPeriod = filteredTimeSeries.some((p) => p.period != null && (p.period === 'pre' || p.period === 'post'))
    const hasBreakout = filteredTimeSeries.some((p) => p.breakout_value != null && p.breakout_value !== '')

    const trendData: Record<string, Record<string, number | string | null>> = {}
    for (const point of filteredTimeSeries) {
      if (!trendData[point.date]) trendData[point.date] = { date: point.date }
      const seg = hasPeriod ? segmentKey(point.cohort_type, point.period ?? null) : point.cohort_type
      const seriesKey = hasBreakout && point.breakout_value
        ? `${point.breakout_value}::${seg}`
        : seg
      trendData[point.date][seriesKey] = point.value
    }

    const dates = Object.keys(trendData).sort((a, b) => a.localeCompare(b))
    const allSeriesKeys = new Set<string>()
    for (const date of dates) {
      for (const k of Object.keys(trendData[date])) {
        if (k !== 'date') allSeriesKeys.add(k)
      }
    }
    const sortedKeys = Array.from(allSeriesKeys).sort((a, b) => a.localeCompare(b))

    const data = dates.map((date) => {
      const row: Record<string, number | string | null> = { date }
      for (const k of sortedKeys) row[k] = trendData[date][k] ?? null
      return row as Record<string, number | string | null> & { date: string }
    })

    const lines = sortedKeys.map((key) => {
      const [breakout, seg] = key.includes('::') ? key.split('::') : [null, key]
      const cohort = seg?.startsWith('test') ? 'test' : 'control'
      const period = seg?.endsWith('_pre') ? 'pre' : seg?.endsWith('_post') ? 'post' : null
      const label = breakout ? `${breakout} • ${segmentLabel(cohort, period)}` : segmentLabel(cohort, period)
      return { key, label, stroke: seriesKeyToColor(seg ?? key) }
    })

    const series = { data, lines }

    return {
      execRows,
      execGroups: null,
      series,
      totalParticipants: backendResults.total_participants ?? null,
      pValue: null,
    }
  }, [backendResults, analysisParams, trendMetricKey, trendAgg, metricsByKey])

  // Local computation for small files
  const localComputed = useMemo(() => {
    if (!parsed || !analysisParams || isLargeFile) return null

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
  }, [analysisParams, execBreakoutCol, metricsByKey, parsed, trendAgg, trendBreakoutCol, trendMetricKey, isLargeFile])

  // Use backend or local computed results
  const computed = isLargeFile ? backendComputed : localComputed

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
                      aggOptions={["sum", "sum_per_captain", "avg", "median", "count", "count_distinct", "ratio"] as AggMethod[]}
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
                    <PivotBuilder
                      rows={parsed.rows}
                      columns={parsed.columns}
                      sessionId={isLargeFile ? sessionId : undefined}
                    />
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
                    onMetricsAdded={async () => {
                      // Refresh the parsed data from the backend to include new columns and row values
                      if (sessionId && parsed) {
                        try {
                          const sessionData = await getSessionData(sessionId)

                          // Transform rows from API format to frontend format
                          const transformedRows: RawRow[] = sessionData.rows
                            .map((row) => {
                              const time = row.date || row.time
                              if (!time) return null // Skip rows with no date/time
                              const timeDate = new Date(`${time}T00:00:00`)

                              const transformedRow: RawRow = {
                                cohort: String(row.cohort ?? ""),
                                captain_id: String(row.captain_id ?? ""),
                                time: timeDate,
                              }

                              // Copy all other fields
                              for (const [key, value] of Object.entries(row)) {
                                if (key === "cohort" || key === "captain_id" || key === "time" || key === "date") continue
                                transformedRow[key] = value
                              }

                              return transformedRow
                            })
                            .filter((row): row is RawRow => row !== null)

                          // Update the parsed state with fresh data from backend
                          setParsed({
                            ...parsed,
                            rows: transformedRows,
                            columns: sessionData.columns,
                            metricColumns: sessionData.metric_columns,
                            numericColumns: sessionData.numeric_columns,
                            categoricalColumns: sessionData.categorical_columns,
                            cohorts: sessionData.cohorts,
                            dateMin: sessionData.date_min ? new Date(`${sessionData.date_min}T00:00:00`) : parsed.dateMin,
                            dateMax: sessionData.date_max ? new Date(`${sessionData.date_max}T00:00:00`) : parsed.dateMax,
                          })
                        } catch (err) {
                          console.error("Failed to refresh session data:", err)
                          // Fallback: at minimum update columns list
                          // This shouldn't happen, but provides graceful degradation
                        }
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

