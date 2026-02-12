import { useState, useEffect, useMemo } from 'react';
import { fetchFullSessionData, previewSessionData } from '@/lib/api';

interface UseDiscoverDataOptions {
    sessionId: string | null;
    /**
     * If true, fetches full dataset (for preview/display).
     * If false, only fetches metadata (columns, types) - used for visualization setup.
     * Visualization aggregation happens on backend via /data/visualize endpoint.
     */
    useFullDataset?: boolean;
}

interface DiscoverDataResult {
    data: Record<string, any>[];
    columns: string[];
    numericColumns: string[];
    categoricalColumns: string[];
    isLoading: boolean;
    error: string | null;
    rowCount: number;
}

/**
 * Hook for fetching session data or metadata.
 * - If useFullDataset=true: fetches full dataset (for preview/display)
 * - If useFullDataset=false: only fetches metadata (columns, types) - used for visualization setup
 * 
 * Note: For visualization, aggregation happens on backend via /data/visualize endpoint
 * to avoid transferring millions of rows.
 */
export function useDiscoverData({ sessionId, useFullDataset = false }: UseDiscoverDataOptions): DiscoverDataResult {
    const [data, setData] = useState<Record<string, any>[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rowCount, setRowCount] = useState(0);

    useEffect(() => {
        if (!sessionId) {
            setData([]);
            setColumns([]);
            setRowCount(0);
            setError(null);
            setIsLoading(false);
            return;
        }

        let cancelled = false;
        setIsLoading(true);
        setError(null);

        if (useFullDataset) {
            // Fetch full dataset
            fetchFullSessionData(sessionId)
                .then((result) => {
                    if (cancelled) return;
                    setData(result.preview || []);
                    setColumns(result.columns || []);
                    setRowCount(result.total_rows || 0);
                })
                .catch((err) => {
                    if (cancelled) return;
                    const errorMessage = err instanceof Error ? err.message : 'Failed to load full dataset';
                    console.error('Error loading full dataset:', err);
                    setError(errorMessage);
                    setData([]);
                    setColumns([]);
                    setRowCount(0);
                })
                .finally(() => {
                    if (!cancelled) setIsLoading(false);
                });
        } else {
            // Only fetch metadata (columns) - use a small preview to get column info
            previewSessionData(sessionId, 100)
                .then((result) => {
                    if (cancelled) return;
                    setData([]); // Don't store data, only metadata
                    setColumns(result.columns || []);
                    setRowCount(result.total_rows || 0);
                })
                .catch((err) => {
                    if (cancelled) return;
                    const errorMessage = err instanceof Error ? err.message : 'Failed to load metadata';
                    console.error('Error loading metadata:', err);
                    setError(errorMessage);
                    setData([]);
                    setColumns([]);
                    setRowCount(0);
                })
                .finally(() => {
                    if (!cancelled) setIsLoading(false);
                });
        }

        return () => {
            cancelled = true;
        };
    }, [sessionId, useFullDataset]);

    // Identify numeric and categorical columns
    const { numericColumns, categoricalColumns } = useMemo(() => {
        if (!data || data.length === 0) {
            return { numericColumns: [], categoricalColumns: [] };
        }

        const numeric: string[] = [];
        const categorical: string[] = [];

        columns.forEach((col) => {
            // Check first few rows to determine type
            let isNumeric = true;
            let hasNumericValue = false;

            for (let i = 0; i < Math.min(10, data.length); i++) {
                const value = data[i]?.[col];
                if (value === null || value === undefined || value === '') continue;

                const numValue = Number(value);
                if (!isNaN(numValue) && isFinite(numValue)) {
                    hasNumericValue = true;
                } else {
                    isNumeric = false;
                    break;
                }
            }

            if (isNumeric && hasNumericValue) {
                numeric.push(col);
            } else {
                categorical.push(col);
            }
        });

        return { numericColumns: numeric, categoricalColumns: categorical };
    }, [data, columns]);

    return {
        data,
        columns,
        numericColumns,
        categoricalColumns,
        isLoading,
        error,
        rowCount,
    };
}
