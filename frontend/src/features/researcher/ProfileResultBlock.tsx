interface AxisStats {
  mean: number
  median: number
  std: number
  min: number
  max: number
  count: number
}

interface ProfileResultBlockProps {
  captainCount: number
  axisStats: Record<string, AxisStats>
}

export function ProfileResultBlock({ captainCount, axisStats }: ProfileResultBlockProps) {
  const axes = Object.entries(axisStats)

  return (
    <div className="my-2 rounded-lg border border-emerald-200 bg-emerald-50/50">
      <div className="flex items-center gap-3 border-b border-emerald-200 px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
          Response Profiles
        </span>
        <span className="text-xs text-slate-500">
          {captainCount.toLocaleString()} captains profiled
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
        {axes.map(([axis, stats]) => (
          <div
            key={axis}
            className="rounded-md border border-emerald-100 bg-white px-3 py-2"
          >
            <div className="mb-1 text-xs font-medium text-slate-700">
              {formatAxisName(axis)}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-slate-900">
                {stats.median.toFixed(3)}
              </span>
              <span className="text-xs text-slate-400">median</span>
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              mean {stats.mean.toFixed(3)} | std {stats.std.toFixed(3)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatAxisName(axis: string): string {
  return axis.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}
