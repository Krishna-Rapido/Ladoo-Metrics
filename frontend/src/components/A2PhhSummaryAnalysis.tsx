import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getA2PhhSummary, type A2PhhSummaryResponse } from '../lib/api';
import { FunnelDataGrid } from './FunnelDataGrid';
import { ChartBuilder } from './ChartBuilder';

export function A2PhhSummaryAnalysis() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<A2PhhSummaryResponse | null>(null);
    const [showChart, setShowChart] = useState(false);

    // Parameters
    const [username, setUsername] = useState('krishna.poddar@rapido.bike');
    const [startDate, setStartDate] = useState('20251001');
    const [endDate, setEndDate] = useState('20251130');
    const [city, setCity] = useState('bangalore');
    const [service, setService] = useState('auto');
    const [timeLevel, setTimeLevel] = useState('day');

    const handleRunAnalysis = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getA2PhhSummary({
                username,
                start_date: startDate,
                end_date: endDate,
                city,
                service,
                time_level: timeLevel,
            });
            setData(res);
        } catch (e: any) {
            setError(e.message ?? 'Failed to fetch A2PHH Summary data');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Parameters Card */}
            <div className="glass-card">
                <div className="card-header">
                    <span className="card-icon">🎯</span>
                    <div>
                        <h3 className="card-title">A2PHH Summary M0 Dashboard</h3>
                        <p className="card-subtitle">Activation to Productive Happy Hour metrics</p>
                    </div>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-4">
                    {/* Date Range */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Start Date (YYYYMMDD)
                        </label>
                        <input
                            type="text"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="20251001"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            End Date (YYYYMMDD)
                        </label>
                        <input
                            type="text"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="20251130"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            City
                        </label>
                        <input
                            type="text"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="bangalore"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Service
                        </label>
                        <input
                            type="text"
                            value={service}
                            onChange={(e) => setService(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="auto"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Time Level
                        </label>
                        <select
                            value={timeLevel}
                            onChange={(e) => setTimeLevel(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="day">Day</option>
                            <option value="week">Week</option>
                            <option value="month">Month</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Presto Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="your.name@rapido.bike"
                        />
                    </div>
                </div>

                <div className="mt-6">
                    <button
                        onClick={handleRunAnalysis}
                        className="btn btn-primary w-full"
                        disabled={loading || !username}
                    >
                        {loading ? (
                            <>
                                <span className="animate-spin">⏳</span>
                                <span>Running Analysis...</span>
                            </>
                        ) : (
                            <>
                                <span>▶</span>
                                <span>Run A2PHH Summary Analysis</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Error Display */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                            <div className="flex items-center gap-2">
                                <span className="text-red-500 text-xl">⚠️</span>
                                <span className="text-red-700 font-medium">Error</span>
                            </div>
                            <p className="text-red-600 text-sm mt-1">{error}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Results Card */}
            {data && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                >
                    <div className="glass-card">
                        <div className="card-header">
                            <span className="card-icon">📊</span>
                            <div className="flex-1">
                                <h3 className="card-title">A2PHH Summary Results</h3>
                                <p className="card-subtitle">
                                    {data.num_rows.toLocaleString()} rows × {data.columns.length} columns
                                </p>
                            </div>
                            <button
                                onClick={() => setShowChart(!showChart)}
                                className={`btn ${showChart ? 'btn-primary' : 'btn-secondary'}`}
                            >
                                <span>{showChart ? '📊' : '📈'}</span>
                                <span>{showChart ? 'Hide Chart' : 'Visualize Data'}</span>
                            </button>
                        </div>

                        <div className="mt-6">
                            <FunnelDataGrid
                                data={data.data}
                                title=""
                                description=""
                                fileName="a2phh_summary"
                            />
                        </div>
                    </div>

                    {/* Chart Builder */}
                    {showChart && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                        >
                            <ChartBuilder data={data.data} title="A2PHH Summary Visualization" />
                        </motion.div>
                    )}
                </motion.div>
            )}

            {/* Empty State */}
            {!data && !loading && !error && (
                <div className="glass-card">
                    <div className="text-center py-16 text-slate-500">
                        <p className="text-5xl mb-4">🎯</p>
                        <p className="text-lg font-medium text-slate-700">Ready to Analyze</p>
                        <p className="text-sm mt-2">
                            Configure parameters above and click "Run A2PHH Summary Analysis"
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

