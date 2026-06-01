import { useState, useRef, useCallback } from "react"
import { createChatStream } from "@/lib/researcherApi"
import {
  createResearcherChat,
  saveChatMessage,
  loadChatMessages,
  type ResearcherChatMessage as DbChatMessage,
} from "@/lib/supabase"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolCall {
  name: string
  arguments: Record<string, unknown>
}

export interface ToolResult {
  name: string
  result: Record<string, unknown>
}

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool"; toolCall: ToolCall; toolResult?: ToolResult }

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  blocks: ContentBlock[]
}

export interface ResearcherRule {
  id: string
  type: "table" | "filter" | "analysis" | "custom"
  content: string
  scope: "global" | "chat"
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

let _nextId = 0
function uid() {
  return `msg-${++_nextId}`
}

export function useResearcherChat(username: string, rules?: ResearcherRule[]) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentAssistant, setCurrentAssistant] = useState<ChatMessage | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [chatId, setChatId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const seqRef = useRef(0)

  const newChat = useCallback(() => {
    setMessages([])
    setCurrentAssistant(null)
    setChatId(null)
    seqRef.current = 0
  }, [])

  const loadChat = useCallback(async (id: string) => {
    setChatId(id)
    setCurrentAssistant(null)
    try {
      const dbMessages = await loadChatMessages(id)
      const msgs: ChatMessage[] = dbMessages.map((m: DbChatMessage) => ({
        id: m.id,
        role: m.role,
        blocks: m.blocks as ContentBlock[],
      }))
      setMessages(msgs)
      seqRef.current = dbMessages.length
    } catch (err) {
      console.error("Failed to load chat messages:", err)
      setMessages([])
      seqRef.current = 0
    }
  }, [])

  const abort = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsStreaming(false)
    setCurrentAssistant((cur) => {
      if (cur && cur.blocks.length > 0) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === cur.id)) return prev
          return [...prev, cur]
        })
      }
      return null
    })
  }, [])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return

      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        blocks: [{ type: "text", text: text.trim() }],
      }

      const assistantMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        blocks: [],
      }

      setMessages((prev) => [...prev, userMsg])
      setCurrentAssistant(assistantMsg)
      setIsStreaming(true)

      // Build history for API
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.blocks
          .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
          .map((b) => b.text)
          .join("\n"),
      }))

      const controller = new AbortController()
      abortRef.current = controller

      // Track the chatId for persistence in the finally block
      let activeChatId = chatId

      try {
        const response = await createChatStream(history, username, controller.signal, rules)
        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          let eventType = ""
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim()
            } else if (line.startsWith("data: ")) {
              const dataStr = line.slice(6)
              try {
                const data = JSON.parse(dataStr)
                handleEvent(eventType, data, setCurrentAssistant)
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return
        }
        setCurrentAssistant((cur) => {
          if (!cur) return null
          const errorBlock: ContentBlock = { type: "text", text: "\n\n*Connection error. Please try again.*" }
          return { ...cur, blocks: [...cur.blocks, errorBlock] }
        })
      } finally {
        abortRef.current = null
        setIsStreaming(false)
        // Move current assistant into messages
        setCurrentAssistant((cur) => {
          if (cur) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === cur.id)) return prev
              return [...prev, cur]
            })

            // Persist to Supabase (fire-and-forget)
            ;(async () => {
              try {
                // Auto-create chat on first message
                if (!activeChatId) {
                  const title = text.trim().slice(0, 60) + (text.trim().length > 60 ? "..." : "")
                  const chat = await createResearcherChat(title)
                  activeChatId = chat.id
                  setChatId(chat.id)
                }
                // Save user message
                await saveChatMessage(activeChatId, "user", userMsg.blocks, seqRef.current++)
                // Save assistant message
                if (cur.blocks.length > 0) {
                  await saveChatMessage(activeChatId, "assistant", cur.blocks, seqRef.current++)
                }
              } catch (err) {
                console.error("Failed to persist chat:", err)
              }
            })()
          }
          return null
        })
      }
    },
    [messages, username, isStreaming, rules, chatId],
  )

  return {
    messages,
    currentAssistant,
    isStreaming,
    chatId,
    sendMessage,
    abort,
    newChat,
    loadChat,
  }
}

// ---------------------------------------------------------------------------
// Event handler
// ---------------------------------------------------------------------------

function handleEvent(
  eventType: string,
  data: Record<string, unknown>,
  setCurrentAssistant: React.Dispatch<React.SetStateAction<ChatMessage | null>>,
) {
  switch (eventType) {
    case "text_delta":
      setCurrentAssistant((cur) => {
        if (!cur) return null
        const text = (data.content as string) || ""
        const blocks = [...cur.blocks]
        const last = blocks[blocks.length - 1]
        if (last && last.type === "text") {
          blocks[blocks.length - 1] = { type: "text", text: last.text + text }
        } else {
          blocks.push({ type: "text", text })
        }
        return { ...cur, blocks }
      })
      break

    case "tool_call_start":
      setCurrentAssistant((cur) => {
        if (!cur) return null
        const toolBlock: ContentBlock = {
          type: "tool",
          toolCall: {
            name: data.name as string,
            arguments: data.arguments as Record<string, unknown>,
          },
        }
        return { ...cur, blocks: [...cur.blocks, toolBlock] }
      })
      break

    case "tool_result":
      setCurrentAssistant((cur) => {
        if (!cur) return null
        const blocks = [...cur.blocks]
        for (let i = blocks.length - 1; i >= 0; i--) {
          const b = blocks[i]
          if (b.type === "tool" && !b.toolResult) {
            blocks[i] = {
              ...b,
              toolResult: {
                name: data.name as string,
                result: data.result as Record<string, unknown>,
              },
            }
            break
          }
        }
        return { ...cur, blocks }
      })
      break

    case "done":
      break

    case "error":
      setCurrentAssistant((cur) => {
        if (!cur) return null
        const errorBlock: ContentBlock = { type: "text", text: `\n\n*Error: ${data.message}*` }
        return { ...cur, blocks: [...cur.blocks, errorBlock] }
      })
      break
  }
}
