import { useState } from "react"
import { Copy, Check, Play, Pencil, Loader2 } from "lucide-react"

interface QueryPreviewProps {
  sql: string
  explanation?: string
  executing?: boolean
  onRun: (sql: string) => void
}

export function QueryPreview({ sql, explanation, executing, onRun }: QueryPreviewProps) {
  const [editing, setEditing] = useState(false)
  const [editedSql, setEditedSql] = useState(sql)
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(editing ? editedSql : sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleRun() {
    onRun(editing ? editedSql : sql)
  }

  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      {/* SQL code block */}
      <div className="relative">
        <div className="flex items-center justify-between border-b border-border bg-slate-50 px-3 py-1.5">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">SQL</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Copy SQL"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(!editing)
                setEditedSql(sql)
              }}
              className={`rounded p-1 transition-colors ${
                editing
                  ? "bg-violet-50 text-violet-600"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              title="Edit SQL"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        </div>

        {editing ? (
          <textarea
            value={editedSql}
            onChange={(e) => setEditedSql(e.target.value)}
            className="w-full min-h-[80px] px-4 py-3 font-mono text-xs text-foreground bg-slate-900 text-slate-100 resize-none outline-none"
            spellCheck={false}
          />
        ) : (
          <pre className="px-4 py-3 overflow-x-auto bg-slate-900">
            <code className="text-xs text-slate-100 font-mono whitespace-pre-wrap">{sql}</code>
          </pre>
        )}
      </div>

      {/* Explanation */}
      {explanation && !editing && (
        <div className="border-t border-border px-4 py-2">
          <p className="text-xs text-muted-foreground">{explanation}</p>
        </div>
      )}

      {/* Run button */}
      <div className="border-t border-border px-4 py-2 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {editing ? "Editing — your changes will be used" : "Review the query before running"}
        </span>
        <button
          type="button"
          onClick={handleRun}
          disabled={executing}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {executing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          Run
        </button>
      </div>
    </div>
  )
}
