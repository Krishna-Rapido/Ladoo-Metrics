import { CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface GateResult {
  gate: string
  passed: boolean
  value: number | null
  threshold: number | null
  detail: string
}

interface ValidationResultBlockProps {
  segmentName: string
  segmentSize: number
  populationSize: number
  populationPct: number
  gates: GateResult[]
  gatesPassed: number
  totalGates: number
  readyToPublish: boolean
}

export function ValidationResultBlock({
  segmentName,
  segmentSize,
  populationSize,
  populationPct,
  gates,
  gatesPassed,
  totalGates,
  readyToPublish,
}: ValidationResultBlockProps) {
  return (
    <div className="my-2 rounded-lg border border-amber-200 bg-amber-50/50">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-amber-200 px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">
          Validation
        </span>
        <span className="text-xs font-medium text-slate-700">{segmentName}</span>
        <span className="text-xs text-slate-500">
          {segmentSize.toLocaleString()} / {populationSize.toLocaleString()} captains ({populationPct.toFixed(1)}%)
        </span>
        <span
          className={cn(
            "ml-auto rounded-full px-2 py-0.5 text-xs font-medium",
            readyToPublish
              ? "bg-emerald-100 text-emerald-700"
              : "bg-red-100 text-red-700",
          )}
        >
          {gatesPassed}/{totalGates} gates passed
        </span>
      </div>

      {/* Gates strip */}
      <div className="flex flex-wrap gap-2 p-3">
        {gates.map((g) => (
          <div
            key={g.gate}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-3 py-1.5",
              g.passed
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700",
            )}
          >
            {g.passed ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <XCircle className="h-3.5 w-3.5" />
            )}
            <span className="text-xs font-medium capitalize">{g.gate.replace(/_/g, " ")}</span>
            {g.value !== null && (
              <span className="text-xs opacity-70">
                ({g.value.toFixed(2)}{g.threshold !== null ? ` / ${g.threshold}` : ""})
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
