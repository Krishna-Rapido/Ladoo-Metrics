import type { ToolCall, ToolResult } from "./useResearcherChat"
import { SqlBlock } from "./SqlBlock"
import { DataTableBlock } from "./DataTableBlock"
import { ContrastResultBlock } from "./ContrastResultBlock"
import { ProfileResultBlock } from "./ProfileResultBlock"
import { ValidationResultBlock } from "./ValidationResultBlock"
import { Loader2 } from "lucide-react"

interface ToolResultBlockProps {
  toolCall: ToolCall
  toolResult?: ToolResult
}

export function ToolResultBlock({ toolCall, toolResult }: ToolResultBlockProps) {
  const result = toolResult?.result

  // Show loading state if no result yet
  if (!result) {
    return (
      <div className="my-2 flex items-center gap-2 rounded-lg border bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Running {formatToolName(toolCall.name)}...
      </div>
    )
  }

  // Error case — truncated
  if (result.error) {
    return (
      <div className="my-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
        <span className="font-medium">{formatToolName(toolCall.name)}</span>: {truncateError(result.error)}
      </div>
    )
  }

  switch (toolCall.name) {
    case "run_presto_query":
      return (
        <>
          {toolCall.arguments.sql && (
            <SqlBlock
              sql={String(toolCall.arguments.sql)}
              description={toolCall.arguments.description as string | undefined}
            />
          )}
          {result.columns && result.rows && (
            <DataTableBlock
              columns={result.columns as string[]}
              rows={result.rows as Record<string, unknown>[]}
              totalRows={result.total_rows as number}
              truncated={result.truncated as boolean}
            />
          )}
        </>
      )

    case "run_contrast_analysis":
      return (
        <>
          {result.queries && (result.queries as string[]).length > 0 && (
            <SqlBlock sql={(result.queries as string[]).join("\n\n---\n\n")} description="Contrast analysis queries" />
          )}
          <ContrastResultBlock
            groupALabel={result.group_a_label as string}
            groupBLabel={result.group_b_label as string}
            groupASize={result.group_a_size as number}
            groupBSize={result.group_b_size as number}
            comparisons={result.comparisons as Array<{
              feature: string
              group_a_mean: number
              group_b_mean: number
              effect_size: number
              p_value: number
              significant: boolean
            }>}
            topFeatures={result.top_features as string[]}
            totalFeaturesCompared={result.total_features_compared as number}
          />
        </>
      )

    case "compute_response_profiles":
      return (
        <>
          {result.queries && (result.queries as string[]).length > 0 && (
            <SqlBlock sql={(result.queries as string[]).join("\n\n---\n\n")} description="Response profile queries" />
          )}
          <ProfileResultBlock
            captainCount={result.captain_count as number}
            axisStats={result.axis_stats as Record<string, { mean: number; median: number; std: number; min: number; max: number; count: number }>}
          />
        </>
      )

    case "validate_segment":
      return (
        <ValidationResultBlock
          segmentName={result.segment_name as string}
          segmentSize={result.segment_size as number}
          populationSize={result.population_size as number}
          populationPct={result.population_pct as number}
          gates={result.gates as Array<{
            gate: string
            passed: boolean
            value: number | null
            threshold: number | null
            detail: string
          }>}
          gatesPassed={result.gates_passed as number}
          totalGates={result.total_gates as number}
          readyToPublish={result.ready_to_publish as boolean}
        />
      )

    case "summarize_dataframe":
      return (
        <div className="my-2 rounded-lg border bg-secondary/50 px-3 py-2 text-xs">
          <div className="mb-1 font-medium text-foreground/80">
            DataFrame Summary ({(result.shape as number[])?.[0]}x{(result.shape as number[])?.[1]})
          </div>
          <pre className="overflow-x-auto text-foreground/70">
            {JSON.stringify(result.summary, null, 2)}
          </pre>
        </div>
      )

    default:
      return (
        <div className="my-2 rounded-lg border bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium">{toolCall.name}</span>: completed
        </div>
      )
  }
}

function formatToolName(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function truncateError(error: unknown): string {
  const raw = String(error)

  // Extract the core message from Presto/Trino JSON-like error objects
  const msgMatch = raw.match(/'message':\s*'([^']+)'/)
  if (msgMatch) {
    const msg = msgMatch[1]
    const cleaned = msg.replace(/^line \d+:\d+:\s*/, "")
    return cleaned.length > 120 ? cleaned.slice(0, 120) + "..." : cleaned
  }

  // Fallback: truncate raw error, strip stack traces
  const firstLine = raw.split(/[\n{]/)[0].trim()
  const truncated = firstLine.length > 150 ? firstLine.slice(0, 150) + "..." : firstLine
  return truncated || raw.slice(0, 150) + "..."
}
