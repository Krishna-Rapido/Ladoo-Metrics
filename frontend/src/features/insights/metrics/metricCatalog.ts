import type { InsightMetric, MetricKey, RatioSpec } from "../types"

function ratioKey(x: string, y: string) {
  return `${x}2${y}` as const
}

function makeRatioSpec(x: string, y: string): RatioSpec {
  // IMPORTANT: x2y means y/x
  return { numeratorCol: x, denominatorCol: y }
}

// Derived ratio metrics (optional); x2y means y/x computed as ratio-of-sums.
export const ladooDerivedRatioMetrics: InsightMetric[] = [
  { key: ratioKey("ao_days", "online_days"), label: "ao_days2online_days", type: "ratio", ratio: makeRatioSpec("ao_days", "online_days") },
  { key: ratioKey("ao_days", "gross_days"), label: "ao_days2gross_days", type: "ratio", ratio: makeRatioSpec("ao_days", "gross_days") },
  { key: ratioKey("ao_days", "accepted_days"), label: "ao_days2accepted_days", type: "ratio", ratio: makeRatioSpec("ao_days", "accepted_days") },
  { key: ratioKey("ao_days", "net_days"), label: "ao_days2net_days", type: "ratio", ratio: makeRatioSpec("ao_days", "net_days") },
  { key: ratioKey("online_days", "gross_days"), label: "online_days2gross_days", type: "ratio", ratio: makeRatioSpec("online_days", "gross_days") },
  { key: ratioKey("online_days", "accepted_days"), label: "online_days2accepted_days", type: "ratio", ratio: makeRatioSpec("online_days", "accepted_days") },
  { key: ratioKey("online_days", "net_days"), label: "online_days2net_days", type: "ratio", ratio: makeRatioSpec("online_days", "net_days") },
  { key: ratioKey("gross_days", "accepted_days"), label: "gross_days2accepted_days", type: "ratio", ratio: makeRatioSpec("gross_days", "accepted_days") },
  { key: ratioKey("gross_days", "net_days"), label: "gross_days2net_days", type: "ratio", ratio: makeRatioSpec("gross_days", "net_days") },
  { key: ratioKey("accepted_days", "net_days"), label: "accepted_days2net_days", type: "ratio", ratio: makeRatioSpec("accepted_days", "net_days") },
]

export const ladooDerivedRatioByKey: Record<MetricKey, InsightMetric> = Object.fromEntries(
  ladooDerivedRatioMetrics.map((m) => [m.key, m])
)

