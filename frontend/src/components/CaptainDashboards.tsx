import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DaprBucketAnalysis } from './DaprBucketAnalysis';
import { Fe2NetAnalysis } from './Fe2NetAnalysis';
import { RtuPerformanceAnalysis } from './RtuPerformanceAnalysis';
import { R2AAnalysis } from './R2AAnalysis';
import { R2APercentageAnalysis } from './R2APercentageAnalysis';
import { A2PhhSummaryAnalysis } from './A2PhhSummaryAnalysis';

type Section = 'quality' | 'retention' | 'acquisition' | null;
type QualityTab = 'dapr' | null;
type RetentionTab = 'fe2net' | 'rtu' | null;
type AcquisitionTab = 'r2a' | 'r2a_percentage' | 'a2phh' | null;

export function CaptainDashboards() {
    const [activeSection, setActiveSection] = useState<Section>(null);
    const [activeQualityTab, setActiveQualityTab] = useState<QualityTab>(null);
    const [activeRetentionTab, setActiveRetentionTab] = useState<RetentionTab>(null);
    const [activeAcquisitionTab, setActiveAcquisitionTab] = useState<AcquisitionTab>(null);

    const sections = [
        { id: 'quality', label: 'Quality', icon: '⭐', description: '                  ' },
        { id: 'retention', label: 'Retention', icon: '🔄', description: '                  ' },
        { id: 'acquisition', label: 'Acquisition', icon: '🎯', description: '                  ' },
        // Future sections can be added here
        // { id: 'performance', label: 'Performance', icon: '🚀', description: 'Performance analytics' },
    ];

    const qualityTabs = [
        { id: 'dapr', label: 'Dapr Bucket Distribution : Mode City Time level', icon: '📊' },
        // Future tabs:
        // { id: 'ratings', label: 'Ratings Analysis', icon: '⭐' },
        // { id: 'cancellations', label: 'Cancellation Patterns', icon: '❌' },
    ];

    const retentionTabs = [
        { id: 'fe2net', label: 'FE2Net Funnel', icon: '📈' },
        { id: 'rtu', label: 'RTU Performance', icon: '🚀' },
        // Future tabs:
        // { id: 'cohort', label: 'Cohort Retention', icon: '👥' },
        // { id: 'churn', label: 'Churn Analysis', icon: '📉' },
    ];

    const acquisitionTabs = [
        { id: 'r2a', label: 'R2A% - Registrations / Activations', icon: '📊' },
        { id: 'r2a_percentage', label: 'R2A %', icon: '📈' },
        { id: 'a2phh', label: 'A2PHH-Summary-M0', icon: '🎯' },
    ];

    return (
        <div className="glass-card slide-in">
            <div className="card-header">
                {/* <span className="card-icon">👨‍✈️</span> */}
                <div>
                    <h2 className="card-title">Captain Dashboards</h2>
                    <p className="card-subtitle">Specialized analytics and insights for captain management</p>
                </div>
            </div>

            <div className="mt-6">
                {/* Section Selection */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-120 mb-100 justify-center items-center place-items-center">
                    {sections.map((section) => (
                        <>

                            <motion.button
                                key={section.id}
                                onClick={() => {
                                    setActiveSection(section.id as Section);
                                    if (section.id === 'quality') {
                                        setActiveQualityTab('dapr');
                                        setActiveRetentionTab(null);
                                        setActiveAcquisitionTab(null);
                                    } else if (section.id === 'retention') {
                                        setActiveRetentionTab('fe2net');
                                        setActiveQualityTab(null);
                                        setActiveAcquisitionTab(null);
                                    } else if (section.id === 'acquisition') {
                                        setActiveAcquisitionTab('r2a');
                                        setActiveQualityTab(null);
                                        setActiveRetentionTab(null);
                                    }
                                }}
                                whileHover={{ scale: 1.03, y: -4 }}
                                whileTap={{ scale: 0.97 }}
                                className={`group relative overflow-hidden rounded-3xl p-8 text-left backdrop-blur-xl transition-all duration-300 border ${activeSection === section.id
                                    ? 'border-purple-300/70 bg-white/30 shadow-[0_22px_60px_rgba(109,40,217,0.28)]'
                                    : 'border-white/20 bg-white/15 shadow-[0_15px_40px_rgba(15,23,42,0.12)] hover:border-purple-200 hover:bg-white/25 hover:shadow-[0_26px_70px_rgba(109,40,217,0.22)]'
                                    }`}
                            >
                                <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-purple-400/20 via-blue-400/15 to-cyan-300/10" />
                                {activeSection === section.id && (
                                    <div className="absolute inset-0 pointer-events-none rounded-3xl border border-white/50" />
                                )}
                                <div className="relative flex items-center gap-4 mb-3">
                                    <span className="text-4xl">{section.icon}</span>
                                    <h3 className="text-2xl font-extrabold tracking-wide text-slate-900">
                                        {section.label}
                                    </h3>
                                </div>
                                <p className="relative text-sm font-medium text-slate-600">
                                    {section.description}
                                </p>
                            </motion.button>
                        </>
                    ))}
                </div>

                {/* Section Content */}
                <AnimatePresence mode="wait">
                    {activeSection === 'quality' && (
                        <motion.div
                            key="quality"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-6"
                        >
                            {/* Quality Tabs */}
                            <div className="flex flex-col gap-4">
                                {qualityTabs.map((tab) => (
                                    <>
                                        <motion.button
                                            key={tab.id}
                                            onClick={() => setActiveQualityTab(tab.id as QualityTab)}
                                            whileHover={{ scale: 1.05, y: -2 }}
                                            whileTap={{ scale: 0.95 }}
                                            className={`group relative overflow-hidden px-8 py-4 rounded-3xl font-semibold tracking-wide backdrop-blur-xl border transition-all duration-300 ${activeQualityTab === tab.id
                                                ? 'bg-gradient-to-r from-purple-500/40 via-pink-500/30 to-blue-500/40 text-purple-900 border-purple-300 shadow-[0_18px_48px_rgba(109,40,217,0.28)]'
                                                : 'bg-white/20 text-slate-700 border-white/25 shadow-[0_12px_32px_rgba(15,23,42,0.12)] hover:bg-white/30 hover:border-purple-200 hover:text-purple-700'
                                                }`}
                                        >
                                            <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-white/40 via-white/10 to-transparent" />
                                            {activeQualityTab === tab.id && (
                                                <span className="absolute inset-0 rounded-3xl border border-white/50 pointer-events-none" />
                                            )}
                                            <span className="relative flex items-center gap-3 text-2xl">
                                                <span className="text-3xl">{tab.icon}</span>
                                                <span className="whitespace-nowrap">{tab.label}</span>
                                            </span>
                                        </motion.button>
                                        <br />
                                    </>
                                ))}
                            </div>

                            {/* Tab Content */}
                            <AnimatePresence mode="wait">
                                {activeQualityTab === 'dapr' && (
                                    <motion.div
                                        key="dapr"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <DaprBucketAnalysis />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}

                    {/* Retention Section */}
                    {activeSection === 'retention' && (
                        <motion.div
                            key="retention"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-6"
                        >
                            {/* Retention Tabs */}
                            <div className="flex flex-col gap-4 mb-4">
                                {retentionTabs.map((tab) => (
                                    <>
                                        <motion.button
                                            key={tab.id}
                                            onClick={() => setActiveRetentionTab(tab.id as RetentionTab)}
                                            whileHover={{ scale: 1.06, y: -3 }}
                                            whileTap={{ scale: 0.95 }}
                                            className={`group relative overflow-hidden px-9 py-4 rounded-3xl font-semibold tracking-wide backdrop-blur-xl border transition-all duration-300 ${activeRetentionTab === tab.id
                                                ? 'bg-gradient-to-r from-purple-500/45 via-fuchsia-500/35 to-blue-500/45 text-white border-purple-300 shadow-[0_20px_60px_rgba(124,58,237,0.32)]'
                                                : 'bg-white/20 text-slate-700 border-white/25 shadow-[0_12px_34px_rgba(15,23,42,0.14)] hover:bg-white/30 hover:border-purple-200 hover:text-purple-700'
                                                }`}
                                        >
                                            <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-white/50 via-white/15 to-transparent" />
                                            {activeRetentionTab === tab.id && (
                                                <span className="absolute inset-0 rounded-3xl border border-white/50 pointer-events-none" />
                                            )}
                                            <span className="relative flex items-center gap-3 text-2xl">
                                                <span className="text-3xl">{tab.icon}</span>
                                                <span className="whitespace-nowrap">{tab.label}</span>
                                            </span>
                                        </motion.button>
                                        <br />
                                    </>
                                ))}
                            </div>

                            {/* Tab Content */}
                            <AnimatePresence mode="wait">
                                {activeRetentionTab === 'fe2net' && (
                                    <motion.div
                                        key="fe2net"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <Fe2NetAnalysis />
                                    </motion.div>
                                )}
                                {activeRetentionTab === 'rtu' && (
                                    <motion.div
                                        key="rtu"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <RtuPerformanceAnalysis />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}

                    {/* Acquisition Section */}
                    {activeSection === 'acquisition' && (
                        <motion.div
                            key="acquisition"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-6"
                        >
                            {/* Acquisition Tabs */}
                            <div className="flex flex-col gap-4">
                                {acquisitionTabs.map((tab) => (
                                    <>
                                        <motion.button
                                            key={tab.id}
                                            onClick={() => setActiveAcquisitionTab(tab.id as AcquisitionTab)}
                                            whileHover={{ scale: 1.05, y: -2 }}
                                            whileTap={{ scale: 0.95 }}
                                            className={`group relative overflow-hidden px-8 py-4 rounded-3xl font-semibold tracking-wide backdrop-blur-xl border transition-all duration-300 ${activeAcquisitionTab === tab.id
                                                ? 'bg-gradient-to-r from-purple-500/40 via-pink-500/30 to-blue-500/40 text-purple-900 border-purple-300 shadow-[0_18px_48px_rgba(109,40,217,0.28)]'
                                                : 'bg-white/20 text-slate-700 border-white/25 shadow-[0_12px_32px_rgba(15,23,42,0.12)] hover:bg-white/30 hover:border-purple-200 hover:text-purple-700'
                                                }`}
                                        >
                                            <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-white/40 via-white/10 to-transparent" />
                                            {activeAcquisitionTab === tab.id && (
                                                <span className="absolute inset-0 rounded-3xl border border-white/50 pointer-events-none" />
                                            )}
                                            <span className="relative flex items-center gap-3 text-2xl">
                                                <span className="text-3xl">{tab.icon}</span>
                                                <span className="whitespace-nowrap">{tab.label}</span>
                                            </span>
                                        </motion.button>
                                        <br />
                                    </>
                                ))}
                            </div>

                            {/* Tab Content */}
                            <AnimatePresence mode="wait">
                                {activeAcquisitionTab === 'r2a' && (
                                    <motion.div
                                        key="r2a"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <R2AAnalysis />
                                    </motion.div>
                                )}
                                {activeAcquisitionTab === 'r2a_percentage' && (
                                    <motion.div
                                        key="r2a_percentage"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <R2APercentageAnalysis />
                                    </motion.div>
                                )}
                                {activeAcquisitionTab === 'a2phh' && (
                                    <motion.div
                                        key="a2phh"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <A2PhhSummaryAnalysis />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}

                    {/* Empty State */}
                    {!activeSection && (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-16 text-slate-500"
                        >
                            {/* <p className="text-5xl mb-4">👨‍✈️</p> */}
                            <p className="text-lg font-medium text-slate-700">Select a Dashboard</p>
                            <p className="text-sm mt-2">
                                Choose a section above to access specialized captain analytics
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

