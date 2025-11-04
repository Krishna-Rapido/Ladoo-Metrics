import { useMemo, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import type { ColDef, GridReadyEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// Register all Community modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface FunnelDataGridProps {
    data: Record<string, any>[];
    title?: string;
    description?: string;
    fileName?: string;  // Kept for future use
}

export function FunnelDataGrid({ data, title, description }: FunnelDataGridProps) {
    const columnDefs: ColDef[] = useMemo(() => {
        if (!data || data.length === 0) return [];

        // Get all columns and filter out unnamed ones
        const allColumns = Object.keys(data[0]).filter(
            (col) => !col.toLowerCase().includes('unnamed')
        );

        // Prioritize important columns
        const importantCols = ['mobile_number', 'captain_id', 'cohort', 'city', 'time', 'date'];
        const identifierCols = ['mobile_number', 'captain_id', 'cohort', 'city', 'time', 'date'];

        const sortedCols = [
            ...importantCols.filter((col) => allColumns.includes(col)),
            ...allColumns.filter((col) => !importantCols.includes(col)).sort(),
        ];

        return sortedCols.map((col, index) => {
            const isIdentifier = identifierCols.includes(col);
            const isPinned = index === 0 || (index === 1 && col === 'captain_id') || (index === 2 && col === 'cohort');

            return {
                field: col,
                headerName: col.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                sortable: true,
                filter: isIdentifier ? true : 'agNumberColumnFilter',
                width: isIdentifier ? 150 : 120,
                pinned: isPinned ? 'left' : undefined,
                valueFormatter: (params) => {
                    const value = params.value;
                    if (value === null || value === undefined) return '-';
                    if (typeof value === 'number') {
                        return Math.abs(value) >= 1000
                            ? value.toLocaleString('en-US', { maximumFractionDigits: 2 })
                            : value.toString();
                    }
                    return String(value);
                },
                cellClass: typeof data[0][col] === 'number' ? 'text-right' : 'text-left',
                headerTooltip: col.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            };
        });
    }, [data]);

    const defaultColDef: ColDef = useMemo(() => ({
        resizable: true,
        sortable: true,
        filter: true,
    }), []);

    const onGridReady = useCallback((params: GridReadyEvent) => {
        // Auto-size columns to fit content
        params.api.sizeColumnsToFit();
    }, []);

    if (!data || data.length === 0) {
        return (
            <div className="text-center py-12 text-slate-500">
                <p className="text-lg">📭 No data available</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            {(title || description) && (
                <div className="flex items-center justify-between">
                    <div>
                        {title && (
                            <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
                        )}
                        {description && (
                            <p className="text-sm text-slate-600 mt-1">{description}</p>
                        )}
                    </div>
                    <div className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
                        {data.length.toLocaleString()} preview rows × {columnDefs.length} columns
                    </div>
                </div>
            )}

            {/* AG Grid */}
            <div className="ag-theme-alpine rounded-lg overflow-hidden border border-slate-200 shadow-sm" style={{ height: '600px', width: '100%' }}>
                <AgGridReact
                    rowData={data}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    onGridReady={onGridReady}
                    animateRows={true}
                    suppressRowClickSelection={false}
                    rowSelection={'multiple'}
                    pagination={true}
                    paginationPageSize={50}
                    paginationPageSizeSelector={[10, 20, 50, 100]}
                    sideBar={{
                        toolPanels: [
                            {
                                id: 'columns',
                                labelDefault: 'Columns',
                                labelKey: 'columns',
                                iconKey: 'columns',
                                toolPanel: 'agColumnsToolPanel',
                                minWidth: 225,
                                maxWidth: 225,
                                width: 225
                            },
                            {
                                id: 'filters',
                                labelDefault: 'Filters',
                                labelKey: 'filters',
                                iconKey: 'filter',
                                toolPanel: 'agFiltersToolPanel',
                                minWidth: 180,
                                maxWidth: 400,
                                width: 250
                            }
                        ],
                        position: 'left'
                    }}
                />
            </div>
        </div>
    );
}

