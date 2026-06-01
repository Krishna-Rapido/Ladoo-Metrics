// ---------------------------------------------------------------------------
// Mind Map graph model types
// ---------------------------------------------------------------------------

export type NodeType = "table" | "filter" | "aggregation" | "step" | "cte"

export type EdgeType = "join" | "data_flow" | "filter_of" | "cte_ref"

export interface QueryGraphNode {
  id: string
  type: NodeType
  label: string
  /** Extra detail shown in the detail panel (SQL snippet, filter list, etc.) */
  detail?: string
  /** For step nodes: loading / done / error */
  status?: "running" | "done" | "error"
}

export interface QueryGraphEdge {
  id: string
  source: string
  target: string
  label?: string
  type: EdgeType
}

export interface QueryGraph {
  nodes: QueryGraphNode[]
  edges: QueryGraphEdge[]
}

// ---------------------------------------------------------------------------
// SQL parser output
// ---------------------------------------------------------------------------

export interface ParsedCTE {
  name: string
  sql: string
}

export interface ParsedTable {
  schema?: string
  table: string
  alias?: string
}

export interface ParsedJoin {
  type: string // LEFT, INNER, CROSS, etc.
  table: ParsedTable
  on?: string  // raw ON clause
}

export interface ParsedFilter {
  column?: string
  operator?: string
  value?: string
  raw: string
}

export interface ParsedAggregation {
  fn: string   // COUNT, SUM, AVG, etc.
  expr: string // the full expression e.g. COUNT(DISTINCT captain_id)
}

export interface ParsedSQL {
  ctes: ParsedCTE[]
  tables: ParsedTable[]
  joins: ParsedJoin[]
  filters: ParsedFilter[]
  aggregations: ParsedAggregation[]
  groupBy: string[]
}
