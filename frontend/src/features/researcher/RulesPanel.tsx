import { useState } from "react"
import { Plus, Trash2, Globe, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import type { ResearcherRule } from "./useResearcherChat"

interface RulesPanelProps {
  rules: ResearcherRule[]
  onAdd: (rule: Omit<ResearcherRule, "id">) => void
  onUpdate: (id: string, updates: Partial<ResearcherRule>) => void
  onDelete: (id: string) => void
}

const RULE_TYPES = [
  { value: "table" as const, label: "Table", description: "Preferred tables and joins" },
  { value: "filter" as const, label: "Filter", description: "Default WHERE filters" },
  { value: "analysis" as const, label: "Analysis", description: "Analysis conventions" },
  { value: "custom" as const, label: "Custom", description: "Any instruction" },
]

export function RulesPanel({ rules, onAdd, onUpdate, onDelete }: RulesPanelProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newType, setNewType] = useState<ResearcherRule["type"]>("filter")
  const [newContent, setNewContent] = useState("")
  const [newScope, setNewScope] = useState<"global" | "chat">("global")

  const handleAdd = () => {
    if (!newContent.trim()) return
    onAdd({ type: newType, content: newContent.trim(), scope: newScope })
    setNewContent("")
    setIsAdding(false)
  }

  const grouped = RULE_TYPES.map((t) => ({
    ...t,
    rules: rules.filter((r) => r.type === t.value),
  })).filter((g) => g.rules.length > 0)

  return (
    <div className="w-full space-y-3">
      <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
        Rules shape how the AI writes queries and analyzes data.
      </p>

      {/* Existing rules grouped by type */}
      {grouped.map((group) => (
        <div key={group.value}>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </div>
          <div className="space-y-1.5">
            {group.rules.map((rule) => (
              <RuleItem
                key={rule.id}
                rule={rule}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      ))}

      {rules.length === 0 && !isAdding && (
        <div className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
          No rules yet. Add rules to guide the AI.
        </div>
      )}

      <Separator />

      {/* Add rule form */}
      {isAdding ? (
        <div className="space-y-2 rounded-lg border bg-accent/30 p-3 [overflow-wrap:anywhere]">
          <div className="flex flex-wrap gap-1.5">
            {RULE_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setNewType(t.value)}
                className={cn(
                  "rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
                  newType === t.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-foreground/70 hover:bg-accent",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder={
              newType === "table"
                ? 'e.g. "Always use bi_mne_v2 instead of bi_mne"'
                : newType === "filter"
                  ? 'e.g. "Default city: bangalore"'
                  : newType === "analysis"
                    ? 'e.g. "Always show Cohen\'s d alongside p-values"'
                    : "Any instruction for the AI..."
            }
            className="w-full rounded-md border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30"
            rows={2}
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex shrink-0 gap-1">
              <button
                onClick={() => setNewScope("global")}
                className={cn(
                  "flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
                  newScope === "global"
                    ? "bg-foreground text-background"
                    : "bg-background text-muted-foreground hover:bg-accent",
                )}
              >
                <Globe className="h-2.5 w-2.5" />
                Global
              </button>
              <button
                onClick={() => setNewScope("chat")}
                className={cn(
                  "flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
                  newScope === "chat"
                    ? "bg-foreground text-background"
                    : "bg-background text-muted-foreground hover:bg-accent",
                )}
              >
                <MessageSquare className="h-2.5 w-2.5" />
                Chat
              </button>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setIsAdding(false); setNewContent("") }}
                className="h-6 px-2 text-[10px]"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={!newContent.trim()}
                className="h-6 px-2 text-[10px]"
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAdding(true)}
          className="w-full border-dashed"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Rule
        </Button>
      )}
    </div>
  )
}

function RuleItem({
  rule,
  onUpdate,
  onDelete,
}: {
  rule: ResearcherRule
  onUpdate: (id: string, updates: Partial<ResearcherRule>) => void
  onDelete: (id: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(rule.content)

  const handleSave = () => {
    if (editContent.trim() && editContent.trim() !== rule.content) {
      onUpdate(rule.id, { content: editContent.trim() })
    }
    setIsEditing(false)
  }

  return (
    <div className="group rounded-lg border bg-background px-2.5 py-2 text-xs [overflow-wrap:anywhere]">
      {isEditing ? (
        <div className="space-y-1.5">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full rounded border bg-background px-2 py-1 text-xs focus:border-ring focus:outline-none"
            rows={2}
            autoFocus
          />
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setIsEditing(false)}>Cancel</Button>
            <Button size="sm" className="h-6 text-[10px]" onClick={handleSave}>Save</Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <div
            className="min-w-0 flex-1 cursor-pointer text-foreground/80 [overflow-wrap:anywhere]"
            onClick={() => { setIsEditing(true); setEditContent(rule.content) }}
          >
            {rule.content}
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onUpdate(rule.id, { scope: rule.scope === "global" ? "chat" : "global" })}
                  className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  {rule.scope === "global" ? (
                    <Globe className="h-3 w-3" />
                  ) : (
                    <MessageSquare className="h-3 w-3" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>{rule.scope === "global" ? "Global rule" : "Chat-scoped rule"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onDelete(rule.id)}
                  className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Delete rule</TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  )
}
