import { useState, useEffect, useCallback } from 'react';
import { Upload, Calendar, Users, BarChart3, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { getMeta, uploadCsv } from '@/lib/api';
import type { MetaResponse, UploadResponse, UploadProgress } from '@/lib/api';

interface InsightsSecondaryConfigProps {
    onRunAnalysis?: () => void;
    onUpload?: (data: UploadResponse) => void;
    onFiltersChange?: (filters: InsightsFilters) => void;
}

export interface InsightsFilters {
    prePeriod: { start: string; end: string };
    postPeriod: { start: string; end: string };
    testCohort: string;
    controlCohort: string;
    testConfirmed: string;
    controlConfirmed: string;
    selectedMetrics: string[];
}

// Confirmation filter options (matching existing Filters.tsx)
const confirmationOptions = [
    { value: 'none', label: 'No Confirmation Filter' },
    { value: 'visitedCaps', label: 'Visited Caps' },
    { value: 'exploredCaptains', label: 'Explored Captains' },
    { value: 'confirmedCaptains', label: 'Confirmed Captains' },
    { value: 'confirmedCaptains_Subs', label: 'Confirmed Captains - Subs' },
    { value: 'confirmedCaptains_Subs_purchased', label: 'Confirmed Captains - Subs Purchased' },
    { value: 'clickedCaptain', label: 'Clicked Captains' },
];

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function InsightsSecondaryConfig({
    onRunAnalysis,
    onUpload,
    onFiltersChange,
}: InsightsSecondaryConfigProps) {
    const [uploadedFile, setUploadedFile] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [meta, setMeta] = useState<MetaResponse | null>(null);
    const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);

    // Filter state
    const [prePeriodStart, setPrePeriodStart] = useState('2024-01-01');
    const [prePeriodEnd, setPrePeriodEnd] = useState('2024-02-14');
    const [postPeriodStart, setPostPeriodStart] = useState('2024-02-15');
    const [postPeriodEnd, setPostPeriodEnd] = useState('2024-03-31');
    const [testCohort, setTestCohort] = useState('');
    const [controlCohort, setControlCohort] = useState('');
    const [testConfirmed, setTestConfirmed] = useState('none');
    const [controlConfirmed, setControlConfirmed] = useState('none');
    const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);

    // Load meta when component mounts
    useEffect(() => {
        getMeta()
            .then(setMeta)
            .catch(() => setMeta(null));
    }, []);

    // Notify parent of filter changes
    useEffect(() => {
        onFiltersChange?.({
            prePeriod: { start: prePeriodStart, end: prePeriodEnd },
            postPeriod: { start: postPeriodStart, end: postPeriodEnd },
            testCohort,
            controlCohort,
            testConfirmed,
            controlConfirmed,
            selectedMetrics,
        });
    }, [
        prePeriodStart,
        prePeriodEnd,
        postPeriodStart,
        postPeriodEnd,
        testCohort,
        controlCohort,
        testConfirmed,
        controlConfirmed,
        selectedMetrics,
        onFiltersChange,
    ]);

    const handleFiles = useCallback(
        async (files: FileList | null) => {
            if (!files || files.length === 0) return;
            const file = files[0];
            
            // Check file size (5GB limit)
            const MAX_SIZE = 5 * 1024 * 1024 * 1024;
            if (file.size > MAX_SIZE) {
                setUploadError(`File too large. Maximum size is 5GB. Your file: ${formatBytes(file.size)}`);
                return;
            }
            
            setUploading(true);
            setUploadError(null);
            setUploadProgress({
                status: 'initializing',
                bytesUploaded: 0,
                totalBytes: file.size,
                progress: 0,
            });
            
            try {
                const res = await uploadCsv(file, (progress) => {
                    setUploadProgress(progress);
                    if (progress.status === 'error') {
                        setUploadError(progress.error || 'Upload failed');
                    }
                });
                setUploadedFile(file.name);
                onUpload?.(res);
                // Refresh meta after upload
                const newMeta = await getMeta();
                setMeta(newMeta);
            } catch (e: any) {
                console.error('Upload failed:', e);
                setUploadError(e?.message || 'Upload failed');
            } finally {
                setUploading(false);
            }
        },
        [onUpload]
    );

    const toggleMetric = (metric: string) => {
        setSelectedMetrics((prev) =>
            prev.includes(metric) ? prev.filter((m) => m !== metric) : [...prev, metric]
        );
    };

    const cohorts = meta?.cohorts ?? [];
    const metrics = meta?.metrics ?? [];

    const canRunAnalysis = testCohort && controlCohort && selectedMetrics.length > 0;

    return (
        <div className="flex flex-col h-full w-full">
            {/* Header */}
            <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Insights</h2>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
                    Configuration
                </p>
            </div>

            {/* Scrollable Content */}
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                    {/* Upload CSV */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Upload className="h-4 w-4 text-muted-foreground" />
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Upload CSV
                            </Label>
                        </div>
                        <label
                            className={`flex flex-col items-center justify-center w-full ${uploading && uploadProgress ? 'h-32' : 'h-24'} border-2 border-dashed rounded-xl cursor-pointer transition-colors ${dragOver
                                ? 'border-emerald-500 bg-emerald-50'
                                : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30'
                                } ${uploading ? 'pointer-events-none opacity-75' : ''}`}
                            onDragOver={(e) => {
                                e.preventDefault();
                                setDragOver(true);
                            }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setDragOver(false);
                                handleFiles(e.dataTransfer.files);
                            }}
                        >
                            <input
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={(e) => handleFiles(e.target.files)}
                                disabled={uploading}
                            />
                            {uploading && uploadProgress ? (
                                <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground w-full px-4">
                                    <div className="flex items-center gap-2">
                                        <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                        {uploadProgress.status === 'processing' ? 'Processing...' : 
                                         uploadProgress.status === 'uploading' ? `Uploading ${Math.round(uploadProgress.progress)}%` : 
                                         'Initializing...'}
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                        <div 
                                            className="h-full rounded-full transition-all duration-300 ease-out bg-emerald-500"
                                            style={{ width: `${Math.min(uploadProgress.progress, 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-xs">
                                        {formatBytes(uploadProgress.bytesUploaded)} / {formatBytes(uploadProgress.totalBytes)}
                                    </p>
                                </div>
                            ) : uploadedFile ? (
                                <div className="text-center px-2">
                                    <p className="text-sm font-medium text-emerald-600 truncate max-w-full">
                                        {uploadedFile}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">Click to replace</p>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <p className="text-sm text-muted-foreground">Drag & drop or click</p>
                                    <p className="text-xs text-muted-foreground mt-1">CSV files up to 5GB</p>
                                </div>
                            )}
                        </label>
                        {uploadError && !uploading && (
                            <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-lg">
                                <p className="text-destructive/80 text-xs">{uploadError}</p>
                            </div>
                        )}
                    </div>

                    <Separator />

                    {/* Pre-Period */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Pre-Period
                            </Label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Start</Label>
                                <Input
                                    type="date"
                                    value={prePeriodStart}
                                    onChange={(e) => setPrePeriodStart(e.target.value)}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">End</Label>
                                <Input
                                    type="date"
                                    value={prePeriodEnd}
                                    onChange={(e) => setPrePeriodEnd(e.target.value)}
                                    className="h-9"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Post-Period */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-emerald-600" />
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Post-Period
                            </Label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Start</Label>
                                <Input
                                    type="date"
                                    value={postPeriodStart}
                                    onChange={(e) => setPostPeriodStart(e.target.value)}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">End</Label>
                                <Input
                                    type="date"
                                    value={postPeriodEnd}
                                    onChange={(e) => setPostPeriodEnd(e.target.value)}
                                    className="h-9"
                                />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Cohort Selection */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Cohort Selection
                            </Label>
                        </div>

                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Test Group (B)</Label>
                                <div className="relative">
                                    <select
                                        value={testCohort || ""}
                                        onChange={(e) => setTestCohort(e.target.value)}
                                        disabled={cohorts.length === 0}
                                        className="h-9 w-full appearance-none rounded-md border border-input bg-background px-3 pr-9 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <option value="" disabled>
                                            {cohorts.length ? "Select test cohort" : "Upload CSV first"}
                                        </option>
                                        {cohorts.map((c) => (
                                            <option key={c} value={c}>
                                                {c}
                                            </option>
                                        ))}
                                    </select>
                                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                        ▾
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Control Group (A)</Label>
                                <div className="relative">
                                    <select
                                        value={controlCohort || ""}
                                        onChange={(e) => setControlCohort(e.target.value)}
                                        disabled={cohorts.length === 0}
                                        className="h-9 w-full appearance-none rounded-md border border-input bg-background px-3 pr-9 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <option value="" disabled>
                                            {cohorts.length ? "Select control cohort" : "Upload CSV first"}
                                        </option>
                                        {cohorts.map((c) => (
                                            <option key={c} value={c}>
                                                {c}
                                            </option>
                                        ))}
                                    </select>
                                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                        ▾
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Confirmation Filters (Optional) */}
                    <div className="space-y-3">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Confirmation Filters (Optional)
                        </Label>

                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Test Confirmation</Label>
                                <select
                                    value={testConfirmed}
                                    onChange={(e) => setTestConfirmed(e.target.value)}
                                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {confirmationOptions.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Control Confirmation</Label>
                                <select
                                    value={controlConfirmed}
                                    onChange={(e) => setControlConfirmed(e.target.value)}
                                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {confirmationOptions.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Metrics */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-muted-foreground" />
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Metrics
                            </Label>
                            <span className="ml-auto text-xs text-muted-foreground">
                                {selectedMetrics.length} selected
                            </span>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                            {metrics.length > 0 ? (
                                metrics.map((metric) => (
                                    <div key={metric} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`metric-${metric}`}
                                            checked={selectedMetrics.includes(metric)}
                                            onCheckedChange={() => toggleMetric(metric)}
                                        />
                                        <label
                                            htmlFor={`metric-${metric}`}
                                            className="text-sm cursor-pointer flex-1 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                        >
                                            {metric.replace(/_/g, ' ')}
                                        </label>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground italic">
                                    Upload a CSV to see available metrics
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </ScrollArea>

            {/* Run Analysis Button */}
            <div className="p-4 border-t">
                <Button
                    onClick={onRunAnalysis}
                    disabled={!canRunAnalysis}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
                >
                    <Play className="h-4 w-4" />
                    Run Analysis
                </Button>
                {!canRunAnalysis && (
                    <p className="text-xs text-muted-foreground text-center mt-2">
                        Select cohorts and at least one metric
                    </p>
                )}
            </div>
        </div>
    );
}
