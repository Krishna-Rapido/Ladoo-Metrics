import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import type { CausalMethod } from "@/lib/api"

type SessionMeta = {
    columns: string[]
    metrics: string[]
    cohorts: string[]
    date_min?: string
    date_max?: string
}

type Props = {
    method: CausalMethod | null
    sessionMeta: SessionMeta | null
    onRun: (method: CausalMethod, config: Record<string, unknown>) => void
    loading: boolean
}

const METHOD_LABELS: Record<CausalMethod, string> = {
    psm: "Propensity Score Matching",
    causal_impact: "CausalImpact",
    hte: "Treatment Heterogeneity",
    synthetic_control: "Synthetic Control",
    rdd: "Regression Discontinuity",
}

export function CausalConfigPanel({ method, sessionMeta, onRun, loading }: Props) {
    // Shared state
    const [outcomeMetric, setOutcomeMetric] = useState("")
    const [preStart, setPreStart] = useState(sessionMeta?.date_min ?? "")
    const [preEnd, setPreEnd] = useState("")
    const [postStart, setPostStart] = useState("")
    const [postEnd, setPostEnd] = useState(sessionMeta?.date_max ?? "")

    // PSM
    const [matchingMethod, setMatchingMethod] = useState<"nearest" | "caliper" | "kernel">("nearest")
    const [caliperWidth, setCaliperWidth] = useState(0.2)

    // CausalImpact
    const [aggregation, setAggregation] = useState<"sum" | "mean">("mean")
    const [useControlAsCovariate, setUseControlAsCovariate] = useState(true)

    // HTE
    const [segmentColumns, setSegmentColumns] = useState<string[]>([])

    // SyntheticControl
    const [unitColumn, setUnitColumn] = useState("city")
    const [treatedUnit, setTreatedUnit] = useState("")
    const [interventionDate, setInterventionDate] = useState("")
    const [scAggregation, setScAggregation] = useState<"sum" | "mean">("mean")

    // RDD
    const [runningVariable, setRunningVariable] = useState("")
    const [cutoffValue, setCutoffValue] = useState(0)
    const [kernel, setKernel] = useState<"triangular" | "epanechnikov" | "uniform">("triangular")

    if (!method) return null

    const metrics = sessionMeta?.metrics ?? []
    const columns = sessionMeta?.columns ?? []
    const cohorts = sessionMeta?.cohorts ?? []
    const testCohort = cohorts.find(c => c.toLowerCase().includes("test")) ?? cohorts[0]
    const controlCohort = cohorts.find(c => c.toLowerCase().includes("control")) ?? cohorts[1]

    function handleRun() {
        if (!method) return
        let config: Record<string, unknown> = {}

        switch (method) {
            case "psm":
                config = {
                    outcome_metric: outcomeMetric,
                    matching_method: matchingMethod,
                    caliper_width: caliperWidth,
                    pre_start: preStart,
                    pre_end: preEnd,
                    post_start: postStart,
                    post_end: postEnd,
                    test_cohort: testCohort,
                    control_cohort: controlCohort,
                }
                break
            case "causal_impact":
                config = {
                    outcome_metric: outcomeMetric,
                    aggregation,
                    use_control_as_covariate: useControlAsCovariate,
                    pre_start: preStart,
                    pre_end: preEnd,
                    post_start: postStart,
                    post_end: postEnd,
                    test_cohort: testCohort,
                    control_cohort: controlCohort,
                }
                break
            case "hte":
                config = {
                    outcome_metric: outcomeMetric,
                    segment_columns: segmentColumns.length > 0 ? segmentColumns : undefined,
                    pre_start: preStart,
                    pre_end: preEnd,
                    post_start: postStart,
                    post_end: postEnd,
                    test_cohort: testCohort,
                    control_cohort: controlCohort,
                }
                break
            case "synthetic_control":
                config = {
                    outcome_metric: outcomeMetric,
                    unit_column: unitColumn,
                    treated_unit: treatedUnit,
                    intervention_date: interventionDate,
                    aggregation: scAggregation,
                }
                break
            case "rdd":
                config = {
                    running_variable: runningVariable,
                    cutoff_value: cutoffValue,
                    outcome_metric: outcomeMetric,
                    kernel,
                    post_start: postStart,
                    post_end: postEnd,
                }
                break
        }

        onRun(method, config)
    }

    const canRun = (() => {
        if (!outcomeMetric && method !== "rdd") return false
        if (method === "rdd" && (!runningVariable || !outcomeMetric)) return false
        if (method === "synthetic_control" && (!treatedUnit || !interventionDate)) return false
        if (method !== "synthetic_control" && method !== "rdd" && (!preStart || !preEnd || !postStart || !postEnd)) return false
        return true
    })()

    return (
        <div className="space-y-5">
            <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">{METHOD_LABELS[method]}</h3>
                <p className="text-xs text-muted-foreground">Configure parameters and run analysis</p>
            </div>

            {/* Outcome metric - all methods */}
            <FieldGroup label="Outcome Metric">
                <Select value={outcomeMetric} onValueChange={setOutcomeMetric}>
                    <SelectTrigger><SelectValue placeholder="Select metric" /></SelectTrigger>
                    <SelectContent>
                        {metrics.map(m => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </FieldGroup>

            {/* Date ranges - not needed for synthetic_control */}
            {method !== "synthetic_control" && (
                <div className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {method === "rdd" ? "Post Period (optional)" : "Pre / Post Periods"}
                    </p>
                    {method !== "rdd" && (
                        <div className="grid grid-cols-2 gap-2">
                            <FieldGroup label="Pre Start">
                                <Input type="date" value={preStart} onChange={e => setPreStart(e.target.value)} />
                            </FieldGroup>
                            <FieldGroup label="Pre End">
                                <Input type="date" value={preEnd} onChange={e => setPreEnd(e.target.value)} />
                            </FieldGroup>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                        <FieldGroup label="Post Start">
                            <Input type="date" value={postStart} onChange={e => setPostStart(e.target.value)} />
                        </FieldGroup>
                        <FieldGroup label="Post End">
                            <Input type="date" value={postEnd} onChange={e => setPostEnd(e.target.value)} />
                        </FieldGroup>
                    </div>
                </div>
            )}

            {/* PSM-specific */}
            {method === "psm" && (
                <>
                    <FieldGroup label="Matching Method">
                        <Select value={matchingMethod} onValueChange={v => setMatchingMethod(v as typeof matchingMethod)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="nearest">Nearest Neighbor</SelectItem>
                                <SelectItem value="caliper">Caliper</SelectItem>
                                <SelectItem value="kernel">Kernel</SelectItem>
                            </SelectContent>
                        </Select>
                    </FieldGroup>
                    {matchingMethod === "caliper" && (
                        <FieldGroup label="Caliper Width">
                            <Input
                                type="number" step={0.05} min={0.01} max={1}
                                value={caliperWidth}
                                onChange={e => setCaliperWidth(Number(e.target.value))}
                            />
                        </FieldGroup>
                    )}
                </>
            )}

            {/* CausalImpact-specific */}
            {method === "causal_impact" && (
                <>
                    <FieldGroup label="Aggregation">
                        <Select value={aggregation} onValueChange={v => setAggregation(v as typeof aggregation)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="mean">Mean</SelectItem>
                                <SelectItem value="sum">Sum</SelectItem>
                            </SelectContent>
                        </Select>
                    </FieldGroup>
                    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                        <input
                            type="checkbox"
                            checked={useControlAsCovariate}
                            onChange={e => setUseControlAsCovariate(e.target.checked)}
                            className="rounded border-border"
                        />
                        Use control as covariate
                    </label>
                </>
            )}

            {/* HTE-specific */}
            {method === "hte" && (
                <FieldGroup label="Segment Columns">
                    <div className="space-y-1.5">
                        <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                            {segmentColumns.map(col => (
                                <Badge
                                    key={col}
                                    variant="secondary"
                                    className="cursor-pointer text-[11px]"
                                    onClick={() => setSegmentColumns(prev => prev.filter(c => c !== col))}
                                >
                                    {col} x
                                </Badge>
                            ))}
                        </div>
                        <Select
                            value=""
                            onValueChange={v => {
                                if (v && !segmentColumns.includes(v)) {
                                    setSegmentColumns(prev => [...prev, v])
                                }
                            }}
                        >
                            <SelectTrigger><SelectValue placeholder="Add column..." /></SelectTrigger>
                            <SelectContent>
                                {columns
                                    .filter(c => !segmentColumns.includes(c))
                                    .map(c => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>
                    </div>
                </FieldGroup>
            )}

            {/* SyntheticControl-specific */}
            {method === "synthetic_control" && (
                <>
                    <FieldGroup label="Unit Column">
                        <Select value={unitColumn} onValueChange={setUnitColumn}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {columns.map(c => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FieldGroup>
                    <FieldGroup label="Treated Unit">
                        <Input
                            placeholder="e.g. bangalore"
                            value={treatedUnit}
                            onChange={e => setTreatedUnit(e.target.value)}
                        />
                    </FieldGroup>
                    <FieldGroup label="Intervention Date">
                        <Input type="date" value={interventionDate} onChange={e => setInterventionDate(e.target.value)} />
                    </FieldGroup>
                    <FieldGroup label="Aggregation">
                        <Select value={scAggregation} onValueChange={v => setScAggregation(v as typeof scAggregation)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="mean">Mean</SelectItem>
                                <SelectItem value="sum">Sum</SelectItem>
                            </SelectContent>
                        </Select>
                    </FieldGroup>
                </>
            )}

            {/* RDD-specific */}
            {method === "rdd" && (
                <>
                    <FieldGroup label="Running Variable">
                        <Select value={runningVariable} onValueChange={setRunningVariable}>
                            <SelectTrigger><SelectValue placeholder="Select variable" /></SelectTrigger>
                            <SelectContent>
                                {metrics.map(m => (
                                    <SelectItem key={m} value={m}>{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FieldGroup>
                    <FieldGroup label="Cutoff Value">
                        <Input
                            type="number"
                            value={cutoffValue}
                            onChange={e => setCutoffValue(Number(e.target.value))}
                        />
                    </FieldGroup>
                    <FieldGroup label="Kernel">
                        <Select value={kernel} onValueChange={v => setKernel(v as typeof kernel)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="triangular">Triangular</SelectItem>
                                <SelectItem value="epanechnikov">Epanechnikov</SelectItem>
                                <SelectItem value="uniform">Uniform</SelectItem>
                            </SelectContent>
                        </Select>
                    </FieldGroup>
                </>
            )}

            {/* Cohort info */}
            {method !== "synthetic_control" && method !== "rdd" && cohorts.length >= 2 && (
                <div className="text-xs text-muted-foreground border-t border-border pt-3">
                    <span className="font-medium">Cohorts:</span> test={testCohort}, control={controlCohort}
                </div>
            )}

            <Button
                className="w-full"
                onClick={handleRun}
                disabled={loading || !canRun}
            >
                {loading ? "Running..." : "Run Analysis"}
            </Button>
        </div>
    )
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{label}</label>
            {children}
        </div>
    )
}
