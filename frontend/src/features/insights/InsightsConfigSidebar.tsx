import { useId, useMemo, useRef, useState } from "react"
import { RotateCcw, Play, Upload } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

import { uploadCsv, type UploadProgress, type UploadResponse } from "@/lib/api"
import { parseCsv } from "@/features/insights/csv/parseCsv"
import type { AggMethod, ParsedCsv } from "@/features/insights/types"

// Threshold for skipping local parsing (50MB) - large files use backend metadata only
const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024

/**
 * Convert backend UploadResponse to ParsedCsv format for large files.
 * Large files don't have local rows - all analysis happens on backend via DuckDB.
 */
function uploadResponseToParsedCsv(response: UploadResponse, fileName: string): ParsedCsv {
  // Parse date strings to Date objects
  const dateMin = response.date_min ? new Date(response.date_min + 'T00:00:00') : undefined
  const dateMax = response.date_max ? new Date(response.date_max + 'T00:00:00') : undefined
  
  // Determine numeric columns (metrics that are not cohort/date/time)
  const numericColumns = response.metrics || []
  const metricColumns = response.columns.filter(c => !['cohort', 'date', 'time'].includes(c.toLowerCase()))
  const categoricalColumns = metricColumns.filter(c => !numericColumns.includes(c))
  
  return {
    fileName,
    rows: [], // Empty for large files - analysis happens on backend
    columns: response.columns,
    metricColumns,
    numericColumns,
    categoricalColumns,
    cohorts: response.cohorts,
    dateMin,
    dateMax,
  }
}
import { aggLabel } from "@/features/insights/analysis/formatters"
import { ladooDerivedRatioMetrics } from "@/features/insights/metrics/metricCatalog"

function toYyyyMmDd(d: Date | undefined) {
  if (!d) return ""
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function fromYyyyMmDd(s: string) {
  if (!s) return undefined
  const d = new Date(`${s}T00:00:00`)
  return Number.isNaN(d.getTime()) ? undefined : d
}

function DateRangeField({
  value,
  onChange,
}: {
  value: DateRange | undefined
  onChange: (r: DateRange | undefined) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="space-y-1.5">
        <span className="text-xs font-semibold text-muted-foreground">Start</span>
        <input
          type="date"
          value={toYyyyMmDd(value?.from)}
          onChange={(e) => {
            const from = fromYyyyMmDd(e.target.value)
            onChange({ from, to: value?.to })
          }}
          className={cn(
            "h-12 w-full rounded-xl border border-border/60 bg-background px-4 text-sm",
            "shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          )}
        />
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-semibold text-muted-foreground">End</span>
        <input
          type="date"
          value={toYyyyMmDd(value?.to)}
          min={toYyyyMmDd(value?.from)}
          onChange={(e) => {
            const to = fromYyyyMmDd(e.target.value)
            onChange({ from: value?.from, to })
          }}
          className={cn(
            "h-12 w-full rounded-xl border border-border/60 bg-background px-4 text-sm",
            "shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          )}
        />
      </label>
    </div>
  )
}

type InsightsConfigSidebarProps = {
  fileName: string | null
  cohorts: string[]
  testCohort: string
  controlCohort: string
  onTestCohortChange: (v: string) => void
  onControlCohortChange: (v: string) => void

  preRange: DateRange | undefined
  onPreRangeChange: (r: DateRange | undefined) => void
  postRange: DateRange | undefined
  onPostRangeChange: (r: DateRange | undefined) => void

  metricOptions: string[]
  numericColumns: string[]
  selectedMetricKeys: string[]
  metricAggs: Record<string, AggMethod>
  onToggleMetric: (metricKey: string) => void
  onMetricAggChange: (metricKey: string, agg: AggMethod) => void

  onUploaded: (parsed: ParsedCsv) => void
  onRun: () => void
  onReset: () => void
}

export function InsightsConfigSidebar({
  fileName,
  cohorts,
  testCohort,
  controlCohort,
  onTestCohortChange,
  onControlCohortChange,
  preRange,
  onPreRangeChange,
  postRange,
  onPostRangeChange,
  metricOptions,
  numericColumns,
  selectedMetricKeys,
  metricAggs,
  onToggleMetric,
  onMetricAggChange,
  onUploaded,
  onRun,
  onReset,
}: InsightsConfigSidebarProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)

  const canRun = useMemo(() => {
    return Boolean(fileName && testCohort && controlCohort && preRange?.from && preRange?.to && postRange?.from && postRange?.to && selectedMetricKeys.length > 0)
  }, [controlCohort, fileName, postRange?.from, postRange?.to, preRange?.from, preRange?.to, selectedMetricKeys.length, testCohort])

  const numericSet = useMemo(() => new Set(numericColumns), [numericColumns])

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const getUploadStatusText = (): string => {
    if (!uploadProgress) return "Uploading..."
    switch (uploadProgress.status) {
      case 'initializing': return 'Initializing...'
      case 'uploading': return `Uploading ${Math.round(uploadProgress.progress)}%`
      case 'processing': return 'Processing CSV...'
      case 'completed': return 'Complete!'
      default: return 'Uploading...'
    }
  }

  return (
    <aside className="flex h-full w-[320px] flex-col border-r bg-background p-6">
      <div className="pb-6">
        <div className="text-xl font-semibold">Insights</div>
        <div className="mt-1 text-xs font-semibold tracking-widest text-muted-foreground">
          CONFIGURATION
        </div>
      </div>

      {/* Top CTA (moved Run Analysis to top) */}
      <div className="grid grid-cols-2 gap-3 pb-6">
        <Button
          type="button"
          variant="outline"
          onClick={onReset}
          className="h-12 w-full gap-2 rounded-xl"
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Button
          type="button"
          onClick={onRun}
          disabled={!canRun}
          className="h-12 w-full gap-2 rounded-xl bg-emerald-950 text-white hover:bg-emerald-900"
        >
          <Play className="h-4 w-4" />
          Run Analysis
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-6">
        {/* Upload */}
        <div className="space-y-3">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept=".csv"
            className="hidden"
            disabled={uploading}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              
              // Check file size (5GB limit)
              const MAX_SIZE = 5 * 1024 * 1024 * 1024
              if (file.size > MAX_SIZE) {
                setUploadError(`File too large. Maximum size is 5GB. Your file: ${formatBytes(file.size)}`)
                return
              }
              
              setUploading(true)
              setUploadError(null)
              setUploadProgress({
                status: 'initializing',
                bytesUploaded: 0,
                totalBytes: file.size,
                progress: 0,
              })
              
              try {
                // Upload to backend with progress tracking
                const uploadResponse = await uploadCsv(file, (progress) => {
                  setUploadProgress(progress)
                  if (progress.status === 'error') {
                    setUploadError(progress.error || 'Upload failed')
                  }
                })
                
                // For large files, use backend metadata directly (no local parsing)
                // For small files, parse locally for richer UI experience
                let parsed: ParsedCsv
                if (file.size > LARGE_FILE_THRESHOLD) {
                  // Large file - use backend metadata, analysis via DuckDB
                  console.log(`Large file (${(file.size / (1024*1024)).toFixed(1)}MB) - using backend metadata`)
                  parsed = uploadResponseToParsedCsv(uploadResponse, file.name)
                } else {
                  // Small file - parse locally for full row access
                  parsed = await parseCsv(file)
                }
                
                onUploaded(parsed)
              } catch (err: any) {
                setUploadError(err?.message ?? "Failed to upload/parse CSV")
              } finally {
                setUploading(false)
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            className={cn(
              "h-14 w-full justify-start gap-3 rounded-xl border-dashed",
              "text-muted-foreground hover:bg-muted/30 overflow-hidden"
            )}
            disabled={uploading}
          >
            <Upload className="h-4 w-4" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground/80" title={fileName ?? ""}>
              {uploading ? getUploadStatusText() : fileName ? fileName : "Upload CSV (up to 5GB)"}
            </span>
          </Button>
          
          {/* Progress bar */}
          {uploading && uploadProgress && (
            <div className="w-full">
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-300 ease-out bg-emerald-500"
                  style={{ width: `${Math.min(uploadProgress.progress, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatBytes(uploadProgress.bytesUploaded)} / {formatBytes(uploadProgress.totalBytes)}
              </p>
            </div>
          )}
          
          {uploadError && !uploading ? <div className="text-xs text-destructive">{uploadError}</div> : null}
        </div>

        {/* Cohort selection */}
        <div className="space-y-3">
          <div className="text-xs font-semibold tracking-widest text-muted-foreground">
            COHORT SELECTION
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-muted-foreground">Test Group (B)</div>
              <select
                value={testCohort || ""}
                onChange={(e) => onTestCohortChange(e.target.value)}
                disabled={cohorts.length === 0}
                className={cn(
                  "h-12 w-full rounded-xl border border-border/60 bg-background px-4 text-sm",
                  "shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                )}
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
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-muted-foreground">Control Group (A)</div>
              <select
                value={controlCohort || ""}
                onChange={(e) => onControlCohortChange(e.target.value)}
                disabled={cohorts.length === 0}
                className={cn(
                  "h-12 w-full rounded-xl border border-border/60 bg-background px-4 text-sm",
                  "shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                )}
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
            </div>
          </div>
        </div>

        {/* Pre period */}
        <div className="space-y-3">
          <div className="text-xs font-semibold tracking-widest text-muted-foreground">PRE-PERIOD</div>
          <DateRangeField value={preRange} onChange={onPreRangeChange} />
        </div>

        {/* Post period */}
        <div className="space-y-3">
          <div className="text-xs font-semibold tracking-widest text-muted-foreground">POST-PERIOD</div>
          <DateRangeField value={postRange} onChange={onPostRangeChange} />
        </div>

        {/* Metrics */}
        <div className="space-y-3">
          <div className="text-xs font-semibold tracking-widest text-muted-foreground">METRICS</div>
          <div className="space-y-3">
            {metricOptions.map((metricKey) => {
              const checked = selectedMetricKeys.includes(metricKey)
              const isNumeric = numericSet.has(metricKey)
              const agg = metricAggs[metricKey] ?? (metricKey === "captain_id" ? "count_distinct" : isNumeric ? "sum_per_captain" : "count")

              const aggOptions: Array<{ value: AggMethod; label: string; disabled?: boolean }> = [
                { value: "sum", label: "Sum", disabled: !isNumeric },
                { value: "sum_per_captain", label: "Sum/Captain", disabled: !isNumeric },
                { value: "avg", label: "Average", disabled: !isNumeric },
                { value: "median", label: "Median", disabled: !isNumeric },
                { value: "count", label: "Count" },
                { value: "count_distinct", label: "Unique Count" },
              ]

              return (
                <label key={metricKey} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 cursor-pointer items-center gap-3 text-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => onToggleMetric(metricKey)}
                      className="data-[state=checked]:bg-emerald-950 data-[state=checked]:border-emerald-950"
                    />
                    <span className={cn("min-w-0 truncate", checked ? "font-medium" : "text-muted-foreground")}>{metricKey}</span>
                  </span>
                  <select
                    value={agg}
                    onChange={(e) => onMetricAggChange(metricKey, e.target.value as AggMethod)}
                    disabled={!checked}
                    className={cn(
                      "h-9 w-[140px] shrink-0 rounded-lg border border-border/60 bg-background px-3 text-xs",
                      "shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                    )}
                  >
                    {aggOptions.map((opt) => (
                      <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              )
            })}
          </div>
        </div>

        {/* Derived ratios (optional) */}
        <div className="space-y-3">
          <div className="text-xs font-semibold tracking-widest text-muted-foreground">DERIVED RATIOS</div>
          <div className="space-y-3">
            {ladooDerivedRatioMetrics.map((m) => {
              const checked = selectedMetricKeys.includes(m.key)
              return (
                <label key={m.key} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 cursor-pointer items-center gap-3 text-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => onToggleMetric(m.key)}
                      className="data-[state=checked]:bg-emerald-950 data-[state=checked]:border-emerald-950"
                    />
                    <span className={cn("min-w-0 truncate", checked ? "font-medium" : "text-muted-foreground")}>
                      {m.label}
                    </span>
                  </span>
                  <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] font-semibold tracking-widest">
                    {aggLabel("ratio")}
                  </Badge>
                </label>
              )
            })}
          </div>
        </div>
      </div>
    </aside>
  )
}

