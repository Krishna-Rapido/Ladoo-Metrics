import { useLocation } from 'react-router-dom';
import { DashboardSecondaryNav } from '@/features/dashboard/DashboardSecondaryNav';
import { DiscoverSidebarTabs } from '@/features/discover/DiscoverSidebarTabs';
import { InsightsSecondaryConfig } from '@/features/insights/InsightsSecondaryConfig';

interface SecondarySidebarProps {
    onAction?: () => void;
}

export function SecondarySidebar({ onAction }: SecondarySidebarProps) {
    const location = useLocation();

    // Determine which secondary sidebar to render based on route
    if (location.pathname.startsWith('/dashboard')) {
        return <DashboardSecondaryNav onNavigate={onAction} />;
    }

    if (location.pathname.startsWith('/discover')) {
        return <DiscoverSidebarTabs />;
    }

    if (location.pathname.startsWith('/insights')) {
        return <InsightsSecondaryConfig onRunAnalysis={onAction} />;
    }

    // Default fallback
    return (
        <div className="flex flex-col h-full w-full p-4">
            <h2 className="text-lg font-semibold mb-2">Navigation</h2>
            <p className="text-sm text-muted-foreground">
                Select a section from the sidebar to get started.
            </p>
        </div>
    );
}
