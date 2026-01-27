import { useParams } from 'react-router-dom';
import { LayoutDashboard, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Import existing analysis components
import { DaprBucketAnalysis } from '@/components/DaprBucketAnalysis';
import { Fe2NetAnalysis } from '@/components/Fe2NetAnalysis';
import { RtuPerformanceAnalysis } from '@/components/RtuPerformanceAnalysis';
import { R2AAnalysis } from '@/components/R2AAnalysis';
import { R2APercentageAnalysis } from '@/components/R2APercentageAnalysis';
import { A2PhhSummaryAnalysis } from '@/components/A2PhhSummaryAnalysis';

// Component mapping based on folder/item slug
const componentMap: Record<string, Record<string, React.ComponentType>> = {
  acquisition: {
    r2a: R2AAnalysis,
    'r2a-percentage': R2APercentageAnalysis,
    a2phh: A2PhhSummaryAnalysis,
  },
  retention: {
    fe2net: Fe2NetAnalysis,
    rtu: RtuPerformanceAnalysis,
  },
  quality: {
    dapr: DaprBucketAnalysis,
  },
};

export function DashboardPage() {
  const { folder, item } = useParams<{ folder?: string; item?: string }>();

  // If no folder/item selected, show welcome screen
  if (!folder || !item) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-6">
          <LayoutDashboard className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground mb-2">Select a Dashboard</h1>
        <p className="text-muted-foreground max-w-md mb-8">
          Choose a dashboard from the navigation panel on the left to view specialized analytics
          and insights for captain management.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl w-full">
          <Card className="hover:shadow-md transition-shadow cursor-pointer group">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                Acquisition
                <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>R2A, A2PHH analysis and funnel metrics</CardDescription>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer group">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                Retention
                <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>FE2Net funnel and RTU performance</CardDescription>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer group">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                Quality
                <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Dapr bucket distribution analysis</CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Get the component for this folder/item
  const folderComponents = componentMap[folder];
  const Component = folderComponents?.[item];

  // If component not found, show error
  if (!Component) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Dashboard Not Found</CardTitle>
            <CardDescription>
              The dashboard "{folder}/{item}" does not exist or has not been implemented yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This may be a custom dashboard that was added but doesn't have an associated component.
              You can create custom analysis components and map them in the DashboardPage.tsx file.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render the component
  return (
    <div className="space-y-6">
      <Component />
    </div>
  );
}
