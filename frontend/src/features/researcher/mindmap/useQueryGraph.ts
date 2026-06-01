import { useMemo } from "react"
import type { ChatMessage, ContentBlock } from "../useResearcherChat"
import type { QueryGraph, QueryGraphNode, QueryGraphEdge } from "./types"
import { parseSql } from "./parseSql"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _eid = 0
function edgeId() {
  return `e-${++_eid}`
}

function tableNodeId(table: string, schema?: string): string {
  const key = schema ? `${schema}.${table}` : table
  return `tbl-${key.replace(/[^a-zA-Z0-9_]/g, "_")}`
}

/** Build a short display name for a table */
function tableLabel(table: string, schema?: string): string {
  if (schema) return `${schema}.${table}`
  return table
}

// ---------------------------------------------------------------------------
// Build graph from a list of tool content blocks
// ---------------------------------------------------------------------------

function buildGraph(allBlocks: ContentBlock[]): QueryGraph {
  const nodes: QueryGraphNode[] = []
  const edges: QueryGraphEdge[] = []
  const nodeMap = new Map<string, QueryGraphNode>()
  let stepIdx = 0

  function addNode(node: QueryGraphNode) {
    if (!nodeMap.has(node.id)) {
      nodeMap.set(node.id, node)
      nodes.push(node)
    }
  }

  for (const block of allBlocks) {
    if (block.type !== "tool") continue

    const { toolCall, toolResult } = block
    const toolName = toolCall.name
    stepIdx++
    const stepId = `step-${stepIdx}`

    // Determine step status
    const status: QueryGraphNode["status"] = toolResult
      ? (toolResult.result?.error ? "error" : "done")
      : "running"

    // Create step node for every tool call
    const stepLabel =
      toolName === "run_presto_query" ? "Query" :
      toolName === "run_contrast_analysis" ? "Contrast Analysis" :
      toolName === "compute_response_profiles" ? "Response Profiles" :
      toolName === "validate_segment" ? "Validate Segment" :
      toolName

    addNode({
      id: stepId,
      type: "step",
      label: `${stepIdx}. ${stepLabel}`,
      detail: toolName,
      status,
    })

    // -----------------------------------------------------------------------
    // run_presto_query: parse the SQL
    // -----------------------------------------------------------------------
    if (toolName === "run_presto_query") {
      const sql = toolCall.arguments?.sql as string | undefined
      if (sql) {
        try {
          const parsed = parseSql(sql)

          // CTE nodes
          for (const cte of parsed.ctes) {
            const cteId = `cte-${cte.name}`
            addNode({
              id: cteId,
              type: "cte",
              label: cte.name,
              detail: cte.sql.length > 300 ? cte.sql.slice(0, 300) + "..." : cte.sql,
            })
            edges.push({ id: edgeId(), source: cteId, target: stepId, type: "cte_ref" })
          }

          // Table nodes
          for (const t of parsed.tables) {
            const tId = tableNodeId(t.table, t.schema)
            addNode({
              id: tId,
              type: "table",
              label: tableLabel(t.table, t.schema),
              detail: t.alias ? `Alias: ${t.alias}` : undefined,
            })
            edges.push({ id: edgeId(), source: tId, target: stepId, type: "data_flow" })
          }

          // Join edges between tables
          for (const j of parsed.joins) {
            const jId = tableNodeId(j.table.table, j.table.schema)
            // If the join table node exists, add a join label to the edge
            const existing = edges.find((e) => e.source === jId && e.target === stepId)
            if (existing) {
              existing.label = `${j.type} JOIN`
              existing.type = "join"
            }
          }

          // Filter node (group all filters together)
          if (parsed.filters.length > 0) {
            const filterId = `filter-${stepIdx}`
            const detail = parsed.filters
              .map((f) => f.column ? `${f.column} ${f.operator} ${f.value}` : f.raw)
              .join("\n")
            addNode({
              id: filterId,
              type: "filter",
              label: `${parsed.filters.length} filter${parsed.filters.length > 1 ? "s" : ""}`,
              detail,
            })
            edges.push({ id: edgeId(), source: filterId, target: stepId, type: "filter_of" })
          }

          // Aggregation node
          if (parsed.aggregations.length > 0 || parsed.groupBy.length > 0) {
            const aggId = `agg-${stepIdx}`
            const lines: string[] = []
            for (const a of parsed.aggregations) lines.push(a.expr)
            if (parsed.groupBy.length > 0) lines.push(`GROUP BY ${parsed.groupBy.join(", ")}`)
            addNode({
              id: aggId,
              type: "aggregation",
              label: parsed.aggregations.length > 0
                ? parsed.aggregations.map((a) => a.fn).join(", ")
                : "GROUP BY",
              detail: lines.join("\n"),
            })
            edges.push({ id: edgeId(), source: stepId, target: aggId, type: "data_flow" })
          }
        } catch {
          // Parsing failed — step node already exists with raw SQL in detail
          const node = nodeMap.get(stepId)
          if (node) node.detail = sql.length > 500 ? sql.slice(0, 500) + "..." : sql
        }
      }
    }

    // -----------------------------------------------------------------------
    // run_contrast_analysis / compute_response_profiles: parse queries array
    // -----------------------------------------------------------------------
    if (toolName === "run_contrast_analysis" || toolName === "compute_response_profiles") {
      // Extract param-based filter nodes from arguments
      const args = toolCall.arguments || {}
      const paramFilters: string[] = []
      if (args.city) paramFilters.push(`city = ${args.city}`)
      if (args.start_date) paramFilters.push(`start_date = ${args.start_date}`)
      if (args.end_date) paramFilters.push(`end_date = ${args.end_date}`)
      if (args.consistency_segment) paramFilters.push(`segment = ${args.consistency_segment}`)

      if (paramFilters.length > 0) {
        const pfId = `filter-params-${stepIdx}`
        addNode({
          id: pfId,
          type: "filter",
          label: `${paramFilters.length} params`,
          detail: paramFilters.join("\n"),
        })
        edges.push({ id: edgeId(), source: pfId, target: stepId, type: "filter_of" })
      }

      // Parse SQL queries from tool result
      const queries = (toolResult?.result?.queries ?? []) as string[]
      for (let qi = 0; qi < queries.length; qi++) {
        try {
          const parsed = parseSql(queries[qi])
          for (const t of parsed.tables) {
            const tId = tableNodeId(t.table, t.schema)
            addNode({
              id: tId,
              type: "table",
              label: tableLabel(t.table, t.schema),
              detail: t.alias ? `Alias: ${t.alias}` : undefined,
            })
            // Avoid duplicate edges
            if (!edges.some((e) => e.source === tId && e.target === stepId)) {
              edges.push({ id: edgeId(), source: tId, target: stepId, type: "data_flow" })
            }
          }
        } catch {
          // Skip unparseable queries
        }
      }
    }

    // -----------------------------------------------------------------------
    // validate_segment: show gate results
    // -----------------------------------------------------------------------
    if (toolName === "validate_segment") {
      const args = toolCall.arguments || {}
      const detail: string[] = []
      if (args.segment_name) detail.push(`Segment: ${args.segment_name}`)
      if (toolResult?.result) {
        const gates = (toolResult.result.gates ?? []) as Array<Record<string, unknown>>
        for (const gate of gates) {
          detail.push(`${gate.name}: ${gate.passed ? "PASS" : "FAIL"} (${gate.value})`)
        }
      }
      const node = nodeMap.get(stepId)
      if (node) node.detail = detail.join("\n")
    }
  }

  return { nodes, edges }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useQueryGraph(
  messages: ChatMessage[],
  currentAssistant: ChatMessage | null,
  isStreaming: boolean,
): QueryGraph {
  return useMemo(() => {
    // Reset edge counter
    _eid = 0

    // Collect all tool blocks from all messages + the in-progress assistant
    const allBlocks: ContentBlock[] = []
    for (const msg of messages) {
      if (msg.role === "assistant") {
        allBlocks.push(...msg.blocks)
      }
    }
    if (currentAssistant) {
      allBlocks.push(...currentAssistant.blocks)
    }

    const toolBlocks = allBlocks.filter((b) => b.type === "tool")
    if (toolBlocks.length === 0) {
      return { nodes: [], edges: [] }
    }

    return buildGraph(allBlocks)
  }, [messages, currentAssistant, isStreaming])
}
