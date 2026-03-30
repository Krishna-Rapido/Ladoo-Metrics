import { useState } from "react"
import { X, Loader2, Link2 } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { createRelationship, type SchemaTable } from "@/lib/knowledgeApi"

interface ConnectTablesDialogProps {
  tables: SchemaTable[]
  /** Pre-select one side of the relationship */
  preselectedTableId?: string | null
  onClose: () => void
  onCreated: () => Promise<void>
}

export function ConnectTablesDialog({
  tables,
  preselectedTableId,
  onClose,
  onCreated,
}: ConnectTablesDialogProps) {
  const { user } = useAuth()
  const [fromTableId, setFromTableId] = useState(preselectedTableId ?? "")
  const [fromColumn, setFromColumn] = useState("")
  const [toTableId, setToTableId] = useState("")
  const [toColumn, setToColumn] = useState("")
  const [joinType, setJoinType] = useState("inner")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const fromTable = tables.find((t) => t.id === fromTableId)
  const toTable = tables.find((t) => t.id === toTableId)

  // Filter: can't connect a table to itself
  const toTableOptions = tables.filter((t) => t.id !== fromTableId)

  async function handleCreate() {
    if (!fromTableId || !fromColumn || !toTableId || !toColumn) return
    setSaving(true)
    setError("")
    try {
      await createRelationship(user?.id ?? "", {
        from_table_id: fromTableId,
        from_column: fromColumn,
        to_table_id: toTableId,
        to_column: toColumn,
        join_type: joinType,
        confidence: 1.0,
        is_approved: true,
        inference_reason: "manual",
      })
      await onCreated()
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create connection"
      if (msg.includes("409") || msg.includes("already exists") || msg.includes("duplicate")) {
        setError("This connection already exists.")
      } else {
        setError(msg)
      }
    } finally {
      setSaving(false)
    }
  }

  const canSave = fromTableId && fromColumn && toTableId && toColumn

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-violet-600" />
            <h2 className="text-base font-semibold text-foreground">Connect Tables</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* From table */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">From Table</label>
            <select
              className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
              value={fromTableId}
              onChange={(e) => { setFromTableId(e.target.value); setFromColumn("") }}
            >
              <option value="">Select a table...</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.friendly_name || t.table_name}
                </option>
              ))}
            </select>

            {fromTable && (
              <select
                className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-white font-mono focus:outline-none focus:ring-2 focus:ring-violet-200"
                value={fromColumn}
                onChange={(e) => setFromColumn(e.target.value)}
              >
                <option value="">Select column...</option>
                {fromTable.columns.map((c) => (
                  <option key={c.id} value={c.column_name}>
                    {c.column_name} ({c.data_type})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Join type */}
          <div className="flex items-center justify-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <select
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium bg-white focus:outline-none"
              value={joinType}
              onChange={(e) => setJoinType(e.target.value)}
            >
              <option value="inner">INNER JOIN</option>
              <option value="left">LEFT JOIN</option>
              <option value="right">RIGHT JOIN</option>
              <option value="full">FULL JOIN</option>
            </select>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* To table */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">To Table</label>
            <select
              className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
              value={toTableId}
              onChange={(e) => { setToTableId(e.target.value); setToColumn("") }}
            >
              <option value="">Select a table...</option>
              {toTableOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.friendly_name || t.table_name}
                </option>
              ))}
            </select>

            {toTable && (
              <select
                className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-white font-mono focus:outline-none focus:ring-2 focus:ring-violet-200"
                value={toColumn}
                onChange={(e) => setToColumn(e.target.value)}
              >
                <option value="">Select column...</option>
                {toTable.columns.map((c) => (
                  <option key={c.id} value={c.column_name}>
                    {c.column_name} ({c.data_type})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Preview */}
          {canSave && (
            <div className="rounded-lg bg-slate-50 border border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{fromTable?.friendly_name || fromTable?.table_name}</span>
                <span className="font-mono text-violet-600">.{fromColumn}</span>
                <span className="mx-2 text-muted-foreground">{joinType.toUpperCase()}</span>
                <span className="font-medium text-foreground">{toTable?.friendly_name || toTable?.table_name}</span>
                <span className="font-mono text-violet-600">.{toColumn}</span>
              </p>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving || !canSave}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Connect
          </button>
        </div>
      </div>
    </div>
  )
}
