import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Calendar, Users } from 'lucide-react';
import type { FiltersState } from '../Filters';

interface ControlsPanelProps {
  filters: FiltersState;
  onFiltersChange: (filters: FiltersState) => void;
  cohorts?: string[];
  onRun: () => void;
  onReset: () => void;
}

export function ControlsPanel({
  filters,
  onFiltersChange,
  cohorts = [],
  onRun,
  onReset,
}: ControlsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Controls
        </CardTitle>
        <CardDescription>
          Configure your experiment parameters
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Date Range */}
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Date Range</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Set the pre and post period dates
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Pre Period Start</Label>
              <DatePicker
                value={filters.pre_period?.start_date ?? '20250804'}
                onChange={(date) =>
                  onFiltersChange({
                    ...filters,
                    pre_period: { ...filters.pre_period, start_date: date },
                  })
                }
                placeholder="Select start date"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Pre Period End</Label>
              <DatePicker
                value={filters.pre_period?.end_date ?? '20250913'}
                onChange={(date) =>
                  onFiltersChange({
                    ...filters,
                    pre_period: { ...filters.pre_period, end_date: date },
                  })
                }
                placeholder="Select end date"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Post Period Start</Label>
              <DatePicker
                value={filters.post_period?.start_date ?? '20250914'}
                onChange={(date) =>
                  onFiltersChange({
                    ...filters,
                    post_period: { ...filters.post_period, start_date: date },
                  })
                }
                placeholder="Select start date"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Post Period End</Label>
              <DatePicker
                value={filters.post_period?.end_date ?? '20251027'}
                onChange={(date) =>
                  onFiltersChange({
                    ...filters,
                    post_period: { ...filters.post_period, end_date: date },
                  })
                }
                placeholder="Select end date"
              />
            </div>
          </div>
        </div>

        {/* Cohort Selection */}
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Cohort Selection
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              Choose test and control cohorts
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Test Cohort</Label>
              <select
                value={filters.test_cohort ?? ""}
                onChange={(e) => onFiltersChange({ ...filters, test_cohort: e.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                disabled={cohorts.length === 0}
              >
                <option value="" disabled>
                  Select test cohort
                </option>
                {cohorts.map((cohort) => (
                  <option key={cohort} value={cohort}>
                    {cohort}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Control Cohort</Label>
              <select
                value={filters.control_cohort ?? ""}
                onChange={(e) => onFiltersChange({ ...filters, control_cohort: e.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                disabled={cohorts.length === 0}
              >
                <option value="" disabled>
                  Select control cohort
                </option>
                {cohorts.map((cohort) => (
                  <option key={cohort} value={cohort}>
                    {cohort}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-4 border-t">
          <Button onClick={onRun} className="w-full">
            Run Analysis
          </Button>
          <Button variant="outline" onClick={onReset} className="w-full">
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


