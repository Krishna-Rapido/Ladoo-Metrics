import { useState } from "react"
import { Brain, MessageSquare, Network } from "lucide-react"
import { PrimarySidebar } from "@/components/nav/PrimarySidebar"
import { cn } from "@/lib/utils"
import { ChatMode } from "./ChatMode"
import { SchemaMode } from "./SchemaMode"
import { useKnowledgeData } from "./useKnowledgeData"

type Mode = "chat" | "schema"

export function KnowledgeShell() {
  const [mode, setMode] = useState<Mode>("chat")
  const knowledgeData = useKnowledgeData()

  return (
    <div className="flex h-screen bg-background">
      <PrimarySidebar activeOverride="knowledge" />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header bar with mode tabs */}
        <header className="flex h-14 items-center justify-between border-b border-border px-6 bg-white">
          <div className="flex items-center gap-3">
            <Brain className="h-5 w-5 text-violet-600" />
            <h1 className="text-lg font-semibold text-foreground">Knowledge</h1>
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setMode("chat")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                mode === "chat"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MessageSquare className="h-4 w-4" />
              Chat
            </button>
            <button
              type="button"
              onClick={() => setMode("schema")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                mode === "schema"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Network className="h-4 w-4" />
              Schema
            </button>
          </div>

          <div className="w-[100px]" /> {/* Spacer for centering */}
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-hidden">
          {mode === "chat" ? (
            <ChatMode tables={knowledgeData.tables} />
          ) : (
            <SchemaMode {...knowledgeData} />
          )}
        </main>
      </div>
    </div>
  )
}
