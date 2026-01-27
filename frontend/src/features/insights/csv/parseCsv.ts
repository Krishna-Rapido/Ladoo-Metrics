import Papa from "papaparse"

import type { ParsedCsv, RawRow } from "../types"

function parseTime(raw: unknown): Date | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00`)
    return Number.isNaN(d.getTime()) ? null : d
  }

  // YYYYMMDD
  if (/^\d{8}$/.test(s)) {
    const yyyy = s.slice(0, 4)
    const mm = s.slice(4, 6)
    const dd = s.slice(6, 8)
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`)
    return Number.isNaN(d.getTime()) ? null : d
  }

  // fallback
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

function toNumberOrNull(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === "number") return Number.isFinite(v) ? v : null
  const s = String(v).trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function normalizeHeader(h: string): string {
  return h.replace(/^\uFEFF/, "").trim()
}

export async function parseCsv(file: File): Promise<ParsedCsv> {
  const text = await file.text()
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  })

  if (parsed.errors?.length) {
    // Papaparse errors are often recoverable; pick the first for now
    const msg = parsed.errors[0]?.message ?? "Failed to parse CSV"
    throw new Error(msg)
  }

  const rows: RawRow[] = []
  const cohorts = new Set<string>()
  const columnsSet = new Set<string>()
  const numericSeen = new Map<string, boolean>()

  let dateMin: Date | undefined
  let dateMax: Date | undefined

  for (const raw of parsed.data ?? []) {
    if (!raw) continue

    const normalized: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(raw)) {
      const key = normalizeHeader(k)
      if (!key) continue
      normalized[key] = v
      columnsSet.add(key)
    }

    const cohort = String(normalized["cohort"] ?? "").trim()
    const captainId = String(normalized["captain_id"] ?? "").trim()
    const time = parseTime(normalized["time"])

    if (!cohort || !captainId || !time) continue

    const row: RawRow = {
      cohort,
      captain_id: captainId,
      time,
    }

    // attach other fields; coerce numerics when possible
    for (const [key, value] of Object.entries(normalized)) {
      if (key === "cohort" || key === "captain_id" || key === "time") continue

      const n = toNumberOrNull(value)
      if (n != null) numericSeen.set(key, true)
      row[key] = n ?? (value == null ? null : String(value).trim())
    }

    cohorts.add(cohort)
    rows.push(row)

    if (!dateMin || time < dateMin) dateMin = time
    if (!dateMax || time > dateMax) dateMax = time
  }

  const columns = Array.from(columnsSet).sort((a, b) => a.localeCompare(b))
  const metricColumns = columns.filter((c) => !["cohort", "time"].includes(c))
  const numericColumns = metricColumns.filter((c) => numericSeen.get(c) === true)
  const categoricalColumns = metricColumns.filter((c) => !numericColumns.includes(c) && c !== "captain_id")
  const cohortList = Array.from(cohorts).sort((a, b) => a.localeCompare(b))

  return {
    fileName: file.name,
    rows,
    columns,
    metricColumns,
    numericColumns,
    categoricalColumns,
    cohorts: cohortList,
    dateMin,
    dateMax,
  }
}

