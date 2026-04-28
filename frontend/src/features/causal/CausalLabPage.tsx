import { useState, useEffect } from "react"
import { PrimarySidebar } from "@/components/nav/PrimarySidebar"
import { getCausalRecommendations, getSessionId, getMeta, type CausalMethod, type MethodRecommendation } from "@/lib/api"
import { CausalMethodSelector } from "./CausalMethodSelector"

type SessionMeta = {
    columns: string[]
    metrics: string[]
    cohorts: string[]
    date_min?: string
    date_max?: string
}

export function CausalLabPage() {
    const [selectedMethod, setSelectedMethod] = useState<CausalMethod | null>(null)
    const [recommendations, setRecommendations] = useState<MethodRecommendation[]>([])
    const [sessionMeta, setSessionMeta] = useState<SessionMeta | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const sessionId = getSessionId()

    useEffect(() => {
        if (!sessionId) return
        setLoading(true)
        Promise.all([
            getMeta().catch(() => null),
            getCausalRecommendations().catch(() => ({ recommendations: [] })),
        ]).then(([meta, recs]) => {
            if (meta) {
                setSessionMeta({
                    columns: meta.categorical_columns || [],
                    metrics: meta.metrics || [],
                    cohorts: meta.cohorts || [],
                    date_min: meta.date_min,
                    date_max: meta.date_max,
                })
            }
            setRecommendations(recs.recommendations)
        }).catch(err => setError(err.message))
        .finally(() => setLoading(false))
    }, [sessionId])

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
            </div>
        </div>
    )
}
