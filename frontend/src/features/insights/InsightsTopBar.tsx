import { Bell, LogOut, Search, Settings, User } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"

type InsightsTopBarProps = {
  fileName: string | null
}

export function InsightsTopBar({ fileName }: InsightsTopBarProps) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate("/login")
  }

  // Extract display name from email (before @)
  const displayName = user?.email?.split("@")[0] ?? "User"

  return (
    <div className="flex items-center justify-between pb-6">
      <div className="flex min-w-0 items-center gap-1 text-sm">
        <span className="shrink-0 text-muted-foreground">Insights</span>
        <span className="shrink-0 text-muted-foreground">/</span>
        <span
          className="min-w-0 truncate font-semibold text-foreground"
          title={fileName ?? "No file"}
        >
          {fileName ?? "No file"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Search className="h-4 w-4" />
          <span className="sr-only">Search</span>
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Bell className="h-4 w-4" />
          <span className="sr-only">Notifications</span>
        </Button>
        <Button variant="outline" className="h-9 gap-2 rounded-xl">
          <Settings className="h-4 w-4" />
          Captains Ingress
        </Button>

        {/* User Menu */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-9 gap-2 rounded-xl">
              <User className="h-4 w-4" />
              <span className="max-w-[120px] truncate">{displayName}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0 rounded-xl" align="end">
            <div className="p-4">
              <div className="font-medium">{displayName}</div>
              <div className="text-sm text-muted-foreground truncate" title={user?.email ?? ""}>
                {user?.email}
              </div>
            </div>
            <Separator />
            <div className="p-2">
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 h-9 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
