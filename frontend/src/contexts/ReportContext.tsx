import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { createReport, addReportItem, listReportItems, type ReportItem, type ReportAddRequest } from '../lib/api';
import { supabase, type SavedReport, type ReportItemData } from '../lib/supabase';

interface ReportContextType {
    reportId: string | null;
    items: ReportItem[];
    isLoading: boolean;
    addItem: (item: ReportAddRequest) => Promise<void>;
    refreshItems: () => Promise<void>;
    showReportBuilder: boolean;
    setShowReportBuilder: (show: boolean) => void;
    // Cloud save/load functions
    savedReports: SavedReport[];
    isSavingToCloud: boolean;
    isLoadingFromCloud: boolean;
    saveToCloud: (name: string, folderId?: string | null) => Promise<void>;
    loadFromCloud: (reportId: string) => Promise<void>;
    listSavedReports: () => Promise<void>;
    deleteSavedReport: (reportId: string) => Promise<void>;
    currentSavedReportName: string | null;
}

const ReportContext = createContext<ReportContextType | null>(null);

export function ReportProvider({ children }: { children: ReactNode }) {
    const [reportId, setReportId] = useState<string | null>(null);
    const [items, setItems] = useState<ReportItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showReportBuilder, setShowReportBuilder] = useState(false);
    
    // Cloud storage state
    const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
    const [isSavingToCloud, setIsSavingToCloud] = useState(false);
    const [isLoadingFromCloud, setIsLoadingFromCloud] = useState(false);
    const [currentSavedReportName, setCurrentSavedReportName] = useState<string | null>(null);

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
            
            // Clear the current saved report name since we've modified the report
            setCurrentSavedReportName(null);
        } catch (error) {
            console.error('Failed to add report item:', error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    // List saved reports from Supabase
    const listSavedReports = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setSavedReports([]);
                return;
            }

            const { data, error } = await supabase
                .from('saved_reports')
                .select('*')
                .eq('user_id', user.id)
                .order('updated_at', { ascending: false });

            if (error) {
                console.error('Failed to list saved reports:', error);
                return;
            }

            setSavedReports(data || []);
        } catch (error) {
            console.error('Failed to list saved reports:', error);
        }
    }, []);

    // Save current report to Supabase
    const saveToCloud = async (name: string, folderId?: string | null) => {
        try {
            setIsSavingToCloud(true);

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error('You must be logged in to save reports');
            }

            // Convert items to the format for storage
            const itemsData: ReportItemData[] = items.map(item => ({
                id: item.id,
                type: item.type,
                title: item.title,
                content: item.content,
                comment: item.comment,
                timestamp: item.timestamp,
            }));

            const { error } = await supabase
                .from('saved_reports')
                .insert({
                    user_id: user.id,
                    name,
                    folder_id: folderId || null,
                    items: itemsData,
                });

            if (error) {
                // Provide user-friendly error messages
                if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
                    throw new Error('Database table not set up. Please run the migration SQL in your Supabase Dashboard.');
                }
                throw new Error(error.message || 'Failed to save report');
            }

            setCurrentSavedReportName(name);
            
            // Refresh the list of saved reports
            await listSavedReports();
        } catch (error) {
            console.error('Failed to save report to cloud:', error);
            throw error;
        } finally {
            setIsSavingToCloud(false);
        }
    };

    // Load a saved report from Supabase
    const loadFromCloud = async (savedReportId: string) => {
        try {
            setIsLoadingFromCloud(true);

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error('You must be logged in to load reports');
            }

            const { data, error } = await supabase
                .from('saved_reports')
                .select('*')
                .eq('id', savedReportId)
                .eq('user_id', user.id)
                .single();

            if (error) {
                throw error;
            }

            if (!data) {
                throw new Error('Report not found');
            }

            // Create a new backend report session
            const { report_id } = await createReport();
            setReportId(report_id);
            localStorage.setItem('report_id', report_id);

            // Add each item from the saved report to the new session
            const savedItems = data.items as ReportItemData[];
            for (const item of savedItems) {
                await addReportItem(
                    {
                        type: item.type,
                        title: item.title,
                        content: item.content,
                        comment: item.comment,
                    },
                    report_id
                );
            }

            // Refresh items to show the loaded report
            await refreshItemsInternal(report_id);
            
            setCurrentSavedReportName(data.name);
        } catch (error) {
            console.error('Failed to load report from cloud:', error);
            throw error;
        } finally {
            setIsLoadingFromCloud(false);
        }
    };

    // Delete a saved report from Supabase
    const deleteSavedReport = async (savedReportId: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error('You must be logged in to delete reports');
            }

            const { error } = await supabase
                .from('saved_reports')
                .delete()
                .eq('id', savedReportId)
                .eq('user_id', user.id);

            if (error) {
                throw error;
            }

            // Refresh the list of saved reports
            await listSavedReports();
        } catch (error) {
            console.error('Failed to delete saved report:', error);
            throw error;
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
                // Cloud save/load
                savedReports,
                isSavingToCloud,
                isLoadingFromCloud,
                saveToCloud,
                loadFromCloud,
                listSavedReports,
                deleteSavedReport,
                currentSavedReportName,
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
