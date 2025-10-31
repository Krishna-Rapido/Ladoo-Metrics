/**
 * Type definitions for pandas DataFrame representation in JSON
 */

export interface DataFrameColumn {
    name: string;
    type?: 'string' | 'number' | 'boolean' | 'date';
}

export interface DataFrameJSON {
    columns: string[];
    data: Record<string, any>[];
    index?: (string | number)[];
}

export interface DataTableProps {
    dataframe: DataFrameJSON;
    title?: string;
    pageSize?: number;
    theme?: 'light' | 'dark';
    enableExport?: boolean;
    enableSearch?: boolean;
    enableColumnResize?: boolean;
    stickyHeader?: boolean;
}

export type SortDirection = 'asc' | 'desc' | false;

export interface TableState {
    sorting: Array<{ id: string; desc: boolean }>;
    globalFilter: string;
    pagination: {
        pageIndex: number;
        pageSize: number;
    };
}


