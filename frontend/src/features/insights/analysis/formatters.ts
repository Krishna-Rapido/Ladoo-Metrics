import type { AggMethod } from "../types"

const INT_FORMAT = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 })
const FLOAT_2_FORMAT = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const RATIO_FORMAT = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 4 })

export function formatNumber(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—"
  return INT_FORMAT.format(Math.round(v))
}

export function formatSignedDelta(v: number | null | undefined, opts?: { decimals?: number }) {
  if (v == null || !Number.isFinite(v)) return "—"
  const decimals = opts?.decimals ?? 2
  const fmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  const sign = v > 0 ? "+" : ""
  return `${sign}${fmt.format(v)}`
}

export function formatPercent(v: number | null | undefined, opts?: { decimals?: number }) {
  if (v == null || !Number.isFinite(v)) return "—"
  const decimals = opts?.decimals ?? 2
  const fmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  return `${fmt.format(v)}%`
}

export function formatRatio(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—"
  return RATIO_FORMAT.format(v)
}

export function formatByAgg(agg: AggMethod, v: number | null | undefined) {
  if (v == null) return "—"
  if (agg === "ratio") return formatRatio(v)
  if (agg === "count" || agg === "count_distinct") return formatNumber(v)
  return FLOAT_2_FORMAT.format(v)
}

export function aggLabel(agg: AggMethod) {
  switch (agg) {
    case "sum":
      return "Sum"
    case "sum_per_captain":
      return "Sum/Captain"
    case "avg":
      return "Average"
    case "median":
      return "Median"
    case "count":
      return "Count"
    case "count_distinct":
      return "Unique"
    case "ratio":
      return "Ratio"
  }
}

