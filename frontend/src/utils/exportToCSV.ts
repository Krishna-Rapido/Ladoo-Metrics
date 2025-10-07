/**
 * Utility function to export table data to CSV file
 */

import type { DataFrameJSON } from '../types/dataframe';

/**
 * Convert DataFrame JSON to CSV string
 */
export function convertToCSV(dataframe: DataFrameJSON): string {
    const { columns, data } = dataframe;

    // Create CSV header
    const header = columns.join(',');

    // Create CSV rows
    const rows = data.map((row) => {
        return columns
            .map((col) => {
                const value = row[col];
                // Handle nulls and undefined
                if (value === null || value === undefined) return '';
                // Escape values containing commas, quotes, or newlines
                const stringValue = String(value);
                if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                    return `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
            })
            .join(',');
    });

    return [header, ...rows].join('\n');
}

/**
 * Download CSV file to user's machine
 */
export function downloadCSV(dataframe: DataFrameJSON, filename: string = 'export.csv'): void {
    const csv = convertToCSV(dataframe);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (link.download !== undefined) {
        // Create download link
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

/**
 * Copy CSV to clipboard
 */
export async function copyToClipboard(dataframe: DataFrameJSON): Promise<void> {
    const csv = convertToCSV(dataframe);
    await navigator.clipboard.writeText(csv);
}

