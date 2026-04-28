import { useMemo } from "react"
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, BarChart, Bar, ScatterChart, Scatter,
    Area, ComposedChart, ReferenceLine, Cell,
} from "recharts"
import { Badge } from "@/components/ui/badge"
import type {
    CausalMethod, PSMResponse, CausalImpactResponse,
    HTEResponse, SyntheticControlResponse, RDDResponse,
} from "@/lib/api"

// Colors
const VIOLET = "#8b5cf6"
const BLUE = "#3b82f6"
const EMERALD = "#10b981"
const AMBER = "#f59e0b"
const RED = "#ef4444"
const GRAY = "#6b7280"

type Props = {
    method: CausalMethod
    results: unknown
    loading: boolean
}

export function CausalResultsView({ method, results, loading }: Props) {
    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
                <div className="text-center space-y-2">
                    <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                    <p>Running {method} analysis...</p>
                </div>
            </div>
        )
    }

    if (!results) return null

    switch (method) {
        case "psm": return <PSMResults data={results as PSMResponse} />
        case "causal_impact": return <CausalImpactResults data={results as CausalImpactResponse} />
        case "hte": return <HTEResults data={results as HTEResponse} />
        case "synthetic_control": return <SyntheticControlResults data={results as SyntheticControlResponse} />
        case "rdd": return <RDDResults data={results as RDDResponse} />
        default: return null
    }
}

// ============================================================================
// SHARED COMPONENTS
// ============================================================================

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
    return (
        <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-lg font-semibold" style={color ? { color } : undefined}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
    )
}

function Narrative({ text, warnings }: { text: string; warnings?: string[] }) {
    return (
        <div className="space-y-3">
            {warnings && warnings.length > 0 && (
                <div className="space-y-1">
                    {warnings.map((w, i) => (
                        <div key={i} className="bg-amber-500/10 text-amber-400 text-xs px-3 py-2 rounded-md">
                            {w}
                        </div>
                    ))}
                </div>
            )}
            <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Narrative</p>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{text}</p>
            </div>
        </div>
    )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm font-medium text-foreground mb-3">{title}</p>
            {children}
        </div>
    )
}

function fmt(n: number | undefined | null, decimals = 3): string {
    if (n == null || isNaN(n)) return "N/A"
    return n.toFixed(decimals)
}

function fmtPct(n: number | undefined | null): string {
    if (n == null || isNaN(n)) return "N/A"
    return (n * 100).toFixed(1) + "%"
}

function pColor(p: number): string {
    if (p < 0.01) return EMERALD
    if (p < 0.05) return BLUE
    if (p < 0.1) return AMBER
    return RED
}

// ============================================================================
// PSM RESULTS
// ============================================================================

function PSMResults({ data }: { data: PSMResponse }) {
    const histogramData = useMemo(() => {
        const bins = 20
        const allScores = [...data.propensity_scores_test, ...data.propensity_scores_control]
        if (allScores.length === 0) return []
        const min = Math.min(...allScores)
        const max = Math.max(...allScores)
        const binWidth = (max - min) / bins || 0.05

        const result: Array<{ bin: string; test: number; control: number }> = []
        for (let i = 0; i < bins; i++) {
            const lo = min + i * binWidth
            const hi = lo + binWidth
            const label = lo.toFixed(2)
            const testCount = data.propensity_scores_test.filter(s => s >= lo && (i < bins - 1 ? s < hi : s <= hi)).length
            const controlCount = data.propensity_scores_control.filter(s => s >= lo && (i < bins - 1 ? s < hi : s <= hi)).length
            result.push({ bin: label, test: testCount, control: controlCount })
        }
        return result
    }, [data.propensity_scores_test, data.propensity_scores_control])

    const loveData = useMemo(() => {
        return data.balance.map(b => ({
            covariate: b.covariate,
            before: Math.abs(b.smd_before),
            after: Math.abs(b.smd_after),
        }))
    }, [data.balance])

    const comparisonData = [
        { name: "Naive Estimate", value: data.naive_estimate },
        { name: "PSM (ATT)", value: data.att },
    ]

    return (
        <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="ATT (Treatment Effect)" value={fmt(data.att)} color={VIOLET} />
                <StatCard
                    label="95% CI"
                    value={`[${fmt(data.att_ci_lower)}, ${fmt(data.att_ci_upper)}]`}
                />
                <StatCard
                    label="p-value"
                    value={fmt(data.att_p_value, 4)}
                    color={pColor(data.att_p_value)}
                />
                <StatCard
                    label="Matched Pairs"
                    value={`${data.n_matched_pairs} / ${data.n_total_test}`}
                    sub={`Overlap: ${fmtPct(data.overlap_score)}`}
                />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Propensity Score Overlap */}
                <ChartCard title="Propensity Score Distribution">
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={histogramData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="bin" tick={{ fontSize: 10 }} stroke="#888" />
                            <YAxis tick={{ fontSize: 10 }} stroke="#888" />
                            <Tooltip
                                contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }}
                                labelStyle={{ color: "#ccc" }}
                            />
                            <Legend />
                            <Bar dataKey="test" fill={VIOLET} opacity={0.7} name="Test" />
                            <Bar dataKey="control" fill={BLUE} opacity={0.7} name="Control" />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>

                {/* Love Plot */}
                <ChartCard title="Covariate Balance (Love Plot)">
                    <ResponsiveContainer width="100%" height={280}>
                        <ScatterChart
                            margin={{ left: 20, right: 20, top: 10, bottom: 10 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis
                                type="number"
                                dataKey="value"
                                name="SMD"
                                tick={{ fontSize: 10 }}
                                stroke="#888"
                                label={{ value: "|SMD|", position: "bottom", offset: 0, style: { fontSize: 11, fill: "#888" } }}
                            />
                            <YAxis
                                type="category"
                                dataKey="covariate"
                                tick={{ fontSize: 10 }}
                                stroke="#888"
                                width={100}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }}
                            />
                            <Legend />
                            <ReferenceLine x={0.1} stroke={AMBER} strokeDasharray="5 5" label={{ value: "0.1", fill: AMBER, fontSize: 10 }} />
                            <Scatter
                                name="Before"
                                data={loveData.map(d => ({ covariate: d.covariate, value: d.before }))}
                                fill={RED}
                            />
                            <Scatter
                                name="After"
                                data={loveData.map(d => ({ covariate: d.covariate, value: d.after }))}
                                fill={EMERALD}
                            />
                        </ScatterChart>
                    </ResponsiveContainer>
                </ChartCard>

                {/* ATT Comparison */}
                <ChartCard title="Naive vs PSM-Adjusted Estimate">
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={comparisonData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis type="number" tick={{ fontSize: 10 }} stroke="#888" />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#888" width={120} />
                            <Tooltip
                                contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }}
                            />
                            <Bar dataKey="value" fill={VIOLET}>
                                {comparisonData.map((_, i) => (
                                    <Cell key={i} fill={i === 0 ? GRAY : VIOLET} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>

                {/* Balance Table */}
                <ChartCard title="Balance Summary">
                    <div className="overflow-auto max-h-[280px]">
                        <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-card">
                                <tr className="border-b border-border">
                                    <th className="text-left py-1.5 px-2 text-muted-foreground">Covariate</th>
                                    <th className="text-right py-1.5 px-2 text-muted-foreground">SMD Before</th>
                                    <th className="text-right py-1.5 px-2 text-muted-foreground">SMD After</th>
                                    <th className="text-right py-1.5 px-2 text-muted-foreground">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.balance.map((row) => {
                                    const improved = Math.abs(row.smd_after) < Math.abs(row.smd_before)
                                    const balanced = Math.abs(row.smd_after) < 0.1
                                    return (
                                        <tr key={row.covariate} className="border-b border-border/50">
                                            <td className="py-1.5 px-2 text-foreground">{row.covariate}</td>
                                            <td className="text-right py-1.5 px-2">{fmt(row.smd_before)}</td>
                                            <td className="text-right py-1.5 px-2">{fmt(row.smd_after)}</td>
                                            <td className="text-right py-1.5 px-2">
                                                <Badge
                                                    variant="outline"
                                                    className={balanced
                                                        ? "text-emerald-400 border-emerald-500/50"
                                                        : improved
                                                            ? "text-amber-400 border-amber-500/50"
                                                            : "text-red-400 border-red-500/50"}
                                                >
                                                    {balanced ? "Balanced" : improved ? "Improved" : "Unbalanced"}
                                                </Badge>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </ChartCard>
            </div>

            <Narrative text={data.narrative} warnings={data.warnings} />
        </div>
    )
}

// ============================================================================
// CAUSAL IMPACT RESULTS
// ============================================================================

function CausalImpactResults({ data }: { data: CausalImpactResponse }) {
    const ts = data.time_series ?? []

    // Find intervention boundary: first point where cumulative effect becomes non-zero
    const interventionIdx = ts.findIndex((d: Record<string, unknown>) => {
        const cum = (d.cumulative ?? d.cumulative_effect ?? d.cum_effect) as number
        return cum !== 0 && cum !== undefined && cum !== null
    })
    const interventionDate = interventionIdx >= 0 ? (ts[interventionIdx] as Record<string, unknown>).date as string : undefined

    const panelData = ts.map((d: Record<string, unknown>) => ({
        date: d.date as string,
        actual: (d.actual ?? d.response) as number,
        predicted: (d.predicted ?? d.point_pred) as number,
        ci_lower: (d.ci_lower ?? d.point_pred_lower ?? d.predicted_lower) as number,
        ci_upper: (d.ci_upper ?? d.point_pred_upper ?? d.predicted_upper) as number,
        pointwise: (d.pointwise ?? d.pointwise_effect ?? d.point_effect) as number,
        pointwise_lower: (d.pointwise_lower ?? d.point_effect_lower) as number,
        pointwise_upper: (d.pointwise_upper ?? d.point_effect_upper) as number,
        cumulative: (d.cumulative ?? d.cumulative_effect ?? d.cum_effect) as number,
        cumulative_lower: (d.cumulative_lower ?? d.cum_effect_lower) as number,
        cumulative_upper: (d.cumulative_upper ?? d.cum_effect_upper) as number,
    }))

    return (
        <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="Average Effect" value={fmt(data.average_effect)} color={VIOLET} />
                <StatCard
                    label="Avg Effect 95% CI"
                    value={`[${fmt(data.average_effect_ci[0])}, ${fmt(data.average_effect_ci[1])}]`}
                />
                <StatCard label="Cumulative Effect" value={fmt(data.cumulative_effect)} color={BLUE} />
                <StatCard
                    label="Prob. of Causal Effect"
                    value={fmtPct(data.posterior_probability)}
                    sub={`Model MAPE: ${fmtPct(data.model_mape)}`}
                    color={data.posterior_probability > 0.95 ? EMERALD : AMBER}
                />
            </div>

            {/* 3-Panel CausalImpact */}
            <div className="space-y-4">
                {/* Panel 1: Actual vs Predicted */}
                <ChartCard title="Original Series vs Counterfactual Prediction">
                    <ResponsiveContainer width="100%" height={260}>
                        <ComposedChart data={panelData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#888" />
                            <YAxis tick={{ fontSize: 10 }} stroke="#888" />
                            <Tooltip contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }} />
                            <Legend />
                            {interventionDate && (
                                <ReferenceLine x={interventionDate} stroke={RED} strokeDasharray="5 5" label={{ value: "Intervention", fill: RED, fontSize: 10 }} />
                            )}
                            <Area dataKey="ci_upper" stroke="none" fill={BLUE} fillOpacity={0.1} name="CI Upper" legendType="none" />
                            <Area dataKey="ci_lower" stroke="none" fill="#1a1a2e" fillOpacity={1} name="CI Lower" legendType="none" />
                            <Line type="monotone" dataKey="predicted" stroke={BLUE} strokeDasharray="5 5" dot={false} name="Predicted" />
                            <Line type="monotone" dataKey="actual" stroke={VIOLET} dot={false} strokeWidth={2} name="Actual" />
                        </ComposedChart>
                    </ResponsiveContainer>
                </ChartCard>

                {/* Panel 2: Pointwise Effect */}
                <ChartCard title="Pointwise Effect">
                    <ResponsiveContainer width="100%" height={200}>
                        <ComposedChart data={panelData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#888" />
                            <YAxis tick={{ fontSize: 10 }} stroke="#888" />
                            <Tooltip contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }} />
                            {interventionDate && (
                                <ReferenceLine x={interventionDate} stroke={RED} strokeDasharray="5 5" />
                            )}
                            <ReferenceLine y={0} stroke="#555" />
                            <Area dataKey="pointwise_upper" stroke="none" fill={EMERALD} fillOpacity={0.1} legendType="none" />
                            <Area dataKey="pointwise_lower" stroke="none" fill="#1a1a2e" fillOpacity={1} legendType="none" />
                            <Line type="monotone" dataKey="pointwise" stroke={EMERALD} dot={false} strokeWidth={2} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </ChartCard>

                {/* Panel 3: Cumulative Effect */}
                <ChartCard title="Cumulative Effect">
                    <ResponsiveContainer width="100%" height={200}>
                        <ComposedChart data={panelData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#888" />
                            <YAxis tick={{ fontSize: 10 }} stroke="#888" />
                            <Tooltip contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }} />
                            {interventionDate && (
                                <ReferenceLine x={interventionDate} stroke={RED} strokeDasharray="5 5" />
                            )}
                            <ReferenceLine y={0} stroke="#555" />
                            <Area dataKey="cumulative_upper" stroke="none" fill={AMBER} fillOpacity={0.1} legendType="none" />
                            <Area dataKey="cumulative_lower" stroke="none" fill="#1a1a2e" fillOpacity={1} legendType="none" />
                            <Line type="monotone" dataKey="cumulative" stroke={AMBER} dot={false} strokeWidth={2} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            <Narrative text={data.narrative} warnings={data.warnings} />
        </div>
    )
}

// ============================================================================
// HTE RESULTS
// ============================================================================

function HTEResults({ data }: { data: HTEResponse }) {
    const sortedSegments = useMemo(() => {
        return [...data.segment_effects].sort((a, b) => b.cate - a.cate)
    }, [data.segment_effects])

    const waterfallData = sortedSegments.map(s => ({
        name: `${s.segment_name}: ${s.segment_value}`,
        cate: s.cate,
        ci_lower: s.cate_ci_lower,
        ci_upper: s.cate_ci_upper,
        n: s.n_captains,
    }))

    const importanceData = (data.feature_importance ?? [])
        .slice(0, 15)
        .map(f => ({ name: f.feature, importance: f.importance }))

    // CATE distribution histogram
    const cateDistData = useMemo(() => {
        const dist = data.cate_distribution
        if (!dist) return []
        if (Array.isArray(dist)) return dist as Array<{ bin: string; count: number }>
        // If it's an object with bins/counts
        const bins = (dist as Record<string, unknown>).bins as number[] | undefined
        const counts = (dist as Record<string, unknown>).counts as number[] | undefined
        if (bins && counts) {
            return bins.map((b, i) => ({ bin: b.toFixed(2), count: counts[i] ?? 0 }))
        }
        return []
    }, [data.cate_distribution])

    return (
        <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <StatCard label="ATE (Average Treatment Effect)" value={fmt(data.ate)} color={VIOLET} />
                <StatCard label="ATE 95% CI" value={`[${fmt(data.ate_ci[0])}, ${fmt(data.ate_ci[1])}]`} />
                <StatCard label="Segments Analyzed" value={String(data.segment_effects.length)} />
            </div>

            {/* Waterfall chart of CATEs */}
            <ChartCard title="Conditional Average Treatment Effects by Segment">
                <ResponsiveContainer width="100%" height={Math.max(280, waterfallData.length * 32)}>
                    <BarChart data={waterfallData} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis type="number" tick={{ fontSize: 10 }} stroke="#888" />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} stroke="#888" width={160} />
                        <Tooltip
                            contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }}
                            formatter={(value: number, name: string) => {
                                if (name === "cate") return [fmt(value), "CATE"]
                                return [value, name]
                            }}
                        />
                        <ReferenceLine x={0} stroke="#555" />
                        <Bar dataKey="cate" name="CATE">
                            {waterfallData.map((d, i) => (
                                <Cell key={i} fill={d.cate >= 0 ? EMERALD : RED} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Feature importance */}
                {importanceData.length > 0 && (
                    <ChartCard title="Feature Importance">
                        <ResponsiveContainer width="100%" height={Math.max(200, importanceData.length * 28)}>
                            <BarChart data={importanceData} layout="vertical" margin={{ left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis type="number" tick={{ fontSize: 10 }} stroke="#888" />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} stroke="#888" width={120} />
                                <Tooltip contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }} />
                                <Bar dataKey="importance" fill={BLUE} />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>
                )}

                {/* CATE Distribution */}
                {cateDistData.length > 0 && (
                    <ChartCard title="CATE Distribution">
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={cateDistData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis dataKey="bin" tick={{ fontSize: 10 }} stroke="#888" />
                                <YAxis tick={{ fontSize: 10 }} stroke="#888" />
                                <Tooltip contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }} />
                                <ReferenceLine x={0} stroke={AMBER} strokeDasharray="3 3" />
                                <Bar dataKey="count" fill={VIOLET} opacity={0.8} />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>
                )}
            </div>

            {/* Segment detail table */}
            <ChartCard title="Segment Detail">
                <div className="overflow-auto max-h-[300px]">
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-card">
                            <tr className="border-b border-border">
                                <th className="text-left py-1.5 px-2 text-muted-foreground">Segment</th>
                                <th className="text-right py-1.5 px-2 text-muted-foreground">CATE</th>
                                <th className="text-right py-1.5 px-2 text-muted-foreground">95% CI</th>
                                <th className="text-right py-1.5 px-2 text-muted-foreground">N</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedSegments.map((s, i) => (
                                <tr key={i} className="border-b border-border/50">
                                    <td className="py-1.5 px-2 text-foreground">{s.segment_name}: {s.segment_value}</td>
                                    <td className="text-right py-1.5 px-2" style={{ color: s.cate >= 0 ? EMERALD : RED }}>{fmt(s.cate)}</td>
                                    <td className="text-right py-1.5 px-2 text-muted-foreground">[{fmt(s.cate_ci_lower)}, {fmt(s.cate_ci_upper)}]</td>
                                    <td className="text-right py-1.5 px-2">{s.n_captains.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </ChartCard>

            <Narrative text={data.narrative} warnings={data.warnings} />
        </div>
    )
}

// ============================================================================
// SYNTHETIC CONTROL RESULTS
// ============================================================================

function SyntheticControlResults({ data }: { data: SyntheticControlResponse }) {
    const ts = data.time_series ?? []

    const seriesData = ts.map((d: Record<string, unknown>) => ({
        date: d.date as string,
        actual: d.actual as number,
        synthetic: d.synthetic as number,
        gap: ((d.actual as number) - (d.synthetic as number)) || 0,
    }))

    // Find intervention date from data
    const interventionIdx = ts.findIndex((d: Record<string, unknown>) => d.post === true || d.post === 1)
    const interventionDate = interventionIdx >= 0 ? (ts[interventionIdx] as Record<string, unknown>).date as string : undefined

    const donorData = (data.donor_weights ?? [])
        .filter(d => d.weight > 0.01)
        .sort((a, b) => b.weight - a.weight)
        .map(d => ({ name: d.unit, weight: d.weight }))

    // Placebo gaps
    const placeboData = useMemo(() => {
        if (!data.placebo_gaps || data.placebo_gaps.length === 0) return []
        return data.placebo_gaps as Array<Record<string, unknown>>
    }, [data.placebo_gaps])

    // Build placebo chart data: pivot from unit-per-row to date-indexed
    const placeboChartData = useMemo(() => {
        if (placeboData.length === 0) return { data: [] as Array<Record<string, unknown>>, units: [] as string[] }
        const byDate = new Map<string, Record<string, unknown>>()
        const units = new Set<string>()
        for (const row of placeboData) {
            const date = row.date as string
            const unit = row.unit as string
            const gap = row.gap as number
            units.add(unit)
            if (!byDate.has(date)) byDate.set(date, { date })
            byDate.get(date)![unit] = gap
        }
        return { data: Array.from(byDate.values()), units: Array.from(units) }
    }, [placeboData])

    return (
        <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="Estimated Effect" value={fmt(data.estimated_effect)} color={VIOLET} />
                <StatCard label="Effect %" value={fmtPct(data.estimated_effect_pct)} />
                <StatCard label="Pre-RMSPE" value={fmt(data.pre_rmspe, 4)} sub={`Post: ${fmt(data.post_rmspe, 4)}`} />
                {data.placebo_p_value != null && (
                    <StatCard
                        label="Placebo p-value"
                        value={fmt(data.placebo_p_value, 4)}
                        color={pColor(data.placebo_p_value)}
                    />
                )}
            </div>

            {/* Actual vs Synthetic */}
            <ChartCard title="Actual vs Synthetic Control">
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={seriesData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#888" />
                        <YAxis tick={{ fontSize: 10 }} stroke="#888" />
                        <Tooltip contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }} />
                        <Legend />
                        {interventionDate && (
                            <ReferenceLine x={interventionDate} stroke={RED} strokeDasharray="5 5" label={{ value: "Intervention", fill: RED, fontSize: 10 }} />
                        )}
                        <Line type="monotone" dataKey="actual" stroke={VIOLET} dot={false} strokeWidth={2} name="Actual (Treated)" />
                        <Line type="monotone" dataKey="synthetic" stroke={BLUE} strokeDasharray="5 5" dot={false} strokeWidth={2} name="Synthetic" />
                    </LineChart>
                </ResponsiveContainer>
            </ChartCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Donor weights */}
                {donorData.length > 0 && (
                    <ChartCard title="Donor Weights">
                        <ResponsiveContainer width="100%" height={Math.max(200, donorData.length * 32)}>
                            <BarChart data={donorData} layout="vertical" margin={{ left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis type="number" tick={{ fontSize: 10 }} stroke="#888" domain={[0, 1]} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} stroke="#888" width={100} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }}
                                    formatter={(v: number) => [fmtPct(v), "Weight"]}
                                />
                                <Bar dataKey="weight" fill={EMERALD} />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>
                )}

                {/* Placebo test */}
                {placeboChartData.data.length > 0 && (
                    <ChartCard title="Placebo Test (Gap)">
                        <ResponsiveContainer width="100%" height={280}>
                            <LineChart data={placeboChartData.data}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#888" />
                                <YAxis tick={{ fontSize: 10 }} stroke="#888" />
                                <Tooltip contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }} />
                                {interventionDate && (
                                    <ReferenceLine x={interventionDate} stroke={RED} strokeDasharray="5 5" />
                                )}
                                <ReferenceLine y={0} stroke="#555" />
                                {placeboChartData.units.map((unit, i) => (
                                    <Line
                                        key={unit}
                                        type="monotone"
                                        dataKey={unit}
                                        stroke={i === 0 ? AMBER : "#555"}
                                        strokeWidth={i === 0 ? 2 : 1}
                                        dot={false}
                                        opacity={i === 0 ? 1 : 0.4}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </ChartCard>
                )}
            </div>

            <Narrative text={data.narrative} warnings={data.warnings} />
        </div>
    )
}

// ============================================================================
// RDD RESULTS
// ============================================================================

function RDDResults({ data }: { data: RDDResponse }) {
    // Scatter data split by side field from backend
    const scatterLeft = (data.scatter_data ?? [])
        .filter((d: Record<string, unknown>) => d.side === "left")
        .map((d: Record<string, unknown>) => ({
            x: (d.x ?? d.running_variable) as number,
            y: (d.y ?? d.outcome) as number,
        }))

    const scatterRight = (data.scatter_data ?? [])
        .filter((d: Record<string, unknown>) => d.side === "right")
        .map((d: Record<string, unknown>) => ({
            x: (d.x ?? d.running_variable) as number,
            y: (d.y ?? d.outcome) as number,
        }))

    // Infer cutoff from the boundary between left and right scatter points
    const cutoffValue = useMemo(() => {
        const leftMax = scatterLeft.length > 0 ? Math.max(...scatterLeft.map(d => d.x)) : 0
        const rightMin = scatterRight.length > 0 ? Math.min(...scatterRight.map(d => d.x)) : 0
        return (leftMax + rightMin) / 2
    }, [scatterLeft, scatterRight])

    const fittedLeft = data.fitted_lines?.left ?? []
    const fittedRight = data.fitted_lines?.right ?? []

    // Bandwidth sensitivity
    const bwData = (data.bandwidth_sensitivity ?? []).map(b => ({
        bandwidth: b.bandwidth.toFixed(2),
        estimate: b.estimate,
        ci_lower: b.ci_lower,
        ci_upper: b.ci_upper,
        n: b.n_left + b.n_right,
    }))

    return (
        <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="RD Estimate" value={fmt(data.rd_estimate)} color={VIOLET} />
                <StatCard label="95% CI" value={`[${fmt(data.rd_ci_lower)}, ${fmt(data.rd_ci_upper)}]`} />
                <StatCard label="p-value" value={fmt(data.rd_p_value, 4)} color={pColor(data.rd_p_value)} />
                <StatCard
                    label="Optimal Bandwidth"
                    value={fmt(data.optimal_bandwidth)}
                    sub={`Left: ${data.n_left}, Right: ${data.n_right}`}
                />
            </div>

            {data.mccrary_manipulation && (
                <div className="bg-red-500/10 text-red-400 text-sm px-4 py-3 rounded-lg">
                    McCrary test suggests manipulation at the cutoff (p={fmt(data.mccrary_p_value ?? 0, 4)}). RD estimates may be invalid.
                </div>
            )}

            {/* RD Scatter Plot */}
            <ChartCard title="Regression Discontinuity Plot">
                <ResponsiveContainer width="100%" height={350}>
                    <ComposedChart margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis
                            type="number"
                            dataKey="x"
                            tick={{ fontSize: 10 }}
                            stroke="#888"
                            domain={["auto", "auto"]}
                        />
                        <YAxis tick={{ fontSize: 10 }} stroke="#888" />
                        <Tooltip contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }} />
                        <Legend />
                        <ReferenceLine
                            x={cutoffValue ?? 0}
                            stroke={RED}
                            strokeDasharray="5 5"
                            label={{ value: `Cutoff: ${cutoffValue ?? 0}`, fill: RED, fontSize: 10 }}
                        />
                        <Scatter name="Below Cutoff" data={scatterLeft} fill={BLUE} opacity={0.4} />
                        <Scatter name="Above Cutoff" data={scatterRight} fill={VIOLET} opacity={0.4} />
                        {fittedLeft.length > 0 && (
                            <Line
                                type="monotone"
                                data={fittedLeft}
                                dataKey="y"
                                stroke={BLUE}
                                strokeWidth={2}
                                dot={false}
                                legendType="none"
                            />
                        )}
                        {fittedRight.length > 0 && (
                            <Line
                                type="monotone"
                                data={fittedRight}
                                dataKey="y"
                                stroke={VIOLET}
                                strokeWidth={2}
                                dot={false}
                                legendType="none"
                            />
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </ChartCard>

            {/* Bandwidth sensitivity */}
            {bwData.length > 0 && (
                <ChartCard title="Bandwidth Sensitivity">
                    <ResponsiveContainer width="100%" height={250}>
                        <ComposedChart data={bwData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="bandwidth" tick={{ fontSize: 10 }} stroke="#888" label={{ value: "Bandwidth", position: "bottom", offset: 0, style: { fontSize: 11, fill: "#888" } }} />
                            <YAxis tick={{ fontSize: 10 }} stroke="#888" />
                            <Tooltip
                                contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }}
                                formatter={(v: number, name: string) => [fmt(v), name]}
                            />
                            <ReferenceLine y={0} stroke="#555" />
                            <Area dataKey="ci_upper" stroke="none" fill={VIOLET} fillOpacity={0.1} legendType="none" />
                            <Area dataKey="ci_lower" stroke="none" fill="#1a1a2e" fillOpacity={1} legendType="none" />
                            <Line type="monotone" dataKey="estimate" stroke={VIOLET} strokeWidth={2} dot={{ fill: VIOLET, r: 4 }} name="RD Estimate" />
                        </ComposedChart>
                    </ResponsiveContainer>
                </ChartCard>
            )}

            {/* Detail table */}
            {bwData.length > 0 && (
                <ChartCard title="Bandwidth Sensitivity Detail">
                    <div className="overflow-auto max-h-[200px]">
                        <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-card">
                                <tr className="border-b border-border">
                                    <th className="text-left py-1.5 px-2 text-muted-foreground">Bandwidth</th>
                                    <th className="text-right py-1.5 px-2 text-muted-foreground">Estimate</th>
                                    <th className="text-right py-1.5 px-2 text-muted-foreground">95% CI</th>
                                    <th className="text-right py-1.5 px-2 text-muted-foreground">N (total)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bwData.map((row, i) => (
                                    <tr key={i} className="border-b border-border/50">
                                        <td className="py-1.5 px-2 text-foreground">{row.bandwidth}</td>
                                        <td className="text-right py-1.5 px-2">{fmt(row.estimate)}</td>
                                        <td className="text-right py-1.5 px-2 text-muted-foreground">[{fmt(row.ci_lower)}, {fmt(row.ci_upper)}]</td>
                                        <td className="text-right py-1.5 px-2">{row.n}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </ChartCard>
            )}

            <Narrative text={data.narrative} warnings={data.warnings} />
        </div>
    )
}
