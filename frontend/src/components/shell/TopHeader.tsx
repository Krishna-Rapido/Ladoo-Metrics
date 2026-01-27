import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, Search, Bell, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TopHeaderProps {
    title?: string;
    onMenuClick?: () => void;
    leftActions?: ReactNode;
    rightActions?: ReactNode;
}

export function TopHeader({ title, onMenuClick, leftActions, rightActions }: TopHeaderProps) {
    const location = useLocation();

    // Generate breadcrumb based on route
    const getBreadcrumb = () => {
        const pathParts = location.pathname.split('/').filter(Boolean);
        if (pathParts.length === 0) return 'Ladoo Metrics';

        const section = pathParts[0];
        const sectionLabel = section.charAt(0).toUpperCase() + section.slice(1);

        // For insights, we might have a file name in state
        if (section === 'insights') {
            return sectionLabel;
        }

        if (pathParts.length > 1) {
            const subsection = pathParts.slice(1).join(' / ').replace(/-/g, ' ');
            const formattedSubsection = subsection
                .split(' ')
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            return `${sectionLabel} / ${formattedSubsection}`;
        }

        return sectionLabel;
    };

    return (
        <header className="h-14 min-h-[56px] border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-4 md:px-6">
            {/* Left Side */}
            <div className="flex items-center gap-3">
                {/* Mobile Menu Button */}
                {onMenuClick && (
                    <Button variant="ghost" size="icon" onClick={onMenuClick} className="md:hidden">
                        <Menu className="h-5 w-5" />
                        <span className="sr-only">Open menu</span>
                    </Button>
                )}

                {leftActions}

                {/* Breadcrumb */}
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{getBreadcrumb()}</span>
                </div>
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-2">
                {rightActions}

                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                    <Search className="h-4 w-4" />
                    <span className="sr-only">Search</span>
                </Button>

                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                    <Bell className="h-4 w-4" />
                    <span className="sr-only">Notifications</span>
                </Button>

                <Button variant="default" size="sm" className="hidden sm:flex gap-2 bg-emerald-600 hover:bg-emerald-700">
                    <Settings className="h-4 w-4" />
                    <span>Captains Ingress</span>
                </Button>
            </div>
        </header>
    );
}
