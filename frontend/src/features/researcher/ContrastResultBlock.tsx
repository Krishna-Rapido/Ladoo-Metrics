import { Users, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface FeatureComparison {
  feature: string
  group_a_mean: number
  group_b_mean: number
  effect_size: number
  p_value: number
  significant: boolean
}

interface ContrastResultBlockProps {
  groupALabel: string
  groupBLabel: string
  groupASize: number
  groupBSize: number
  comparisons: FeatureComparison[]
  topFeatures: string[]
  totalFeaturesCompared: number
}

export function ContrastResultBlock({
  groupALabel,
  groupBLabel,
  groupASize,
  groupBSize,
  comparisons,
  topFeatures,
  totalFeaturesCompared,
}: ContrastResultBlockProps) {
  return (
    <div className="my-2 rounded-lg border border-violet-200 bg-violet-50/50">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-violet-200 px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-violet-600">
          Contrast Analysis
        </span>
        <div className="flex items-center gap-3 text-xs text-slate-600">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {groupALabel}: {groupASize.toLocaleString()}
          </span>
          <span className="text-slate-300">vs</span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {groupBLabel}: {groupBSize.toLocaleString()}
          </span>
        </div>
        <span className="ml-auto text-xs text-slate-400">
          {totalFeaturesCompared} features compared
        </span>
      </div>

      {/* Top features */}
      {topFeatures.length > 0 && (
        <div className="border-b border-violet-100 px-4 py-2">
          <div className="mb-1 text-xs font-medium text-slate-500">
            Top differentiating features:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {topFeatures.slice(0, 5).map((f) => (
              <span
                key={f}
                className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Comparisons table */}
      {comparisons.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-violet-100 text-slate-500">
                <th className="px-4 py-1.5 text-left font-medium">Feature</th>
                <th className="px-3 py-1.5 text-right font-medium">{groupALabel}</th>
                <th className="px-3 py-1.5 text-right font-medium">{groupBLabel}</th>
                <th className="px-3 py-1.5 text-right font-medium">Effect Size</th>
                <th className="px-3 py-1.5 text-right font-medium">p-value</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((c) => (
                <tr
                  key={c.feature}
                  className={cn(
                    "border-b border-violet-50",
                    c.significant && "bg-violet-50/50"
                  )}
                >
                  <td className="px-4 py-1.5 font-medium text-slate-700">
                    {c.feature}
                    {c.significant && (
                      <TrendingUp className="ml-1 inline h-3 w-3 text-violet-500" />
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right text-slate-600">
                    {c.group_a_mean.toFixed(3)}
                  </td>
                  <td className="px-3 py-1.5 text-right text-slate-600">
                    {c.group_b_mean.toFixed(3)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-slate-700">
                    {c.effect_size.toFixed(3)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-slate-500">
                    {c.p_value < 0.001 ? "<.001" : c.p_value.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
