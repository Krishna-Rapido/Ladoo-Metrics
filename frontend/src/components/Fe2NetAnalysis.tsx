import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getFe2Net, type Fe2NetResponse } from '../lib/api';
import { FunnelDataGrid } from './FunnelDataGrid';
import { ChartBuilder } from './ChartBuilder';

export function Fe2NetAnalysis() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<Fe2NetResponse | null>(null);
    const [showChart, setShowChart] = useState(false);

    // Parameters
    const [username, setUsername] = useState('krishna.poddar@rapido.bike');
    const [startDate, setStartDate] = useState('20250801');
    const [endDate, setEndDate] = useState('20251031');
    const [city, setCity] = useState('delhi');
    const [serviceCategory, setServiceCategory] = useState('bike_taxi');
    const [geoLevel, setGeoLevel] = useState('city');
    const [timeLevel, setTimeLevel] = useState('daily');

    const handleRunAnalysis = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getFe2Net({
                username,
                start_date: startDate,
                end_date: endDate,
                city,
                service_category: serviceCategory,
                geo_level: geoLevel,
                time_level: timeLevel,
            });
            setData(res);
        } catch (e: any) {
            setError(e.message ?? 'Failed to fetch FE2Net data');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Parameters Card */}
            <div className="glass-card">
                <div className="card-header">
                    <span className="card-icon">⚙️</span>
                    <div>
                        <h3 className="card-title">Analysis Parameters</h3>
                        <p className="card-subtitle">Configure parameters for FE2Net funnel analysis</p>
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
                            placeholder="20250801"
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
                            placeholder="20251031"
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
                            placeholder="delhi"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Service Category
                        </label>
                        <input
                            type="text"
                            value={serviceCategory}
                            onChange={(e) => setServiceCategory(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="bike_taxi"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Geo Level
                        </label>
                        <select
                            value={geoLevel}
                            onChange={(e) => setGeoLevel(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="city">City</option>
                            <option value="zone">Zone</option>
                            <option value="cluster">Cluster</option>
                        </select>
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
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                        </select>
                    </div>
                    <div className="col-span-3">
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
                                <span>Run FE2Net Analysis</span>
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
                                <h3 className="card-title">Analysis Results</h3>
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
                                fileName="fe2net_funnel"
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
                            <ChartBuilder data={data.data} title="FE2Net Funnel Visualization" />
                        </motion.div>
                    )}
                </motion.div>
            )}

            {/* Empty State */}
            {!data && !loading && !error && (
                <div className="glass-card">
                    <div className="text-center py-16 text-slate-500">
                        <p className="text-5xl mb-4">📊</p>
                        <p className="text-lg font-medium text-slate-700">Ready to Analyze</p>
                        <p className="text-sm mt-2">
                            Configure parameters above and click "Run FE2Net Analysis"
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

