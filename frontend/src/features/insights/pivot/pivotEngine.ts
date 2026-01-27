import type { CsvPrimitive, PivotAggFn, PivotFilterRule, PivotRequest, PivotResult, RawRow } from "../types"

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v)
}

function toComparable(v: unknown): CsvPrimitive {
  if (v == null) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10) // YYYY-MM-DD
  if (typeof v === "string") return v
  if (typeof v === "number") return v
  if (typeof v === "boolean") return v
  return String(v)
}

function passesFilter(row: RawRow, f: PivotFilterRule): boolean {
  const raw = row[f.column]
  const v = toComparable(raw)

  switch (f.operator) {
    case "equals":
      return v === f.value
    case "not_equals":
      return v !== f.value
    case "contains":
      return String(v ?? "").toLowerCase().includes(String(f.value).toLowerCase())
    case "not_contains":
      return !String(v ?? "").toLowerCase().includes(String(f.value).toLowerCase())
    case "in":
      return f.value.some((x) => x === v)
    case "between": {
      const [a, b] = f.value
      if (v == null || a == null || b == null) return false

      // numeric between
      if (typeof v === "number" && typeof a === "number" && typeof b === "number") {
        const lo = Math.min(a, b)
        const hi = Math.max(a, b)
        return v >= lo && v <= hi
      }

      // string compare (incl iso dates)
      const vs = String(v)
      const as = String(a)
      const bs = String(b)
      const lo = as < bs ? as : bs
      const hi = as < bs ? bs : as
      return vs >= lo && vs <= hi
    }
    default:
      return true
  }
}

function makeGroupKey(parts: CsvPrimitive[]) {
  return parts.map((p) => (p == null ? "" : String(p))).join("¦")
}

type AggState =
  | { agg: "sum" | "avg"; sum: number; count: number }
  | { agg: "min" | "max"; value: number | null }
  | { agg: "count"; count: number }
  | { agg: "countDistinct"; set: Set<string> }

function initAggState(agg: PivotAggFn): AggState {
  switch (agg) {
    case "sum":
    case "avg":
      return { agg, sum: 0, count: 0 }
    case "min":
    case "max":
      return { agg, value: null }
    case "count":
      return { agg, count: 0 }
    case "countDistinct":
      return { agg, set: new Set<string>() }
  }
}

function updateAggState(state: AggState, value: unknown) {
  switch (state.agg) {
    case "sum":
    case "avg": {
      if (isNumber(value)) {
        state.sum += value
        state.count += 1
      }
      return
    }
    case "min": {
      if (!isNumber(value)) return
      state.value = state.value == null ? value : Math.min(state.value, value)
      return
    }
    case "max": {
      if (!isNumber(value)) return
      state.value = state.value == null ? value : Math.max(state.value, value)
      return
    }
    case "count": {
      state.count += 1
      return
    }
    case "countDistinct": {
      const s = String(value ?? "").trim()
      if (s) state.set.add(s)
      return
    }
  }
}

function finalizeAggState(state: AggState): number | null {
  switch (state.agg) {
    case "sum":
      return state.count === 0 ? 0 : state.sum
    case "avg":
      return state.count === 0 ? null : state.sum / state.count
    case "min":
    case "max":
      return state.value
    case "count":
      return state.count
    case "countDistinct":
      return state.set.size
  }
}

function valueFieldName(col: string, agg: PivotAggFn) {
  return `${col}__${agg}`
}

function displayColKey(colKey: string) {
  const s = String(colKey ?? "").trim()
  if (!s) return "All"
  return s.replaceAll("¦", " / ")
}

export function buildPivot(req: PivotRequest): PivotResult {
  const { rows, rowFields, colFields, values, filters } = req

  const filtered = filters?.length ? rows.filter((r) => filters.every((f) => passesFilter(r, f))) : rows

  // groupKey -> colKey -> valueField -> AggState
  const cube = new Map<string, Map<string, Map<string, AggState>>>()
  const rowKeyToParts = new Map<string, CsvPrimitive[]>()
  const colKeys = new Set<string>()

  for (const r of filtered) {
    const rowParts = rowFields.map((f) => toComparable(r[f]))
    const colParts = colFields.map((f) => toComparable(r[f]))
    const rowKey = makeGroupKey(rowParts)
    const colKey = makeGroupKey(colParts)

    rowKeyToParts.set(rowKey, rowParts)
    colKeys.add(colKey)

    let byCol = cube.get(rowKey)
    if (!byCol) {
      byCol = new Map()
      cube.set(rowKey, byCol)
    }
    let byValue = byCol.get(colKey)
    if (!byValue) {
      byValue = new Map()
      byCol.set(colKey, byValue)
    }

    for (const v of values) {
      const field = valueFieldName(v.col, v.agg)
      let state = byValue.get(field)
      if (!state) {
        state = initAggState(v.agg)
        byValue.set(field, state)
      }
      updateAggState(state, r[v.col])
    }
  }

  const sortedColKeys = Array.from(colKeys).sort((a, b) => a.localeCompare(b))

  const columns: string[] = [
    ...rowFields,
    ...(colFields.length === 0
      ? values.map((v) => `${v.col} (${v.agg})`)
      : sortedColKeys.flatMap((ck) =>
          values.map((v) => `${displayColKey(ck)} • ${v.col} (${v.agg})`)
        )),
  ]

  // build data rows
  const data: Record<string, CsvPrimitive>[] = []
  const grandTotals: Record<string, number> = {}

  const sortedRowKeys = Array.from(cube.keys()).sort((a, b) => a.localeCompare(b))
  for (const rk of sortedRowKeys) {
    const row: Record<string, CsvPrimitive> = {}
    const parts = rowKeyToParts.get(rk) ?? []
    rowFields.forEach((f, idx) => {
      row[f] = parts[idx] ?? null
    })

    if (colFields.length === 0) {
      const ck = sortedColKeys[0] ?? ""
      for (const v of values) {
        const field = valueFieldName(v.col, v.agg)
        const colName = `${v.col} (${v.agg})`
        const state = cube.get(rk)?.get(ck)?.get(field)
        const val = state ? finalizeAggState(state) : null
        row[colName] = val
        if (typeof val === "number" && Number.isFinite(val)) {
          grandTotals[colName] = (grandTotals[colName] ?? 0) + val
        }
      }
    } else {
      for (const ck of sortedColKeys) {
        for (const v of values) {
          const field = valueFieldName(v.col, v.agg)
          const colName = `${displayColKey(ck)} • ${v.col} (${v.agg})`
          const state = cube.get(rk)?.get(ck)?.get(field)
          const val = state ? finalizeAggState(state) : null
          row[colName] = val
          if (typeof val === "number" && Number.isFinite(val)) {
            grandTotals[colName] = (grandTotals[colName] ?? 0) + val
          }
        }
      }
    }

    data.push(row)
  }

  return { columns, data, grandTotals }
}

export function exportPivotToCsv(result: PivotResult, fileName = "pivot.csv") {
  const { columns, data } = result
  const lines: string[] = []
  lines.push(columns.map(csvEscape).join(","))
  for (const row of data) {
    lines.push(columns.map((c) => csvEscape(row[c])).join(","))
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function csvEscape(v: CsvPrimitive): string {
  if (v == null) return ""
  const s = String(v)
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`
  return s
}

