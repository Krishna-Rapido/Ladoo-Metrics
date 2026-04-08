import { useState, useCallback, useRef, type KeyboardEvent } from "react"
import { ReactFlowProvider } from "@xyflow/react"
import { Loader2, Database, Send } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ChatMessage } from "../useResearcherChat"
import type { QueryGraph } from "./types"
import { useQueryGraph } from "./useQueryGraph"
import { QueryMindMap } from "./QueryMindMap"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MindMapPanelProps {
  messages: ChatMessage[]
  currentAssistant: ChatMessage | null
  isStreaming: boolean
  onSendDirective: (text: string) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MindMapPanel({
  messages,
  currentAssistant,
  isStreaming,
  onSendDirective,
}: MindMapPanelProps) {
  const graph = useQueryGraph(messages, currentAssistant, isStreaming)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [directive, setDirective] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const tableCount = graph.nodes.filter((n) => n.type === "table").length
  const selectedNode = selectedNodeId
    ? graph.nodes.find((n) => n.id === selectedNodeId)
    : null

  const handleSend = useCallback(() => {
    const text = directive.trim()
    if (!text) return
    onSendDirective(text)
    setDirective("")
  }, [directive, onSendDirective])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Database className="h-4 w-4 text-violet-600" />
        <span className="text-sm font-medium text-foreground">Query Mind Map</span>
        {isStreaming && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />
        )}
        {tableCount > 0 && (
          <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-[10px]">
            {tableCount} table{tableCount !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* ReactFlow canvas or empty state */}
      <div className="relative min-h-0 flex-1">
        {graph.nodes.length === 0 ? (
          <EmptyState />
        ) : (
          <ReactFlowProvider>
            <QueryMindMap graph={graph} onNodeSelect={setSelectedNodeId} />
          </ReactFlowProvider>
        )}
      </div>

      {/* Node detail panel (on click) */}
      {selectedNode && (
        <div className="max-h-[120px] flex-shrink-0 border-t bg-muted/30">
          <ScrollArea className="h-full">
            <div className="p-3">
              <div className="mb-1 text-xs font-semibold text-foreground">
                {selectedNode.label}
              </div>
              {selectedNode.detail && (
                <pre className="whitespace-pre-wrap text-[10px] leading-relaxed text-muted-foreground">
                  {selectedNode.detail}
                </pre>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Directive input */}
      <div className="flex-shrink-0 border-t bg-background p-3">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={directive}
            onChange={(e) => setDirective(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Direct the AI: 'Use bi_mne_v2 instead'"
            rows={1}
            className="min-h-[32px] flex-1 resize-none rounded-md border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSend}
            disabled={!directive.trim()}
            className="h-8 w-8 flex-shrink-0 p-0"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <Database className="mb-3 h-8 w-8 text-muted-foreground/40" />
      <p className="text-xs text-muted-foreground">
        Queries will appear here as the AI runs them.
      </p>
    </div>
  )
}
