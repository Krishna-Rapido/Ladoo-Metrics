import { User, Bot } from "lucide-react"
import type { ChatMessage as ChatMessageType, ContentBlock } from "./useResearcherChat"
import { ToolResultBlock } from "./ToolResultBlock"

interface ChatMessageProps {
  message: ChatMessageType
  isStreaming?: boolean
}

export function ChatMessageBubble({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === "user"

  if (isUser) {
    const text = message.blocks
      .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("\n")

    return (
      <div className="flex justify-end">
        <div className="flex max-w-[85%] items-start gap-2">
          <div className="rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
            {text}
          </div>
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
            <User className="h-4 w-4 text-primary" />
          </div>
        </div>
      </div>
    )
  }

  // Assistant message — render blocks in order
  return (
    <div className="flex items-start gap-2">
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-secondary">
        <Bot className="h-4 w-4 text-secondary-foreground" />
      </div>
      <div className="min-w-0 max-w-[85%] flex-1">
        <div className="space-y-1">
          {message.blocks.map((block, i) => {
            if (block.type === "text") {
              return (
                <div key={i} className="prose prose-sm max-w-none text-foreground/90">
                  <FormattedContent text={block.text} />
                </div>
              )
            }
            if (block.type === "tool") {
              return (
                <ToolResultBlock
                  key={i}
                  toolCall={block.toolCall}
                  toolResult={block.toolResult}
                />
              )
            }
            return null
          })}
          {isStreaming && <BlinkingCursor />}
        </div>
      </div>
    </div>
  )
}

function FormattedContent({ text }: { text: string }) {
  if (!text) return null

  const paragraphs = text.split("\n\n")
  return (
    <>
      {paragraphs.map((p, i) => (
        <div key={i} className="mb-2 last:mb-0">
          {p.split("\n").map((line, j) => {
            if (line.match(/^[-*]\s/)) {
              return (
                <div key={j} className="ml-2 flex gap-1.5">
                  <span className="text-muted-foreground">-</span>
                  <span>
                    <InlineFormatted text={line.replace(/^[-*]\s/, "")} />
                  </span>
                </div>
              )
            }
            if (line.match(/^\d+\.\s/)) {
              const num = line.match(/^(\d+)\./)?.[1]
              return (
                <div key={j} className="ml-2 flex gap-1.5">
                  <span className="text-muted-foreground">{num}.</span>
                  <span>
                    <InlineFormatted text={line.replace(/^\d+\.\s/, "")} />
                  </span>
                </div>
              )
            }
            if (line.startsWith("### ")) {
              return <h4 key={j} className="mt-2 text-sm font-semibold text-foreground">{line.slice(4)}</h4>
            }
            if (line.startsWith("## ")) {
              return <h3 key={j} className="mt-2 text-sm font-bold text-foreground">{line.slice(3)}</h3>
            }
            return (
              <span key={j}>
                <InlineFormatted text={line} />
                {j < p.split("\n").length - 1 && <br />}
              </span>
            )
          })}
        </div>
      ))}
    </>
  )
}

function InlineFormatted({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={i} className="rounded bg-secondary px-1 py-0.5 text-xs font-mono text-primary">
              {part.slice(1, -1)}
            </code>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

function BlinkingCursor() {
  return (
    <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-primary/60" />
  )
}
