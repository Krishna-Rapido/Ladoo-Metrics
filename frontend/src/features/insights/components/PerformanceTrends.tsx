import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Maximize2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toPng } from "html-to-image"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

import type { AggMethod, TrendChartType, TrendMultiSeries } from "../types"
import { aggLabel } from "../analysis/formatters"
import { useReport } from "@/contexts/ReportContext"

export type PerformanceTrendsProps = {
  metricKey: string | null
  onMetricKeyChange: (key: string) => void
  agg: AggMethod
  onAggChange: (agg: AggMethod) => void
  breakoutCol: string
  onBreakoutColChange: (col: string) => void
  chartType: TrendChartType
  onChartTypeChange: (t: TrendChartType) => void
  metricOptions: Array<{ key: string; label: string }>
  aggOptions: AggMethod[]
  breakoutOptions: string[]
  series: TrendMultiSeries
}

export function PerformanceTrends({
  metricKey,
  onMetricKeyChange,
  agg,
  onAggChange,
  breakoutCol,
  onBreakoutColChange,
  chartType,
  onChartTypeChange,
  metricOptions,
  series,
  aggOptions,
  breakoutOptions,
}: PerformanceTrendsProps) {
  const { addItem } = useReport()
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const captureRef = useRef<HTMLDivElement | null>(null)

  const labelByKey = useMemo(() => {
    return Object.fromEntries(series.lines.map((l) => [l.key, l.label]))
  }, [series.lines])
  const strokeByKey = useMemo(() => {
    return Object.fromEntries(series.lines.map((l) => [l.key, l.stroke]))
  }, [series.lines])

  const [hiddenKeys, setHiddenKeys] = useState<Record<string, boolean>>({})

  // Prune hidden state when series keys change
  useEffect(() => {
    const active = new Set(series.lines.map((l) => l.key))
    setHiddenKeys((prev) => {
      const next: Record<string, boolean> = {}
      for (const [k, v] of Object.entries(prev)) {
        if (active.has(k)) next[k] = v
      }
      return next
    })
  }, [series.lines])

  const isHidden = (key: string) => hiddenKeys[key] === true

  const toggleKey = (key: string) => {
    setHiddenKeys((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleAddToReport = async () => {
    if (!captureRef.current || !metricKey) return
    setAdding(true)
    try {
      const dataUrl = await toPng(captureRef.current, {
        backgroundColor: "#ffffff",
        quality: 1.0,
        pixelRatio: 2,
      })

      const titleParts = [metricKey, aggLabel(agg)]
      if (breakoutCol) titleParts.push(`Breakout: ${breakoutCol}`)
      titleParts.push(chartType.replaceAll("_", " "))
      await addItem({
        type: "chart",
        title: `Performance Trends (${titleParts.join(" • ")})`,
        content: {
          imageDataUrl: dataUrl,
          metricKey,
          agg,
          breakoutCol,
          chartType,
        },
        comment: "",
      })

      setAdded(true)
      setTimeout(() => setAdded(false), 2000)
    } finally {
      setAdding(false)
    }
  }

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardHeader className="pb-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-muted-foreground">[In 2]:</span>
            <CardTitle className="text-base font-semibold">Performance Trends</CardTitle>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={metricKey ?? ""}
            onChange={(e) => onMetricKeyChange(e.target.value)}
            disabled={metricOptions.length === 0}
            className="h-9 w-[220px] rounded-xl border border-border/60 bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="" disabled>
              Select metric
            </option>
            {metricOptions.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>

          <select
            value={agg}
            onChange={(e) => onAggChange(e.target.value as AggMethod)}
            disabled={!metricKey}
            className="h-9 w-[170px] rounded-xl border border-border/60 bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {aggOptions.map((a) => (
              <option key={a} value={a}>
                {aggLabel(a)}
              </option>
            ))}
          </select>

          <select
            value={breakoutCol}
            onChange={(e) => onBreakoutColChange(e.target.value)}
            disabled={breakoutOptions.length === 0}
            className="h-9 w-[220px] rounded-xl border border-border/60 bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">None</option>
            {breakoutOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={chartType}
            onChange={(e) => onChartTypeChange(e.target.value as TrendChartType)}
            className="h-9 w-[160px] rounded-xl border border-border/60 bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="line">Line</option>
            <option value="bar">Bar</option>
            <option value="stacked_bar">Stacked bar</option>
          </select>

          <Button
            variant="outline"
            className="h-9 rounded-xl"
            onClick={handleAddToReport}
            disabled={!metricKey || adding}
          >
            {added ? "Added" : adding ? "Adding…" : "Add to Report"}
          </Button>

          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Maximize2 className="h-4 w-4" />
            <span className="sr-only">Maximize</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {!metricKey ? (
          <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
            Select metrics and click Run Analysis.
          </div>
        ) : (
          <div ref={captureRef} className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "line" ? (
                <LineChart data={series.data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    width={42}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="left"
                    wrapperStyle={{ paddingBottom: 8 }}
                    content={() => {
                      return (
                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
                          {series.lines.map((l) => {
                            const key = l.key
                            const label = l.label
                            const color = l.stroke
                            const hidden = isHidden(l.key)
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => toggleKey(key)}
                                className="flex items-center gap-2 text-left"
                                style={{ opacity: hidden ? 0.45 : 1 }}
                                title={hidden ? "Show series" : "Hide series"}
                              >
                                <span
                                  className="inline-block h-2.5 w-2.5 rounded-sm"
                                  style={{ backgroundColor: color }}
                                />
                                <span style={{ color }}>{label}</span>
                              </button>
                            )
                          })}
                        </div>
                      )
                    }}
                  />
                  {series.lines.map((l) => (
                    <Line
                      key={l.key}
                      type="monotone"
                      dataKey={l.key}
                      stroke={l.stroke}
                      strokeWidth={2.25}
                      strokeDasharray={l.strokeDasharray}
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                      hide={isHidden(l.key)}
                    />
                  ))}
                </LineChart>
              ) : (
                <BarChart data={series.data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    width={42}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="left"
                    wrapperStyle={{ paddingBottom: 8 }}
                    content={() => {
                      return (
                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
                          {series.lines.map((l) => {
                            const key = l.key
                            const label = l.label
                            const color = l.stroke
                            const hidden = isHidden(l.key)
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => toggleKey(key)}
                                className="flex items-center gap-2 text-left"
                                style={{ opacity: hidden ? 0.45 : 1 }}
                                title={hidden ? "Show series" : "Hide series"}
                              >
                                <span
                                  className="inline-block h-2.5 w-2.5 rounded-sm"
                                  style={{ backgroundColor: color }}
                                />
                                <span style={{ color }}>{label}</span>
                              </button>
                            )
                          })}
                        </div>
                      )
                    }}
                  />
                  {series.lines.map((l) => (
                    <Bar
                      key={l.key}
                      dataKey={l.key}
                      fill={l.stroke}
                      stackId={chartType === "stacked_bar" ? "stack" : undefined}
                      isAnimationActive={false}
                      hide={isHidden(l.key)}
                    />
                  ))}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

