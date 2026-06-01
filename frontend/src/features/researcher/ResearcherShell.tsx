import { useState, useCallback, useEffect, useRef } from "react"
import { BookOpen, GitBranch, Wifi, WifiOff, Loader2, CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/contexts/AuthContext"
import { PrimarySidebar } from "@/components/nav/PrimarySidebar"
import { useResearcherChat, type ResearcherRule } from "./useResearcherChat"
import { ChatPanel } from "./ChatPanel"
import { RulesPanel } from "./RulesPanel"
import { ChatHistory } from "./ChatHistory"
import { MindMapPanel } from "./mindmap/MindMapPanel"
import { testPrestoConnection, type PrestoTestResponse } from "@/lib/researcherApi"
import {
  listResearcherRules,
  createResearcherRule,
  updateResearcherRule,
  deleteResearcherRule,
  type ResearcherRuleRow,
} from "@/lib/supabase"

// Kept for backward compatibility with deprecated wizard files
export type ResearcherConfig = {
  method: "contrast" | "stimulus_response"
  username: string
  city: string
  start_date: string
  end_date: string
  consistency_segment?: string
  performance_segment?: string
  splitting_outcome?: string
  custom_column?: string
  custom_threshold?: number
  axes?: string[]
  min_active_days?: number
}

export function ResearcherShell() {
  const { user } = useAuth()
  const username = user?.email || "anonymous"

  // Rules state (synced with Supabase)
  const [rules, setRules] = useState<ResearcherRule[]>([])
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const [rightPanel, setRightPanel] = useState<"none" | "rules" | "mindmap">("none")
  const prevStreamingRef = useRef(false)

  const { messages, currentAssistant, isStreaming, chatId, sendMessage, abort, newChat, loadChat } =
    useResearcherChat(username, rules)

  // Presto connection test
  const [testResult, setTestResult] = useState<PrestoTestResponse | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)
  const [showTestPanel, setShowTestPanel] = useState(false)

  // Load rules from Supabase on mount and when chatId changes
  useEffect(() => {
    async function fetchRules() {
      try {
        const rows = await listResearcherRules(chatId ?? undefined)
        setRules(
          rows.map((r: ResearcherRuleRow) => ({
            id: r.id,
            type: r.type,
            content: r.content,
            scope: r.chat_id ? "chat" as const : "global" as const,
          }))
        )
      } catch (err) {
        console.error("Failed to load rules:", err)
      }
    }
    fetchRules()
  }, [chatId])

  const runConnectionTest = useCallback(async () => {
    setTestLoading(true)
    setTestError(null)
    setTestResult(null)
    setShowTestPanel(true)
    try {
      const result = await testPrestoConnection(username)
      setTestResult(result)
    } catch (err: unknown) {
      setTestError(err instanceof Error ? err.message : "Connection test failed")
    } finally {
      setTestLoading(false)
    }
  }, [username])

  // Rule CRUD handlers (persist to Supabase)
  const handleAddRule = useCallback(async (rule: Omit<ResearcherRule, "id">) => {
    try {
      const row = await createResearcherRule(
        rule.type,
        rule.content,
        rule.scope === "chat" ? chatId : null
      )
      setRules((prev) => [...prev, {
        id: row.id,
        type: row.type,
        content: row.content,
        scope: row.chat_id ? "chat" : "global",
      }])
    } catch (err) {
      console.error("Failed to create rule:", err)
      setRules((prev) => [...prev, { ...rule, id: `temp-${Date.now()}` }])
    }
  }, [chatId])

  const handleUpdateRule = useCallback(async (id: string, updates: Partial<ResearcherRule>) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)))
    try {
      const dbUpdates: Partial<Pick<ResearcherRuleRow, 'content' | 'type'>> = {}
      if (updates.content) dbUpdates.content = updates.content
      if (updates.type) dbUpdates.type = updates.type
      if (Object.keys(dbUpdates).length > 0) {
        await updateResearcherRule(id, dbUpdates)
      }
    } catch (err) {
      console.error("Failed to update rule:", err)
    }
  }, [])

  const handleDeleteRule = useCallback(async (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id))
    try {
      await deleteResearcherRule(id)
    } catch (err) {
      console.error("Failed to delete rule:", err)
    }
  }, [])

  const handleNewChat = useCallback(() => {
    newChat()
    setRules((prev) => prev.filter((r) => r.scope === "global"))
    setHistoryRefreshKey((k) => k + 1)
  }, [newChat])

  const handleSelectChat = useCallback(async (selectedChatId: string) => {
    await loadChat(selectedChatId)
  }, [loadChat])

  // Refresh history when chatId changes
  useEffect(() => {
    if (chatId) {
      setHistoryRefreshKey((k) => k + 1)
    }
  }, [chatId])

  // Auto-open mind map when streaming starts (if no panel is open)
  useEffect(() => {
    if (isStreaming && !prevStreamingRef.current && rightPanel === "none") {
      setRightPanel("mindmap")
    }
    prevStreamingRef.current = isStreaming
  }, [isStreaming, rightPanel])

  return (
    <div className="flex h-screen w-full overflow-hidden bg-muted/20">
      {/* Primary Sidebar — shared app nav */}
      <PrimarySidebar activeOverride="researcher" />

      {/* Secondary Sidebar — Chat History */}
      <aside className="flex w-[260px] flex-shrink-0 flex-col border-r bg-background">
        <ChatHistory
          activeChatId={chatId}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          refreshKey={historyRefreshKey}
        />
      </aside>

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex h-14 min-h-[56px] flex-shrink-0 items-center justify-between border-b bg-background/95 px-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Researcher</span>
            <Separator orientation="vertical" className="mx-1 h-4" />
            <span className="text-sm text-muted-foreground">AI Discovery Agent</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Mind Map toggle */}
            <Button
              variant={rightPanel === "mindmap" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setRightPanel((v) => v === "mindmap" ? "none" : "mindmap")}
              className="gap-1.5"
            >
              <GitBranch className="h-3.5 w-3.5" />
              Mind Map
            </Button>

            {/* Rules toggle */}
            <Button
              variant={rightPanel === "rules" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setRightPanel((v) => v === "rules" ? "none" : "rules")}
              className="gap-1.5"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Rules
              {rules.length > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-5 min-w-5 px-1.5 text-[10px]">
                  {rules.length}
                </Badge>
              )}
            </Button>

            {/* Presto test */}
            <Button
              variant="outline"
              size="sm"
              onClick={runConnectionTest}
              disabled={testLoading}
              className={cn(
                "gap-1.5",
                testResult?.connected && testResult.tables.every((t) => t.accessible)
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : testResult && !testResult.tables.every((t) => t.accessible)
                    ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    : "",
              )}
            >
              {testLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : testResult?.connected ? (
                <Wifi className="h-3.5 w-3.5" />
              ) : (
                <WifiOff className="h-3.5 w-3.5" />
              )}
              {testLoading ? "Testing..." : "Test Presto"}
            </Button>

            <span className="text-xs text-muted-foreground">{username}</span>
          </div>
        </header>

        {/* Connection test results panel */}
        {showTestPanel && (testResult || testLoading || testError) && (
          <div className="flex-shrink-0 border-b bg-secondary/30 px-6 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Presto Connection Test
              </span>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowTestPanel(false)}>
                Close
              </Button>
            </div>
            {testLoading && (
              <p className="mt-2 text-sm text-muted-foreground">Running diagnostics...</p>
            )}
            {testError && (
              <p className="mt-2 text-sm text-destructive">{testError}</p>
            )}
            {testResult && (
              <div className="mt-2 space-y-2">
                <p className="text-sm font-medium text-foreground">
                  {testResult.summary}
                </p>
                <p className="text-xs text-muted-foreground">
                  Host: {testResult.presto_host}:{testResult.presto_port} | User: {testResult.username}
                </p>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {testResult.tables.map((t) => (
                    <div
                      key={t.table}
                      className={cn(
                        "flex items-start gap-2 rounded-md px-2.5 py-1.5 text-xs",
                        t.accessible ? "bg-emerald-50" : "bg-red-50",
                      )}
                    >
                      {t.accessible ? (
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
                      ) : (
                        <XCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-500" />
                      )}
                      <div className="min-w-0">
                        <span className={cn(
                          "font-medium",
                          t.accessible ? "text-emerald-800" : "text-red-800",
                        )}>
                          {t.table.split(".").pop()}
                        </span>
                        <span className="ml-1 text-muted-foreground">({t.query_ms}ms)</span>
                        {t.error && (
                          <p className="mt-0.5 truncate text-destructive" title={t.error}>
                            {t.error.slice(0, 80)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chat + Rules sidebar */}
        <div className="flex flex-1 overflow-hidden">
          {/* Chat panel */}
          <div className="min-w-0 flex-1">
            <ChatPanel
              messages={messages}
              currentAssistant={currentAssistant}
              isStreaming={isStreaming}
              onSend={sendMessage}
              onStop={abort}
            />
          </div>

          {/* Right sidebar — Rules or Mind Map */}
          {rightPanel === "rules" && (
            <aside className="w-[300px] flex-shrink-0 border-l bg-background">
              <div className="flex h-full flex-col">
                <div className="flex items-center gap-2 border-b px-4 py-3">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Rules</span>
                </div>
                <ScrollArea className="flex-1">
                  <div className="w-[300px] overflow-hidden p-4">
                    <RulesPanel
                      rules={rules}
                      onAdd={handleAddRule}
                      onUpdate={handleUpdateRule}
                      onDelete={handleDeleteRule}
                    />
                  </div>
                </ScrollArea>
              </div>
            </aside>
          )}
          {rightPanel === "mindmap" && (
            <aside className="w-[420px] flex-shrink-0 border-l bg-background">
              <MindMapPanel
                messages={messages}
                currentAssistant={currentAssistant}
                isStreaming={isStreaming}
                onSendDirective={sendMessage}
              />
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}
