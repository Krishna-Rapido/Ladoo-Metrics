import { useCallback, useEffect, useRef, useState } from "react"
import { Clock, Plus, Send } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { nlQuery, listQueryHistory, type NLQueryHistoryItem, type NLQueryResponse, type SchemaTable } from "@/lib/knowledgeApi"
import { ChatMessage, type Message } from "./ChatMessage"

interface ChatModeProps {
  tables: SchemaTable[]
}

export function ChatMode({ tables }: ChatModeProps) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [history, setHistory] = useState<NLQueryHistoryItem[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const userId = user?.id ?? ""

  // Load history
  useEffect(() => {
    if (userId) {
      listQueryHistory(userId).then(setHistory).catch(() => {})
    }
  }, [userId])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = "auto"
      ta.style.height = `${Math.min(ta.scrollHeight, 150)}px`
    }
  }, [input])

  const handleSend = useCallback(async () => {
    const question = input.trim()
    if (!question || sending) return

    setInput("")
    setSending(true)

    // Add user message
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: question }
    setMessages((prev) => [...prev, userMsg])

    try {
      // Step 1: Generate SQL (don't execute yet)
      const genResult = await nlQuery(userId, { question, execute: false, username: user?.email ?? "" })

      if (!genResult.success) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "error", content: genResult.error || "Failed to generate SQL" },
        ])
        return
      }

      // Add assistant message with intent + SQL
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        intent: genResult.intent,
        sql: genResult.sql,
        explanation: genResult.explanation,
        queryId: genResult.query_id,
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "error", content: e instanceof Error ? e.message : "Request failed" },
      ])
    } finally {
      setSending(false)
    }
  }, [input, sending, userId, user?.email])

  const handleExecute = useCallback(async (msgId: string, sql: string) => {
    // Update message to show loading
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, executing: true } : m))
    )

    try {
      const result = await nlQuery(userId, {
        question: "",
        execute: true,
        sql_override: sql,
        username: user?.email ?? "",
      })

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                executing: false,
                result: result.success ? result : undefined,
                error: result.success ? undefined : result.error,
              }
            : m
        )
      )
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, executing: false, error: e instanceof Error ? e.message : "Execution failed" }
            : m
        )
      )
    }
  }, [userId, user?.email])

  function handleHistoryClick(item: NLQueryHistoryItem) {
    setInput(item.question)
    setShowHistory(false)
    textareaRef.current?.focus()
  }

  function handleNewConversation() {
    setMessages([])
  }

  const hasSchema = tables.length > 0

  return (
    <div className="flex h-full">
      {/* Sidebar — History */}
      <div className="w-64 flex-shrink-0 border-r border-border bg-slate-50 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">History</span>
          <button
            type="button"
            onClick={handleNewConversation}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="New conversation"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {history.length === 0 ? (
            <p className="px-4 py-8 text-xs text-muted-foreground text-center">
              No queries yet. Ask a question to get started.
            </p>
          ) : (
            history.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleHistoryClick(item)}
                className="w-full text-left px-4 py-2.5 hover:bg-white transition-colors group"
              >
                <p className="text-xs text-foreground truncate group-hover:text-violet-700">
                  {item.question}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                  {item.was_executed && item.row_count !== null && (
                    <span className="text-[10px] text-emerald-600">{item.row_count} rows</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <div className="max-w-md text-center">
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  Ask about your data
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Ask questions in plain English and get SQL queries generated from your knowledge graph.
                  {!hasSchema && " Add tables in Schema mode first for best results."}
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    "How many captains were online in Bangalore yesterday?",
                    "What's the average daily rides per captain by city?",
                    "Show me the top 10 captains by net rides last week",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => { setInput(suggestion); textareaRef.current?.focus() }}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              userId={userId}
              onExecute={handleExecute}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="border-t border-border bg-white px-6 py-4">
          <div className="mx-auto max-w-3xl">
            <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3 focus-within:ring-2 focus-within:ring-violet-200 focus-within:border-violet-400 transition-all">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Ask a question about your data..."
                rows={1}
                className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                    GPT-4o
                  </span>
                  {tables.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {tables.length} table{tables.length !== 1 ? "s" : ""} in schema
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending || !input.trim()}
                  className="rounded-lg bg-violet-600 p-2 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              Press <kbd className="rounded bg-muted px-1 py-0.5 text-[10px] font-mono">Cmd+Enter</kbd> to send
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
