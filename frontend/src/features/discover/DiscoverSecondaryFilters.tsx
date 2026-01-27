import { useState } from 'react';
import { Calendar, Filter, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface DiscoverSecondaryFiltersProps {
    onApply?: () => void;
}

// Sample segments and metrics for demonstration
const defaultSegments = [
    { id: 'new-users', label: 'New Users' },
    { id: 'returning-users', label: 'Returning Users' },
    { id: 'high-value', label: 'High Value' },
    { id: 'at-risk', label: 'At Risk' },
    { id: 'churned', label: 'Churned' },
    { id: 'activated', label: 'Activated' },
];

const defaultMetrics = [
    { id: 'conversion-rate', label: 'Conversion Rate' },
    { id: 'avg-order-value', label: 'Avg. Order Value' },
    { id: 'retention-d30', label: 'Retention (Day 30)' },
    { id: 'churn-rate', label: 'Churn Rate' },
    { id: 'ltv', label: 'Lifetime Value' },
    { id: 'arpu', label: 'ARPU' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'orders', label: 'Total Orders' },
];

export function DiscoverSecondaryFilters({ onApply }: DiscoverSecondaryFiltersProps) {
    const [startDate, setStartDate] = useState('2024-01-01');
    const [endDate, setEndDate] = useState('2024-03-31');
    const [selectedSegments, setSelectedSegments] = useState<string[]>(['new-users', 'returning-users']);
    const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['conversion-rate', 'avg-order-value']);

    const toggleSegment = (segmentId: string) => {
        setSelectedSegments((prev) =>
            prev.includes(segmentId) ? prev.filter((id) => id !== segmentId) : [...prev, segmentId]
        );
    };

    const toggleMetric = (metricId: string) => {
        setSelectedMetrics((prev) =>
            prev.includes(metricId) ? prev.filter((id) => id !== metricId) : [...prev, metricId]
        );
    };

    const clearFilters = () => {
        setStartDate('2024-01-01');
        setEndDate('2024-03-31');
        setSelectedSegments([]);
        setSelectedMetrics([]);
    };

    const handleApply = () => {
        // In a real app, this would dispatch filters to a context or make an API call
        console.log('Applying filters:', {
            startDate,
            endDate,
            selectedSegments,
            selectedMetrics,
        });
        onApply?.();
    };

    return (
        <div className="flex flex-col h-full w-full">
            {/* Header */}
            <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Discover</h2>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
                    Filters
                </p>
            </div>

            {/* Scrollable Content */}
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                    {/* Time Period */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Time Period
                            </Label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="start-date" className="text-xs text-muted-foreground">
                                    Start Date
                                </Label>
                                <Input
                                    id="start-date"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="end-date" className="text-xs text-muted-foreground">
                                    End Date
                                </Label>
                                <Input
                                    id="end-date"
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="h-9"
                                />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Segments */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Segments
                            </Label>
                            <span className="ml-auto text-xs text-muted-foreground">
                                {selectedSegments.length} selected
                            </span>
                        </div>
                        <div className="space-y-2">
                            {defaultSegments.map((segment) => (
                                <div key={segment.id} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={segment.id}
                                        checked={selectedSegments.includes(segment.id)}
                                        onCheckedChange={() => toggleSegment(segment.id)}
                                    />
                                    <label
                                        htmlFor={segment.id}
                                        className="text-sm cursor-pointer flex-1 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                        {segment.label}
                                    </label>
                                </div>
                            ))}
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
                        <div className="space-y-2">
                            {defaultMetrics.map((metric) => (
                                <div key={metric.id} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={metric.id}
                                        checked={selectedMetrics.includes(metric.id)}
                                        onCheckedChange={() => toggleMetric(metric.id)}
                                    />
                                    <label
                                        htmlFor={metric.id}
                                        className="text-sm cursor-pointer flex-1 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                        {metric.label}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </ScrollArea>

            {/* Action Buttons */}
            <div className="p-4 border-t space-y-2">
                <Button onClick={handleApply} className="w-full bg-emerald-600 hover:bg-emerald-700">
                    Apply Filters
                </Button>
                <Button variant="outline" onClick={clearFilters} className="w-full">
                    Clear Filters
                </Button>
            </div>
        </div>
    );
}
