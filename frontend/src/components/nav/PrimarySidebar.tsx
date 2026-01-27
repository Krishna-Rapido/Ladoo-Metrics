import { NavLink } from "react-router-dom"
import { BarChart3, Code, Compass, FileText, LayoutDashboard, Settings, User } from "lucide-react"

import { cn } from "@/lib/utils"

type PrimarySidebarProps = {
  activeOverride?: "dashboard" | "discover" | "insights" | "reports" | "functions"
}

const navItems = [
  { key: "dashboard" as const, to: "/dashboard", label: "DASHBOARD", Icon: LayoutDashboard },
  { key: "discover" as const, to: "/discover", label: "DISCOVER", Icon: Compass },
  { key: "insights" as const, to: "/insights", label: "INSIGHTS", Icon: BarChart3 },
  { key: "reports" as const, to: "/reports", label: "REPORTS", Icon: FileText },
  { key: "functions" as const, to: "/functions", label: "FUNCTIONS", Icon: Code },
]

export function PrimarySidebar({ activeOverride }: PrimarySidebarProps) {
  return (
    <aside className="sticky top-0 flex h-screen w-[72px] flex-col items-center border-r border-slate-200 bg-slate-100 text-slate-700">
      <div className="flex h-16 w-full items-center justify-center border-b border-slate-200">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200 shadow-sm">
          <BarChart3 className="h-5 w-5 text-emerald-700" />
        </div>
      </div>

      <nav className="flex flex-1 flex-col items-center gap-2 py-4">
        {navItems.map(({ key, to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => {
              const active = activeOverride ? activeOverride === key : isActive
              return cn(
                "flex w-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 transition-colors",
                "hover:bg-slate-200/70",
                active
                  ? "bg-white text-slate-900 ring-1 ring-slate-200 shadow-sm"
                  : "text-slate-600"
              )
            }}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-semibold tracking-wider">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="flex w-full flex-col items-center gap-2 border-t border-slate-200 py-4">
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-2xl text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
          aria-label="Settings"
        >
          <Settings className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-2xl text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
          aria-label="User"
        >
          <User className="h-5 w-5" />
        </button>
      </div>
    </aside>
  )
}

