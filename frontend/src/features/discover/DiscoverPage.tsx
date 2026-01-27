import { useState } from 'react';
import { Compass, Filter, TrendingUp, Users, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Sample data for demonstration
const sampleInsights = [
    {
        id: 1,
        title: 'New User Conversion',
        metric: '+12.4%',
        trend: 'up',
        description: 'Week over week improvement in new user conversion rate',
    },
    {
        id: 2,
        title: 'Retention Rate',
        metric: '68.2%',
        trend: 'stable',
        description: '30-day retention across all segments',
    },
    {
        id: 3,
        title: 'Average Order Value',
        metric: '$42.50',
        trend: 'up',
        description: 'Up from $38.20 last period',
    },
];

export function DiscoverPage() {
    const [activeFilters] = useState({
        timePeriod: 'Jan 1 - Mar 31, 2024',
        segments: ['New Users', 'Returning Users'],
        metrics: ['Conversion Rate', 'Avg. Order Value'],
    });

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">Discover</h1>
                <p className="text-muted-foreground">
                    Explore metrics and insights across different segments and time periods.
                </p>
            </div>

            {/* Active Filters Summary */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                            <Filter className="h-4 w-4" />
                            Active Filters
                        </CardTitle>
                        <Badge variant="secondary" className="font-normal">
                            {activeFilters.segments.length + activeFilters.metrics.length} applied
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="gap-1">
                            <span className="text-muted-foreground">Period:</span>
                            {activeFilters.timePeriod}
                        </Badge>
                        {activeFilters.segments.map((segment) => (
                            <Badge key={segment} variant="outline" className="bg-blue-50 border-blue-200">
                                {segment}
                            </Badge>
                        ))}
                        {activeFilters.metrics.map((metric) => (
                            <Badge key={metric} variant="outline" className="bg-emerald-50 border-emerald-200">
                                {metric}
                            </Badge>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Quick Insights Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {sampleInsights.map((insight) => (
                    <Card key={insight.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs uppercase tracking-wider">
                                {insight.title}
                            </CardDescription>
                            <CardTitle className="text-2xl font-bold flex items-center gap-2">
                                {insight.metric}
                                {insight.trend === 'up' && (
                                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">{insight.description}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Results Area - Placeholder */}
            <Card className="min-h-[400px]">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Analysis Results
                    </CardTitle>
                    <CardDescription>
                        Apply filters from the sidebar to generate detailed analysis
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                            <Compass className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-medium mb-2">Ready to Explore</h3>
                        <p className="text-muted-foreground max-w-md">
                            Configure your filters in the sidebar and click "Apply Filters" to generate
                            detailed analysis and visualizations for your selected segments and metrics.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Segment Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Segment Distribution
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm">New Users</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                                        <div className="h-full w-[35%] bg-blue-500 rounded-full" />
                                    </div>
                                    <span className="text-sm font-medium w-12 text-right">35%</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm">Returning Users</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                                        <div className="h-full w-[45%] bg-emerald-500 rounded-full" />
                                    </div>
                                    <span className="text-sm font-medium w-12 text-right">45%</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm">High Value</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                                        <div className="h-full w-[20%] bg-purple-500 rounded-full" />
                                    </div>
                                    <span className="text-sm font-medium w-12 text-right">20%</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            Metric Summary
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between py-1">
                                <span className="text-sm">Conversion Rate</span>
                                <span className="text-sm font-medium text-emerald-600">3.82%</span>
                            </div>
                            <div className="flex items-center justify-between py-1">
                                <span className="text-sm">Avg. Order Value</span>
                                <span className="text-sm font-medium">$46.20</span>
                            </div>
                            <div className="flex items-center justify-between py-1">
                                <span className="text-sm">Churn Rate</span>
                                <span className="text-sm font-medium text-amber-600">0.9%</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
