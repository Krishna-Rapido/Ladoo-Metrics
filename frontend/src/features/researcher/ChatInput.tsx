import { useState, useRef, useCallback } from "react"
import { Send, Square } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ChatInputProps {
  onSend: (text: string) => void
  onStop: () => void
  isStreaming: boolean
  disabled?: boolean
}

export function ChatInput({ onSend, onStop, isStreaming, disabled }: ChatInputProps) {
  const [value, setValue] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = useCallback(() => {
    if (isStreaming) {
      onStop()
      return
    }
    const text = value.trim()
    if (!text) return
    onSend(text)
    setValue("")
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }, [value, isStreaming, onSend, onStop])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleInput = () => {
    const el = textareaRef.current
    if (el) {
      el.style.height = "auto"
      el.style.height = Math.min(el.scrollHeight, 160) + "px"
    }
  }

  return (
    <div className="flex items-end gap-2 rounded-lg border bg-background p-2 shadow-sm transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/30">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder="Ask about captain segments, churn patterns, behavioral differences..."
        disabled={disabled}
        rows={1}
        className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
      <Button
        size="icon"
        onClick={handleSubmit}
        disabled={disabled || (!isStreaming && !value.trim())}
        className="h-8 w-8 flex-shrink-0"
      >
        {isStreaming ? (
          <Square className="h-3.5 w-3.5" fill="currentColor" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  )
}
