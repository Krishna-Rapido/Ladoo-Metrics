import dagre from "@dagrejs/dagre"
import type { Node, Edge } from "@xyflow/react"
import type { QueryGraph, NodeType } from "./types"

// ---------------------------------------------------------------------------
// Node dimensions by type
// ---------------------------------------------------------------------------

const NODE_SIZES: Record<NodeType, { width: number; height: number }> = {
  step:        { width: 260, height: 90 },
  table:       { width: 220, height: 80 },
  cte:         { width: 220, height: 80 },
  filter:      { width: 200, height: 60 },
  aggregation: { width: 200, height: 60 },
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export interface LayoutResult {
  nodes: Node[]
  edges: Edge[]
}

export function layoutGraph(graph: QueryGraph): LayoutResult {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: "TB", ranksep: 60, nodesep: 40, marginx: 20, marginy: 20 })

  for (const node of graph.nodes) {
    const size = NODE_SIZES[node.type] || NODE_SIZES.table
    g.setNode(node.id, { width: size.width, height: size.height })
  }

  for (const edge of graph.edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  const nodes: Node[] = graph.nodes.map((node) => {
    const pos = g.node(node.id)
    const size = NODE_SIZES[node.type] || NODE_SIZES.table
    return {
      id: node.id,
      type: node.type,
      position: {
        x: (pos?.x ?? 0) - size.width / 2,
        y: (pos?.y ?? 0) - size.height / 2,
      },
      data: {
        label: node.label,
        detail: node.detail,
        status: node.status,
        nodeType: node.type,
      },
    }
  })

  const edges: Edge[] = graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: "smoothstep",
    animated: edge.type === "data_flow",
    style: { strokeWidth: 1.5 },
    labelStyle: { fontSize: 10, fill: "#64748b" },
  }))

  return { nodes, edges }
}
