import { useState } from 'react';
import { Download, Loader2, AlertCircle, ChevronRight, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import {
    getExperimentPerformance,
    downloadExperimentPerformance,
    type ExperimentPerformanceResponse,
} from '@/lib/api';

const CITIES = ['delhi', 'bangalore', 'mumbai', 'hyderabad', 'chennai', 'kolkata', 'pune', 'ahmedabad', 'jaipur', 'lucknow'];

export function DiscoverExperimentSection() {
    const { user } = useAuth();
    const username = user?.email ?? 'anonymous';

    const [expExperimentId, setExpExperimentId] = useState('');
    const [expStartDate, setExpStartDate] = useState('20260101');
    const [expEndDate, setExpEndDate] = useState('20260115');
    const [expTimeLevel, setExpTimeLevel] = useState<'daily' | 'weekly' | 'monthly'>('daily');
    const [expTodLevel, setExpTodLevel] = useState<'daily' | 'afternoon' | 'evening' | 'morning' | 'night' | 'all'>('daily');
    const [expCity, setExpCity] = useState('delhi');
    const [expServiceValue, setExpServiceValue] = useState<'two_wheeler' | 'three_wheeler' | 'four_wheeler'>('two_wheeler');
    const [expLoading, setExpLoading] = useState(false);
    const [expError, setExpError] = useState<string | null>(null);
    const [expResult, setExpResult] = useState<ExperimentPerformanceResponse | null>(null);
    const [expDownloading, setExpDownloading] = useState(false);

    const handleFetchExperimentPerformance = async () => {
        if (!expExperimentId.trim()) {
            setExpError('Please enter an experiment ID');
            return;
        }
        setExpLoading(true);
        setExpError(null);
        setExpResult(null);
        try {
            const result = await getExperimentPerformance({
                username,
                experiment_id: expExperimentId.trim(),
                start_date: expStartDate,
                end_date: expEndDate,
                time_level: expTimeLevel,
                tod_level: expTodLevel,
                city: expCity,
                service_value: expServiceValue,
            });
            if (result.error) {
                setExpError(result.error);
            } else {
                setExpResult(result);
            }
        } catch (err) {
            setExpError(err instanceof Error ? err.message : 'Failed to fetch experiment data');
        } finally {
            setExpLoading(false);
        }
    };

    const handleDownloadExperimentPerformance = async () => {
        setExpDownloading(true);
        try {
            await downloadExperimentPerformance({
                username,
                experiment_id: expExperimentId.trim(),
                start_date: expStartDate,
                end_date: expEndDate,
                time_level: expTimeLevel,
                tod_level: expTodLevel,
                city: expCity,
                service_value: expServiceValue,
            });
        } catch (err) {
            setExpError(err instanceof Error ? err.message : 'Failed to download data');
        } finally {
            setExpDownloading(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Experiment Performance Query</CardTitle>
                    <CardDescription>Run a query and download results or view cohort breakdown.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Experiment ID</Label>
                        <Input
                            placeholder="e.g., edc35f8a-ed7a-4557-9a3e-14edc61e6d58"
                            value={expExperimentId}
                            onChange={(e) => setExpExperimentId(e.target.value)}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Start Date</Label>
                            <Input placeholder="YYYYMMDD" value={expStartDate} onChange={(e) => setExpStartDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>End Date</Label>
                            <Input placeholder="YYYYMMDD" value={expEndDate} onChange={(e) => setExpEndDate(e.target.value)} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>City</Label>
                            <Select value={expCity} onValueChange={setExpCity}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {CITIES.map((c) => (
                                        <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Service</Label>
                            <Select value={expServiceValue} onValueChange={(v) => setExpServiceValue(v as typeof expServiceValue)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="two_wheeler">Two Wheeler</SelectItem>
                                    <SelectItem value="three_wheeler">Three Wheeler</SelectItem>
                                    <SelectItem value="four_wheeler">Four Wheeler</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Time Level</Label>
                            <Select value={expTimeLevel} onValueChange={(v) => setExpTimeLevel(v as typeof expTimeLevel)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="daily">Daily</SelectItem>
                                    <SelectItem value="weekly">Weekly</SelectItem>
                                    <SelectItem value="monthly">Monthly</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>TOD Level</Label>
                            <Select value={expTodLevel} onValueChange={(v) => setExpTodLevel(v as typeof expTodLevel)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="daily">Daily</SelectItem>
                                    <SelectItem value="morning">Morning</SelectItem>
                                    <SelectItem value="afternoon">Afternoon</SelectItem>
                                    <SelectItem value="evening">Evening</SelectItem>
                                    <SelectItem value="night">Night</SelectItem>
                                    <SelectItem value="all">All</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <Button
                        onClick={handleFetchExperimentPerformance}
                        disabled={expLoading || !expExperimentId.trim()}
                        className="bg-emerald-600 hover:bg-emerald-700"
                    >
                        {expLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...</> : <><ChevronRight className="h-4 w-4 mr-2" />Run Query</>}
                    </Button>
                    {expError && (
                        <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><span>{expError}</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {expResult && !expResult.error && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle>Results</CardTitle>
                        <CardDescription>
                            {expResult.row_count.toLocaleString()} rows, {expResult.columns.length} columns
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{expResult.total_unique_captains?.toLocaleString() ?? 0} unique captains</span>
                        </div>
                        {expResult.cohort_breakdown && expResult.cohort_breakdown.length > 0 && (
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">Cohort Breakdown:</p>
                                <div className="grid grid-cols-2 gap-1">
                                    {expResult.cohort_breakdown.map((cb) => (
                                        <div key={cb.cohort} className="flex justify-between text-xs bg-muted/50 px-2 py-1 rounded">
                                            <span>{cb.cohort}</span>
                                            <span className="font-medium">{cb.unique_captains.toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <Button variant="outline" size="sm" onClick={handleDownloadExperimentPerformance} disabled={expDownloading}>
                            {expDownloading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Preparing...</> : <><Download className="h-4 w-4 mr-2" />Download CSV</>}
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
