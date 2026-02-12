import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Compass, Download, FileSpreadsheet, Loader2, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { getSessionId, getSessionData, downloadSessionData } from '@/lib/api';
import { AddMetricsTab } from '@/features/insights/AddMetricsTab';
import { DiscoverSecondaryFilters } from './DiscoverSecondaryFilters';
import { DiscoverExperimentSection } from './DiscoverExperimentSection';
import { DiscoverTransitionSection } from './DiscoverTransitionSection';
import { DiscoverVisualization } from './DiscoverVisualization';
import { CalculatedColumnsEditor } from './CalculatedColumnsEditor';
import { useDiscoverData } from './useDiscoverData';
import type { DiscoverSection as DiscoverSectionType } from './DiscoverSidebarTabs';

const SECTION_PARAM = 'section';

export function DiscoverPage() {
    const { user } = useAuth();
    const username = user?.email ?? 'anonymous';

    const [sessionId, setSessionId] = useState<string | null>(getSessionId());
    const [sessionMeta, setSessionMeta] = useState<{ row_count: number; columns: string[] } | null>(null);
    const [isLoadingMeta, setIsLoadingMeta] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    useEffect(() => {
        const handleSessionChange = () => setSessionId(getSessionId());
        window.addEventListener('session-id-changed', handleSessionChange);
        return () => window.removeEventListener('session-id-changed', handleSessionChange);
    }, []);

    useEffect(() => {
        if (!sessionId) {
            setSessionMeta(null);
            return;
        }
        let cancelled = false;
        setIsLoadingMeta(true);
        getSessionData(sessionId)
            .then((data) => {
                if (!cancelled) setSessionMeta({ row_count: data.row_count, columns: data.columns });
            })
            .catch(() => {
                if (!cancelled) setSessionMeta(null);
            })
            .finally(() => {
                if (!cancelled) setIsLoadingMeta(false);
            });
        return () => { cancelled = true; };
    }, [sessionId]);

    const handleDownload = async () => {
        if (!sessionId) return;
        setIsDownloading(true);
        try {
            await downloadSessionData(sessionId);
        } catch (err) {
            console.error('Download failed:', err);
        } finally {
            setIsDownloading(false);
        }
    };

    const handleMetricsAdded = () => {
        if (sessionId) {
            getSessionData(sessionId).then((data) => {
                setSessionMeta({ row_count: data.row_count, columns: data.columns });
            });
        }
    };

    function DiscoverVisualizationContent({ sessionId }: { sessionId: string | null }) {
        // For visualization, we need column metadata but NOT the full dataset
        // Aggregation happens on the backend via /data/visualize endpoint
        const { columns, numericColumns, categoricalColumns, isLoading, error } = useDiscoverData({
            sessionId,
            useFullDataset: false, // Only fetch metadata, not full data
        });

        if (!sessionId) {
            return (
                <Card className="rounded-2xl">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <Compass className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-lg font-medium mb-2">No dataset available</p>
                        <p className="text-sm text-muted-foreground">Create a dataset first to visualize</p>
                    </CardContent>
                </Card>
            );
        }

        if (isLoading) {
            return (
                <Card className="rounded-2xl">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Loading column metadata...</p>
                    </CardContent>
                </Card>
            );
        }

        if (error) {
            return (
                <Card className="rounded-2xl">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <p className="text-destructive mb-2 font-medium">Error loading metadata</p>
                        <p className="text-sm text-muted-foreground mb-4">{error}</p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                // Trigger a reload by updating the sessionId dependency
                                window.dispatchEvent(new CustomEvent('session-id-changed'));
                            }}
                            className="rounded-lg"
                        >
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            );
        }

        if (!columns || columns.length === 0) {
            return (
                <Card className="rounded-2xl">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-lg font-medium mb-2">No columns available</p>
                        <p className="text-sm text-muted-foreground">Dataset may be empty or not loaded</p>
                    </CardContent>
                </Card>
            );
        }

        return (
            <DiscoverVisualization
                sessionId={sessionId}
                columns={columns}
                numericColumns={numericColumns}
                categoricalColumns={categoricalColumns}
            />
        );
    }

    const [searchParams] = useSearchParams();
    const section = (searchParams.get(SECTION_PARAM) as DiscoverSectionType) || 'discover';

    // Experiment and Transition: show section content only
    if (section === 'experiment') {
        return (
            <div className="space-y-6">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight">Discover</h1>
                    <p className="text-muted-foreground">Experiment Performance Query — run a query and view or download results.</p>
                </div>
                <DiscoverExperimentSection />
            </div>
        );
    }

    if (section === 'transition') {
        return (
            <div className="space-y-6">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight">Discover</h1>
                    <p className="text-muted-foreground">Segment transitions (Sankey diagram). Change the period (Daily / Weekly / Monthly) in the results.</p>
                </div>
                <DiscoverTransitionSection />
            </div>
        );
    }

    // Discover: Build CSV with functions
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">Discover</h1>
                <p className="text-muted-foreground">
                    Build a CSV in session using saved functions. Start with a function in the sidebar, then add metrics and download at any stage.
                </p>
            </div>

            <DiscoverSecondaryFilters hideHeader />

            {!sessionId ? (
                <Card className="min-h-[280px]">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                            <Compass className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-medium mb-2">No dataset yet</h3>
                        <p className="text-muted-foreground max-w-md">
                            Select a saved function above and click &quot;Run function to start dataset&quot; to build your first dataset.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                                    <CardTitle className="text-base font-medium">Current dataset</CardTitle>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleDownload}
                                    disabled={isDownloading}
                                    className="shrink-0"
                                >
                                    {isDownloading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Preparing...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="h-4 w-4 mr-2" />
                                            Download CSV
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {isLoadingMeta ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading...
                                </div>
                            ) : sessionMeta ? (
                                <p className="text-sm text-muted-foreground">
                                    {sessionMeta.row_count.toLocaleString()} rows, {sessionMeta.columns.length} columns
                                    {sessionMeta.columns.length > 0 && (
                                        <span className="ml-1">
                                            ({sessionMeta.columns.slice(0, 5).join(', ')}
                                            {sessionMeta.columns.length > 5 ? '...' : ''})
                                        </span>
                                    )}
                                </p>
                            ) : (
                                <p className="text-sm text-muted-foreground">Session active</p>
                            )}
                        </CardContent>
                    </Card>

                    <Tabs defaultValue="metrics" className="space-y-6">
                        <TabsList className="grid w-full max-w-2xl grid-cols-3">
                            <TabsTrigger value="metrics">Add Metrics</TabsTrigger>
                            <TabsTrigger value="calculated">Calculated Columns</TabsTrigger>
                            <TabsTrigger value="visualize">Visualize</TabsTrigger>
                        </TabsList>

                        <TabsContent value="metrics" className="space-y-0">
                            <AddMetricsTab
                                sessionId={sessionId}
                                username={username}
                                onMetricsAdded={handleMetricsAdded}
                            />
                        </TabsContent>

                        <TabsContent value="calculated" className="space-y-0">
                            <CalculatedColumnsEditor
                                sessionId={sessionId}
                                onColumnAdded={handleMetricsAdded}
                            />
                        </TabsContent>

                        <TabsContent value="visualize" className="space-y-0">
                            <DiscoverVisualizationContent sessionId={sessionId} />
                        </TabsContent>
                    </Tabs>
                </>
            )}
        </div>
    );
}
