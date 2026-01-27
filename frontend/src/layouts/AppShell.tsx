import { useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { SlidersHorizontal } from "lucide-react"

import { useIsMobile } from "@/hooks/use-mobile"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { PrimarySidebar } from "@/components/nav/PrimarySidebar"
import { SecondarySidebar } from "@/components/nav/SecondarySidebar"
import { TopHeader } from "@/components/shell/TopHeader"

export function AppShell() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [primaryOpen, setPrimaryOpen] = useState(false);
  const [secondaryOpen, setSecondaryOpen] = useState(false);

  // Determine page title based on route
  const getPageTitle = () => {
    if (location.pathname.startsWith('/dashboard')) return 'Dashboard';
    if (location.pathname.startsWith('/discover')) return 'Discover';
    if (location.pathname.startsWith('/insights')) return 'Insights';
    return 'Ladoo Metrics';
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-muted/20">
      {/* Desktop Primary Sidebar */}
      {!isMobile && (
        <div className="hidden md:block">
          <PrimarySidebar />
        </div>
      )}

      {/* Mobile Primary Sidebar Sheet */}
      {isMobile && (
        <Sheet open={primaryOpen} onOpenChange={setPrimaryOpen}>
          <SheetContent side="left" className="w-[72px] p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
              <SheetDescription>Main navigation menu</SheetDescription>
            </SheetHeader>
            <PrimarySidebar />
          </SheetContent>
        </Sheet>
      )}

      {/* Desktop Secondary Sidebar */}
      {!isMobile && (
        <aside className="hidden md:flex w-[320px] flex-shrink-0 border-r bg-background">
          <SecondarySidebar />
        </aside>
      )}

      {/* Mobile Secondary Sidebar Sheet */}
      {isMobile && (
        <Sheet open={secondaryOpen} onOpenChange={setSecondaryOpen}>
          <SheetContent side="left" className="w-[320px] p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Configuration</SheetTitle>
              <SheetDescription>Page configuration and filters</SheetDescription>
            </SheetHeader>
            <SecondarySidebar onAction={() => setSecondaryOpen(false)} />
          </SheetContent>
        </Sheet>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <TopHeader
          title={getPageTitle()}
          onMenuClick={isMobile ? () => setPrimaryOpen(true) : undefined}
          leftActions={
            isMobile ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSecondaryOpen(true)}
                className="md:hidden"
              >
                <SlidersHorizontal className="h-5 w-5" />
                <span className="sr-only">Open configuration</span>
              </Button>
            ) : undefined
          }
        />

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
