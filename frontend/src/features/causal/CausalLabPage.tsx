import { useState, useEffect } from "react"
import { PrimarySidebar } from "@/components/nav/PrimarySidebar"
import {
    getCausalRecommendations, getSessionId, getMeta,
    runPSM, runCausalImpact, runHTE, runSyntheticControl, runRDD,
    type CausalMethod, type MethodRecommendation,
} from "@/lib/api"
import { CausalMethodSelector } from "./CausalMethodSelector"
import { CausalConfigPanel } from "./CausalConfigPanel"
import { CausalResultsView } from "./CausalResultsView"

type SessionMeta = {
    columns: string[]
    metrics: string[]
    cohorts: string[]
    date_min?: string
    date_max?: string
}

const API_FNS: Record<CausalMethod, (config: Record<string, unknown>) => Promise<unknown>> = {
    psm: (c) => runPSM(c as Parameters<typeof runPSM>[0]),
    causal_impact: (c) => runCausalImpact(c as Parameters<typeof runCausalImpact>[0]),
    hte: (c) => runHTE(c as Parameters<typeof runHTE>[0]),
    synthetic_control: (c) => runSyntheticControl(c as Parameters<typeof runSyntheticControl>[0]),
    rdd: (c) => runRDD(c as Parameters<typeof runRDD>[0]),
}

export function CausalLabPage() {
    const [selectedMethod, setSelectedMethod] = useState<CausalMethod | null>(null)
    const [recommendations, setRecommendations] = useState<MethodRecommendation[]>([])
    const [sessionMeta, setSessionMeta] = useState<SessionMeta | null>(null)
    const [loading, setLoading] = useState(false)
    const [analysisLoading, setAnalysisLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [results, setResults] = useState<Record<string, unknown>>({})

    const sessionId = getSessionId()

    useEffect(() => {
        if (!sessionId) return
        setLoading(true)
        getMeta()
            .then((meta) => {
                const sm: SessionMeta = {
                    columns: meta.categorical_columns || [],
                    metrics: meta.metrics || [],
                    cohorts: meta.cohorts || [],
                    date_min: meta.date_min,
                    date_max: meta.date_max,
                }
                setSessionMeta(sm)

                // Pass cohort names for better recommendations
                const testCohort = sm.cohorts.find(c => c.toLowerCase().includes("test")) ?? sm.cohorts[0]
                const controlCohort = sm.cohorts.find(c => c.toLowerCase().includes("control")) ?? sm.cohorts[1]
                return getCausalRecommendations(testCohort, controlCohort)
            })
            .then((recs) => {
                setRecommendations(recs.recommendations)
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false))
    }, [sessionId])

    async function handleRun(method: CausalMethod, config: Record<string, unknown>) {
        setError(null)
        setAnalysisLoading(true)
        try {
            const fn = API_FNS[method]
            const result = await fn(config)
            setResults(prev => ({ ...prev, [method]: result }))
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            setError(msg)
        } finally {
            setAnalysisLoading(false)
        }
    }

    const currentResult = selectedMethod ? results[selectedMethod] : undefined

    return (
        <div className="flex h-screen bg-background">
            <PrimarySidebar activeOverride="causal" />

            <div className="w-80 border-r border-border bg-card flex flex-col overflow-y-auto">
                <div className="p-4 border-b border-border">
                    <h2 className="text-lg font-semibold text-foreground">Causal Inference Lab</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        {sessionId
                            ? `Session loaded${sessionMeta ? ` · ${sessionMeta.cohorts.length} cohort(s)` : ""}`
                            : "Upload data in Insights first"}
                    </p>
                </div>

                <CausalMethodSelector
                    recommendations={recommendations}
                    selectedMethod={selectedMethod}
                    onSelect={setSelectedMethod}
                    loading={loading}
                />

                {/* Config panel below method selector */}
                {selectedMethod && sessionMeta && (
                    <div className="p-3 border-t border-border">
                        <CausalConfigPanel
                            method={selectedMethod}
                            sessionMeta={sessionMeta}
                            onRun={handleRun}
                            loading={analysisLoading}
                        />
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {error && (
                    <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg mb-4">
                        {error}
                    </div>
                )}

                {!sessionId && (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">
                            <p className="text-lg">No session data loaded</p>
                            <p className="text-sm mt-2">Upload a CSV in Insights, then come back here to run causal analysis.</p>
                        </div>
                    </div>
                )}

                {sessionId && !selectedMethod && (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        <p className="text-lg">Select a causal method from the sidebar</p>
                    </div>
                )}

                {sessionId && selectedMethod && !currentResult && !analysisLoading && (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">
                            <p className="text-lg">Configure and run your analysis</p>
                            <p className="text-sm mt-2">Set parameters in the sidebar, then click "Run Analysis"</p>
                        </div>
                    </div>
                )}

                {selectedMethod && (currentResult || analysisLoading) && (
                    <CausalResultsView
                        method={selectedMethod}
                        results={currentResult}
                        loading={analysisLoading}
                    />
                )}
            </div>
        </div>
    )
}
