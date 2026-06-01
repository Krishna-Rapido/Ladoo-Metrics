import { useState } from "react"
import { AlertCircle, Lightbulb, ThumbsUp, ThumbsDown, Loader2 } from "lucide-react"
import { submitQueryFeedback, type NLQueryResponse } from "@/lib/knowledgeApi"
import { cn } from "@/lib/utils"
import { QueryPreview } from "./QueryPreview"
import { ResultsTable } from "./ResultsTable"

export interface Message {
  id: string
  role: "user" | "assistant" | "error"
  content: string
  intent?: string
  sql?: string
  explanation?: string
  queryId?: string
  result?: NLQueryResponse
  error?: string
  executing?: boolean
}

interface ChatMessageProps {
  message: Message
  userId: string
  onExecute: (msgId: string, sql: string) => void
}

export function ChatMessage({ message, userId, onExecute }: ChatMessageProps) {
  const [feedback, setFeedback] = useState<"thumbs_up" | "thumbs_down" | null>(null)

  async function handleFeedback(type: "thumbs_up" | "thumbs_down") {
    if (!message.queryId) return
    setFeedback(type)
    try {
      await submitQueryFeedback(message.queryId, userId, type)
    } catch {
      // ignore
    }
  }

  // User message
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[70%] rounded-2xl rounded-tr-md bg-violet-600 px-4 py-3 text-sm text-white">
          {message.content}
        </div>
      </div>
    )
  }

  // Error message
  if (message.role === "error") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[80%] rounded-2xl rounded-tl-md border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium text-red-700">Error</span>
          </div>
          <p className="text-sm text-red-600">{message.content}</p>
        </div>
      </div>
    )
  }

  // Assistant message
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-3">
        {/* Intent */}
        {message.intent && (
          <div className="flex items-start gap-2 rounded-xl bg-violet-50 px-4 py-3">
            <Lightbulb className="h-4 w-4 text-violet-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-violet-800">{message.intent}</p>
          </div>
        )}

        {/* SQL preview */}
        {message.sql && (
          <QueryPreview
            sql={message.sql}
            explanation={message.explanation}
            executing={message.executing}
            onRun={(sql) => onExecute(message.id, sql)}
          />
        )}

        {/* Execution error */}
        {message.error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-xs text-red-600">{message.error}</p>
          </div>
        )}

        {/* Results table */}
        {message.result && message.result.success && message.result.rows.length > 0 && (
          <ResultsTable
            rows={message.result.rows}
            columns={message.result.columns}
            rowCount={message.result.row_count}
            executionTimeMs={message.result.execution_time_ms}
          />
        )}

        {/* Empty results */}
        {message.result && message.result.success && message.result.rows.length === 0 && (
          <div className="rounded-xl border border-border bg-slate-50 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Query returned 0 rows ({message.result.execution_time_ms}ms)
            </p>
          </div>
        )}

        {/* Feedback */}
        {message.queryId && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleFeedback("thumbs_up")}
              className={cn(
                "rounded-lg p-1.5 transition-colors",
                feedback === "thumbs_up"
                  ? "bg-emerald-50 text-emerald-600"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleFeedback("thumbs_down")}
              className={cn(
                "rounded-lg p-1.5 transition-colors",
                feedback === "thumbs_down"
                  ? "bg-red-50 text-red-600"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
