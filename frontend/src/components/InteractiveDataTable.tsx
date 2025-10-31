import React, { useMemo, useState, useMemo as useDeepMemo } from "react";

type Row = Record<string, any>;

interface InteractiveDataTableProps {
    data: Row[];
    columns: string[];
    initialPageSize?: number;
}

/** Utilities */
const formatCell = (value: any) => {
    if (value == null) return "";
    if (typeof value === "number") {
        return Number.isInteger(value)
            ? value.toLocaleString()
            : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    }
    if (value instanceof Date) return value.toLocaleString();
    return String(value);
};

const csvEscape = (v: string) =>
    /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

const toCSV = (rows: Row[], cols: string[]) => {
    const head = cols.join(",");
    const body = rows
        .map((r) => cols.map((c) => csvEscape(formatCell(r[c]))).join(","))
        .join("\n");
    return `${head}\n${body}`;
};

type SortState = { id: string; desc: boolean } | null;

/** Component */
export function InteractiveDataTable({
    data,
    columns,
    initialPageSize = 20,
}: InteractiveDataTableProps) {
    // table state
    const [globalFilter, setGlobalFilter] = useState("");
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
    const [sort, setSort] = useState<SortState>(null);
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(initialPageSize);

    // derived: filtered rows
    const filtered = useMemo(() => {
        const gf = globalFilter.trim().toLowerCase();
        const cfEntries = Object.entries(columnFilters).filter(([, v]) => v?.trim());
        return data.filter((row) => {
            // per-column filters (AND)
            for (const [col, q] of cfEntries) {
                const cell = formatCell(row[col]).toLowerCase();
                if (!cell.includes(q.toLowerCase())) return false;
            }
            // global filter
            if (!gf) return true;
            for (const c of columns) {
                const cell = formatCell(row[c]).toLowerCase();
                if (cell.includes(gf)) return true;
            }
            return false;
        });
    }, [data, columns, globalFilter, columnFilters]);

    // derived: sorted rows
    const sorted = useMemo(() => {
        if (!sort) return filtered;
        const { id, desc } = sort;
        const copy = [...filtered];
        copy.sort((a, b) => {
            const av = a[id];
            const bv = b[id];
            // number first, then Date, then string
            const numA = typeof av === "number" ? av : Number.NaN;
            const numB = typeof bv === "number" ? bv : Number.NaN;
            let cmp = 0;
            if (!Number.isNaN(numA) && !Number.isNaN(numB)) cmp = numA - numB;
            else if (av instanceof Date && bv instanceof Date) cmp = av.getTime() - bv.getTime();
            else cmp = String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true, sensitivity: "base" });
            return desc ? -cmp : cmp;
        });
        return copy;
    }, [filtered, sort]);

    // pagination
    const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
    const safePageIndex = Math.min(pageIndex, pageCount - 1);
    const paged = useMemo(() => {
        const start = safePageIndex * pageSize;
        return sorted.slice(start, start + pageSize);
    }, [sorted, pageSize, safePageIndex]);

    // handlers
    const toggleSort = (id: string) => {
        setPageIndex(0);
        setSort((prev) => {
            if (!prev || prev.id !== id) return { id, desc: false }; // asc
            if (prev && !prev.desc) return { id, desc: true }; // desc
            return null; // off
        });
    };

    const setColFilter = (id: string, val: string) => {
        setPageIndex(0);
        setColumnFilters((f) => ({ ...f, [id]: val }));
    };

    const exportCSV = () => {
        const csv = toCSV(sorted, columns);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "table_export.csv";
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-4">
            {/* Top bar */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <input
                    value={globalFilter}
                    onChange={(e) => { setGlobalFilter(e.target.value); setPageIndex(0); }}
                    placeholder="Search all columns..."
                    className="w-full sm:flex-1 rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
                />
                <div className="flex items-center gap-2">
                    <button
                        onClick={exportCSV}
                        className="px-3 py-2 text-sm rounded-md border border-slate-300 bg-white hover:bg-slate-50"
                    >
                        Export CSV
                    </button>
                    <span className="text-sm text-slate-600">
                        {sorted.length} of {data.length} row(s)
                    </span>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
                <table className="min-w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-gradient-to-r from-slate-100 to-slate-200">
                        <tr>
                            {columns.map((col) => {
                                const sortedState =
                                    sort?.id === col ? (sort.desc ? "desc" : "asc") : null;
                                return (
                                    <th key={col} className="px-4 py-2 text-left align-bottom">
                                        <div className="flex items-center gap-2">
                                            <button
                                                className="font-semibold uppercase tracking-wide text-xs text-slate-700 hover:underline"
                                                onClick={() => toggleSort(col)}
                                                title="Sort"
                                            >
                                                {col.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                                            </button>
                                            <span className="text-slate-500">
                                                {sortedState === "asc" ? "↑" : sortedState === "desc" ? "↓" : "⇅"}
                                            </span>
                                        </div>
                                        <input
                                            value={columnFilters[col] ?? ""}
                                            onChange={(e) => setColFilter(col, e.target.value)}
                                            placeholder={`Filter ${col}`}
                                            className="mt-2 w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-slate-300"
                                        />
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {paged.map((row, rIdx) => (
                            <tr key={rIdx} className={rIdx % 2 ? "bg-slate-50/60" : ""}>
                                {columns.map((c) => (
                                    <td key={c} className="px-4 py-2 whitespace-nowrap text-slate-900">
                                        {formatCell(row[c])}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        {paged.length === 0 && (
                            <tr>
                                <td colSpan={columns.length} className="px-4 py-6 text-center text-slate-500">
                                    No results
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setPageIndex(0)}
                        disabled={safePageIndex === 0}
                        className="px-3 py-1 text-sm rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50"
                    >
                        {"<<"}
                    </button>
                    <button
                        onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                        disabled={safePageIndex === 0}
                        className="px-3 py-1 text-sm rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50"
                    >
                        {"<"}
                    </button>
                    <button
                        onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
                        disabled={safePageIndex >= pageCount - 1}
                        className="px-3 py-1 text-sm rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50"
                    >
                        {">"}
                    </button>
                    <button
                        onClick={() => setPageIndex(pageCount - 1)}
                        disabled={safePageIndex >= pageCount - 1}
                        className="px-3 py-1 text-sm rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50"
                    >
                        {">>"}
                    </button>
                    <span className="text-sm text-slate-700">
                        Page <strong>{safePageIndex + 1}</strong> of <strong>{pageCount}</strong>
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-700">Rows per page:</span>
                    <select
                        value={pageSize}
                        onChange={(e) => { setPageSize(Number(e.target.value)); setPageIndex(0); }}
                        className="rounded border border-slate-300 px-2 py-1"
                    >
                        {[10, 20, 30, 50, 100].map((n) => (
                            <option key={n} value={n}>{n}</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
}
