import { useState, useEffect } from 'react';
import { Database, RefreshCw, Clock, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getCachedDashboardResult, DASHBOARD_TYPE_LABELS } from '@/lib/schedulerApi';

interface SnapshotContent {
    dashboard_type: string;
    params: Record<string, unknown>;
    result: {
        num_rows: number;
        columns: string[];
        data: Record<string, unknown>[];
    };
    computed_at: string;
    job_id?: string | null;
    auto_refresh?: boolean;
}

interface DashboardSnapshotRendererProps {
    content: SnapshotContent;
    title: string;
    onContentUpdate?: (newContent: SnapshotContent) => void;
}

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    } catch {
        return iso;
    }
}

export function DashboardSnapshotRenderer({ content, title, onContentUpdate }: DashboardSnapshotRendererProps) {
    const [refreshing, setRefreshing] = useState(false);
    const [refreshError, setRefreshError] = useState<string | null>(null);

    // Auto-refresh on mount if enabled
    useEffect(() => {
        if (!content.auto_refresh) return;

        const refresh = async () => {
            try {
                setRefreshing(true);
                const cached = await getCachedDashboardResult(
                    content.dashboard_type,
                    content.params as Record<string, unknown>,
                );
                if (cached.cached && cached.result) {
                    const newComputedAt = cached.computed_at || content.computed_at;
                    // Only update if newer
                    if (newComputedAt > content.computed_at) {
                        onContentUpdate?.({
                            ...content,
                            result: cached.result as SnapshotContent['result'],
                            computed_at: newComputedAt,
                        });
                    }
                }
            } catch (e) {
                setRefreshError(e instanceof Error ? e.message : 'Refresh failed');
            } finally {
                setRefreshing(false);
            }
        };

        refresh();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const { result } = content;
    if (!result || !result.columns || !result.data) {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
                <AlertCircle className="h-4 w-4" />
                No data available for this snapshot.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Header with metadata */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{title}</span>
                    <Badge variant="outline" className="text-xs">
                        {DASHBOARD_TYPE_LABELS[content.dashboard_type] || content.dashboard_type}
                    </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {refreshing && <RefreshCw className="h-3 w-3 animate-spin" />}
                    {refreshError && <span className="text-amber-600">{refreshError}</span>}
                    <Clock className="h-3 w-3" />
                    <span>Computed: {formatDate(content.computed_at)}</span>
                    {content.auto_refresh && (
                        <Badge variant="secondary" className="text-[10px]">Auto-refresh</Badge>
                    )}
                </div>
            </div>

            {/* Parameter badges */}
            <div className="flex flex-wrap gap-1.5">
                {Object.entries(content.params).slice(0, 8).map(([k, v]) => (
                    <Badge key={k} variant="secondary" className="text-[10px] font-normal">
                        {k}: {String(v)}
                    </Badge>
                ))}
            </div>

            {/* Data table */}
            <div className="overflow-auto max-h-[400px] rounded-md border">
                <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                        <tr>
                            {result.columns.map(col => (
                                <th key={col} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {result.data.slice(0, 100).map((row, i) => (
                            <tr key={i} className="border-t hover:bg-muted/30">
                                {result.columns.map(col => (
                                    <td key={col} className="px-3 py-1.5 whitespace-nowrap">
                                        {row[col] != null ? String(row[col]) : '—'}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {result.data.length > 100 && (
                    <div className="text-center text-xs text-muted-foreground py-2 border-t">
                        Showing 100 of {result.num_rows} rows
                    </div>
                )}
            </div>
        </div>
    );
}
