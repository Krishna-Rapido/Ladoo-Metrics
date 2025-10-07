// frontend/src/components/CohortAggregation.tsx
import { useState, useEffect } from 'react';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

function getSessionId(): string | null {
    return localStorage.getItem('session_id');
}

function sessionHeaders(): Headers {
    const h = new Headers();
    const session = getSessionId();
    if (session) h.set('x-session-id', session);
    return h;
}

export function CohortAggregation() {
    const [htmlTable, setHtmlTable] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchCohortData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${BASE_URL}/cohort-aggregation`, {
                headers: sessionHeaders(),
            });
            if (!res.ok) throw new Error(await res.text());
            const html = await res.text();
            setHtmlTable(html);
        } catch (e: any) {
            setError(e.message ?? 'Failed to load cohort aggregation data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCohortData();
    }, []);

    return (
        <div className="glass-card slide-in">
            <div className="card-header">
                <span className="card-icon">📊</span>
                <div>
                    <h2 className="card-title">Cohort Aggregation Table</h2>
                    <p className="card-subtitle">Interactive view of cohort-level metrics</p>
                </div>
                <button
                    onClick={fetchCohortData}
                    className="ml-auto px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700
                   transition shadow-sm hover:shadow-md font-medium text-sm flex items-center gap-2"
                >
                    <span>🔄</span>
                    <span>Refresh</span>
                </button>
            </div>

            {loading && (
                <div className="flex items-center justify-center py-12">
                    <div className="loading-spinner"></div>
                    <span className="ml-3 text-slate-600 font-medium">Loading cohort data...</span>
                </div>
            )}

            {error && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                    <div className="flex items-center gap-2">
                        <span className="text-red-500">⚠️</span>
                        <span className="text-red-700 font-medium">Error</span>
                    </div>
                    <p className="text-red-600 text-sm mt-1">{error}</p>
                </div>
            )}

            {!loading && !error && htmlTable && (
                <div className="mt-6 p-4 bg-white/80 rounded-xl shadow-sm">
                    <div
                        className="overflow-x-auto"
                        dangerouslySetInnerHTML={{ __html: htmlTable }}
                    />
                </div>
            )}

            {!loading && !error && !htmlTable && (
                <div className="text-center py-12 text-gray-500">
                    <p className="text-lg">📭 No data available</p>
                    <p className="text-sm mt-2">Please upload a CSV file with the required columns first.</p>
                </div>
            )}
        </div>
    );
}
