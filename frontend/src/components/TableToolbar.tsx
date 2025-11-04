/**
 * Toolbar component with search, export, and other table controls
 */

import { useState } from 'react';
import type { DataFrameJSON } from '../types/dataframe';
import { downloadCSV, copyToClipboard } from '../utils/exportToCSV';

interface TableToolbarProps {
    globalFilter: string;
    onGlobalFilterChange: (value: string) => void;
    dataframe: DataFrameJSON;
    totalRows: number;
    filteredRows: number;
    enableExport?: boolean;
    title?: string;
}

export function TableToolbar({
    globalFilter,
    onGlobalFilterChange,
    dataframe,
    totalRows,
    filteredRows,
    enableExport = true,
    title,
}: TableToolbarProps) {
    const [copied, setCopied] = useState(false);

    const handleDownloadCSV = () => {
        const filename = title ? `${title.replace(/\s+/g, '_').toLowerCase()}.csv` : 'export.csv';
        downloadCSV(dataframe, filename);
    };

    const handleCopyToClipboard = async () => {
        try {
            await copyToClipboard(dataframe);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
        }
    };

    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            {/* Search Input */}
            <div className="flex-1 w-full sm:w-auto">
                <div className="relative">
                    <input
                        type="text"
                        value={globalFilter ?? ''}
                        onChange={(e) => onGlobalFilterChange(e.target.value)}
                        placeholder="🔍 Search across all columns..."
                        className="w-full px-4 py-2.5 pr-10 rounded-lg border border-gray-200 bg-white/80 backdrop-blur-sm 
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                     transition shadow-sm hover:shadow-md"
                    />
                    {globalFilter && (
                        <button
                            onClick={() => onGlobalFilterChange('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            title="Clear search"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Right Side Controls */}
            <div className="flex items-center gap-3">
                {/* Row Count Badge */}
                <div className="px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium">
                    {filteredRows === totalRows
                        ? `${totalRows} rows`
                        : `${filteredRows} of ${totalRows} rows`}
                </div>

                {/* Export Buttons */}
                {enableExport && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCopyToClipboard}
                            className="px-3 py-2 rounded-lg border border-gray-200 bg-white/80 backdrop-blur-sm 
                       hover:bg-gray-50 hover:shadow-md transition text-sm font-medium text-gray-700
                       flex items-center gap-2"
                            title="Copy to clipboard"
                        >
                            {copied ? (
                                <>
                                    <span>✓</span>
                                    <span>Copied!</span>
                                </>
                            ) : (
                                <>
                                    <span>📋</span>
                                    <span>Copy</span>
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleDownloadCSV}
                            className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 
                       hover:shadow-md transition text-sm font-medium flex items-center gap-2"
                            title="Download as CSV"
                        >
                            <span>⬇️</span>
                            <span>Export CSV</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}



