import { useEffect, useState } from "react"
import {
  Layers,
  Loader2,
  FlaskConical,
  GitCompare,
  Zap,
  Calendar,
  MapPin,
  Users,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { listSegments } from "@/lib/researcherApi"
import type { SegmentItem } from "@/lib/researcherApi"

export function SegmentCatalog() {
  const [segments, setSegments] = useState<SegmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    loadSegments()
  }, [])

  const loadSegments = async () => {
    setLoading(true)
    try {
      const data = await listSegments()
      setSegments(data)
    } catch (err) {
      // If table doesn't exist yet, show empty state
      setSegments([])
      if (err instanceof Error && !err.message.includes("PGRST")) {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (segments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Layers className="mb-4 h-12 w-12 text-slate-300" />
        <h2 className="text-lg font-semibold text-slate-700">
          No segments yet
        </h2>
        <p className="text-sm text-muted-foreground">
          Discover and validate segments using the Frame tab, then publish
          them here.
        </p>
        {error && (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        )}
      </div>
    )
  }

  const methodIcon = (method: string) => {
    switch (method) {
      case "contrast":
        return <GitCompare className="h-4 w-4 text-violet-600" />
      case "stimulus_response":
        return <Zap className="h-4 w-4 text-amber-500" />
      default:
        return <FlaskConical className="h-4 w-4 text-slate-500" />
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          Segment Catalog
        </h2>
        <span className="text-sm text-muted-foreground">
          {segments.length} segment{segments.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {segments.map((seg) => (
          <Card key={seg.id} className="transition-all hover:shadow-md">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  {methodIcon(seg.method)}
                  {seg.name}
                </CardTitle>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    seg.status === "published"
                      ? "bg-emerald-100 text-emerald-800"
                      : seg.status === "validated"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {seg.status}
                </span>
              </div>
              <CardDescription>{seg.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-xs text-muted-foreground">
                {/* Stats row */}
                <div className="flex items-center gap-4">
                  {seg.segment_size && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {seg.segment_size.toLocaleString()} captains
                    </span>
                  )}
                  {seg.population_pct && (
                    <span>{seg.population_pct}% of population</span>
                  )}
                </div>
                {/* Metadata row */}
                <div className="flex items-center gap-4">
                  {seg.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {seg.city}
                    </span>
                  )}
                  {seg.population_context && (
                    <span>{seg.population_context}</span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(seg.created_at).toLocaleDateString()}
                  </span>
                </div>
                {/* Actionability */}
                {seg.actionability_note && (
                  <div className="mt-2 rounded-md bg-violet-50 p-2 text-xs text-violet-800">
                    <strong>Action:</strong> {seg.actionability_note}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
