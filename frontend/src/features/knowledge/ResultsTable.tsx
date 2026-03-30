import { useMemo, useState } from "react"
import { ChevronDown, ChevronUp, Clock, Rows3 } from "lucide-react"
import { AgGridReact } from "ag-grid-react"

interface ResultsTableProps {
  rows: Array<Record<string, unknown>>
  columns: string[]
  rowCount: number
  executionTimeMs: number
}

export function ResultsTable({ rows, columns, rowCount, executionTimeMs }: ResultsTableProps) {
  const [collapsed, setCollapsed] = useState(false)

  const columnDefs = useMemo(
    () =>
      columns.map((col) => ({
        field: col,
        headerName: col,
        sortable: true,
        filter: true,
        resizable: true,
        minWidth: 100,
      })),
    [columns]
  )

  const displayRows = rows.slice(0, 50)

  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between w-full px-4 py-2 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Rows3 className="h-3 w-3" />
            <span className="font-medium text-foreground">{rowCount}</span> rows
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {executionTimeMs}ms
          </div>
          {rowCount > 50 && (
            <span className="text-[10px] text-amber-600">showing first 50</span>
          )}
        </div>
        {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
      </button>

      {/* Table */}
      {!collapsed && (
        <div className="ag-theme-alpine" style={{ height: Math.min(displayRows.length * 42 + 48, 400) }}>
          <AgGridReact
            rowData={displayRows}
            columnDefs={columnDefs}
            defaultColDef={{
              flex: 1,
              minWidth: 100,
              resizable: true,
            }}
            animateRows={false}
            suppressMovableColumns
            domLayout="normal"
          />
        </div>
      )}
    </div>
  )
}
