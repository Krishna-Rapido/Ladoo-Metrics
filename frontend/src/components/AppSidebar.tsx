"use client"

import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import {
  FlaskConical,
  LayoutDashboard,
  TrendingUp,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const items = [
  {
    title: "Experiments",
    path: "/experiments",
    icon: FlaskConical,
  },
  {
    title: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Funnel Analysis",
    path: "/funnel",
    icon: TrendingUp,
  },
]

export function AppSidebar() {
  const location = useLocation()

  return (
    <Sidebar>
      <SidebarContent className="py-6">
        <SidebarGroup className="px-4">
          <SidebarGroupLabel className="px-3 py-3 mb-3 text-xs font-semibold uppercase tracking-wider">
            Application
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="flex flex-col gap-1">
              {items.map((item) => {
                const isActive = location.pathname === item.path

                return (
                  <SidebarMenuItem key={item.path} className="block">
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className="w-full justify-start px-4 py-3 h-auto min-h-[2.75rem] rounded-md"
                    >
                      <Link to={item.path} className="flex items-center gap-3 w-full">
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="text-left font-medium">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}

