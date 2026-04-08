import { useState } from "react"
import {
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  Loader2,
  Send,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createSegment } from "@/lib/researcherApi"
import type { ValidateSegmentResponse } from "@/lib/researcherApi"
import type { ResearcherConfig } from "./ResearcherShell"

type Props = {
  config: ResearcherConfig | null
  validationResult: ValidateSegmentResponse | null
}

export function ValidateStep({ config, validationResult }: Props) {
  const [actionabilityNote, setActionabilityNote] = useState("")
  const [description, setDescription] = useState("")
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)

  if (!validationResult) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Shield className="mb-4 h-12 w-12 text-slate-300" />
        <h2 className="text-lg font-semibold text-slate-700">
          No validation yet
        </h2>
        <p className="text-sm text-muted-foreground">
          Run an analysis and define a segment to validate it.
        </p>
      </div>
    )
  }

  const { gates, segment_name, segment_size, population_size, population_pct } =
    validationResult

  const handlePublish = async () => {
    if (!config) return
    setPublishing(true)
    try {
      await createSegment({
        name: segment_name,
        description: description || `Discovered via ${config.method} analysis`,
        definition: JSON.stringify(validationResult),
        method: config.method,
        city: config.city,
        population_context: [
          config.consistency_segment,
          config.performance_segment,
        ]
          .filter(Boolean)
          .join(" + ") || "All captains",
        validation: { gates },
        segment_size,
        population_pct,
        key_features: [],
        actionability_note: actionabilityNote,
      })
      setPublished(true)
    } finally {
      setPublishing(false)
    }
  }

  const allGatesPassed = gates.every((g) => g.passed)

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {segment_name}
              </h2>
              <p className="text-sm text-muted-foreground">
                {segment_size.toLocaleString()} captains ({population_pct}% of{" "}
                {population_size.toLocaleString()})
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                {validationResult.gates_passed}/{validationResult.total_gates}{" "}
                gates passed
              </span>
              {allGatesPassed ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              ) : (
                <Clock className="h-6 w-6 text-amber-500" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gate cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {gates.map((gate) => (
          <GateCard key={gate.gate} gate={gate} />
        ))}
      </div>

      {/* Actionability input (Gate 6) */}
      {!gates.find((g) => g.gate === "actionability")?.passed && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Gate 6: Actionability (Your Input)
            </CardTitle>
            <CardDescription>
              What would you do differently for this segment? This is the most
              important gate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="For this segment, we would... (e.g. 'Stop offering per-ride bonuses — they'll just hit target faster and log off. Use time-locked bonuses instead.')"
              value={actionabilityNote}
              onChange={(e) => setActionabilityNote(e.target.value)}
              rows={3}
            />
          </CardContent>
        </Card>
      )}

      {/* Publish */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Publish to Segment Catalog</CardTitle>
          <CardDescription>
            Once validated, publish this segment so the team can use it in
            experiments and analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              placeholder="Brief description of what this segment represents and how it was discovered..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {published ? (
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">
                Segment published to catalog!
              </span>
            </div>
          ) : (
            <Button
              onClick={handlePublish}
              disabled={publishing || !description}
              className="gap-2"
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Publish Segment
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function GateCard({ gate }: { gate: { gate: string; passed: boolean; value: number | null; threshold: number | null; detail: string } }) {
  const gateLabels: Record<string, string> = {
    size: "1. Size",
    separation: "2. Separation",
    stability: "3. Stability",
    orthogonality: "4. Orthogonality",
    predictive_lift: "5. Predictive Lift",
    actionability: "6. Actionability",
  }

  const gateDescriptions: Record<string, string> = {
    size: "> 5% of population",
    separation: "Cohen's d > 0.3 on 2+ KPIs",
    stability: "Consistent membership over time",
    orthogonality: "Cuts across existing segments",
    predictive_lift: "Improves outcome prediction",
    actionability: "Implies a different intervention",
  }

  return (
    <Card
      className={
        gate.passed
          ? "border-emerald-200 bg-emerald-50/30"
          : "border-amber-200 bg-amber-50/30"
      }
    >
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              {gate.passed ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <XCircle className="h-4 w-4 text-amber-600" />
              )}
              <span className="font-semibold text-sm">
                {gateLabels[gate.gate] || gate.gate}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {gateDescriptions[gate.gate] || ""}
            </p>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              gate.passed
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {gate.passed ? "PASS" : "FAIL"}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-700">{gate.detail}</p>
        {gate.value !== null && gate.threshold !== null && (
          <p className="mt-1 text-xs text-muted-foreground">
            Value: {gate.value} (threshold: {gate.threshold})
          </p>
        )}
      </CardContent>
    </Card>
  )
}
