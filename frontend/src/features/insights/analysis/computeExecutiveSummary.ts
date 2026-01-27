import type { AggMethod, DateRange, ExecutiveRow, InsightMetric, MetricKey, RawRow, TrendLineStyle, TrendMultiSeries } from "../types"

function toYyyyMmDd(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function inRange(d: Date, range: DateRange): boolean {
  return d >= range.start && d <= range.end
}

export function safeDivide(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  if (b === 0) return null
  return a / b
}

function sum(rows: RawRow[], col: string): number {
  let s = 0
  for (const r of rows) {
    const v = r[col]
    if (typeof v === "number" && Number.isFinite(v)) s += v
  }
  return s
}

function countDistinct(rows: RawRow[], col: string): number {
  const set = new Set<string>()
  for (const r of rows) {
    const v = r[col]
    if (v == null) continue
    const s = String(v).trim()
    if (s) set.add(s)
  }
  return set.size
}

function mean(rows: RawRow[], col: string): number {
  let s = 0
  let n = 0
  for (const r of rows) {
    const v = r[col]
    if (typeof v === "number" && Number.isFinite(v)) {
      s += v
      n++
    }
  }
  return n === 0 ? 0 : s / n
}

function median(rows: RawRow[], col: string): number {
  const vals: number[] = []
  for (const r of rows) {
    const v = r[col]
    if (typeof v === "number" && Number.isFinite(v)) vals.push(v)
  }
  if (vals.length === 0) return 0
  vals.sort((a, b) => a - b)
  const mid = Math.floor(vals.length / 2)
  if (vals.length % 2 === 1) return vals[mid]
  return (vals[mid - 1] + vals[mid]) / 2
}

function countPresent(rows: RawRow[], col: string): number {
  let n = 0
  for (const r of rows) {
    const v = r[col]
    if (v == null) continue
    if (typeof v === "string" && v.trim() === "") continue
    n++
  }
  return n
}

export type MetricSelection = { metricKey: MetricKey; agg: Exclude<AggMethod, "ratio"> } | { metricKey: MetricKey; agg: "ratio" }

function computeMetricValue(rows: RawRow[], metric: InsightMetric, selAgg: AggMethod): number | null {
  if (metric.type === "ratio") {
    // ratio-of-sums (x2y means y/x) => SUM(y) / SUM(x)
    const numeratorSum = sum(rows, metric.ratio.numeratorCol)
    const denominatorSum = sum(rows, metric.ratio.denominatorCol)
    return safeDivide(denominatorSum, numeratorSum)
  }

  // column metric
  if (!rows.length) {
    // match backend-ish behavior for empty segments
    if (selAgg === "ratio") return null
    return 0
  }

  switch (selAgg) {
    case "sum":
      return sum(rows, metric.column)
    case "sum_per_captain": {
      const captains = countDistinct(rows, "captain_id")
      if (captains <= 0) return 0
      return sum(rows, metric.column) / captains
    }
    case "avg":
      return mean(rows, metric.column)
    case "median":
      return median(rows, metric.column)
    case "count":
      return countPresent(rows, metric.column)
    case "count_distinct":
      return countDistinct(rows, metric.column)
    case "ratio":
      return null
  }
}

export type ComputeExecutiveSummaryInput = {
  rows: RawRow[]
  testCohort: string
  controlCohort: string
  pre: DateRange
  post: DateRange
  metricsByKey: Record<MetricKey, InsightMetric>
  selections: MetricSelection[]
}

function breakoutValueForRow(r: RawRow, breakoutCol: string): string {
  const v = r[breakoutCol]
  const s = String(v ?? "").trim()
  return s ? s : "Unknown"
}

export function computeExecutiveSummary(input: ComputeExecutiveSummaryInput): ExecutiveRow[] {
  const { rows, testCohort, controlCohort, pre, post, metricsByKey, selections } = input

  const testPre = rows.filter((r) => r.cohort === testCohort && inRange(r.time, pre))
  const testPost = rows.filter((r) => r.cohort === testCohort && inRange(r.time, post))
  const controlPre = rows.filter((r) => r.cohort === controlCohort && inRange(r.time, pre))
  const controlPost = rows.filter((r) => r.cohort === controlCohort && inRange(r.time, post))

  return selections
    .map((sel) => {
      const metric = metricsByKey[sel.metricKey]
      if (!metric) return null

      const cPre = computeMetricValue(controlPre, metric, sel.agg)
      const cPost = computeMetricValue(controlPost, metric, sel.agg)
      const tPre = computeMetricValue(testPre, metric, sel.agg)
      const tPost = computeMetricValue(testPost, metric, sel.agg)

      const dControl = cPre == null || cPost == null ? null : cPost - cPre
      const dTest = tPre == null || tPost == null ? null : tPost - tPre
      const did = dTest == null || dControl == null ? null : dTest - dControl

      // lift_pct = (did / control_pre) * 100 (match python)
      const div = did == null ? null : safeDivide(did, cPre)
      const liftPct = div == null ? 0 : div * 100

      return {
        metricKey: metric.key,
        label: metric.label,
        agg: sel.agg,
        controlPre: cPre,
        controlPost: cPost,
        deltaControl: dControl,
        testPre: tPre,
        testPost: tPost,
        deltaTest: dTest,
        did,
        liftPct,
      }
    })
    .filter(Boolean) as ExecutiveRow[]
}

export type ExecutiveSummaryBreakoutGroup = {
  value: string
  rows: ExecutiveRow[]
}

export function computeExecutiveSummaryByBreakout(
  input: ComputeExecutiveSummaryInput & { breakoutCol: string }
): ExecutiveSummaryBreakoutGroup[] {
  const { breakoutCol, rows, testCohort, controlCohort, pre, post } = input

  // Only consider breakouts that appear in the relevant cohorts + date windows.
  const relevant = rows.filter(
    (r) =>
      (r.cohort === testCohort || r.cohort === controlCohort) && (inRange(r.time, pre) || inRange(r.time, post))
  )

  const valuesSet = new Set<string>()
  for (const r of relevant) valuesSet.add(breakoutValueForRow(r, breakoutCol))

  const values = Array.from(valuesSet).sort((a, b) => {
    if (a === "Unknown" && b !== "Unknown") return -1
    if (b === "Unknown" && a !== "Unknown") return 1
    return a.localeCompare(b)
  })

  return values.map((value) => {
    const filteredRows = relevant.filter((r) => breakoutValueForRow(r, breakoutCol) === value)
    return {
      value,
      rows: computeExecutiveSummary({ ...input, rows: filteredRows }),
    }
  })
}

export type ComputeTrendSeriesInput = {
  rows: RawRow[]
  testCohort: string
  controlCohort: string
  metric: InsightMetric
  agg: AggMethod
  dateRange: DateRange
  pre: DateRange
  post: DateRange
  breakoutCol?: string | null
}

function inEither(d: Date, a: DateRange, b: DateRange) {
  return inRange(d, a) || inRange(d, b)
}

function periodForDate(d: Date, pre: DateRange, post: DateRange): "pre" | "post" | null {
  // if overlap, prefer post (matches visual split point)
  if (inRange(d, post)) return "post"
  if (inRange(d, pre)) return "pre"
  return null
}

function hashString(s: string) {
  // simple deterministic hash
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

// High-contrast palette matching the reference image (Matplotlib tab10).
// Order: blue, orange, green, red, purple, brown, pink, gray, olive, cyan.
const SERIES_PALETTE = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf",
] as const

function colorForSeriesKey(seriesKey: string) {
  // Prefer a well-separated palette; fallback to golden-angle HSL.
  const h = hashString(seriesKey)
  const idx = h % SERIES_PALETTE.length
  const base = SERIES_PALETTE[idx]
  if (base) return base
  const hue = (h * 137.508) % 360
  return `hsl(${hue} 80% 45%)`
}

function segmentLabel(segment: "test_pre" | "test_post" | "control_pre" | "control_post") {
  switch (segment) {
    case "test_pre":
      return "Test (Pre)"
    case "test_post":
      return "Test (Post)"
    case "control_pre":
      return "Control (Pre)"
    case "control_post":
      return "Control (Post)"
  }
}

export function computeTrendSeries(input: ComputeTrendSeriesInput): TrendMultiSeries {
  const { rows, testCohort, controlCohort, metric, agg, dateRange, pre, post, breakoutCol } = input

  // only consider dates inside unionRange AND inside either pre or post (so "4 colors" is meaningful)
  const rowsInRange = rows.filter((r) => inRange(r.time, dateRange) && inEither(r.time, pre, post))

  type Bucket = { rows: RawRow[] }
  const byDate = new Map<string, Map<string, Bucket>>() // date -> seriesKey -> bucket

  function getBreakoutValue(r: RawRow) {
    if (!breakoutCol) return "All"
    const v = r[breakoutCol]
    const s = String(v ?? "").trim()
    return s ? s : "Unknown"
  }

  for (const r of rowsInRange) {
    const cohortType = r.cohort === testCohort ? "test" : r.cohort === controlCohort ? "control" : null
    if (!cohortType) continue
    const period = periodForDate(r.time, pre, post)
    if (!period) continue

    const b = getBreakoutValue(r)
    const dateKey = toYyyyMmDd(r.time)
    const segmentKey = `${cohortType}_${period}` as const // test_pre etc
    const seriesKey = breakoutCol ? `${b}::${segmentKey}` : segmentKey

    let dateMap = byDate.get(dateKey)
    if (!dateMap) {
      dateMap = new Map()
      byDate.set(dateKey, dateMap)
    }
    const bucket = dateMap.get(seriesKey) ?? { rows: [] }
    bucket.rows.push(r)
    dateMap.set(seriesKey, bucket)
  }

  const dates = Array.from(byDate.keys()).sort((a, b) => a.localeCompare(b))

  const allSeriesKeys = new Set<string>()
  for (const dateKey of dates) {
    const dateMap = byDate.get(dateKey)!
    for (const k of dateMap.keys()) allSeriesKeys.add(k)
  }

  const sortedSeriesKeys = Array.from(allSeriesKeys).sort((a, b) => a.localeCompare(b))

  const data = dates.map((date) => {
    const row: Record<string, number | string | null> = { date }
    const dateMap = byDate.get(date)!
    for (const seriesKey of sortedSeriesKeys) {
      const bucket = dateMap.get(seriesKey)
      row[seriesKey] = bucket ? computeMetricValue(bucket.rows, metric, agg) : null
    }
    return row as Record<string, number | string | null> & { date: string }
  })

  const lines: TrendLineStyle[] = sortedSeriesKeys.map((seriesKey) => {
    const segment = seriesKey.includes("::")
      ? (seriesKey.split("::")[1] as "test_pre" | "test_post" | "control_pre" | "control_post")
      : (seriesKey as "test_pre" | "test_post" | "control_pre" | "control_post")
    const breakout = seriesKey.includes("::") ? seriesKey.split("::")[0] : "All"
    const label = breakoutCol ? `${breakout} • ${segmentLabel(segment)}` : segmentLabel(segment)
    return {
      key: seriesKey,
      label,
      stroke: colorForSeriesKey(seriesKey),
    }
  })

  return { data, lines }
}

export function computeTotalParticipants(rows: RawRow[], segments: Array<{ cohort: string; range: DateRange }>) {
  const set = new Set<string>()
  for (const seg of segments) {
    for (const r of rows) {
      if (r.cohort !== seg.cohort) continue
      if (!inRange(r.time, seg.range)) continue
      if (r.captain_id) set.add(String(r.captain_id))
    }
  }
  return set.size
}

