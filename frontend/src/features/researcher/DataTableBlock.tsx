import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

interface DataTableBlockProps {
  columns: string[]
  rows: Record<string, unknown>[]
  totalRows: number
  truncated: boolean
}

export function DataTableBlock({ columns, rows, totalRows, truncated }: DataTableBlockProps) {
  const [showAll, setShowAll] = useState(false)
  const displayRows = showAll ? rows : rows.slice(0, 10)

  return (
    <div className="my-2 rounded-lg border border-slate-200 bg-white text-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-1.5">
        <span className="text-xs font-medium text-slate-500">
          {totalRows.toLocaleString()} rows{truncated ? " (showing first 50)" : ""}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {columns.map((col) => (
                <th
                  key={col}
                  className="whitespace-nowrap px-3 py-1.5 text-left font-medium text-slate-600"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                {columns.map((col) => (
                  <td key={col} className="whitespace-nowrap px-3 py-1 text-slate-700">
                    {formatCell(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 10 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="flex w-full items-center justify-center gap-1 border-t border-slate-100 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
        >
          {showAll ? (
            <>
              <ChevronDown className="h-3 w-3" /> Show less
            </>
          ) : (
            <>
              <ChevronRight className="h-3 w-3" /> Show all {rows.length} rows
            </>
          )}
        </button>
      )}
    </div>
  )
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(4)
  }
  return String(value)
}
