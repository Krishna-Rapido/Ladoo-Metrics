import { useState, Component, type ReactNode, useCallback } from 'react';
import { Download, Loader2, AlertCircle, ChevronRight, Users, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import {
    getSegmentTransitions,
    downloadSegmentTransitions,
    getSegmentTransitionCaptains,
    type SegmentTransitionResponse,
    type SankeyNodeMeta,
    type SankeyLinkMeta,
} from '@/lib/api';
import { PlotlySankey, type NodeClickInfo, type LinkClickInfo } from './PlotlySankey';

const CITIES = ['delhi', 'bangalore', 'mumbai', 'hyderabad', 'chennai', 'kolkata', 'pune', 'ahmedabad', 'jaipur', 'lucknow'];
const SERVICE_CATEGORIES = ['bike_taxi', 'auto', 'cab', 'c2c', 'delivery'];
const FILTER_NONE = 'none';

const PERIOD_OPTIONS = [
    { value: 'D' as const, label: 'Daily' },
    { value: 'W' as const, label: 'Weekly' },
    { value: 'M' as const, label: 'Monthly' },
];

class SankeyErrorBoundary extends Component<
    { children: ReactNode },
    { hasError: boolean }
> {
    state = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: Error) {
        console.error('Sankey diagram error:', error);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex items-center justify-center h-64 rounded-md border border-destructive/50 bg-destructive/5 text-destructive text-sm">
                    Diagram failed to render. Try narrowing the date range.
                </div>
            );
        }
        return this.props.children;
    }
}

export function DiscoverTransitionSection() {
    const { user } = useAuth();
    const username = user?.email ?? 'anonymous';

    const [transStartDate, setTransStartDate] = useState('20260105');
    const [transEndDate, setTransEndDate] = useState('20260115');
    const [transCity, setTransCity] = useState('delhi');
    const [transServiceCategory, setTransServiceCategory] = useState('bike_taxi');
    const [transServiceValue, setTransServiceValue] = useState('two_wheeler');
    const [transFilterType, setTransFilterType] = useState<'dau' | 'mau' | 'dtu' | 'mtu' | typeof FILTER_NONE>(FILTER_NONE);
    const [transPeriod, setTransPeriod] = useState<'D' | 'W' | 'M'>('D');
    const [transLoading, setTransLoading] = useState(false);
    const [transError, setTransError] = useState<string | null>(null);
    const [transResult, setTransResult] = useState<SegmentTransitionResponse | null>(null);
    const [transDownloading, setTransDownloading] = useState(false);
    const [captainsModalOpen, setCaptainsModalOpen] = useState(false);
    const [captainsClickInfo, setCaptainsClickInfo] = useState<{ type: 'node' | 'link'; node?: SankeyNodeMeta; link?: SankeyLinkMeta } | null>(null);
    const [captainsList, setCaptainsList] = useState<string[]>([]);
    const [captainsLoading, setCaptainsLoading] = useState(false);
    const [captainsError, setCaptainsError] = useState<string | null>(null);
    const [copiedAll, setCopiedAll] = useState(false);
    const copyAllCaptains = useCallback(() => {
        if (captainsList.length === 0) return;
        const text = ['captain_id', ...captainsList].join('\n');
        navigator.clipboard.writeText(text).then(() => {
            setCopiedAll(true);
            setTimeout(() => setCopiedAll(false), 2000);
        });
    }, [captainsList]);

    const handleNodeClick = (info: NodeClickInfo) => {
        setCaptainsClickInfo({ type: 'node', node: info });
        setCaptainsModalOpen(true);
        setCaptainsList([]);
        setCaptainsError(null);
        setCaptainsLoading(true);
        // For node, get all captains in that period+segment (transitions TO this node)
        getSegmentTransitionCaptains({
            username,
            start_date: transStartDate,
            end_date: transEndDate,
            city: transCity,
            service_category: transServiceCategory,
            service_value: transServiceValue,
            filter_type: transFilterType === FILTER_NONE ? null : transFilterType,
            period: transPeriod,
            from_period: '',
            to_period: info.period,
            from_segment: '',
            to_segment: info.segment,
        })
            .then((res) => {
                setCaptainsList(res.captain_ids);
            })
            .catch((err) => {
                setCaptainsError(err instanceof Error ? err.message : 'Failed to load captains');
            })
            .finally(() => {
                setCaptainsLoading(false);
            });
    };

    const handleLinkClick = (info: LinkClickInfo) => {
        setCaptainsClickInfo({ type: 'link', link: info });
        setCaptainsModalOpen(true);
        setCaptainsList([]);
        setCaptainsError(null);
        setCaptainsLoading(true);
        getSegmentTransitionCaptains({
            username,
            start_date: transStartDate,
            end_date: transEndDate,
            city: transCity,
            service_category: transServiceCategory,
            service_value: transServiceValue,
            filter_type: transFilterType === FILTER_NONE ? null : transFilterType,
            period: transPeriod,
            from_period: info.from_period,
            to_period: info.to_period,
            from_segment: info.from_segment,
            to_segment: info.to_segment,
        })
            .then((res) => {
                setCaptainsList(res.captain_ids);
            })
            .catch((err) => {
                setCaptainsError(err instanceof Error ? err.message : 'Failed to load captains');
            })
            .finally(() => {
                setCaptainsLoading(false);
            });
    };

    const handleDownloadCaptainsCsv = () => {
        if (!captainsClickInfo || captainsList.length === 0) return;
        const header = 'captain_id\n';
        const csv = header + captainsList.join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        if (captainsClickInfo.type === 'link' && captainsClickInfo.link) {
            a.download = `captains_${captainsClickInfo.link.from_segment}_${captainsClickInfo.link.from_period}_to_${captainsClickInfo.link.to_segment}_${captainsClickInfo.link.to_period}.csv`;
        } else if (captainsClickInfo.type === 'node' && captainsClickInfo.node) {
            a.download = `captains_${captainsClickInfo.node.segment}_${captainsClickInfo.node.period}.csv`;
        }
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const handleFetchSegmentTransitions = async () => {
        setTransLoading(true);
        setTransError(null);
        setTransResult(null);
        try {
            const result = await getSegmentTransitions({
                username,
                start_date: transStartDate,
                end_date: transEndDate,
                city: transCity,
                service_category: transServiceCategory,
                service_value: transServiceValue,
                filter_type: transFilterType === FILTER_NONE ? null : transFilterType,
                period: transPeriod,
            });
            if (result.error) {
                setTransError(result.error);
            } else {
                setTransResult(result);
            }
        } catch (err) {
            setTransError(err instanceof Error ? err.message : 'Failed to fetch segment transitions');
        } finally {
            setTransLoading(false);
        }
    };

    const handleDownloadSegmentTransitions = async () => {
        setTransDownloading(true);
        try {
            await downloadSegmentTransitions({
                username,
                start_date: transStartDate,
                end_date: transEndDate,
                city: transCity,
                service_category: transServiceCategory,
                service_value: transServiceValue,
                filter_type: transFilterType === FILTER_NONE ? null : transFilterType,
                period: transPeriod,
            });
        } catch (err) {
            setTransError(err instanceof Error ? err.message : 'Failed to download data');
        } finally {
            setTransDownloading(false);
        }
    };

    const refetchWithPeriod = (period: 'D' | 'W' | 'M') => {
        setTransPeriod(period);
        if (transResult && !transResult.error) {
            getSegmentTransitions({
                username,
                start_date: transStartDate,
                end_date: transEndDate,
                city: transCity,
                service_category: transServiceCategory,
                service_value: transServiceValue,
                filter_type: transFilterType === FILTER_NONE ? null : transFilterType,
                period,
            })
                .then((result) => {
                    if (!result.error) setTransResult(result);
                })
                .catch((err) => {
                    console.error('DiscoverTransitionSection refetch failed:', err);
                });
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Segment Transitions (Sankey Diagram)</CardTitle>
                    <CardDescription>Query captain consistency segment flows and change aggregation period for the diagram.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Start Date</Label>
                            <Input placeholder="YYYYMMDD" value={transStartDate} onChange={(e) => setTransStartDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>End Date</Label>
                            <Input placeholder="YYYYMMDD" value={transEndDate} onChange={(e) => setTransEndDate(e.target.value)} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>City</Label>
                        <Select value={transCity} onValueChange={setTransCity}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {CITIES.map((c) => (
                                    <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Service Category</Label>
                            <Select value={transServiceCategory} onValueChange={setTransServiceCategory}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {SERVICE_CATEGORIES.map((sc) => (
                                        <SelectItem key={sc} value={sc}>{sc.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Service Value</Label>
                            <Select value={transServiceValue} onValueChange={setTransServiceValue}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="two_wheeler">Two Wheeler</SelectItem>
                                    <SelectItem value="three_wheeler">Three Wheeler</SelectItem>
                                    <SelectItem value="four_wheeler">Four Wheeler</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Filter (Optional)</Label>
                        <Select value={transFilterType} onValueChange={(v) => setTransFilterType(v as typeof transFilterType)}>
                            <SelectTrigger><SelectValue placeholder="No filter" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={FILTER_NONE}>No filter</SelectItem>
                                <SelectItem value="dau">DAU</SelectItem>
                                <SelectItem value="mau">MAU</SelectItem>
                                <SelectItem value="dtu">DTU</SelectItem>
                                <SelectItem value="mtu">MTU</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={handleFetchSegmentTransitions} disabled={transLoading} className="bg-emerald-600 hover:bg-emerald-700">
                        {transLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...</> : <><ChevronRight className="h-4 w-4 mr-2" />Run Query</>}
                    </Button>
                    {transError && (
                        <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><span>{transError}</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {transResult && !transResult.error && (
                <>
                    <Card>
                        <CardHeader className="pb-2">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <CardTitle>Results</CardTitle>
                                    <CardDescription>{transResult.row_count.toLocaleString()} rows</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Label className="text-sm text-muted-foreground whitespace-nowrap">Period:</Label>
                                    <Select value={transPeriod} onValueChange={(v) => refetchWithPeriod(v as 'D' | 'W' | 'M')}>
                                        <SelectTrigger className="w-[120px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PERIOD_OPTIONS.map((o) => (
                                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Button variant="outline" size="sm" onClick={handleDownloadSegmentTransitions} disabled={transDownloading}>
                                {transDownloading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Preparing...</> : <><Download className="h-4 w-4 mr-2" />Download CSV</>}
                            </Button>
                        </CardContent>
                    </Card>

                    {transResult.sankey_data && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle>Segment Flow</CardTitle>
                                <CardDescription>
                                    Aggregation: {PERIOD_OPTIONS.find((o) => o.value === transPeriod)?.label ?? transPeriod}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {transResult.sankey_data.node_labels?.length ? (
                                    <SankeyErrorBoundary>
                                        <PlotlySankey
                                            data={transResult.sankey_data}
                                            onNodeClick={handleNodeClick}
                                            onLinkClick={handleLinkClick}
                                        />
                                    </SankeyErrorBoundary>
                                ) : (
                                    <div className="flex items-center justify-center h-64 text-muted-foreground">No diagram data</div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </>
            )}

            <Dialog open={captainsModalOpen} onOpenChange={setCaptainsModalOpen}>
                <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] flex flex-col gap-5">
                    <DialogHeader className="space-y-2">
                        <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
                            <Users className="h-5 w-5 text-primary" />
                            {captainsClickInfo?.type === 'node' ? 'Captains in Segment' : 'Captains on Transition'}
                        </DialogTitle>
                        <DialogDescription asChild>
                            <div className="space-y-1.5 text-base">
                                {captainsClickInfo?.type === 'link' && captainsClickInfo.link && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-medium text-foreground">From:</span>
                                        <span className="inline-flex items-center px-3 py-1.5 rounded-md bg-primary/15 text-primary font-medium capitalize border border-primary/20">
                                            {captainsClickInfo.link.from_segment}
                                        </span>
                                        <span className="text-muted-foreground text-sm font-mono">({captainsClickInfo.link.from_period})</span>
                                        <span className="text-muted-foreground mx-1">→</span>
                                        <span className="font-medium text-foreground">To:</span>
                                        <span className="inline-flex items-center px-3 py-1.5 rounded-md bg-primary/15 text-primary font-medium capitalize border border-primary/20">
                                            {captainsClickInfo.link.to_segment}
                                        </span>
                                        <span className="text-muted-foreground text-sm font-mono">({captainsClickInfo.link.to_period})</span>
                                        {captainsClickInfo.link.value != null && (
                                            <span className="text-muted-foreground text-sm">· {captainsClickInfo.link.value.toLocaleString()} captains</span>
                                        )}
                                    </div>
                                )}
                                {captainsClickInfo?.type === 'node' && captainsClickInfo.node && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="inline-flex items-center px-3 py-1.5 rounded-md bg-primary/15 text-primary font-medium capitalize border border-primary/20">
                                            {captainsClickInfo.node.segment}
                                        </span>
                                        <span className="text-muted-foreground text-sm font-mono">({captainsClickInfo.node.period})</span>
                                        {captainsClickInfo.node.total != null && (
                                            <span className="text-muted-foreground text-sm">· {captainsClickInfo.node.total.toLocaleString()} total</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </DialogDescription>
                    </DialogHeader>

                    {captainsLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-4">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                            <p className="text-sm font-medium text-muted-foreground">Loading captain IDs…</p>
                            <p className="text-xs text-muted-foreground">Using cached data when available</p>
                        </div>
                    ) : captainsError ? (
                        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                            <AlertCircle className="h-5 w-5 shrink-0" />
                            <p className="text-sm font-medium">{captainsError}</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 flex-1 min-h-0">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-base">
                                    <span className="text-2xl font-bold text-foreground tabular-nums">{captainsList.length.toLocaleString()}</span>
                                    <span className="text-muted-foreground ml-2">captain{captainsList.length !== 1 ? 's' : ''} found</span>
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={copyAllCaptains} disabled={captainsList.length === 0} className="gap-2">
                                        {copiedAll ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                        {copiedAll ? 'Copied' : 'Copy all'}
                                    </Button>
                                    <Button size="sm" onClick={handleDownloadCaptainsCsv} disabled={captainsList.length === 0} className="gap-2">
                                        <Download className="h-4 w-4" />
                                        Download CSV
                                    </Button>
                                </div>
                            </div>
                            <ScrollArea className="flex-1 min-h-0 h-[380px] border rounded-lg bg-muted/20">
                                <div className="p-4">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                        {captainsList.slice(0, 500).map((id) => (
                                            <div
                                                key={id}
                                                className="font-mono text-sm px-3 py-2 bg-background rounded-md border border-border/80 truncate hover:bg-muted/50"
                                                title={id}
                                            >
                                                {id}
                                            </div>
                                        ))}
                                    </div>
                                    {captainsList.length > 500 && (
                                        <p className="text-center text-sm text-muted-foreground mt-4 py-3 border-t font-medium">
                                            Showing first 500. Download CSV for all {(captainsList.length).toLocaleString()} captains.
                                        </p>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
