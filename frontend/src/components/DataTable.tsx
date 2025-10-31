import { useMemo, useState } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    type ColumnResizeMode,
} from '@tanstack/react-table';
import type { ColumnDef, SortingState, ColumnFiltersState } from '@tanstack/react-table';
import type { DataFrameJSON } from '../types/dataframe';

interface UseDataTableOptions {
    dataframe: DataFrameJSON;
    pageSize?: number;
    enableColumnResize?: boolean;
}

function formatCellValue(value: any): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number') {
        if (Number.isInteger(value)) return value.toLocaleString();
        return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    }
    if (typeof value === 'boolean') return value ? '✓' : '✗';
    return String(value);
}

export function DataTable({ dataframe, pageSize = 20, enableColumnResize = true }: UseDataTableOptions) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [columnResizeMode] = useState<ColumnResizeMode>('onChange');

    const columns = useMemo<ColumnDef<Record<string, any>>[]>(() => {
        return dataframe.columns.map((col) => ({
            accessorKey: col,
            id: col,
            header: col.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            cell: (info) => formatCellValue(info.getValue()),
            enableSorting: true,
            enableColumnFilter: true,
            enableResizing: enableColumnResize,
        }));
    }, [dataframe.columns, enableColumnResize]);

    const table = useReactTable({
        data: dataframe.data,
        columns,
        state: { sorting, columnFilters, globalFilter },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        columnResizeMode,
        initialState: { pagination: { pageSize } },
        enableColumnResizing: enableColumnResize,
    });

    return { table, globalFilter, setGlobalFilter, sorting, setSorting };
}
