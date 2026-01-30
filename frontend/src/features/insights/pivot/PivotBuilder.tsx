import { useEffect, useMemo, useRef, useState } from "react"
import { Download } from "lucide-react"
import { toPng } from "html-to-image"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import type { DragEndEvent } from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import type {
  PivotAggFn,
  PivotFilterRule,
  PivotResult,
  PivotValueSpec,
  RawRow,
} from "../types"
import { buildPivot, exportPivotToCsv } from "./pivotEngine"
import { useReport } from "@/contexts/ReportContext"
import { fetchPivot } from "@/lib/api"

const ZONES = ["filters", "rows", "cols", "values"] as const
type ZoneId = (typeof ZONES)[number]

function zoneLabel(z: ZoneId) {
  switch (z) {
    case "filters":
      return "Filters"
    case "rows":
      return "Rows"
    case "cols":
      return "Columns"
    case "values":
      return "Values"
  }
}

function parseCsvPrimitive(s: string): string | number {
  const n = Number(s)
  if (!Number.isNaN(n) && s.trim() !== "") return n
  return s
}

function formatCell(v: any): string {
  if (v == null) return "—"
  if (typeof v === "number" && Number.isFinite(v)) {
    // keep pivots readable; 4dp max
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 4 }).format(v)
  }
  return String(v)
}

function DraggableField({ field }: { field: string }) {
  const id = `field:${field}`
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border border-border/60 px-3 py-2 text-sm bg-background",
        "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-60"
      )}
      {...listeners}
      {...attributes}
    >
      <span className="font-medium">{field}</span>
      <span className="ml-2 text-xs text-muted-foreground">drag</span>
    </div>
  )
}

function SelectableField({
  field,
  onAdd,
}: {
  field: string
  onAdd: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <DraggableField field={field} />
      <button
        type="button"
        className="h-9 w-9 shrink-0 rounded-lg border border-border/60 bg-background text-sm font-semibold shadow-sm hover:bg-muted/30"
        onPointerDown={(e) => {
          // prevent dnd-kit from treating this as a drag start
          e.preventDefault()
          e.stopPropagation()
        }}
        onClick={(e) => {
          e.stopPropagation()
          onAdd()
        }}
        aria-label="Add field"
        title="Add to selected zone"
      >
        +
      </button>
    </div>
  )
}

function SortableChip({
  id,
  label,
  onRemove,
}: {
  id: string
  label: string
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-60")} {...attributes} {...listeners}>
      <Badge className="rounded-xl bg-muted px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted">
        <span className="max-w-[160px] truncate">{label}</span>
        <button
          type="button"
          onPointerDown={(e) => {
            // Prevent dnd-kit PointerSensor from starting a drag on remove click
            e.preventDefault()
            e.stopPropagation()
          }}
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-2 text-muted-foreground hover:text-foreground"
          aria-label="Remove"
        >
          ×
        </button>
      </Badge>
    </div>
  )
}

function ZoneCard({
  zoneId,
  title,
  items,
  onRemoveItem,
  active,
  onActivate,
  allFields,
  onAddField,
}: {
  zoneId: ZoneId
  title: string
  items: Array<{ id: string; label: string }>
  onRemoveItem: (id: string) => void
  active: boolean
  onActivate: () => void
  allFields: string[]
  onAddField: (field: string) => void
}) {
  const droppableId = `zone:${zoneId}`
  const { setNodeRef, isOver } = useDroppable({ id: droppableId })

  const used = useMemo(() => new Set(items.map((i) => i.label)), [items])

  return (
    <div
      ref={setNodeRef}
      onClick={onActivate}
      className={cn(
        "rounded-xl border border-border/60 p-3",
        isOver && "ring-2 ring-ring/50",
        active && "ring-2 ring-ring/40"
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-xs font-semibold tracking-widest text-muted-foreground">{title}</div>
          {active ? <span className="text-[11px] text-foreground/70">(selected)</span> : null}
        </div>
        <div className="text-xs text-muted-foreground">{items.length}</div>
      </div>
      <div className="mb-2">
        <select
          value=""
          onChange={(e) => {
            const v = e.target.value
            if (!v) return
            onAddField(v)
          }}
          className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Add field…</option>
          {allFields.map((f) => (
            <option key={f} value={f} disabled={used.has(f)}>
              {used.has(f) ? `${f} (added)` : f}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.length === 0 ? (
          <div className="text-xs text-muted-foreground">Drag fields here</div>
        ) : null}
        <SortableContext items={items.map((i) => i.id)}>
          {items.map((i) => (
            <SortableChip key={i.id} id={i.id} label={i.label} onRemove={() => onRemoveItem(i.id)} />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}

export type PivotBuilderProps = {
  rows: RawRow[]
  columns: string[]
  /** When set and rows are empty, pivot is computed via backend (DuckDB). */
  sessionId?: string | null
}

export function PivotBuilder({ rows, columns, sessionId }: PivotBuilderProps) {
  const { addItem } = useReport()
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const pivotResultRef = useRef<HTMLDivElement | null>(null)
  const useBackendPivot = Boolean(sessionId && rows.length === 0)
  const [backendPivotResult, setBackendPivotResult] = useState<PivotResult | null>(null)
  const [pivotLoading, setPivotLoading] = useState(false)
  const [pivotError, setPivotError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const [rowFields, setRowFields] = useState<string[]>(["cohort"])
  const [colFields, setColFields] = useState<string[]>([])
  const [values, setValues] = useState<PivotValueSpec[]>([{ col: "ao_days", agg: "sum" }])
  const [filters, setFilters] = useState<Array<{ column: string; operator: PivotFilterRule["operator"]; value: any }>>(
    []
  )
  const [activeZone, setActiveZone] = useState<ZoneId>("rows")

  const allFields = useMemo(() => {
    const base = Array.from(new Set(columns.concat(["cohort", "time", "captain_id"])))
    return base.sort((a, b) => a.localeCompare(b))
  }, [columns])

  const addToZone = (zone: ZoneId, field: string) => {
    if (zone === "rows") setRowFields((prev) => (prev.includes(field) ? prev : [...prev, field]))
    if (zone === "cols") setColFields((prev) => (prev.includes(field) ? prev : [...prev, field]))
    if (zone === "values") setValues((prev) => (prev.some((v) => v.col === field) ? prev : [...prev, { col: field, agg: "sum" }]))
    if (zone === "filters") setFilters((prev) => (prev.some((f) => f.column === field) ? prev : [...prev, { column: field, operator: "equals", value: "" }]))
  }

  const containerForId = (id: string): ZoneId | "fields" | null => {
    if (id.startsWith("field:")) return "fields"
    if (id.startsWith("zone:")) return id.slice("zone:".length) as ZoneId
    if (id.startsWith("rows:")) return "rows"
    if (id.startsWith("cols:")) return "cols"
    if (id.startsWith("values:")) return "values"
    if (id.startsWith("filters:")) return "filters"
    return null
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return

    const from = containerForId(String(active.id))
    const to = containerForId(String(over.id))
    if (!from || !to) return

    // allow dropping onto a container itself (zone:* ids)
    const toZone: ZoneId | null = to === "fields" ? null : (to as ZoneId)

    const activeId = String(active.id)
    const overId = String(over.id)

    const activeCol = activeId.startsWith("field:")
      ? activeId.slice("field:".length)
      : activeId.split(":")[1]

    // Reorder inside same zone
    if (from !== "fields" && to !== "fields" && from === to) {
      const zone = from as ZoneId
      const getIds = () => {
        switch (zone) {
          case "rows":
            return rowFields.map((c) => `rows:${c}`)
          case "cols":
            return colFields.map((c) => `cols:${c}`)
          case "values":
            return values.map((v) => `values:${v.col}`)
          case "filters":
            return filters.map((f) => `filters:${f.column}`)
        }
      }
      const ids = getIds()
      const oldIndex = ids.indexOf(activeId)
      const newIndex = ids.indexOf(overId)
      // if dropping on container (zone:*), append
      if (newIndex === -1 && overId === `zone:${zone}`) {
        return
      }
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

      if (zone === "rows") setRowFields((prev) => arrayMove(prev, oldIndex, newIndex))
      if (zone === "cols") setColFields((prev) => arrayMove(prev, oldIndex, newIndex))
      if (zone === "values") setValues((prev) => arrayMove(prev, oldIndex, newIndex))
      if (zone === "filters") setFilters((prev) => arrayMove(prev, oldIndex, newIndex))
      return
    }

    // Add field into zone
    if (from === "fields" && toZone) {
      addToZone(toZone, activeCol)
      return
    }

    // Move between zones (remove from source, add to target)
    const sourceZone = from === "fields" ? null : (from as ZoneId)
    const targetZone = to === "fields" ? null : (to as ZoneId)
    if (!sourceZone || !targetZone) return

    // remove from source
    if (sourceZone === "rows") setRowFields((prev) => prev.filter((c) => c !== activeCol))
    if (sourceZone === "cols") setColFields((prev) => prev.filter((c) => c !== activeCol))
    if (sourceZone === "values") setValues((prev) => prev.filter((v) => v.col !== activeCol))
    if (sourceZone === "filters") setFilters((prev) => prev.filter((f) => f.column !== activeCol))

    // add to target
    addToZone(targetZone, activeCol)
  }

  const pivotFilters: PivotFilterRule[] = useMemo(() => {
    return filters.map((f) => {
      if (f.operator === "between") {
        const a = parseCsvPrimitive(String(f.value?.[0] ?? ""))
        const b = parseCsvPrimitive(String(f.value?.[1] ?? ""))
        return { column: f.column, operator: "between", value: [a as any, b as any] }
      }
      if (f.operator === "in") {
        const parts = String(f.value ?? "")
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
          .map(parseCsvPrimitive)
        return { column: f.column, operator: "in", value: parts as any }
      }
      if (f.operator === "contains") {
        return { column: f.column, operator: "contains", value: String(f.value ?? "") }
      }
      if (f.operator === "not_contains") {
        return { column: f.column, operator: "not_contains", value: String(f.value ?? "") }
      }
      if (f.operator === "not_equals") {
        return { column: f.column, operator: "not_equals", value: parseCsvPrimitive(String(f.value ?? "")) as any }
      }
      return { column: f.column, operator: "equals", value: parseCsvPrimitive(String(f.value ?? "")) as any }
    })
  }, [filters])

  // Backend pivot (DuckDB) when sessionId is set and no rows
  useEffect(() => {
    if (!useBackendPivot || !sessionId) {
      setBackendPivotResult(null)
      setPivotError(null)
      return
    }
    let cancelled = false
    setPivotLoading(true)
    setPivotError(null)
    fetchPivot({
      row_fields: rowFields,
      col_fields: colFields,
      values: values.map((v) => ({ col: v.col, agg: v.agg })),
      filters: pivotFilters.map((f) => ({ column: f.column, operator: f.operator, value: f.value })),
    })
      .then((res) => {
        if (!cancelled) {
          setBackendPivotResult({ columns: res.columns, data: res.data as Record<string, import("../types").CsvPrimitive>[] })
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPivotError(err?.message ?? "Pivot failed")
          setBackendPivotResult(null)
        }
      })
      .finally(() => {
        if (!cancelled) setPivotLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [useBackendPivot, sessionId, rowFields, colFields, values, pivotFilters])

  const pivotResult = useMemo((): PivotResult => {
    if (useBackendPivot && backendPivotResult) return backendPivotResult
    return buildPivot({
      rows,
      rowFields,
      colFields,
      values,
      filters: pivotFilters,
    })
  }, [useBackendPivot, backendPivotResult, rows, rowFields, colFields, values, pivotFilters])

  const tableColumns = useMemo<ColumnDef<Record<string, any>>[]>(() => {
    return pivotResult.columns.map((c) => ({
      accessorKey: c,
      header: c,
      cell: ({ getValue }) => {
        const v = getValue<any>()
        const isNum = typeof v === "number" && Number.isFinite(v)
        return (
          <span className={cn("tabular-nums block", isNum && "text-right")}>
            {formatCell(v)}
          </span>
        )
      },
    }))
  }, [pivotResult.columns])

  const table = useReactTable({
    data: pivotResult.data as any,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
  })

  const handleAddToReport = async () => {
    if (!pivotResultRef.current) return
    setAdding(true)
    try {
      const dataUrl = await toPng(pivotResultRef.current, {
        backgroundColor: "#ffffff",
        quality: 1.0,
        pixelRatio: 2,
      })
      await addItem({
        type: "table",
        title: "Pivot Result",
        content: {
          imageDataUrl: dataUrl,
          rowFields,
          colFields,
          values,
          filters: pivotFilters,
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
          <CardTitle className="text-base font-semibold">Pivot Builder</CardTitle>
          <span className="text-xs text-muted-foreground">Drag fields into Rows / Columns / Values / Filters</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-9 rounded-xl"
            onClick={handleAddToReport}
            disabled={adding || pivotResult.data.length === 0}
          >
            {added ? "Added" : adding ? "Adding…" : "Add to Report"}
          </Button>
          <Button
            variant="outline"
            className="h-9 rounded-xl gap-2"
            onClick={() => exportPivotToCsv(pivotResult, "pivot.csv")}
            disabled={pivotResult.data.length === 0}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
            <div className="rounded-xl border border-border/60">
              <div className="p-4">
                <div className="text-xs font-semibold tracking-widest text-muted-foreground">FIELDS</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Click a zone to select it, then hit <span className="font-semibold text-foreground">+</span> to add a field (or drag).
                </div>
                <div className="mt-3">
                  <ScrollArea className="h-[420px]">
                    <div className="space-y-2 pr-3">
                      {allFields.map((f) => (
                        <SelectableField key={f} field={f} onAdd={() => addToZone(activeZone, f)} />
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
              <Separator />
              <div className="p-4">
                <div className="text-xs font-semibold tracking-widest text-muted-foreground">VALUES SETTINGS</div>
                <div className="mt-3 space-y-3">
                  {values.map((v) => (
                    <div key={v.col} className="grid grid-cols-2 gap-3 items-end">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Column</Label>
                        <div className="h-9 rounded-lg border border-border/60 bg-muted/30 px-3 text-sm flex items-center">
                          {v.col}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Agg</Label>
                        <select
                          value={v.agg}
                          onChange={(e) =>
                            setValues((prev) =>
                              prev.map((x) => (x.col === v.col ? { ...x, agg: e.target.value as PivotAggFn } : x))
                            )
                          }
                          className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {(["sum", "avg", "min", "max", "count", "countDistinct"] as PivotAggFn[]).map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <ZoneCard
                zoneId="filters"
                title={zoneLabel("filters")}
                items={filters.map((f) => ({ id: `filters:${f.column}`, label: f.column }))}
                onRemoveItem={(id) => {
                  const col = id.split(":")[1]
                  setFilters((prev) => prev.filter((f) => f.column !== col))
                }}
                active={activeZone === "filters"}
                onActivate={() => setActiveZone("filters")}
                allFields={allFields}
                onAddField={(field) => addToZone("filters", field)}
              />

              {filters.length ? (
                <div className="rounded-xl border border-border/60 p-4">
                  <div className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground">FILTER RULES</div>
                  <div className="space-y-4">
                    {filters.map((f) => (
                      <div key={f.column} className="grid grid-cols-1 gap-3 lg:grid-cols-[180px_180px_1fr]">
                        <div className="text-sm font-medium truncate">{f.column}</div>
                        <select
                          value={f.operator}
                          onChange={(e) =>
                            setFilters((prev) =>
                              prev.map((x) => (x.column === f.column ? { ...x, operator: e.target.value as any } : x))
                            )
                          }
                          className="h-9 rounded-lg border border-border/60 bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {(
                            [
                              ["equals", "Equals"],
                              ["not_equals", "Not equal to"],
                              ["contains", "Contains"],
                              ["not_contains", "Does not contain"],
                              ["in", "In"],
                              ["between", "Between"],
                            ] as Array<[PivotFilterRule["operator"], string]>
                          ).map(([op, label]) => (
                            <option key={op} value={op}>
                              {label}
                            </option>
                          ))}
                        </select>
                        {f.operator === "between" ? (
                          <div className="grid grid-cols-2 gap-3">
                            <Input
                              className="h-9 rounded-lg"
                              placeholder="min"
                              value={String(f.value?.[0] ?? "")}
                              onChange={(e) =>
                                setFilters((prev) =>
                                  prev.map((x) =>
                                    x.column === f.column ? { ...x, value: [e.target.value, x.value?.[1] ?? ""] } : x
                                  )
                                )
                              }
                            />
                            <Input
                              className="h-9 rounded-lg"
                              placeholder="max"
                              value={String(f.value?.[1] ?? "")}
                              onChange={(e) =>
                                setFilters((prev) =>
                                  prev.map((x) =>
                                    x.column === f.column ? { ...x, value: [x.value?.[0] ?? "", e.target.value] } : x
                                  )
                                )
                              }
                            />
                          </div>
                        ) : (
                          <Input
                            className="h-9 rounded-lg"
                            placeholder={
                              f.operator === "in"
                                ? "comma separated"
                                : f.operator === "contains" || f.operator === "not_contains"
                                  ? "text"
                                  : "value"
                            }
                            value={String(f.value ?? "")}
                            onChange={(e) =>
                              setFilters((prev) =>
                                prev.map((x) => (x.column === f.column ? { ...x, value: e.target.value } : x))
                              )
                            }
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <ZoneCard
                  zoneId="rows"
                  title={zoneLabel("rows")}
                  items={rowFields.map((c) => ({ id: `rows:${c}`, label: c }))}
                  onRemoveItem={(id) => {
                    const col = id.split(":")[1]
                    setRowFields((prev) => prev.filter((c) => c !== col))
                  }}
                  active={activeZone === "rows"}
                  onActivate={() => setActiveZone("rows")}
                  allFields={allFields}
                  onAddField={(field) => addToZone("rows", field)}
                />
                <ZoneCard
                  zoneId="cols"
                  title={zoneLabel("cols")}
                  items={colFields.map((c) => ({ id: `cols:${c}`, label: c }))}
                  onRemoveItem={(id) => {
                    const col = id.split(":")[1]
                    setColFields((prev) => prev.filter((c) => c !== col))
                  }}
                  active={activeZone === "cols"}
                  onActivate={() => setActiveZone("cols")}
                  allFields={allFields}
                  onAddField={(field) => addToZone("cols", field)}
                />
              </div>

              <ZoneCard
                zoneId="values"
                title={zoneLabel("values")}
                items={values.map((v) => ({ id: `values:${v.col}`, label: `${v.col} (${v.agg})` }))}
                onRemoveItem={(id) => {
                  const col = id.split(":")[1]
                  setValues((prev) => prev.filter((v) => v.col !== col))
                }}
                active={activeZone === "values"}
                onActivate={() => setActiveZone("values")}
                allFields={allFields}
                onAddField={(field) => addToZone("values", field)}
              />

              <div ref={pivotResultRef} className="rounded-xl border border-border/60">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="text-sm font-semibold">Pivot Result</div>
                  <div className="flex items-center gap-3">
                    {useBackendPivot && pivotLoading && (
                      <span className="text-xs text-muted-foreground">Loading…</span>
                    )}
                    {pivotError && (
                      <span className="text-xs text-destructive">{pivotError}</span>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {pivotResult.data.length} rows • {pivotResult.columns.length} cols
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="h-[420px] overflow-auto">
                  <div className="min-w-max p-4">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        {table.getHeaderGroups().map((hg) => (
                          <TableRow key={hg.id} className="hover:bg-transparent">
                            {hg.headers.map((h) => (
                              <TableHead
                                key={h.id}
                                className={cn(
                                  "text-xs font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap",
                                  "bg-background"
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
                              <TableCell key={c.id} className="text-sm whitespace-nowrap">
                                {flexRender(c.column.columnDef.cell, c.getContext())}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DndContext>
      </CardContent>
    </Card>
  )
}

