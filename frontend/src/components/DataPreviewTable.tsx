import { useMemo } from 'react';

interface DataPreviewTableProps {
    data: Record<string, any>[];
    title?: string;
    maxHeight?: string;
    highlightColumns?: string[];
}

export function DataPreviewTable({
    data,
    title = 'Data Preview',
    maxHeight = '500px',
    highlightColumns = []
}: DataPreviewTableProps) {
    const { columns, rows } = useMemo(() => {
        if (!data || data.length === 0) return { columns: [], rows: [] };

        // Get all columns from first row
        const allColumns = Object.keys(data[0]);

        // Filter out unnamed columns and reorder to put important ones first
        const importantFirst = ['mobile_number', 'captain_id', 'cohort', 'city', 'time', 'date'];
        const filteredColumns = allColumns.filter(col =>
            !col.toLowerCase().includes('unnamed')
        );

        // Sort columns: important first, then the rest alphabetically
        const sortedColumns = [
            ...importantFirst.filter(col => filteredColumns.includes(col)),
            ...filteredColumns.filter(col => !importantFirst.includes(col)).sort()
        ];

        return { columns: sortedColumns, rows: data };
    }, [data]);

    if (!data || data.length === 0) {
        return (
            <div className="text-center py-8 text-slate-500">
                <p>No data available</p>
            </div>
        );
    }

    const formatValue = (value: any): string => {
        if (value === null || value === undefined) return '-';
        if (typeof value === 'number') {
            // Format large numbers with commas
            if (Math.abs(value) >= 1000) {
                return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
            }
            return value.toString();
        }
        return String(value);
    };

    const isMetricColumn = (col: string): boolean => {
        const identifierColumns = ['mobile_number', 'captain_id', 'cohort', 'city', 'time', 'date'];
        return !identifierColumns.includes(col);
    };

    return (
        <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
                <div className="text-xs text-slate-500">
                    {rows.length} row{rows.length !== 1 ? 's' : ''} × {columns.length} column{columns.length !== 1 ? 's' : ''}
                </div>
            </div>

            <div
                className="border border-slate-200 rounded-lg overflow-hidden shadow-sm bg-white"
                style={{ maxHeight }}
            >
                <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight }}>
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-gradient-to-r from-slate-50 to-slate-100 sticky top-0 z-10">
                            <tr>
                                {columns.map((col) => (
                                    <th
                                        key={col}
                                        className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${highlightColumns.includes(col)
                                                ? 'text-indigo-700 bg-indigo-50'
                                                : isMetricColumn(col)
                                                    ? 'text-slate-600'
                                                    : 'text-slate-700'
                                            }`}
                                        style={{
                                            minWidth: col.length > 15 ? '180px' : '120px',
                                            position: 'sticky',
                                            top: 0
                                        }}
                                    >
                                        <div className="flex items-center gap-1">
                                            {isMetricColumn(col) && (
                                                <span className="text-blue-500">📊</span>
                                            )}
                                            <span className="truncate" title={col}>
                                                {col.replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {rows.map((row, idx) => (
                                <tr
                                    key={idx}
                                    className="hover:bg-indigo-50/30 transition-colors duration-150"
                                >
                                    {columns.map((col) => {
                                        const value = row[col];
                                        const isNumeric = typeof value === 'number';
                                        const isHighlighted = highlightColumns.includes(col);

                                        return (
                                            <td
                                                key={col}
                                                className={`px-4 py-3 text-sm whitespace-nowrap ${isHighlighted
                                                        ? 'font-semibold text-indigo-900 bg-indigo-50/50'
                                                        : isMetricColumn(col)
                                                            ? 'text-slate-700 font-medium'
                                                            : 'text-slate-600'
                                                    } ${isNumeric ? 'text-right tabular-nums' : 'text-left'
                                                    }`}
                                            >
                                                {formatValue(value)}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
                <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    Identifier columns
                </span>
                <span className="flex items-center gap-1">
                    <span className="text-blue-500">📊</span>
                    Metric columns
                </span>
            </div>
        </div>
    );
}

