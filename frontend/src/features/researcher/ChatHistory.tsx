import { useEffect, useState, useCallback } from "react"
import { MessageSquare, Trash2, Loader2, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"
import {
  listResearcherChats,
  deleteResearcherChat,
  type ResearcherChat,
} from "@/lib/supabase"

interface ChatHistoryProps {
  activeChatId: string | null
  onSelectChat: (chatId: string) => void
  onNewChat: () => void
  refreshKey?: number
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(dateStr).toLocaleDateString()
}

export function ChatHistory({ activeChatId, onSelectChat, onNewChat, refreshKey }: ChatHistoryProps) {
  const [chats, setChats] = useState<ResearcherChat[]>([])
  const [loading, setLoading] = useState(true)

  const fetchChats = useCallback(async () => {
    try {
      const data = await listResearcherChats()
      setChats(data)
    } catch (err) {
      console.error("Failed to load chat history:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchChats()
  }, [fetchChats, refreshKey])

  const handleDelete = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation()
    try {
      await deleteResearcherChat(chatId)
      setChats((prev) => prev.filter((c) => c.id !== chatId))
    } catch (err) {
      console.error("Failed to delete chat:", err)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold text-foreground">Chats</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNewChat}>
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">New Chat</TooltipContent>
        </Tooltip>
      </div>

      {/* Chat list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {loading ? (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : chats.length === 0 ? (
            <div className="px-2 py-8 text-center">
              <MessageSquare className="mx-auto mb-2 h-5 w-5 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">No chats yet</p>
              <p className="mt-1 text-[11px] text-muted-foreground/70">
                Chats are auto-saved when you send a message.
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Recents
              </div>
              {chats.map((chat, i) => (
                <div key={chat.id}>
                  <button
                    onClick={() => onSelectChat(chat.id)}
                    className={cn(
                      "group flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors",
                      activeChatId === chat.id
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground/80 hover:bg-accent/50",
                    )}
                  >
                    <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-[13px] leading-snug">{chat.title}</div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">{timeAgo(chat.updated_at)}</div>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => handleDelete(e, chat.id)}
                          className="flex-shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right">Delete chat</TooltipContent>
                    </Tooltip>
                  </button>
                  {i < chats.length - 1 && activeChatId !== chat.id && activeChatId !== chats[i + 1]?.id && (
                    <Separator className="mx-2 my-0.5" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
