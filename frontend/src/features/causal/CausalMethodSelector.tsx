import { type CausalMethod, type MethodRecommendation } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

const METHOD_INFO: Record<CausalMethod, { label: string; description: string }> = {
    psm: {
        label: "Propensity Score Matching",
        description: "Fix selection bias in non-random experiments",
    },
    causal_impact: {
        label: "CausalImpact",
        description: "Pre/post analysis without a control group",
    },
    hte: {
        label: "Treatment Heterogeneity",
        description: "Which captain segments benefit most?",
    },
    synthetic_control: {
        label: "Synthetic Control",
        description: "City-level pilots with synthetic counterfactual",
    },
    rdd: {
        label: "Regression Discontinuity",
        description: "Threshold-based treatment assignment",
    },
}

const METHOD_ORDER: CausalMethod[] = ["psm", "causal_impact", "hte", "synthetic_control", "rdd"]

type Props = {
    recommendations: MethodRecommendation[]
    selectedMethod: CausalMethod | null
    onSelect: (method: CausalMethod) => void
    loading: boolean
}

export function CausalMethodSelector({ recommendations, selectedMethod, onSelect, loading }: Props) {
    const recMap = Object.fromEntries(recommendations.map(r => [r.method, r]))

    return (
        <div className="p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">Methods</p>
            {METHOD_ORDER.map(method => {
                const info = METHOD_INFO[method]
                const rec = recMap[method]
                const isSelected = selectedMethod === method
                const feasible = rec?.feasible ?? false
                const recommended = rec?.recommended ?? false

                return (
                    <button
                        key={method}
                        onClick={() => onSelect(method)}
                        disabled={loading}
                        className={cn(
                            "w-full text-left p-3 rounded-lg border transition-colors",
                            isSelected
                                ? "border-primary bg-primary/5"
                                : feasible
                                    ? "border-border hover:border-primary/50 hover:bg-accent/50"
                                    : "border-border/50 opacity-50 cursor-not-allowed",
                        )}
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-foreground truncate">{info.label}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">{info.description}</div>
                            </div>
                            {recommended && <Badge variant="outline" className="text-[10px] shrink-0 border-emerald-500/50 text-emerald-400">Recommended</Badge>}
                            {!feasible && rec && <Badge variant="outline" className="text-[10px] shrink-0 border-amber-500/50 text-amber-400">Needs data</Badge>}
                        </div>
                        {rec && (
                            <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">{rec.reason}</p>
                        )}
                    </button>
                )
            })}
        </div>
    )
}
