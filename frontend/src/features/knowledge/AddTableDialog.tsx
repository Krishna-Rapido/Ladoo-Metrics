import { useState } from "react"
import { X, Loader2, Zap, PenLine } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import {
  autoDetectTable,
  createSchemaTable,
  bulkAddColumns,
  type SchemaColumnCreate,
} from "@/lib/knowledgeApi"

interface AddTableDialogProps {
  onClose: () => void
  onAdded: () => Promise<void>
}

type Mode = "auto" | "manual"

export function AddTableDialog({ onClose, onAdded }: AddTableDialogProps) {
  const { user } = useAuth()
  const [mode, setMode] = useState<Mode>("auto")
  const [tableName, setTableName] = useState("")
  const [friendlyName, setFriendlyName] = useState("")
  const [description, setDescription] = useState("")
  const [grain, setGrain] = useState("")
  const [detectedColumns, setDetectedColumns] = useState<SchemaColumnCreate[]>([])
  const [detecting, setDetecting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function handleDetect() {
    if (!tableName.trim()) return
    setDetecting(true)
    setError("")
    try {
      const result = await autoDetectTable(tableName.trim(), user?.email ?? "ladoo")
      if (result.error) {
        setError(result.error)
      } else {
        setDetectedColumns(result.columns)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Detection failed")
    } finally {
      setDetecting(false)
    }
  }

  async function handleSave() {
    if (!tableName.trim()) return
    setSaving(true)
    setError("")
    try {
      const table = await createSchemaTable(user?.id ?? "", {
        table_name: tableName.trim(),
        friendly_name: friendlyName.trim(),
        description: description.trim(),
        grain: grain.trim(),
      })

      // Add detected columns if any
      if (detectedColumns.length > 0) {
        await bulkAddColumns(table.id, detectedColumns)
      }

      await onAdded()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create table")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">Add Table</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("auto")}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                mode === "auto"
                  ? "border-violet-500 bg-violet-50 text-violet-700"
                  : "border-border text-muted-foreground hover:border-slate-300"
              }`}
            >
              <Zap className="h-4 w-4" />
              Auto-detect from Presto
            </button>
            <button
              type="button"
              onClick={() => setMode("manual")}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                mode === "manual"
                  ? "border-violet-500 bg-violet-50 text-violet-700"
                  : "border-border text-muted-foreground hover:border-slate-300"
              }`}
            >
              <PenLine className="h-4 w-4" />
              Manual entry
            </button>
          </div>

          {/* Table name */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {mode === "auto" ? "Presto Table Name" : "Table Name"}
            </label>
            <input
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder={mode === "auto" ? "e.g., metrics.captain_base_metrics_enriched" : "e.g., my_table"}
            />
          </div>

          {mode === "auto" && (
            <button
              type="button"
              onClick={handleDetect}
              disabled={detecting || !tableName.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {detecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              Detect Columns
            </button>
          )}

          {/* Detected columns preview */}
          {detectedColumns.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Detected {detectedColumns.length} columns
              </p>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-slate-50 p-2 space-y-0.5">
                {detectedColumns.map((col, i) => (
                  <div key={i} className="flex items-center justify-between text-xs px-2 py-1">
                    <span className="font-mono">{col.column_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{col.data_type}</span>
                      <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px]">
                        {col.category}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Optional metadata */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Friendly Name</label>
              <input
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                value={friendlyName}
                onChange={(e) => setFriendlyName(e.target.value)}
                placeholder="Captain Base Metrics"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Grain</label>
              <input
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                value={grain}
                onChange={(e) => setGrain(e.target.value)}
                placeholder="captain × day × city"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm resize-none"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this table contain?"
            />
          </div>

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
            onClick={handleSave}
            disabled={saving || !tableName.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Add Table
          </button>
        </div>
      </div>
    </div>
  )
}
