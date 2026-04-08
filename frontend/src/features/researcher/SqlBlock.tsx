import { useState } from "react"
import { ChevronDown, ChevronRight, Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface SqlBlockProps {
  sql: string
  description?: string
}

export function SqlBlock({ sql, description }: SqlBlockProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-2 rounded-lg border border-slate-200 bg-slate-50 text-sm">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-600 hover:bg-slate-100"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
        )}
        <span className="font-mono text-xs text-violet-600">SQL</span>
        {description && (
          <span className="truncate text-xs text-slate-500">— {description}</span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleCopy()
          }}
          className="ml-auto flex-shrink-0 rounded p-1 hover:bg-slate-200"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-slate-400" />
          )}
        </button>
      </button>
      {expanded && (
        <pre className="overflow-x-auto border-t border-slate-200 px-3 py-2 text-xs leading-relaxed text-slate-700">
          {sql}
        </pre>
      )}
    </div>
  )
}
