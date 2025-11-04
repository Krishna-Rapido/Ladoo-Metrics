import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DaprBucketAnalysis } from './DaprBucketAnalysis';
import { Fe2NetAnalysis } from './Fe2NetAnalysis';
import { RtuPerformanceAnalysis } from './RtuPerformanceAnalysis';

type Section = 'quality' | 'retention' | null;
type QualityTab = 'dapr' | null;
type RetentionTab = 'fe2net' | 'rtu' | null;

export function CaptainDashboards() {
    const [activeSection, setActiveSection] = useState<Section>(null);
    const [activeQualityTab, setActiveQualityTab] = useState<QualityTab>(null);
    const [activeRetentionTab, setActiveRetentionTab] = useState<RetentionTab>(null);

    const sections = [
        { id: 'quality', label: 'Quality', icon: '⭐', description: 'Quality metrics and analysis' },
        { id: 'retention', label: 'Retention', icon: '🔄', description: 'Retention and funnel analysis' },
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

    return (
        <div className="glass-card slide-in">
            <div className="card-header">
                <span className="card-icon">👨‍✈️</span>
                <div>
                    <h2 className="card-title">Captain Dashboards</h2>
                    <p className="card-subtitle">Specialized analytics and insights for captain management</p>
                </div>
            </div>

            <div className="mt-8">
                {/* Section Selection - Bold Glassmorphic Buttons */}
                <div className="grid grid-cols-2 gap-6 mb-10">
                    {sections.map((section) => (
                        <motion.button
                            key={section.id}
                            onClick={() => {
                                setActiveSection(section.id as Section);
                                if (section.id === 'quality') {
                                    setActiveQualityTab('dapr');
                                    setActiveRetentionTab(null);
                                } else if (section.id === 'retention') {
                                    setActiveRetentionTab('fe2net');
                                    setActiveQualityTab(null);
                                }
                            }}
                            whileHover={{ scale: 1.03, y: -4 }}
                            whileTap={{ scale: 0.97 }}
                            className={`relative overflow-hidden p-8 rounded-2xl text-left transition-all duration-300 ${activeSection === section.id
                                ? 'bg-gradient-to-br from-purple-500/20 via-blue-500/20 to-indigo-500/20 backdrop-blur-xl border-2 border-purple-400 shadow-2xl'
                                : 'bg-white/60 backdrop-blur-lg border-2 border-slate-200/50 shadow-lg hover:border-purple-300 hover:shadow-xl'
                                }`}
                        >
                            {/* Animated gradient background for active */}
                            {activeSection === section.id && (
                                <div className="absolute inset-0 bg-gradient-to-r from-purple-400/10 via-pink-400/10 to-blue-400/10 animate-pulse" />
                            )}

                            <div className="relative z-10">
                                <div className="flex items-center gap-4 mb-3">
                                    <span className="text-5xl">{section.icon}</span>
                                    <h3 className="text-2xl font-black text-slate-800">{section.label}</h3>
                                </div>
                                <p className="text-sm font-medium text-slate-600">{section.description}</p>
                            </div>
                        </motion.button>
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
                            {/* Quality Tabs - BIG Rounded Buttons with Outline */}
                            <div className="flex flex-wrap gap-5 mb-10">
                                {qualityTabs.map((tab) => (
                                    <motion.button
                                        key={tab.id}
                                        onClick={() => setActiveQualityTab(tab.id as QualityTab)}
                                        whileHover={{ scale: 1.05, y: -3 }}
                                        whileTap={{ scale: 0.95 }}
                                        className={`relative overflow-hidden px-10 py-5 rounded-3xl font-bold text-lg transition-all duration-300 ${activeQualityTab === tab.id
                                                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white border-4 border-purple-400 shadow-2xl ring-4 ring-purple-200'
                                                : 'bg-white/80 backdrop-blur-lg text-slate-800 border-3 border-slate-300 shadow-lg hover:border-purple-400 hover:shadow-2xl hover:bg-purple-50/50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <span className="text-3xl">{tab.icon}</span>
                                            <span className="tracking-wide">{tab.label}</span>
                                        </div>
                                        {activeQualityTab === tab.id && (
                                            <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-white/5 to-transparent animate-pulse" />
                                        )}
                                    </motion.button>
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
                            {/* Retention Tabs - BIG Rounded Buttons with Outline */}
                            <div className="flex flex-wrap gap-5 mb-10">
                                {retentionTabs.map((tab) => (
                                    <motion.button
                                        key={tab.id}
                                        onClick={() => setActiveRetentionTab(tab.id as RetentionTab)}
                                        whileHover={{ scale: 1.05, y: -3 }}
                                        whileTap={{ scale: 0.95 }}
                                        className={`relative overflow-hidden px-10 py-5 rounded-3xl font-bold text-lg transition-all duration-300 ${activeRetentionTab === tab.id
                                                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white border-4 border-purple-400 shadow-2xl ring-4 ring-purple-200'
                                                : 'bg-white/80 backdrop-blur-lg text-slate-800 border-3 border-slate-300 shadow-lg hover:border-purple-400 hover:shadow-2xl hover:bg-purple-50/50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <span className="text-3xl">{tab.icon}</span>
                                            <span className="tracking-wide">{tab.label}</span>
                                        </div>
                                        {activeRetentionTab === tab.id && (
                                            <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-white/5 to-transparent animate-pulse" />
                                        )}
                                    </motion.button>
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

                    {/* Empty State */}
                    {!activeSection && (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-16 text-slate-500"
                        >
                            <p className="text-5xl mb-4">👨‍✈️</p>
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

