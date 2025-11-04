import { useState, useMemo } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    flexRender,
    type ColumnDef,
    type SortingState,
    type ColumnFiltersState,
} from '@tanstack/react-table';
import { motion, AnimatePresence } from 'framer-motion';

interface InteractiveDataTableProps {
    data: Record<string, any>[];
    title?: string;
    description?: string;
}

export function InteractiveDataTable({ data, title, description }: InteractiveDataTableProps) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

    const columns = useMemo<ColumnDef<any>[]>(() => {
        if (!data || data.length === 0) return [];

        // Get all columns and filter out unnamed ones
        const allColumns = Object.keys(data[0]).filter(
            (col) => !col.toLowerCase().includes('unnamed')
        );

        // Prioritize important columns
        const importantCols = ['mobile_number', 'captain_id', 'cohort', 'city', 'time', 'date'];
        const sortedCols = [
            ...importantCols.filter((col) => allColumns.includes(col)),
            ...allColumns.filter((col) => !importantCols.includes(col)).sort(),
        ];

        return sortedCols.map((col) => ({
            accessorKey: col,
            header: col.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            cell: (info) => {
                const value = info.getValue();
                if (value === null || value === undefined) return <span className="text-slate-400">-</span>;
                if (typeof value === 'number') {
                    return (
                        <span className="tabular-nums">
                            {Math.abs(value) >= 1000
                                ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                                : value
                            }
                        </span>
                    );
                }
                return String(value);
            },
            enableSorting: true,
            enableColumnFilter: true,
        }));
    }, [data]);

    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
            columnFilters,
            globalFilter,
            pagination,
        },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onGlobalFilterChange: setGlobalFilter,
        onPaginationChange: setPagination,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
    });

    if (!data || data.length === 0) {
        return (
            <div className="text-center py-12 text-slate-500">
                <p className="text-lg">📭 No data available</p>
            </div>
        );
    }

    const isMetricColumn = (colId: string): boolean => {
        const identifierColumns = ['mobile_number', 'captain_id', 'cohort', 'city', 'time', 'date'];
        return !identifierColumns.includes(colId);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-4"
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    {title && (
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                            {title}
                        </h3>
                    )}
                    {description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            {description}
                        </p>
                    )}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full">
                    {table.getFilteredRowModel().rows.length.toLocaleString()} rows × {columns.length} columns
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-slate-400">🔍</span>
                </div>
                <input
                    type="text"
                    value={globalFilter ?? ''}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    placeholder="Search all columns..."
                    className="w-full pl-10 pr-4 py-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                />
                {globalFilter && (
                    <button
                        onClick={() => setGlobalFilter('')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-800 border-b border-slate-200 dark:border-slate-600">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <th
                                            key={header.id}
                                            className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${isMetricColumn(header.column.id)
                                                    ? 'text-indigo-700 dark:text-indigo-400'
                                                    : 'text-slate-700 dark:text-slate-300'
                                                }`}
                                        >
                                            {header.isPlaceholder ? null : (
                                                <div
                                                    className={`flex items-center gap-2 ${header.column.getCanSort()
                                                            ? 'cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-300'
                                                            : ''
                                                        }`}
                                                    onClick={header.column.getToggleSortingHandler()}
                                                >
                                                    {isMetricColumn(header.column.id) && (
                                                        <span className="text-sm">📊</span>
                                                    )}
                                                    <span className="truncate">
                                                        {flexRender(
                                                            header.column.columnDef.header,
                                                            header.getContext()
                                                        )}
                                                    </span>
                                                    {{
                                                        asc: <span className="text-indigo-600 dark:text-indigo-400">↑</span>,
                                                        desc: <span className="text-indigo-600 dark:text-indigo-400">↓</span>,
                                                    }[header.column.getIsSorted() as string] ?? (
                                                            header.column.getCanSort() && (
                                                                <span className="text-slate-400">⇅</span>
                                                            )
                                                        )}
                                                </div>
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            <AnimatePresence mode="popLayout">
                                {table.getRowModel().rows.map((row, idx) => (
                                    <motion.tr
                                        key={row.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        transition={{ duration: 0.2, delay: idx * 0.02 }}
                                        className="hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors"
                                    >
                                        {row.getVisibleCells().map((cell) => {
                                            const isNumeric = typeof cell.getValue() === 'number';
                                            const isMetric = isMetricColumn(cell.column.id);

                                            return (
                                                <td
                                                    key={cell.id}
                                                    className={`px-4 py-3 text-sm whitespace-nowrap ${isMetric
                                                            ? 'text-slate-700 dark:text-slate-300 font-medium'
                                                            : 'text-slate-600 dark:text-slate-400'
                                                        } ${isNumeric ? 'text-right' : 'text-left'}`}
                                                >
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </td>
                                            );
                                        })}
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => table.setPageIndex(0)}
                                disabled={!table.getCanPreviousPage()}
                                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors text-sm font-medium"
                            >
                                «
                            </button>
                            <button
                                onClick={() => table.previousPage()}
                                disabled={!table.getCanPreviousPage()}
                                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors text-sm font-medium"
                            >
                                ‹
                            </button>
                            <button
                                onClick={() => table.nextPage()}
                                disabled={!table.getCanNextPage()}
                                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors text-sm font-medium"
                            >
                                ›
                            </button>
                            <button
                                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                                disabled={!table.getCanNextPage()}
                                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors text-sm font-medium"
                            >
                                »
                            </button>
                        </div>

                        <div className="flex items-center gap-4">
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                Page{' '}
                                <span className="font-semibold">
                                    {table.getState().pagination.pageIndex + 1}
                                </span>{' '}
                                of{' '}
                                <span className="font-semibold">{table.getPageCount()}</span>
                            </span>

                            <select
                                value={table.getState().pagination.pageSize}
                                onChange={(e) => table.setPageSize(Number(e.target.value))}
                                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                {[10, 20, 50, 100].map((pageSize) => (
                                    <option key={pageSize} value={pageSize}>
                                        Show {pageSize}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    Identifier columns
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="text-sm">📊</span>
                    Metric columns
                </span>
                <span className="flex items-center gap-1.5">
                    <span>⇅</span>
                    Sortable
                </span>
            </div>
        </motion.div>
    );
}
