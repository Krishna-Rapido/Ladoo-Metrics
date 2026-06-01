import type {
  ParsedSQL,
  ParsedCTE,
  ParsedTable,
  ParsedJoin,
  ParsedFilter,
  ParsedAggregation,
} from "./types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip SQL comments and normalize whitespace */
function preprocess(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, "")          // single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, "")  // block comments
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Find the matching close-paren for the open-paren at `start`.
 * Respects nested parens and quoted strings.
 */
function findMatchingParen(sql: string, start: number): number {
  let depth = 0
  let inSingle = false
  let inDouble = false
  for (let i = start; i < sql.length; i++) {
    const ch = sql[i]
    if (ch === "'" && !inDouble) inSingle = !inSingle
    else if (ch === '"' && !inSingle) inDouble = !inDouble
    else if (!inSingle && !inDouble) {
      if (ch === "(") depth++
      else if (ch === ")") {
        depth--
        if (depth === 0) return i
      }
    }
  }
  return -1
}

/**
 * Split a clause on AND/OR respecting paren depth.
 */
function splitFilters(clause: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ""
  const tokens = clause.split(/\b(AND|OR)\b/i)
  for (const tok of tokens) {
    const upper = tok.trim().toUpperCase()
    if ((upper === "AND" || upper === "OR") && depth === 0) {
      if (current.trim()) parts.push(current.trim())
      current = ""
    } else {
      for (const ch of tok) {
        if (ch === "(") depth++
        else if (ch === ")") depth--
      }
      current += tok
    }
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

// ---------------------------------------------------------------------------
// Parse table reference: schema.table alias  OR  table alias
// ---------------------------------------------------------------------------

function parseTableRef(ref: string): ParsedTable | null {
  const cleaned = ref.trim().replace(/[`"]/g, "")
  if (!cleaned) return null

  // Split on whitespace to get [tablePart, alias?]
  const parts = cleaned.split(/\s+/)
  const tablePart = parts[0]
  const alias = parts.length > 1 && !/^(on|where|group|order|having|limit|inner|left|right|full|cross|join|lateral)$/i.test(parts[1])
    ? parts[1]
    : undefined

  const dotParts = tablePart.split(".")
  if (dotParts.length >= 2) {
    return { schema: dotParts.slice(0, -1).join("."), table: dotParts[dotParts.length - 1], alias }
  }
  return { table: dotParts[0], alias }
}

// ---------------------------------------------------------------------------
// Extractors
// ---------------------------------------------------------------------------

function extractCTEs(sql: string): { ctes: ParsedCTE[]; remainder: string } {
  const ctes: ParsedCTE[] = []
  const withMatch = sql.match(/^\s*WITH\s+/i)
  if (!withMatch) return { ctes, remainder: sql }

  let pos = withMatch[0].length
  let remainder = sql

  while (pos < sql.length) {
    // Match CTE name (possibly quoted)
    const nameMatch = sql.slice(pos).match(/^\s*([`"\w]+)\s+AS\s*\(/i)
    if (!nameMatch) break

    const cteName = nameMatch[1].replace(/[`"]/g, "")
    const parenStart = pos + nameMatch.index! + nameMatch[0].length - 1
    const parenEnd = findMatchingParen(sql, parenStart)
    if (parenEnd === -1) break

    ctes.push({
      name: cteName,
      sql: sql.slice(parenStart + 1, parenEnd).trim(),
    })

    pos = parenEnd + 1
    // Skip comma between CTEs
    const commaMatch = sql.slice(pos).match(/^\s*,\s*/)
    if (commaMatch) {
      pos += commaMatch[0].length
    } else {
      remainder = sql.slice(pos).trim()
      break
    }
  }

  return { ctes, remainder }
}

function extractTables(sql: string): ParsedTable[] {
  const tables: ParsedTable[] = []
  // Match FROM <table> patterns (not sub-selects)
  const fromRegex = /\bFROM\s+(?!\s*\()([\w.`"]+(?:\s+[\w`"]+)?)/gi
  let m: RegExpExecArray | null
  while ((m = fromRegex.exec(sql)) !== null) {
    const t = parseTableRef(m[1])
    if (t) tables.push(t)
  }
  return tables
}

function extractJoins(sql: string): ParsedJoin[] {
  const joins: ParsedJoin[] = []
  const joinRegex = /\b(LEFT|RIGHT|INNER|FULL|CROSS)?\s*JOIN\s+([\w.`"]+(?:\s+[\w`"]+)?)\s+(?:ON\s+(.+?))?(?=\s+(?:LEFT|RIGHT|INNER|FULL|CROSS)?\s*JOIN\b|\s+WHERE\b|\s+GROUP\b|\s+ORDER\b|\s+HAVING\b|\s+LIMIT\b|\s+UNION\b|\s*$)/gi
  let m: RegExpExecArray | null
  while ((m = joinRegex.exec(sql)) !== null) {
    const t = parseTableRef(m[2])
    if (t) {
      joins.push({
        type: (m[1] || "INNER").toUpperCase(),
        table: t,
        on: m[3]?.trim(),
      })
    }
  }
  return joins
}

function extractFilters(sql: string): ParsedFilter[] {
  // Find WHERE clause, bounded by GROUP BY / ORDER BY / HAVING / LIMIT / UNION or end
  const whereMatch = sql.match(/\bWHERE\s+([\s\S]+?)(?=\s+GROUP\s+BY\b|\s+ORDER\s+BY\b|\s+HAVING\b|\s+LIMIT\b|\s+UNION\b|$)/i)
  if (!whereMatch) return []

  const rawFilters = splitFilters(whereMatch[1])
  return rawFilters.map((raw) => {
    // Try to parse "column op value"
    const opMatch = raw.match(/^([\w.`"]+)\s*(=|!=|<>|>=|<=|>|<|LIKE|NOT\s+LIKE|IN|NOT\s+IN|IS\s+NOT|IS|BETWEEN)\s*(.+)$/i)
    if (opMatch) {
      return {
        column: opMatch[1].replace(/[`"]/g, ""),
        operator: opMatch[2].toUpperCase(),
        value: opMatch[3].trim(),
        raw,
      }
    }
    return { raw }
  })
}

function extractAggregations(sql: string): ParsedAggregation[] {
  const aggs: ParsedAggregation[] = []
  // Only look in SELECT clause (before first FROM)
  const selectMatch = sql.match(/\bSELECT\s+([\s\S]+?)\bFROM\b/i)
  if (!selectMatch) return aggs

  const selectClause = selectMatch[1]
  const aggRegex = /\b(COUNT|SUM|AVG|MIN|MAX|STDDEV|VARIANCE|APPROX_DISTINCT|APPROX_PERCENTILE|ARBITRARY)\s*\(/gi
  let m: RegExpExecArray | null
  while ((m = aggRegex.exec(selectClause)) !== null) {
    // Find the matching paren
    const start = m.index! + m[0].length - 1
    const end = findMatchingParen(selectClause, start)
    if (end !== -1) {
      aggs.push({
        fn: m[1].toUpperCase(),
        expr: selectClause.slice(m.index!, end + 1).trim(),
      })
    }
  }
  return aggs
}

function extractGroupBy(sql: string): string[] {
  const gbMatch = sql.match(/\bGROUP\s+BY\s+([\s\S]+?)(?=\s+HAVING\b|\s+ORDER\b|\s+LIMIT\b|\s+UNION\b|$)/i)
  if (!gbMatch) return []
  return gbMatch[1]
    .split(",")
    .map((s) => s.trim().replace(/[`"]/g, ""))
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export function parseSql(rawSql: string): ParsedSQL {
  const sql = preprocess(rawSql)
  const { ctes, remainder } = extractCTEs(sql)

  // Parse the main query + all CTEs for comprehensive extraction
  const allSql = [remainder, ...ctes.map((c) => c.sql)]

  const tables: ParsedTable[] = []
  const joins: ParsedJoin[] = []
  const filters: ParsedFilter[] = []
  const aggregations: ParsedAggregation[] = []
  const groupBy: string[] = []
  const seenTables = new Set<string>()

  for (const s of allSql) {
    for (const t of extractTables(s)) {
      const key = `${t.schema || ""}.${t.table}`
      if (!seenTables.has(key)) {
        seenTables.add(key)
        tables.push(t)
      }
    }
    for (const j of extractJoins(s)) {
      joins.push(j)
      const key = `${j.table.schema || ""}.${j.table.table}`
      if (!seenTables.has(key)) {
        seenTables.add(key)
        tables.push(j.table)
      }
    }
    filters.push(...extractFilters(s))
    aggregations.push(...extractAggregations(s))
    groupBy.push(...extractGroupBy(s))
  }

  return { ctes, tables, joins, filters, aggregations, groupBy }
}
