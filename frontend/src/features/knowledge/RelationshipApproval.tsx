import { useState } from "react"
import { Check, X, Link2 } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { updateRelationship, deleteRelationship } from "@/lib/knowledgeApi"
import type { SchemaRelationship, SchemaTable } from "@/lib/knowledgeApi"
import { cn } from "@/lib/utils"

interface RelationshipApprovalProps {
  relationships: SchemaRelationship[]
  tables: SchemaTable[]
  onUpdate: () => Promise<void>
}

export function RelationshipApproval({
  relationships,
  tables,
  onUpdate,
}: RelationshipApprovalProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState<string | null>(null)

  const tableMap = new Map(tables.map((t) => [t.id, t]))

  async function handleApprove(rel: SchemaRelationship) {
    setLoading(rel.id)
    try {
      await updateRelationship(rel.id, user?.id ?? "", { is_approved: true })
      await onUpdate()
    } finally {
      setLoading(null)
    }
  }

  async function handleReject(rel: SchemaRelationship) {
    setLoading(rel.id)
    try {
      await deleteRelationship(rel.id)
      await onUpdate()
    } finally {
      setLoading(null)
    }
  }

  function confidenceColor(c: number) {
    if (c >= 0.8) return "text-emerald-700 bg-emerald-50"
    if (c >= 0.6) return "text-amber-700 bg-amber-50"
    return "text-red-700 bg-red-50"
  }

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-foreground mb-1">
        Inferred Relationships
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        Review and approve or reject the automatically inferred join relationships.
      </p>

      <div className="space-y-3">
        {relationships.map((rel) => {
          const fromTable = tableMap.get(rel.from_table_id)
          const toTable = tableMap.get(rel.to_table_id)
          const isLoading = loading === rel.id

          return (
            <div
              key={rel.id}
              className="rounded-xl border border-border bg-white p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-violet-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-foreground">
                    {fromTable?.friendly_name || fromTable?.table_name || "?"}{" "}
                    <span className="text-muted-foreground">→</span>{" "}
                    {toTable?.friendly_name || toTable?.table_name || "?"}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {rel.from_column} → {rel.to_column}
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium",
                    confidenceColor(rel.confidence)
                  )}
                >
                  {(rel.confidence * 100).toFixed(0)}%
                </span>
              </div>

              {rel.inference_reason && (
                <p className="text-[10px] text-muted-foreground pl-6">
                  {rel.inference_reason}
                </p>
              )}

              <div className="flex items-center gap-2 pl-6">
                <button
                  type="button"
                  onClick={() => handleApprove(rel)}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                >
                  <Check className="h-3 w-3" />
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => handleReject(rel)}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  <X className="h-3 w-3" />
                  Reject
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
