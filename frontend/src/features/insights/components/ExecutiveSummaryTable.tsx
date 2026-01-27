import { Download, MoreHorizontal } from "lucide-react"
import { useMemo, useRef, useState } from "react"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"
import { toPng } from "html-to-image"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import type { ExecutiveRow, InsightMetric } from "../types"
import type { ExecutiveSummaryBreakoutGroup } from "../analysis/computeExecutiveSummary"
import { formatByAgg, formatPercent, formatSignedDelta, aggLabel } from "../analysis/formatters"
import { useReport } from "@/contexts/ReportContext"

function deltaDecimals(agg: ExecutiveRow["agg"]) {
  if (agg === "ratio") return 4
  if (agg === "count" || agg === "count_distinct") return 0
  return 2
}

export type ExecutiveSummaryTableProps = {
  rows: ExecutiveRow[]
  groups?: ExecutiveSummaryBreakoutGroup[] | null
  metricsByKey: Record<string, InsightMetric>
  breakoutCol?: string
  onBreakoutColChange?: (col: string) => void
  breakoutOptions?: string[]
  onDownload?: () => void
}

function ExecTable({ rows, metricsByKey, columns }: { rows: ExecutiveRow[]; metricsByKey: Record<string, InsightMetric>; columns: ColumnDef<ExecutiveRow>[] }) {
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((hg) => (
          <TableRow key={hg.id} className="hover:bg-transparent">
            {hg.headers.map((h) => (
              <TableHead
                key={h.id}
                className={cn(
                  "text-xs font-semibold uppercase tracking-widest text-muted-foreground",
                  ["controlPre", "controlPost", "deltaControl", "testPre", "testPost", "deltaTest", "did", "liftPct"].includes(
                    String(h.column.id)
                  ) && "text-right"
                )}
              >
                {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((r) => (
          <TableRow key={r.id} className="hover:bg-muted/30">
            {r.getVisibleCells().map((c) => (
              <TableCell key={c.id} className="text-sm">
                {flexRender(c.column.columnDef.cell, c.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function ExecutiveSummaryTable({
  rows,
  groups,
  metricsByKey,
  breakoutCol,
  onBreakoutColChange,
  breakoutOptions,
  onDownload,
}: ExecutiveSummaryTableProps) {
  const { addItem } = useReport()
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const captureRef = useRef<HTMLDivElement | null>(null)

  const columns = useMemo<ColumnDef<ExecutiveRow>[]>(() => {
    return [
      {
        id: "metric",
        header: "METRIC",
        cell: ({ row }) => {
          const r = row.original
          const metric = metricsByKey[r.metricKey]
          return <span className="max-w-[260px] truncate font-semibold">{metric?.label ?? r.label}</span>
        },
      },
      {
        id: "agg",
        header: "AGG",
        cell: ({ row }) => {
          const r = row.original
          return <span className="text-xs text-muted-foreground">{aggLabel(r.agg)}</span>
        },
      },
      {
        accessorKey: "controlPre",
        header: "CONTROL (PRE)",
        cell: ({ row }) => (
          <span className="text-right tabular-nums text-muted-foreground block">
            {formatByAgg(row.original.agg, row.original.controlPre)}
          </span>
        ),
      },
      {
        accessorKey: "controlPost",
        header: "CONTROL (POST)",
        cell: ({ row }) => (
          <span className="text-right tabular-nums text-muted-foreground block">
            {formatByAgg(row.original.agg, row.original.controlPost)}
          </span>
        ),
      },
      {
        accessorKey: "deltaControl",
        header: "Δ CONTROL",
        cell: ({ row }) => {
          const r = row.original
          return (
            <span className="text-right tabular-nums font-medium block">
              {formatSignedDelta(r.deltaControl, { decimals: deltaDecimals(r.agg) })}
            </span>
          )
        },
      },
      {
        accessorKey: "testPre",
        header: "TEST (PRE)",
        cell: ({ row }) => (
          <span className="text-right tabular-nums text-muted-foreground block">
            {formatByAgg(row.original.agg, row.original.testPre)}
          </span>
        ),
      },
      {
        accessorKey: "testPost",
        header: "TEST (POST)",
        cell: ({ row }) => (
          <span className="text-right tabular-nums font-semibold text-emerald-900 block">
            {formatByAgg(row.original.agg, row.original.testPost)}
          </span>
        ),
      },
      {
        accessorKey: "deltaTest",
        header: "Δ TEST",
        cell: ({ row }) => {
          const r = row.original
          return (
            <span className="text-right tabular-nums font-medium block">
              {formatSignedDelta(r.deltaTest, { decimals: deltaDecimals(r.agg) })}
            </span>
          )
        },
      },
      {
        accessorKey: "did",
        header: "Δ (DID)",
        cell: ({ row }) => {
          const r = row.original
          return (
            <span
              className={cn(
                "text-right tabular-nums font-semibold block",
                (r.did ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"
              )}
            >
              {formatSignedDelta(r.did, { decimals: deltaDecimals(r.agg) })}
            </span>
          )
        },
      },
      {
        accessorKey: "liftPct",
        header: "LIFT (%)",
        cell: ({ row }) => {
          const r = row.original
          const liftPositive = (r.liftPct ?? 0) >= 0
          return (
            <span
              className={cn(
                "text-right tabular-nums font-semibold block",
                liftPositive ? "text-emerald-600" : "text-red-600"
              )}
            >
              {formatPercent(r.liftPct, { decimals: 2 })}
            </span>
          )
        },
      },
    ]
  }, [metricsByKey])

  const handleAddToReport = async () => {
    if (!captureRef.current) return
    setAdding(true)
    try {
      const dataUrl = await toPng(captureRef.current, {
        backgroundColor: "#ffffff",
        quality: 1.0,
        pixelRatio: 2,
      })

      const title = breakoutCol ? `Executive Summary: Pre vs Post (${breakoutCol})` : "Executive Summary: Pre vs Post"
      await addItem({
        type: "table",
        title,
        content: {
          imageDataUrl: dataUrl,
          breakoutCol: breakoutCol ?? "",
        },
        comment: "",
      })

      setAdded(true)
      setTimeout(() => setAdded(false), 2000)
    } finally {
      setAdding(false)
    }
  }

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground">[In 1]:</span>
          <CardTitle className="text-base font-semibold">Executive Summary: Pre vs Post</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={breakoutCol ?? ""}
            onChange={(e) => onBreakoutColChange?.(e.target.value)}
            disabled={!breakoutOptions?.length || !onBreakoutColChange}
            className="h-9 w-[220px] rounded-xl border border-border/60 bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">None</option>
            {(breakoutOptions ?? []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <Button
            variant="outline"
            className="h-9 rounded-xl"
            onClick={handleAddToReport}
            disabled={adding}
          >
            {added ? "Added" : adding ? "Adding…" : "Add to Report"}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onDownload}
            disabled={!onDownload}
          >
            <Download className="h-4 w-4" />
            <span className="sr-only">Download</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">More</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div ref={captureRef}>
          {!groups?.length || !breakoutCol ? (
            <ExecTable rows={rows} metricsByKey={metricsByKey} columns={columns} />
          ) : (
            <div className="space-y-8">
              {groups.map((g) => (
                <div key={g.value} className="space-y-3">
                  <div className="text-sm font-semibold text-foreground">{g.value}</div>
                  <div className="rounded-xl border border-border/60">
                    <ExecTable rows={g.rows} metricsByKey={metricsByKey} columns={columns} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

