import React, { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import type { ColDef, GridReadyEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// Register all Community modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface SummaryStatsData {
    group: string;
    mean: number;
    median: number;
    p25: number;
    p75: number;
    std: number;
    count: number;
}

interface SummaryStatsTableProps {
    data: SummaryStatsData[];
    title?: string;
}

export function SummaryStatsTable({ data, title }: SummaryStatsTableProps) {
    const columnDefs: ColDef[] = useMemo(() => [
        {
            field: 'group',
            headerName: 'Group',
            sortable: true,
            filter: true,
            width: 150,
            pinned: 'left'
        },
        {
            field: 'mean',
            headerName: 'Mean',
            sortable: true,
            filter: 'agNumberColumnFilter',
            width: 100,
            valueFormatter: (params) => {
                const num = parseFloat(params.value);
                return isNaN(num) ? '0.00' : num.toFixed(2);
            },
            cellClass: 'text-right'
        },
        {
            field: 'median',
            headerName: 'Median',
            sortable: true,
            filter: 'agNumberColumnFilter',
            width: 100,
            valueFormatter: (params) => {
                const num = parseFloat(params.value);
                return isNaN(num) ? '0.00' : num.toFixed(2);
            },
            cellClass: 'text-right'
        },
        {
            field: 'p25',
            headerName: '25th Percentile',
            sortable: true,
            filter: 'agNumberColumnFilter',
            width: 120,
            valueFormatter: (params) => {
                const num = parseFloat(params.value);
                return isNaN(num) ? '0.00' : num.toFixed(2);
            },
            cellClass: 'text-right'
        },
        {
            field: 'p75',
            headerName: '75th Percentile',
            sortable: true,
            filter: 'agNumberColumnFilter',
            width: 120,
            valueFormatter: (params) => {
                const num = parseFloat(params.value);
                return isNaN(num) ? '0.00' : num.toFixed(2);
            },
            cellClass: 'text-right'
        },
        {
            field: 'std',
            headerName: 'Std Dev',
            sortable: true,
            filter: 'agNumberColumnFilter',
            width: 100,
            valueFormatter: (params) => {
                const num = parseFloat(params.value);
                return isNaN(num) ? '0.00' : num.toFixed(2);
            },
            cellClass: 'text-right'
        },
        {
            field: 'count',
            headerName: 'Count',
            sortable: true,
            filter: 'agNumberColumnFilter',
            width: 80,
            valueFormatter: (params) => {
                const num = parseInt(params.value);
                return isNaN(num) ? '0' : num.toLocaleString();
            },
            cellClass: 'text-right'
        }
    ], []);

    const defaultColDef: ColDef = useMemo(() => ({
        resizable: true,
        sortable: true,
        filter: true,
    }), []);

    const onGridReady = (params: GridReadyEvent) => {
        params.api.sizeColumnsToFit();
    };

    return (
        <div className="ag-theme-alpine" style={{ height: '200px', width: '100%' }}>
            {title && (
                <div className="mb-2">
                    <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
                </div>
            )}

            <AgGridReact
                rowData={data}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                onGridReady={onGridReady}
                animateRows={true}
                suppressRowClickSelection={true}
                pagination={false}
                headerHeight={32}
                rowHeight={28}
            />
        </div>
    );
}
