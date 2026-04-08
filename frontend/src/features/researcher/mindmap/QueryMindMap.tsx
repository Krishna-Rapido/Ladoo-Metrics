import { useCallback, useEffect, useMemo } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type NodeProps,
  type Node,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Loader2, Database, Filter, BarChart3, GitBranch, Layers } from "lucide-react"
import { cn } from "@/lib/utils"
import type { QueryGraph } from "./types"
import { layoutGraph } from "./layoutGraph"

// ---------------------------------------------------------------------------
// Custom Node Components
// ---------------------------------------------------------------------------

type MindMapNodeData = {
  label: string
  detail?: string
  status?: "running" | "done" | "error"
  nodeType: string
}

function TableNode({ data, selected }: NodeProps<Node<MindMapNodeData>>) {
  return (
    <div className={cn(
      "rounded-lg border-2 bg-blue-50 px-3 py-2 shadow-sm transition-shadow",
      selected ? "border-blue-500 shadow-md" : "border-blue-300",
    )}>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-400" />
      <Handle type="target" position={Position.Top} className="!bg-blue-400" />
      <div className="flex items-center gap-1.5">
        <Database className="h-3.5 w-3.5 text-blue-600" />
        <span className="text-xs font-semibold text-blue-900">{data.label}</span>
      </div>
      {data.detail && (
        <div className="mt-0.5 text-[10px] text-blue-600">{data.detail}</div>
      )}
    </div>
  )
}

function FilterNode({ data, selected }: NodeProps<Node<MindMapNodeData>>) {
  return (
    <div className={cn(
      "rounded-lg border-2 bg-amber-50 px-3 py-2 shadow-sm transition-shadow",
      selected ? "border-amber-500 shadow-md" : "border-amber-300",
    )}>
      <Handle type="source" position={Position.Bottom} className="!bg-amber-400" />
      <Handle type="target" position={Position.Top} className="!bg-amber-400" />
      <div className="flex items-center gap-1.5">
        <Filter className="h-3.5 w-3.5 text-amber-600" />
        <span className="text-xs font-semibold text-amber-900">{data.label}</span>
      </div>
    </div>
  )
}

function AggregationNode({ data, selected }: NodeProps<Node<MindMapNodeData>>) {
  return (
    <div className={cn(
      "rounded-lg border-2 bg-emerald-50 px-3 py-2 shadow-sm transition-shadow",
      selected ? "border-emerald-500 shadow-md" : "border-emerald-300",
    )}>
      <Handle type="source" position={Position.Bottom} className="!bg-emerald-400" />
      <Handle type="target" position={Position.Top} className="!bg-emerald-400" />
      <div className="flex items-center gap-1.5">
        <BarChart3 className="h-3.5 w-3.5 text-emerald-600" />
        <span className="text-xs font-semibold text-emerald-900">{data.label}</span>
      </div>
    </div>
  )
}

function StepNode({ data, selected }: NodeProps<Node<MindMapNodeData>>) {
  return (
    <div className={cn(
      "rounded-lg border-2 bg-violet-50 px-3 py-2.5 shadow-sm transition-shadow",
      selected ? "border-violet-500 shadow-md" : "border-violet-300",
    )}>
      <Handle type="source" position={Position.Bottom} className="!bg-violet-400" />
      <Handle type="target" position={Position.Top} className="!bg-violet-400" />
      <div className="flex items-center gap-1.5">
        {data.status === "running" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-600" />
        ) : (
          <GitBranch className="h-3.5 w-3.5 text-violet-600" />
        )}
        <span className="text-xs font-semibold text-violet-900">{data.label}</span>
      </div>
      {data.status === "error" && (
        <div className="mt-0.5 text-[10px] font-medium text-red-600">Error</div>
      )}
    </div>
  )
}

function CTENode({ data, selected }: NodeProps<Node<MindMapNodeData>>) {
  return (
    <div className={cn(
      "rounded-lg border-2 bg-slate-100 px-3 py-2 shadow-sm transition-shadow",
      selected ? "border-slate-500 shadow-md" : "border-slate-300",
    )}>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400" />
      <Handle type="target" position={Position.Top} className="!bg-slate-400" />
      <div className="flex items-center gap-1.5">
        <Layers className="h-3.5 w-3.5 text-slate-600" />
        <span className="text-xs font-semibold text-slate-800">{data.label}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Node type registry (stable reference)
// ---------------------------------------------------------------------------

const nodeTypes = {
  table: TableNode,
  filter: FilterNode,
  aggregation: AggregationNode,
  step: StepNode,
  cte: CTENode,
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface QueryMindMapProps {
  graph: QueryGraph
  onNodeSelect?: (nodeId: string | null) => void
}

export function QueryMindMap({ graph, onNodeSelect }: QueryMindMapProps) {
  const layout = useMemo(() => layoutGraph(graph), [graph])
  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layout.edges)
  const { fitView } = useReactFlow()

  // Update nodes/edges when graph changes
  useEffect(() => {
    setNodes(layout.nodes)
    setEdges(layout.edges)
    // Fit view after a small delay to let the DOM update
    const timer = setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 100)
    return () => clearTimeout(timer)
  }, [layout, setNodes, setEdges, fitView])

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeSelect?.(node.id)
    },
    [onNodeSelect],
  )

  const handlePaneClick = useCallback(() => {
    onNodeSelect?.(null)
  }, [onNodeSelect])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      onPaneClick={handlePaneClick}
      nodeTypes={nodeTypes}
      fitView
      minZoom={0.3}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      className="bg-muted/10"
    >
      <Background gap={16} size={1} color="#e2e8f0" />
      <Controls showInteractive={false} className="!shadow-sm" />
      <MiniMap
        nodeColor={(n) => {
          switch (n.type) {
            case "table": return "#93c5fd"
            case "filter": return "#fcd34d"
            case "aggregation": return "#6ee7b7"
            case "step": return "#c4b5fd"
            case "cte": return "#cbd5e1"
            default: return "#e2e8f0"
          }
        }}
        maskColor="rgba(0,0,0,0.08)"
        className="!shadow-sm"
      />
    </ReactFlow>
  )
}
