import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    uploadMobileNumbers,
    getCaptainIds,
    getAOFunnel,
    useFunnelForAnalysis,
    exportFunnelCsv,
    type MobileNumberUploadResponse,
    type CaptainIdResponse,
    type AOFunnelResponse,
    type UploadResponse,
} from '../lib/api';
import { FunnelDataGrid } from './FunnelDataGrid';

type Step = 'upload' | 'captain-ids' | 'ao-funnel' | 'complete';

interface FunnelAnalysisProps {
    onDataReady?: (uploadResponse: UploadResponse) => void;
}

export function FunnelAnalysis({ onDataReady }: FunnelAnalysisProps) {
    const [currentStep, setCurrentStep] = useState<Step>('upload');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Data from each step
    const [uploadData, setUploadData] = useState<MobileNumberUploadResponse | null>(null);
    const [captainIdData, setCaptainIdData] = useState<CaptainIdResponse | null>(null);
    const [funnelData, setFunnelData] = useState<AOFunnelResponse | null>(null);


    // Form inputs
    const [username, setUsername] = useState('krishna.poddar@rapido.bike');
    const [startDate, setStartDate] = useState('20250801');
    const [endDate, setEndDate] = useState('20251031');
    const [timeLevel, setTimeLevel] = useState<'daily' | 'weekly' | 'monthly'>('daily');
    const [todLevel, setTodLevel] = useState<'daily' | 'afternoon' | 'evening' | 'morning' | 'night' | 'all'>('daily');

    const [dragOver, setDragOver] = useState(false);

    // Calculate summary metrics for upload step
    const uploadSummary = useMemo(() => {
        if (!uploadData) return null;

        const uniqueMobileNumbers = uploadData.num_rows;
        const cohortCounts: Record<string, number> = {};

        // Count unique mobile numbers per cohort from preview data
        if (uploadData.has_cohort && uploadData.preview) {
            uploadData.preview.forEach(row => {
                const cohort = row.cohort || 'Unknown';
                cohortCounts[cohort] = (cohortCounts[cohort] || 0) + 1;
            });
        }

        return {
            totalRows: uploadData.num_rows,
            uniqueMobileNumbers,
            cohortCounts: uploadData.has_cohort ? cohortCounts : null,
        };
    }, [uploadData]);

    // Calculate summary for captain IDs
    const captainIdSummary = useMemo(() => {
        if (!captainIdData) return null;
        return {
            uniqueCaptainIds: captainIdData.num_captains_found,
            totalRows: captainIdData.num_rows,
            matchRate: ((captainIdData.num_captains_found / captainIdData.num_rows) * 100).toFixed(2),
        };
    }, [captainIdData]);

    // Calculate summary for AO funnel
    const funnelSummary = useMemo(() => {
        if (!funnelData) return null;

        return {
            totalDataPoints: funnelData.num_rows,
            uniqueCaptainIds: funnelData.unique_captain_ids,
            metricsCount: funnelData.metrics.length,
        };
    }, [funnelData]);

    // Export full dataset as CSV
    const handleExportCsv = async () => {
        try {
            await exportFunnelCsv();
        } catch (e: any) {
            setError(e.message ?? 'Failed to export CSV');
        }
    };

    // Step 1: Upload mobile numbers
    const handleUpload = useCallback(async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const file = files[0];
        setLoading(true);
        setError(null);
        try {
            const res = await uploadMobileNumbers(file);
            setUploadData(res);
            setCurrentStep('captain-ids');
        } catch (e: any) {
            setError(e.message ?? 'Upload failed');
        } finally {
            setLoading(false);
        }
    }, []);

    // Step 2: Get captain IDs
    const handleGetCaptainIds = async () => {
        if (!username.trim()) {
            setError('Please enter a Presto username');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await getCaptainIds(username);
            setCaptainIdData(res);
            setCurrentStep('ao-funnel');
        } catch (e: any) {
            setError(e.message ?? 'Failed to fetch captain IDs');
        } finally {
            setLoading(false);
        }
    };

    // Step 3: Get AO funnel
    const handleGetAOFunnel = async () => {
        if (!username.trim()) {
            setError('Please enter a Presto username');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await getAOFunnel({
                username,
                start_date: startDate,
                end_date: endDate,
                time_level: timeLevel,
                tod_level: todLevel,
            });
            setFunnelData(res);
            setCurrentStep('complete');
        } catch (e: any) {
            setError(e.message ?? 'Failed to fetch AO funnel data');
        } finally {
            setLoading(false);
        }
    };

    const resetWizard = () => {
        setCurrentStep('upload');
        setUploadData(null);
        setCaptainIdData(null);
        setFunnelData(null);
        setError(null);
    };

    // Transfer funnel data to main analysis session
    const handleUseForAnalysis = async () => {
        setLoading(true);
        setError(null);
        try {
            const uploadResponse = await useFunnelForAnalysis();
            if (onDataReady) {
                onDataReady(uploadResponse);
            }
        } catch (e: any) {
            setError(e.message ?? 'Failed to transfer data for analysis');
        } finally {
            setLoading(false);
        }
    };

    const steps = [
        { id: 'upload', label: 'Upload', icon: '📤', completed: !!uploadData },
        { id: 'captain-ids', label: 'Captain IDs', icon: '👥', completed: !!captainIdData },
        { id: 'ao-funnel', label: 'AO Funnel', icon: '📊', completed: !!funnelData },
    ];

    const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

    return (
        <div className="glass-card slide-in">
            {/* Header */}
            <div className="card-header">
                <span className="card-icon">🔍</span>
                <div>
                    <h2 className="card-title">Funnel Analysis</h2>
                    <p className="card-subtitle">Upload mobile numbers and fetch AO funnel metrics from Presto</p>
                </div>
            </div>

            <div className="mt-6">
                {/* Progress Steps */}
                <div className="mb-8">
                    <div className="flex items-center justify-between relative">
                        {/* Progress Line */}
                        <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-200">
                            <motion.div
                                className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
                                initial={{ width: '0%' }}
                                animate={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>

                        {/* Step Circles */}
                        {steps.map((step, idx) => (
                            <div key={step.id} className="relative z-10 flex flex-col items-center flex-1">
                                <motion.div
                                    initial={false}
                                    animate={{ scale: currentStep === step.id ? 1.1 : 1 }}
                                    className={`w-11 h-11 rounded-full flex items-center justify-center text-xl font-bold transition-all duration-300 ${step.completed || idx <= currentStepIndex
                                        ? 'bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-lg'
                                        : 'bg-white text-slate-400 border-2 border-slate-200'
                                        }`}
                                >
                                    {step.completed ? '✓' : step.icon}
                                </motion.div>
                                <span
                                    className={`mt-2 text-sm font-medium ${currentStep === step.id ? 'text-purple-600' : 'text-slate-600'
                                        }`}
                                >
                                    {step.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Error Display */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-6 overflow-hidden"
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

                {/* Step Content */}
                <div className="space-y-6">
                    <AnimatePresence mode="wait">
                        {/* STEP 1: Upload */}
                        {currentStep === 'upload' && (
                            <motion.div
                                key="upload"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                                className="space-y-6"
                            >
                                <label
                                    className={`relative block cursor-pointer group ${dragOver ? 'scale-[1.02]' : ''}`}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        setDragOver(true);
                                    }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        setDragOver(false);
                                        handleUpload(e.dataTransfer.files);
                                    }}
                                >
                                    <input
                                        type="file"
                                        accept=".csv"
                                        className="hidden"
                                        onChange={(e) => handleUpload(e.target.files)}
                                    />
                                    <div
                                        className={`p-12 rounded-lg border-2 border-dashed transition-all duration-300 ${dragOver
                                            ? 'border-purple-500 bg-purple-50'
                                            : 'border-slate-300 bg-slate-50 group-hover:border-purple-400 group-hover:bg-purple-50/30'
                                            }`}
                                    >
                                        <div className="text-center">
                                            <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">
                                                {loading ? '⏳' : '📁'}
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-800 mb-2">
                                                {loading ? 'Uploading...' : 'Upload CSV with Mobile Numbers'}
                                            </h3>
                                            <p className="text-slate-600 mb-4">
                                                Required: <span className="font-semibold">mobile_number</span> column
                                                <br />
                                                Optional: <span className="font-semibold">cohort</span> column
                                            </p>
                                            <div className="btn btn-primary">
                                                <span>Click to browse</span>
                                                <span>→</span>
                                            </div>
                                        </div>
                                    </div>
                                </label>

                                {/* Show upload summary if data exists */}
                                {uploadSummary && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="grid grid-cols-3 gap-4"
                                    >
                                        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                                            <div className="text-sm font-medium text-slate-600 mb-1">Total Rows</div>
                                            <div className="text-2xl font-bold text-slate-800">
                                                {uploadSummary.totalRows.toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                                            <div className="text-sm font-medium text-slate-600 mb-1">Unique Mobile Numbers</div>
                                            <div className="text-2xl font-bold text-slate-800">
                                                {uploadSummary.uniqueMobileNumbers.toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                                            <div className="text-sm font-medium text-slate-600 mb-1">Has Cohort</div>
                                            <div className="text-2xl font-bold text-slate-800">
                                                {uploadSummary.cohortCounts ? '✓' : '✗'}
                                            </div>
                                        </div>
                                        {uploadSummary.cohortCounts && (
                                            <div className="col-span-3 p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                                                <div className="text-sm font-medium text-slate-600 mb-2">Cohort Distribution</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {Object.entries(uploadSummary.cohortCounts).map(([cohort, count]) => (
                                                        <div key={cohort} className="px-3 py-1.5 bg-purple-50 rounded-full text-sm">
                                                            <span className="font-semibold text-purple-700">{cohort}:</span>
                                                            <span className="ml-1 text-purple-600">{count}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </motion.div>
                        )}

                        {/* STEP 2: Get Captain IDs */}
                        {currentStep === 'captain-ids' && uploadData && (
                            <motion.div
                                key="captain-ids"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                                className="space-y-6"
                            >
                                {/* Summary from previous step */}
                                {uploadSummary && (
                                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xl">📊</span>
                                            <h3 className="font-semibold text-blue-900">Upload Complete</h3>
                                        </div>
                                        <div className="flex gap-4 text-sm text-blue-800">
                                            <span><strong>{uploadSummary.totalRows.toLocaleString()}</strong> rows uploaded</span>
                                            <span><strong>{uploadSummary.uniqueMobileNumbers.toLocaleString()}</strong> unique mobile numbers</span>
                                        </div>
                                    </div>
                                )}

                                {/* Data preview */}
                                {uploadData.preview && uploadData.preview.length > 0 && (
                                    <FunnelDataGrid
                                        data={uploadData.preview}
                                        title="Uploaded Data Preview"
                                        description="First 5 rows of uploaded data"
                                        fileName="mobile_numbers"
                                    />
                                )}

                                {/* Username Input */}
                                <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        🔐 Presto Username
                                    </label>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        placeholder="your.name@rapido.bike"
                                    />
                                </div>

                                {/* Captain ID Summary if available */}
                                {captainIdSummary && (
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                                            <div className="text-sm font-medium text-slate-600 mb-1">Unique Captain IDs</div>
                                            <div className="text-2xl font-bold text-green-600">
                                                {captainIdSummary.uniqueCaptainIds.toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                                            <div className="text-sm font-medium text-slate-600 mb-1">Match Rate</div>
                                            <div className="text-2xl font-bold text-green-600">
                                                {captainIdSummary.matchRate}%
                                            </div>
                                        </div>
                                        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                                            <div className="text-sm font-medium text-slate-600 mb-1">Unmatched</div>
                                            <div className="text-2xl font-bold text-amber-600">
                                                {(captainIdSummary.totalRows - captainIdSummary.uniqueCaptainIds).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Captain ID Data Grid */}
                                {captainIdData && captainIdData.preview && captainIdData.preview.length > 0 && (
                                    <FunnelDataGrid
                                        data={captainIdData.preview}
                                        title="Captain IDs Preview"
                                        description="First 5 rows with captain IDs"
                                        fileName="captain_ids"
                                    />
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-4">
                                    <button
                                        onClick={resetWizard}
                                        className="btn btn-secondary"
                                        disabled={loading}
                                    >
                                        ← Back
                                    </button>
                                    <button
                                        onClick={handleGetCaptainIds}
                                        className="btn btn-primary flex-1"
                                        disabled={loading || !username.trim()}
                                    >
                                        {loading ? (
                                            <>
                                                <span className="animate-spin">⏳</span>
                                                <span>Fetching Captain IDs...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Get Captain IDs</span>
                                                <span>→</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 3: Get AO Funnel */}
                        {currentStep === 'ao-funnel' && captainIdData && (
                            <motion.div
                                key="ao-funnel"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                                className="space-y-6"
                            >
                                {/* Summary from previous step */}
                                {captainIdSummary && (
                                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xl">✅</span>
                                            <h3 className="font-semibold text-green-900">Captain IDs Retrieved</h3>
                                        </div>
                                        <div className="flex gap-4 text-sm text-green-800">
                                            <span><strong>{captainIdSummary.uniqueCaptainIds.toLocaleString()}</strong> captain IDs found</span>
                                            <span><strong>{captainIdSummary.matchRate}%</strong> match rate</span>
                                        </div>
                                    </div>
                                )}

                                {/* Funnel Parameters */}
                                <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                                    <h4 className="text-lg font-semibold text-slate-800 mb-4">⚙️ Funnel Parameters</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                Start Date (YYYYMMDD)
                                            </label>
                                            <input
                                                type="text"
                                                value={startDate}
                                                onChange={(e) => setStartDate(e.target.value)}
                                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                Time Level
                                            </label>
                                            <select
                                                value={timeLevel}
                                                onChange={(e) => setTimeLevel(e.target.value as any)}
                                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            >
                                                <option value="daily">Daily</option>
                                                <option value="weekly">Weekly</option>
                                                <option value="monthly">Monthly</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                Time of Day Level
                                            </label>
                                            <select
                                                value={todLevel}
                                                onChange={(e) => setTodLevel(e.target.value as any)}
                                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            >
                                                <option value="daily">Daily</option>
                                                <option value="afternoon">Afternoon</option>
                                                <option value="evening">Evening</option>
                                                <option value="morning">Morning</option>
                                                <option value="night">Night</option>
                                                <option value="all">All</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Funnel Summary if available */}
                                {funnelSummary && (
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                                            <div className="text-sm font-medium text-slate-600 mb-1">Total Data Points</div>
                                            <div className="text-2xl font-bold text-purple-600">
                                                {funnelSummary.totalDataPoints.toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                                            <div className="text-sm font-medium text-slate-600 mb-1">Unique Captain IDs</div>
                                            <div className="text-2xl font-bold text-purple-600">
                                                {funnelSummary.uniqueCaptainIds.toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                                            <div className="text-sm font-medium text-slate-600 mb-1">Metrics Available</div>
                                            <div className="text-2xl font-bold text-purple-600">
                                                {funnelSummary.metricsCount}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setCurrentStep('captain-ids')}
                                        className="btn btn-secondary"
                                        disabled={loading}
                                    >
                                        ← Back
                                    </button>
                                    <button
                                        onClick={handleGetAOFunnel}
                                        className="btn btn-primary flex-1"
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <>
                                                <span className="animate-spin">⏳</span>
                                                <span>Fetching Funnel Data...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Get AO Funnel</span>
                                                <span>→</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 4: Complete */}
                        {currentStep === 'complete' && funnelData && (
                            <motion.div
                                key="complete"
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.4 }}
                                className="space-y-6"
                            >
                                {/* Success Banner */}
                                <div className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="text-4xl">🎉</span>
                                        <h3 className="text-2xl font-bold text-purple-900">AO Funnel Data Ready!</h3>
                                    </div>

                                    {funnelSummary && (
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="p-3 bg-white/80 rounded-lg">
                                                <div className="text-xs font-medium text-purple-600 mb-1">Total Data Points</div>
                                                <div className="text-2xl font-bold text-purple-900">
                                                    {funnelSummary.totalDataPoints.toLocaleString()}
                                                </div>
                                                <div className="text-xs text-purple-600">Captain × Days</div>
                                            </div>
                                            <div className="p-3 bg-white/80 rounded-lg">
                                                <div className="text-xs font-medium text-purple-600 mb-1">Unique Captains</div>
                                                <div className="text-2xl font-bold text-purple-900">
                                                    {funnelSummary.uniqueCaptainIds.toLocaleString()}
                                                </div>
                                                <div className="text-xs text-purple-600">In dataset</div>
                                            </div>
                                            <div className="p-3 bg-white/80 rounded-lg">
                                                <div className="text-xs font-medium text-purple-600 mb-1">Available Metrics</div>
                                                <div className="text-2xl font-bold text-purple-900">
                                                    {funnelSummary.metricsCount}
                                                </div>
                                                <div className="text-xs text-purple-600">Ready for analysis</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Metrics List */}
                                    <div className="mt-4 p-3 bg-white/60 rounded-lg">
                                        <div className="text-sm font-semibold text-purple-800 mb-2">📊 Available Metrics</div>
                                        <div className="metric-pills flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                            {funnelData.metrics.map((metric) => (
                                                <span
                                                    key={metric}
                                                    className="metric-pill bg-purple-100 text-purple-700 rounded flex items-center text-xs font-medium px-3 py-1"
                                                    title={metric}
                                                >
                                                    {metric.replace(/_/g, ' ')}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Data Grid with Export */}
                                {funnelData.preview && funnelData.preview.length > 0 && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-lg font-semibold text-slate-800">AO Funnel Metrics</h3>
                                                <p className="text-sm text-slate-600">
                                                    Preview of first 10 rows - Export downloads full dataset
                                                </p>
                                            </div>
                                            <button
                                                onClick={handleExportCsv}
                                                className="btn btn-primary"
                                            >
                                                <span>📥</span>
                                                <span>Export Full Dataset (CSV)</span>
                                            </button>
                                        </div>
                                        <FunnelDataGrid
                                            data={funnelData.preview}
                                            title=""
                                            description=""
                                            fileName="ao_funnel_preview"
                                        />
                                    </div>
                                )}

                                {/* Action Card */}
                                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                    <p className="text-sm text-green-800 mb-3 flex items-start gap-2">
                                        <span className="text-xl">💡</span>
                                        <span>
                                            <strong>Next Step:</strong> Transfer this funnel data to the main cohort
                                            analysis section for advanced plotting, filtering, and statistical testing.
                                        </span>
                                    </p>
                                    <button
                                        onClick={handleUseForAnalysis}
                                        className="btn btn-success w-full"
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <>
                                                <span className="animate-spin">⏳</span>
                                                <span>Preparing Data...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>📊</span>
                                                <span>Use for Cohort Analysis</span>
                                                <span>→</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Reset Button */}
                                <div className="text-center">
                                    <button
                                        onClick={resetWizard}
                                        className="btn btn-secondary"
                                        disabled={loading}
                                    >
                                        Start New Analysis
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
