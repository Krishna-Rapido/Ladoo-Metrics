export type CsvPrimitive = string | number | boolean | null

export type AggMethod =
  | "sum"
  | "sum_per_captain"
  | "avg"
  | "median"
  | "count"
  | "count_distinct"
  | "ratio"

export type MetricKey = string

export type RawRow = {
  cohort: string
  time: Date
  captain_id: string
  // allow other numeric columns
  [key: string]: any
}

export type RatioSpec = {
  // x2y means y/x (ratio-of-sums)
  numeratorCol: string // x
  denominatorCol: string // y
}

export type InsightMetric =
  | {
      key: MetricKey
      label: string
      type: "column"
      column: string
    }
  | {
      key: MetricKey
      label: string
      type: "ratio"
      ratio: RatioSpec
    }

export type ExecutiveRow = {
  metricKey: string
  label: string
  agg: AggMethod
  controlPre: number | null
  controlPost: number | null
  deltaControl: number | null
  testPre: number | null
  testPost: number | null
  deltaTest: number | null
  did: number | null
  liftPct: number | null
}

export type DateRange = { start: Date; end: Date }

export type TrendPoint = {
  date: string // YYYY-MM-DD
  test: number | null
  control: number | null
}

export type TrendLineStyle = {
  key: string
  label: string
  stroke: string
  strokeDasharray?: string
}

export type TrendMultiSeries = {
  data: Array<Record<string, number | string | null> & { date: string }>
  lines: TrendLineStyle[]
}

export type TrendChartType = "line" | "bar" | "stacked_bar"

export type ParsedCsv = {
  fileName: string
  rows: RawRow[]
  columns: string[]
  metricColumns: string[]
  numericColumns: string[]
  categoricalColumns: string[]
  cohorts: string[]
  dateMin?: Date
  dateMax?: Date
}

export type PivotAggFn = "sum" | "avg" | "min" | "max" | "count" | "countDistinct"

export type PivotValueSpec = { col: string; agg: PivotAggFn }

export type PivotOperator = "equals" | "contains" | "in" | "between"

export type PivotFilterRule =
  | { column: string; operator: "equals"; value: CsvPrimitive }
  | { column: string; operator: "not_equals"; value: CsvPrimitive }
  | { column: string; operator: "contains"; value: string }
  | { column: string; operator: "not_contains"; value: string }
  | { column: string; operator: "in"; value: CsvPrimitive[] }
  | { column: string; operator: "between"; value: [CsvPrimitive, CsvPrimitive] }

export type PivotRequest = {
  rows: RawRow[]
  rowFields: string[]
  colFields: string[]
  values: PivotValueSpec[]
  filters: PivotFilterRule[]
}

export type PivotResult = {
  columns: string[]
  data: Record<string, CsvPrimitive>[]
  grandTotals?: Record<string, number>
}

