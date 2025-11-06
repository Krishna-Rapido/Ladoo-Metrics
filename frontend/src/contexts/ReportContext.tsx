import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { createReport, addReportItem, listReportItems, type ReportItem, type ReportAddRequest } from '../lib/api';

interface ReportContextType {
    reportId: string | null;
    items: ReportItem[];
    isLoading: boolean;
    addItem: (item: ReportAddRequest) => Promise<void>;
    refreshItems: () => Promise<void>;
    showReportBuilder: boolean;
    setShowReportBuilder: (show: boolean) => void;
}

const ReportContext = createContext<ReportContextType | null>(null);

export function ReportProvider({ children }: { children: ReactNode }) {
    const [reportId, setReportId] = useState<string | null>(null);
    const [items, setItems] = useState<ReportItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showReportBuilder, setShowReportBuilder] = useState(false);

    // Initialize report on mount
    useEffect(() => {
        const initReport = async () => {
            try {
                const { report_id } = await createReport();
                setReportId(report_id);
                localStorage.setItem('report_id', report_id);
            } catch (error) {
                console.error('Failed to create report:', error);
            }
        };

        // Check if we have an existing report ID in localStorage
        const existingReportId = localStorage.getItem('report_id');
        if (existingReportId) {
            setReportId(existingReportId);
            refreshItemsInternal(existingReportId);
        } else {
            initReport();
        }
    }, []);

    const refreshItemsInternal = async (id: string) => {
        try {
            setIsLoading(true);
            console.log('Fetching report items for ID:', id);
            const response = await listReportItems(id);
            console.log('List items response:', response);

            if (response.report_id && response.report_id !== id) {
                // Update report ID if it changed
                setReportId(response.report_id);
                localStorage.setItem('report_id', response.report_id);
            }

            setItems(response.items || []);
        } catch (error) {
            console.error('Failed to fetch report items:', error);
            setItems([]);
        } finally {
            setIsLoading(false);
        }
    };

    const refreshItems = async () => {
        if (reportId) {
            await refreshItemsInternal(reportId);
        }
    };

    const addItem = async (item: ReportAddRequest) => {
        let currentReportId = reportId;

        // If no report ID, create one
        if (!currentReportId) {
            try {
                const { report_id } = await createReport();
                currentReportId = report_id;
                setReportId(report_id);
                localStorage.setItem('report_id', report_id);
            } catch (error) {
                console.error('Failed to create report:', error);
                throw new Error('Failed to create report session');
            }
        }

        try {
            setIsLoading(true);
            const response = await addReportItem(item, currentReportId);
            console.log('Add item response:', response);

            // Update report ID if it was created
            if (response.report_id && response.report_id !== currentReportId) {
                setReportId(response.report_id);
                localStorage.setItem('report_id', response.report_id);
            }

            await refreshItemsInternal(currentReportId || response.report_id);
        } catch (error) {
            console.error('Failed to add report item:', error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ReportContext.Provider
            value={{
                reportId,
                items,
                isLoading,
                addItem,
                refreshItems,
                showReportBuilder,
                setShowReportBuilder,
            }}
        >
            {children}
        </ReportContext.Provider>
    );
}

export function useReport() {
    const context = useContext(ReportContext);
    if (!context) {
        throw new Error('useReport must be used within ReportProvider');
    }
    return context;
}

