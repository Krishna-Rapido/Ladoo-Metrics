import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import type { ColDef, GridReadyEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// Register all Community modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface CohortAggregationData {
    cohort: string;
    totalExpCaps: number;
    visitedCaps: number;
    clickedCaptain: number;
    pitch_centre_card_clicked: number;
    pitch_centre_card_visible: number;
    exploredCaptains: number;
    exploredCaptains_Subs: number;
    exploredCaptains_EPKM: number;
    exploredCaptains_FlatCommission: number;
    exploredCaptains_CM: number;
    confirmedCaptains: number;
    confirmedCaptains_Subs: number;
    confirmedCaptains_Subs_purchased: number;
    confirmedCaptains_Subs_purchased_weekend: number;
    confirmedCaptains_EPKM: number;
    confirmedCaptains_FlatCommission: number;
    confirmedCaptains_CM: number;
    Visit2Click: number;
    Base2Visit: number;
    Click2Confirm: number;
}

interface CohortDataGridProps {
    data: CohortAggregationData[];
    title?: string;
}

export function CohortDataGrid({ data, title }: CohortDataGridProps) {
    const columnDefs: ColDef[] = useMemo(() => [
        {
            field: 'cohort',
            headerName: 'Cohort',
            sortable: true,
            filter: true,
            width: 180,
            pinned: 'left'
        },
        {
            field: 'Base2Visit',
            headerName: 'Base→Visit %',
            sortable: true,
            filter: 'agNumberColumnFilter',
            width: 120,
            valueFormatter: (params) => {
                const num = parseFloat(params.value);
                return isNaN(num) ? '0.00%' : (num * 100).toFixed(2) + '%';
            },
            cellClass: 'text-right'
        },
        {
            field: 'Visit2Click',
            headerName: 'Visit→Click %',
            sortable: true,
            filter: 'agNumberColumnFilter',
            width: 120,
            valueFormatter: (params) => {
                const num = parseFloat(params.value);
                return isNaN(num) ? '0.00%' : (num * 100).toFixed(2) + '%';
            },
            cellClass: 'text-right'
        },

        {
            field: 'Click2Confirm',
            headerName: 'Click→Confirm %',
            sortable: true,
            filter: 'agNumberColumnFilter',
            width: 120,
            valueFormatter: (params) => {
                const num = parseFloat(params.value);
                return isNaN(num) ? '0.00%' : (num * 100).toFixed(2) + '%';
            },
            cellClass: 'text-right'
        },
        {
            field: 'totalExpCaps',
            headerName: 'Total Exposed',
            sortable: true,
            filter: 'agNumberColumnFilter',
            width: 120,
            valueFormatter: (params) => {
                const num = parseFloat(params.value);
                return isNaN(num) ? '0' : num.toLocaleString('en-US');
            },
            cellClass: 'text-right'
        },
        {
            field: 'visitedCaps',
            headerName: 'Visited',
            sortable: true,
            filter: 'agNumberColumnFilter',
            width: 100,
            valueFormatter: (params) => {
                const num = parseFloat(params.value);
                return isNaN(num) ? '0' : num.toLocaleString('en-US');
            },
            cellClass: 'text-right'
        },
        {
            field: 'clickedCaptain',
            headerName: 'Clicked ',
            sortable: true,
            filter: 'agNumberColumnFilter',
            width: 100,
            valueFormatter: (params) => {
                const num = parseFloat(params.value);
                return isNaN(num) ? '0' : num.toLocaleString('en-US');
            },
            cellClass: 'text-right'
        },
        {
            field: 'confirmedCaptains',
            headerName: 'Confirmed',
            sortable: true,
            filter: 'agNumberColumnFilter',
            width: 110,
            valueFormatter: (params) => {
                const num = parseFloat(params.value);
                return isNaN(num) ? '0' : num.toLocaleString('en-US');
            },
            cellClass: 'text-right'
        },
        {
            field: 'pitch_centre_card_clicked',
            headerName: 'PC Clicked',
            sortable: true,
            filter: 'agNumberColumnFilter',
            width: 100,
            valueFormatter: (params) => {
                const num = parseFloat(params.value);
                return isNaN(num) ? '0' : num.toLocaleString('en-US');
            },
            cellClass: 'text-right'
        },

        {
            field: 'pitch_centre_card_visible',
            headerName: 'PC Visible',
            sortable: true,
            filter: 'agNumberColumnFilter',
            width: 100,
            valueFormatter: (params) => {
                const num = parseFloat(params.value);
                return isNaN(num) ? '0' : num.toLocaleString('en-US');
            },
            cellClass: 'text-right'
        },
        {
            field: 'exploredCaptains',
            headerName: 'Explored',
            sortable: true,
            filter: 'agNumberColumnFilter',
            width: 100,
            valueFormatter: (params) => {
                const num = parseFloat(params.value);
                return isNaN(num) ? '0' : num.toLocaleString('en-US');
            },
            cellClass: 'text-right'
        },

        // Additional columns for completeness
        {
            field: 'exploredCaptains_Subs',
            headerName: 'Explored Subs',
            sortable: true,
            filter: 'agNumberColumnFilter',
            width: 130,
            valueFormatter: (params) => {
                const num = parseFloat(params.value);
                return isNaN(num) ? '0' : num.toLocaleString('en-US');
            },
            cellClass: 'text-right'
        },
        {
            field: 'exploredCaptains_EPKM',
            headerName: 'Explored EPKM',
            sortable: true,
            filter: 'agNumberColumnFilter',
            width: 130,
            valueFormatter: (params) => {
                const num = parseFloat(params.value);
                return isNaN(num) ? '0' : num.toLocaleString('en-US');
            },
            cellClass: 'text-right'
        },
        {
            field: 'confirmedCaptains_Subs_purchased',
            headerName: 'Confirmed Subs Purchased',
            sortable: true,
            filter: 'agNumberColumnFilter',
            width: 180,
            valueFormatter: (params) => {
                const num = parseFloat(params.value);
                return isNaN(num) ? '0' : num.toLocaleString('en-US');
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
        // Auto-size columns to fit content
        params.api.sizeColumnsToFit();
    };

    return (
        <div className="ag-theme-alpine" style={{ height: '600px', width: '100%' }}>
            {title && (
                <div className="mb-4">
                    <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
                    <p className="text-sm text-slate-600">Interactive data table with sorting, filtering, and export capabilities</p>
                </div>
            )}

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
                defaultCsvExportParams={{
                    fileName: 'cohort_data.csv'
                }}
                defaultExcelExportParams={{
                    fileName: 'cohort_data.xlsx'
                }}
            />
        </div>
    );
}
