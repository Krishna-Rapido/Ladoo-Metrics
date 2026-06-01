import { useState } from "react"
import { Link2, Plus, RefreshCw, X, Trash2 } from "lucide-react"
import type { SchemaTable, SchemaRelationship } from "@/lib/knowledgeApi"
import { inferRelationships, deleteRelationship } from "@/lib/knowledgeApi"
import { GraphExplorer, type EdgePairDetail } from "./GraphExplorer"
import { TableDetailPanel } from "./TableDetailPanel"
import { AddTableDialog } from "./AddTableDialog"
import { ConnectTablesDialog } from "./ConnectTablesDialog"
import { RelationshipApproval } from "./RelationshipApproval"

interface SchemaModeProps {
  tables: SchemaTable[]
  relationships: SchemaRelationship[]
  loading: boolean
  error: string
  refresh: () => Promise<void>
  isAdmin?: boolean
}

export function SchemaMode({ tables, relationships, loading, error, refresh, isAdmin = false }: SchemaModeProps) {
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [selectedEdgePair, setSelectedEdgePair] = useState<EdgePairDetail | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showConnectDialog, setShowConnectDialog] = useState(false)
  const [connectPreselectedTableId, setConnectPreselectedTableId] = useState<string | null>(null)
  const [inferring, setInferring] = useState(false)
  const [deletingRelId, setDeletingRelId] = useState<string | null>(null)

  const selectedTable = tables.find((t) => t.id === selectedTableId) ?? null

  const approvedRels = relationships.filter((r) => r.is_approved)
  const unapprovedRels = relationships.filter((r) => !r.is_approved)

  async function handleInfer() {
    setInferring(true)
    try {
      await inferRelationships()
      await refresh()
    } finally {
      setInferring(false)
    }
  }

  function handleConnectFrom(tableId: string) {
    setConnectPreselectedTableId(tableId)
    setShowConnectDialog(true)
  }

  function handleEdgeClick(detail: EdgePairDetail) {
    setSelectedTableId(null)
    setSelectedEdgePair(detail)
  }

  function handleSelectTable(id: string | null) {
    setSelectedEdgePair(null)
    setSelectedTableId(id)
  }

  async function handleDeleteJoin(relId: string) {
    setDeletingRelId(relId)
    try {
      await deleteRelationship(relId)
      await refresh()
      setSelectedEdgePair(null)
    } finally {
      setDeletingRelId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading knowledge graph...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 max-w-md text-center">
          <p className="text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={refresh}
            className="mt-3 text-sm font-medium text-red-600 hover:text-red-800"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Empty state
  if (tables.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50">
            <Plus className="h-8 w-8 text-violet-500" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">No tables registered yet</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Add your first Presto table to start building the knowledge graph.
            You can auto-detect columns or add them manually.
          </p>
          <button
            type="button"
            onClick={() => setShowAddDialog(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            <Plus className="h-4 w-4" />
            Add Table
          </button>
          {showAddDialog && (
            <AddTableDialog
              onClose={() => setShowAddDialog(false)}
              onAdded={refresh}
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Left: Graph Explorer */}
      <div className="flex-1 flex flex-col border-r border-border">
        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <button
            type="button"
            onClick={() => setShowAddDialog(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Table
          </button>
          <button
            type="button"
            onClick={() => { setConnectPreselectedTableId(null); setShowConnectDialog(true) }}
            disabled={tables.length < 2}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
          >
            <Link2 className="h-3.5 w-3.5" />
            Connect Tables
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={handleInfer}
              disabled={inferring || tables.length < 2}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${inferring ? "animate-spin" : ""}`} />
              Infer Joins
            </button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {tables.length} table{tables.length !== 1 ? "s" : ""} &middot;{" "}
            {approvedRels.length} connection{approvedRels.length !== 1 ? "s" : ""}
            {unapprovedRels.length > 0 && (
              <span className="ml-1 text-amber-600">({unapprovedRels.length} pending)</span>
            )}
          </span>
        </div>

        {/* Graph shows only approved relationships */}
        <GraphExplorer
          tables={tables}
          relationships={approvedRels}
          selectedTableId={selectedTableId}
          onSelectTable={handleSelectTable}
          onEdgeClick={handleEdgeClick}
        />
      </div>

      {/* Right: Detail Panel */}
      <div className="w-[420px] flex-shrink-0 overflow-y-auto bg-white">
        {selectedEdgePair ? (
          <EdgeJoinsPanel
            detail={selectedEdgePair}
            tables={tables}
            relationships={approvedRels}
            deletingRelId={deletingRelId}
            onDeleteJoin={isAdmin ? handleDeleteJoin : undefined}
            onClose={() => setSelectedEdgePair(null)}
          />
        ) : unapprovedRels.length > 0 && !selectedTable && isAdmin ? (
          <RelationshipApproval
            relationships={unapprovedRels}
            tables={tables}
            onUpdate={refresh}
          />
        ) : selectedTable ? (
          <TableDetailPanel
            table={selectedTable}
            relationships={relationships}
            tables={tables}
            onUpdate={refresh}
            onClose={() => setSelectedTableId(null)}
            onConnect={() => handleConnectFrom(selectedTable.id)}
            isAdmin={isAdmin}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Click a table node or edge in the graph to view details.
            </p>
          </div>
        )}
      </div>

      {showAddDialog && (
        <AddTableDialog
          onClose={() => setShowAddDialog(false)}
          onAdded={refresh}
        />
      )}

      {showConnectDialog && (
        <ConnectTablesDialog
          tables={tables}
          preselectedTableId={connectPreselectedTableId}
          onClose={() => setShowConnectDialog(false)}
          onCreated={refresh}
          autoApprove={isAdmin}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Edge Joins Detail Panel — shown when a grouped edge is clicked
// ---------------------------------------------------------------------------

function EdgeJoinsPanel({
  detail,
  tables,
  relationships,
  deletingRelId,
  onDeleteJoin,
  onClose,
}: {
  detail: EdgePairDetail
  tables: SchemaTable[]
  relationships: SchemaRelationship[]
  deletingRelId: string | null
  onDeleteJoin?: (relId: string) => void
  onClose: () => void
}) {
  const sourceTable = tables.find((t) => t.id === detail.sourceTableId)
  const targetTable = tables.find((t) => t.id === detail.targetTableId)

  // Match joins to actual relationship records to get IDs for deletion
  function findRelId(join: EdgePairDetail["joins"][0]): string | undefined {
    return relationships.find(
      (r) =>
        ((r.from_table_id === detail.sourceTableId && r.to_table_id === detail.targetTableId &&
          r.from_column === join.from_column && r.to_column === join.to_column) ||
         (r.from_table_id === detail.targetTableId && r.to_table_id === detail.sourceTableId &&
          r.from_column === join.to_column && r.to_column === join.from_column))
    )?.id
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">
            {detail.joins.length} Join{detail.joins.length !== 1 ? "s" : ""}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {sourceTable?.friendly_name || sourceTable?.table_name || "?"}{" "}
            <span className="text-emerald-600">↔</span>{" "}
            {targetTable?.friendly_name || targetTable?.table_name || "?"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Table name pills */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className="rounded-lg bg-violet-50 border border-violet-200 px-2.5 py-1 text-xs font-medium text-violet-700 truncate max-w-[160px]">
          {sourceTable?.table_name}
        </span>
        <Link2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
        <span className="rounded-lg bg-violet-50 border border-violet-200 px-2.5 py-1 text-xs font-medium text-violet-700 truncate max-w-[160px]">
          {targetTable?.table_name}
        </span>
      </div>

      {/* Joins list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {detail.joins.map((join, idx) => {
          const relId = findRelId(join)
          return (
            <div
              key={idx}
              className="group rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 uppercase">
                  {join.join_type} join
                </span>
                {relId && onDeleteJoin && (
                  <button
                    type="button"
                    onClick={() => onDeleteJoin(relId)}
                    disabled={deletingRelId === relId}
                    className="rounded p-1 text-emerald-400 opacity-0 group-hover:opacity-100 hover:bg-emerald-100 hover:text-red-500 transition-all disabled:opacity-50"
                    title="Remove this join"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2 font-mono">
                <span className="text-emerald-800">{join.from_column}</span>
                <span className="text-emerald-400">→</span>
                <span className="text-emerald-800">{join.to_column}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
