import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  Handle,
  Position,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { cn } from "@/lib/utils"
import type { SchemaTable, SchemaRelationship } from "@/lib/knowledgeApi"

// ---------------------------------------------------------------------------
// Custom Table Node
// ---------------------------------------------------------------------------

interface TableNodeData {
  label: string
  friendlyName: string
  columnCount: number
  grain: string
  categories: { identifier: number; dimension: number; measure: number; time: number }
  selected: boolean
  [key: string]: unknown
}

function TableNode({ data }: { data: TableNodeData }) {
  const cats = data.categories
  return (
    <div
      className={cn(
        "rounded-xl border bg-white shadow-sm px-4 py-3 min-w-[180px] transition-all",
        data.selected
          ? "border-violet-500 ring-2 ring-violet-200"
          : "border-slate-200 hover:border-slate-300"
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-slate-400 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-slate-400 !w-2 !h-2" />

      <div className="text-sm font-semibold text-foreground truncate">
        {data.friendlyName || data.label}
      </div>
      <div className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">
        {data.label}
      </div>

      <div className="flex items-center gap-2 mt-2">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
          {data.columnCount} cols
        </span>
        {data.grain && (
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-600">
            {data.grain}
          </span>
        )}
      </div>

      {/* Category indicators */}
      <div className="flex gap-1 mt-2">
        {cats.identifier > 0 && (
          <div className="h-1.5 rounded-full bg-blue-400" style={{ width: `${Math.min(cats.identifier * 8, 40)}px` }} title={`${cats.identifier} identifiers`} />
        )}
        {cats.dimension > 0 && (
          <div className="h-1.5 rounded-full bg-emerald-400" style={{ width: `${Math.min(cats.dimension * 4, 40)}px` }} title={`${cats.dimension} dimensions`} />
        )}
        {cats.measure > 0 && (
          <div className="h-1.5 rounded-full bg-amber-400" style={{ width: `${Math.min(cats.measure * 4, 40)}px` }} title={`${cats.measure} measures`} />
        )}
        {cats.time > 0 && (
          <div className="h-1.5 rounded-full bg-rose-400" style={{ width: `${Math.min(cats.time * 8, 40)}px` }} title={`${cats.time} time columns`} />
        )}
      </div>
    </div>
  )
}

const nodeTypes: NodeTypes = {
  tableNode: TableNode,
}

// ---------------------------------------------------------------------------
// Custom Grouped Edge — shows count badge, clickable
// ---------------------------------------------------------------------------

interface GroupedEdgeData {
  count: number
  joins: Array<{ from_column: string; to_column: string; join_type: string }>
  pairKey: string
  [key: string]: unknown
}

function GroupedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: {
  id: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: Position
  targetPosition: Position
  data: GroupedEdgeData
  selected?: boolean
}) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const count = data?.count ?? 1

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected ? "#8b5cf6" : "#22c55e",
          strokeWidth: selected ? 3 : 2,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
        >
          <div
            className={cn(
              "flex items-center justify-center rounded-full font-semibold cursor-pointer transition-all shadow-sm border-2",
              "min-w-[28px] h-7 px-2",
              selected
                ? "bg-violet-600 text-white border-violet-400 scale-110"
                : "bg-white text-emerald-700 border-emerald-400 hover:bg-emerald-50 hover:scale-105"
            )}
            title={`${count} join${count !== 1 ? "s" : ""} — click to view`}
          >
            <span className="text-xs">{count}</span>
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

const edgeTypes: EdgeTypes = {
  grouped: GroupedEdge,
}

// ---------------------------------------------------------------------------
// Grouping + Layout helpers
// ---------------------------------------------------------------------------

function layoutNodes(tables: SchemaTable[]): Node<TableNodeData>[] {
  const cols = Math.max(Math.ceil(Math.sqrt(tables.length)), 1)
  const spacingX = 320
  const spacingY = 200

  return tables.map((t, i) => {
    const categories = { identifier: 0, dimension: 0, measure: 0, time: 0 }
    for (const col of t.columns) {
      const cat = col.category as keyof typeof categories
      if (cat in categories) categories[cat]++
    }

    return {
      id: t.id,
      type: "tableNode",
      position: {
        x: (i % cols) * spacingX + 50,
        y: Math.floor(i / cols) * spacingY + 50,
      },
      data: {
        label: t.table_name,
        friendlyName: t.friendly_name,
        columnCount: t.columns.length,
        grain: t.grain,
        categories,
        selected: false,
      },
    }
  })
}

/** Group relationships by table pair → one edge per pair with count badge. */
function buildGroupedEdges(relationships: SchemaRelationship[]): Edge<GroupedEdgeData>[] {
  const groups = new Map<string, { source: string; target: string; joins: GroupedEdgeData["joins"]; ids: string[] }>()

  for (const r of relationships) {
    // Consistent key regardless of direction
    const [a, b] = [r.from_table_id, r.to_table_id].sort()
    const pairKey = `${a}__${b}`

    if (!groups.has(pairKey)) {
      groups.set(pairKey, { source: r.from_table_id, target: r.to_table_id, joins: [], ids: [] })
    }
    const g = groups.get(pairKey)!
    g.joins.push({ from_column: r.from_column, to_column: r.to_column, join_type: r.join_type })
    g.ids.push(r.id)
  }

  return Array.from(groups.entries()).map(([pairKey, g]) => ({
    id: `edge_${pairKey}`,
    source: g.source,
    target: g.target,
    type: "grouped",
    data: {
      count: g.joins.length,
      joins: g.joins,
      pairKey,
    },
  }))
}

// ---------------------------------------------------------------------------
// Exported types for parent
// ---------------------------------------------------------------------------

export interface EdgePairDetail {
  pairKey: string
  sourceTableId: string
  targetTableId: string
  joins: Array<{ from_column: string; to_column: string; join_type: string }>
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface GraphExplorerProps {
  tables: SchemaTable[]
  relationships: SchemaRelationship[]
  selectedTableId: string | null
  onSelectTable: (id: string | null) => void
  onEdgeClick?: (detail: EdgePairDetail) => void
}

export function GraphExplorer({
  tables,
  relationships,
  selectedTableId,
  onSelectTable,
  onEdgeClick,
}: GraphExplorerProps) {
  const initialNodes = useMemo(() => layoutNodes(tables), [tables])
  const initialEdges = useMemo(() => buildGroupedEdges(relationships), [relationships])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

  // Map for looking up grouped data from edge id
  const edgeDataMap = useMemo(() => {
    const m = new Map<string, { source: string; target: string; data: GroupedEdgeData }>()
    for (const e of initialEdges) {
      if (e.data) m.set(e.id, { source: e.source, target: e.target, data: e.data })
    }
    return m
  }, [initialEdges])

  // Update nodes when tables/selection changes
  useEffect(() => {
    setNodes((prev) => {
      const laid = layoutNodes(tables)
      return laid.map((n) => {
        const existing = prev.find((p) => p.id === n.id)
        return {
          ...n,
          position: existing?.position ?? n.position,
          data: { ...n.data, selected: n.id === selectedTableId },
        }
      })
    })
  }, [tables, selectedTableId, setNodes])

  useEffect(() => {
    const grouped = buildGroupedEdges(relationships)
    setEdges(grouped.map((e) => ({
      ...e,
      selected: e.id === selectedEdgeId,
    })))
  }, [relationships, selectedEdgeId, setEdges])

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedEdgeId(null)
      onSelectTable(node.id === selectedTableId ? null : node.id)
    },
    [onSelectTable, selectedTableId]
  )

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      onSelectTable(null)
      setSelectedEdgeId((prev) => (prev === edge.id ? null : edge.id))

      const info = edgeDataMap.get(edge.id)
      if (info && onEdgeClick) {
        onEdgeClick({
          pairKey: info.data.pairKey,
          sourceTableId: info.source,
          targetTableId: info.target,
          joins: info.data.joins,
        })
      }
    },
    [onSelectTable, onEdgeClick, edgeDataMap]
  )

  const onPaneClick = useCallback(() => {
    onSelectTable(null)
    setSelectedEdgeId(null)
  }, [onSelectTable])

  return (
    <div className="flex-1">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e2e8f0" gap={20} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as TableNodeData
            return data.selected ? "#8b5cf6" : "#e2e8f0"
          }}
          maskColor="rgba(255,255,255,0.7)"
          className="!bg-white !border-slate-200"
        />
      </ReactFlow>
    </div>
  )
}
