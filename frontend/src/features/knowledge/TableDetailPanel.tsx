import { useState } from "react"
import { X, Save, Database, Clock, Tag, Link2, Pencil, Trash2, Plus } from "lucide-react"
import type { SchemaTable, SchemaRelationship, SchemaColumnUpdate } from "@/lib/knowledgeApi"
import { updateSchemaTable, updateColumn, deleteSchemaTable, deleteRelationship } from "@/lib/knowledgeApi"
import { useAuth } from "@/contexts/AuthContext"
import { cn } from "@/lib/utils"

interface TableDetailPanelProps {
  table: SchemaTable
  relationships: SchemaRelationship[]
  tables: SchemaTable[]
  onUpdate: () => Promise<void>
  onClose: () => void
  onConnect?: () => void
}

const categoryColors: Record<string, string> = {
  identifier: "bg-blue-50 text-blue-700 border-blue-200",
  dimension: "bg-emerald-50 text-emerald-700 border-emerald-200",
  measure: "bg-amber-50 text-amber-700 border-amber-200",
  time: "bg-rose-50 text-rose-700 border-rose-200",
}

export function TableDetailPanel({
  table,
  relationships,
  tables,
  onUpdate,
  onClose,
  onConnect,
}: TableDetailPanelProps) {
  const { user } = useAuth()
  const [editing, setEditing] = useState(false)
  const [friendlyName, setFriendlyName] = useState(table.friendly_name)
  const [description, setDescription] = useState(table.description)
  const [grain, setGrain] = useState(table.grain)
  const [saving, setSaving] = useState(false)
  const [editingColId, setEditingColId] = useState<string | null>(null)
  const [colFriendlyName, setColFriendlyName] = useState("")
  const [colDescription, setColDescription] = useState("")
  const [deletingRelId, setDeletingRelId] = useState<string | null>(null)

  // Group columns by category
  const grouped: Record<string, typeof table.columns> = {}
  for (const col of table.columns) {
    const cat = col.category || "dimension"
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(col)
  }

  const categoryOrder = ["identifier", "time", "dimension", "measure"]

  // Split relationships for this table
  const tableRels = relationships.filter(
    (r) => r.from_table_id === table.id || r.to_table_id === table.id
  )
  const approvedConnections = tableRels.filter((r) => r.is_approved)
  const pendingConnections = tableRels.filter((r) => !r.is_approved)

  async function handleSaveTable() {
    setSaving(true)
    try {
      await updateSchemaTable(table.id, { friendly_name: friendlyName, description, grain })
      setEditing(false)
      await onUpdate()
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveColumn(colId: string) {
    try {
      const updates: SchemaColumnUpdate = {}
      if (colFriendlyName) updates.friendly_name = colFriendlyName
      if (colDescription) updates.description = colDescription
      await updateColumn(colId, updates)
      setEditingColId(null)
      await onUpdate()
    } catch {
      // ignore
    }
  }

  async function handleDeleteRelationship(relId: string) {
    setDeletingRelId(relId)
    try {
      await deleteRelationship(relId)
      await onUpdate()
    } finally {
      setDeletingRelId(null)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete table "${table.table_name}" and all its columns?`)) return
    try {
      await deleteSchemaTable(table.id, user?.id ?? "")
      onClose()
      await onUpdate()
    } catch {
      // ignore
    }
  }

  function connectionDisplay(r: SchemaRelationship) {
    const isFrom = r.from_table_id === table.id
    const otherId = isFrom ? r.to_table_id : r.from_table_id
    const otherCol = isFrom ? r.to_column : r.from_column
    const thisCol = isFrom ? r.from_column : r.to_column
    const otherTable = tables.find((t) => t.id === otherId)
    return { otherId, otherCol, thisCol, otherTable }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="min-w-0">
          {editing ? (
            <input
              className="text-base font-semibold bg-transparent border-b border-violet-300 outline-none w-full"
              value={friendlyName}
              onChange={(e) => setFriendlyName(e.target.value)}
              placeholder="Friendly name"
            />
          ) : (
            <h2 className="text-base font-semibold text-foreground truncate">
              {table.friendly_name || table.table_name}
            </h2>
          )}
          <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{table.table_name}</p>
        </div>
        <div className="flex items-center gap-1 ml-2">
          {editing ? (
            <button
              type="button"
              onClick={handleSaveTable}
              disabled={saving}
              className="rounded-lg bg-violet-600 p-1.5 text-white hover:bg-violet-700 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Metadata */}
        <div className="space-y-2">
          {editing ? (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm resize-none"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Grain</label>
                <input
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                  value={grain}
                  onChange={(e) => setGrain(e.target.value)}
                  placeholder="e.g., captain × day × city"
                />
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              {table.grain && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs text-violet-700">
                  <Database className="h-3 w-3" />
                  {table.grain}
                </span>
              )}
              {table.time_column && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs text-rose-700">
                  <Clock className="h-3 w-3" />
                  {table.time_column}
                </span>
              )}
              {(table.tags ?? []).map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                  <Tag className="h-3 w-3" />
                  {tag}
                </span>
              ))}
            </div>
          )}
          {table.description && !editing && (
            <p className="text-xs text-muted-foreground">{table.description}</p>
          )}
        </div>

        {/* Columns by category */}
        {categoryOrder.map((cat) => {
          const cols = grouped[cat]
          if (!cols || cols.length === 0) return null
          return (
            <div key={cat}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {cat}s ({cols.length})
              </h3>
              <div className="space-y-1">
                {cols.map((col) => (
                  <div
                    key={col.id}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-xs",
                      categoryColors[cat] ?? "bg-slate-50 text-slate-700 border-slate-200"
                    )}
                  >
                    {editingColId === col.id ? (
                      <div className="space-y-1">
                        <input
                          className="w-full rounded border px-2 py-1 text-xs bg-white"
                          value={colFriendlyName}
                          onChange={(e) => setColFriendlyName(e.target.value)}
                          placeholder="Friendly name"
                        />
                        <input
                          className="w-full rounded border px-2 py-1 text-xs bg-white"
                          value={colDescription}
                          onChange={(e) => setColDescription(e.target.value)}
                          placeholder="Description"
                        />
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleSaveColumn(col.id)}
                            className="rounded bg-violet-600 px-2 py-0.5 text-[10px] text-white"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingColId(null)}
                            className="rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => {
                          setEditingColId(col.id)
                          setColFriendlyName(col.friendly_name)
                          setColDescription(col.description)
                        }}
                      >
                        <div className="min-w-0">
                          <span className="font-mono font-medium">{col.column_name}</span>
                          {col.friendly_name && (
                            <span className="ml-1.5 font-normal opacity-70">({col.friendly_name})</span>
                          )}
                        </div>
                        <span className="text-[10px] opacity-60 ml-2 flex-shrink-0">{col.data_type}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {/* Approved Connections */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Connections ({approvedConnections.length})
            </h3>
            {onConnect && (
              <button
                type="button"
                onClick={onConnect}
                className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-1 text-[10px] font-medium text-violet-700 hover:bg-violet-100"
              >
                <Plus className="h-3 w-3" />
                Connect to...
              </button>
            )}
          </div>

          {approvedConnections.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No connections yet. Use "Connect to..." to link this table to another.
            </p>
          ) : (
            <div className="space-y-1.5">
              {approvedConnections.map((r) => {
                const { otherTable, thisCol, otherCol } = connectionDisplay(r)
                return (
                  <div
                    key={r.id}
                    className="group flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs"
                  >
                    <Link2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-emerald-800">
                        {otherTable?.friendly_name || otherTable?.table_name || "?"}
                      </span>
                      <div className="text-[10px] text-emerald-600 font-mono mt-0.5">
                        {thisCol} → {otherCol}
                      </div>
                      <span className="text-[10px] text-emerald-500">{r.join_type} join</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteRelationship(r.id)}
                      disabled={deletingRelId === r.id}
                      className="rounded p-1 text-emerald-400 opacity-0 group-hover:opacity-100 hover:bg-emerald-100 hover:text-red-500 transition-all disabled:opacity-50"
                      title="Remove connection"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Pending Connections (inferred, not yet approved) */}
        {pendingConnections.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">
              Pending ({pendingConnections.length})
            </h3>
            <div className="space-y-1.5">
              {pendingConnections.map((r) => {
                const { otherTable, thisCol, otherCol } = connectionDisplay(r)
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs"
                  >
                    <Link2 className="h-3 w-3 text-amber-500 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-amber-800">
                        {otherTable?.friendly_name || otherTable?.table_name || "?"}
                      </span>
                      <span className="text-amber-600 ml-1 font-mono text-[10px]">
                        {thisCol} → {otherCol}
                      </span>
                    </div>
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                      {(r.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                )
              })}
              <p className="text-[10px] text-muted-foreground">
                Approve pending connections in the review panel (deselect this table).
              </p>
            </div>
          </div>
        )}

        {/* Delete button */}
        <div className="pt-2 border-t border-border">
          <button
            type="button"
            onClick={handleDelete}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Delete this table
          </button>
        </div>
      </div>
    </div>
  )
}
