import { Database, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CacheIndicatorProps {
    cached: boolean;
    stale: boolean;
    computedAt?: string | null;
}

function formatTime(iso: string): string {
    try {
        return new Date(iso).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            day: 'numeric',
            month: 'short',
        });
    } catch {
        return iso;
    }
}

export function CacheIndicator({ cached, stale, computedAt }: CacheIndicatorProps) {
    if (!cached) return null;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Badge
                        variant="outline"
                        className={`gap-1 text-[10px] ${
                            stale
                                ? 'text-amber-700 border-amber-300 bg-amber-500/5'
                                : 'text-emerald-700 border-emerald-300 bg-emerald-500/5'
                        }`}
                    >
                        {stale ? <AlertCircle className="h-3 w-3" /> : <Database className="h-3 w-3" />}
                        {stale ? 'Stale cache' : 'Cached'}
                    </Badge>
                </TooltipTrigger>
                <TooltipContent>
                    <p className="text-xs">
                        {stale ? 'Data is stale — will refresh on next schedule run' : 'Serving from precomputed cache'}
                        {computedAt && <><br />Computed: {formatTime(computedAt)}</>}
                    </p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
