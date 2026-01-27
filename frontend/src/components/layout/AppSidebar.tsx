import { Link, useLocation } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  FlaskConical,
  TrendingUp,
  BarChart3,
  GitCompare,
  Layers,
} from 'lucide-react';

const navItems = [
  {
    title: 'Experiments',
    path: '/experiments',
    icon: FlaskConical,
  },
  {
    title: 'Funnel Analysis',
    path: '/funnel',
    icon: TrendingUp,
  },
  {
    title: 'Cohort Aggregation',
    path: '/experiments',
    icon: BarChart3,
    section: 'cohort',
  },
  {
    title: 'Segmentation',
    path: '/experiments',
    icon: Layers,
    section: 'segmentation',
  },
  {
    title: 'Experiment Comparison',
    path: '/experiments',
    icon: GitCompare,
    section: 'comparison',
  },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="p-6 border-b">
        <h1 className="text-xl font-semibold">Ladoo Metrics</h1>
        <p className="text-sm text-muted-foreground mt-1">Analytics Dashboard</p>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <nav className="p-4 space-y-1">
          <div className="px-3 py-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Experiments
            </p>
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  location.pathname === item.path ||
                  (item.section && location.pathname.includes(item.section));

                return (
                  <Link
                    key={item.title}
                    to={item.path}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t">
        <Separator className="mb-4" />
        <div className="text-xs text-muted-foreground">
          <p className="font-medium">Ladoo Metrics</p>
          <p className="mt-1">v1.0.0</p>
        </div>
      </div>
    </div>
  );
}

