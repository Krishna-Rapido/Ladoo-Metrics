import { Users, Zap } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { formatNumber } from "../analysis/formatters"

export type StatCardsProps = {
  totalParticipants: number | null
  pValue: number | null
}

export function StatCards({ totalParticipants, pValue }: StatCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Users className="h-4 w-4 text-emerald-950" />
            Population Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Total Participants</div>
            <div className="text-2xl font-semibold tabular-nums">
              {totalParticipants == null ? "—" : formatNumber(totalParticipants)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base font-semibold">
            <span className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-950" />
              Statistical Significance
            </span>
            <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold tracking-widest text-emerald-800 hover:bg-emerald-100">
              {pValue == null ? "—" : "P-VALUE"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="text-xs font-semibold tracking-widest text-muted-foreground">P-VALUE</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {pValue == null ? "—" : String(pValue)}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

