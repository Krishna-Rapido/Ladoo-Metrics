import { useEffect, useRef } from "react"
import { FlaskConical, Sparkles } from "lucide-react"
import type { ChatMessage as ChatMessageType } from "./useResearcherChat"
import { ChatMessageBubble } from "./ChatMessage"
import { ChatInput } from "./ChatInput"

interface ChatPanelProps {
  messages: ChatMessageType[]
  currentAssistant: ChatMessageType | null
  isStreaming: boolean
  onSend: (text: string) => void
  onStop: () => void
}

export function ChatPanel({
  messages,
  currentAssistant,
  isStreaming,
  onSend,
  onStop,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new content
  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages, currentAssistant?.blocks.length, currentAssistant?.blocks])

  const isEmpty = messages.length === 0 && !currentAssistant

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <WelcomeState onSuggestionClick={onSend} />
        ) : (
          <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
            {messages.map((msg) => (
              <ChatMessageBubble key={msg.id} message={msg} />
            ))}
            {currentAssistant && (
              <ChatMessageBubble
                message={currentAssistant}
                isStreaming={isStreaming}
              />
            )}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t bg-background/80 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <ChatInput
            onSend={onSend}
            onStop={onStop}
            isStreaming={isStreaming}
          />
        </div>
      </div>
    </div>
  )
}

function WelcomeState({ onSuggestionClick }: { onSuggestionClick: (text: string) => void }) {
  const suggestions = [
    "Why did weekly captains in Bangalore churn in March 2026?",
    "Compare high-idle vs low-idle captains in Delhi this quarter",
    "What behavioral patterns differentiate HP from MP captains in Mumbai?",
    "How many daily captains were active in Hyderabad last week?",
  ]

  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <Sparkles className="h-7 w-7 text-primary" />
      </div>
      <h2 className="mb-2 text-xl font-semibold text-foreground">
        What would you like to investigate?
      </h2>
      <p className="mb-8 max-w-md text-center text-sm text-muted-foreground">
        I can run SQL queries, contrast analyses, behavioral profiling, and segment validation.
        Describe your question and I'll figure out the right approach.
      </p>
      <div className="grid max-w-xl gap-2 sm:grid-cols-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestionClick(s)}
            className="rounded-lg border bg-background px-4 py-3 text-left text-sm text-foreground/80 shadow-sm transition-colors hover:border-primary/30 hover:bg-accent"
          >
            <FlaskConical className="mb-1 h-4 w-4 text-muted-foreground" />
            <span className="line-clamp-2">{s}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
