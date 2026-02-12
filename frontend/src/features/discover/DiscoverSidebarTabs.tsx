import { useSearchParams } from 'react-router-dom';
import {
    FlaskConical,
    GitBranch,
    Compass,
    ChevronDown,
    BarChart3,
    TrendingUp,
    FileSpreadsheet,
} from 'lucide-react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export type DiscoverSection = 'experiment' | 'transition' | 'discover';

const SECTION_PARAM = 'section';

export function DiscoverSidebarTabs() {
    const [searchParams, setSearchParams] = useSearchParams();
    const section = (searchParams.get(SECTION_PARAM) as DiscoverSection) || 'discover';

    const experimentOpen = section === 'experiment';
    const transitionOpen = section === 'transition';
    const discoverOpen = section === 'discover';

    const setSection = (s: DiscoverSection) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set(SECTION_PARAM, s);
            return next;
        });
    };

    return (
        <div className="flex flex-col h-full w-full min-h-0">
            <div className="p-4 border-b shrink-0">
                <h2 className="text-lg font-semibold">Discover</h2>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
                    Filters
                </p>
            </div>

            {/* Scrollable list modal: collapsible categories */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                <Collapsible open={experimentOpen} onOpenChange={(o) => o && setSection('experiment')}>
                    <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/50 transition-colors">
                        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', experimentOpen && 'rotate-180')} />
                        <FlaskConical className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 font-medium text-sm">Experiment</span>
                        <span className="text-xs text-muted-foreground">1</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <button
                            type="button"
                            onClick={() => setSection('experiment')}
                            className={cn(
                                'flex w-full items-center gap-2 py-2 pl-10 pr-4 text-sm hover:bg-muted/50 transition-colors',
                                section === 'experiment' && 'bg-primary/10 text-primary font-medium'
                            )}
                        >
                            <BarChart3 className="h-4 w-4 shrink-0 text-muted-foreground" />
                            Experiment Performance Query
                        </button>
                    </CollapsibleContent>
                </Collapsible>
                <Collapsible open={transitionOpen} onOpenChange={(o) => o && setSection('transition')}>
                    <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/50 transition-colors">
                        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', transitionOpen && 'rotate-180')} />
                        <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 font-medium text-sm">Transition</span>
                        <span className="text-xs text-muted-foreground">1</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <button
                            type="button"
                            onClick={() => setSection('transition')}
                            className={cn(
                                'flex w-full items-center gap-2 py-2 pl-10 pr-4 text-sm hover:bg-muted/50 transition-colors',
                                section === 'transition' && 'bg-primary/10 text-primary font-medium'
                            )}
                        >
                            <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                            Sankey Diagram
                        </button>
                    </CollapsibleContent>
                </Collapsible>
                <Collapsible open={discoverOpen} onOpenChange={(o) => o && setSection('discover')}>
                    <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/50 transition-colors">
                        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', discoverOpen && 'rotate-180')} />
                        <Compass className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 font-medium text-sm">Discover</span>
                        <span className="text-xs text-muted-foreground">1</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <button
                            type="button"
                            onClick={() => setSection('discover')}
                            className={cn(
                                'flex w-full items-center gap-2 py-2 pl-10 pr-4 text-sm hover:bg-muted/50 transition-colors',
                                section === 'discover' && 'bg-primary/10 text-primary font-medium'
                            )}
                        >
                            <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
                            Build CSV with functions
                        </button>
                    </CollapsibleContent>
                </Collapsible>
            </div>
        </div>
    );
}
