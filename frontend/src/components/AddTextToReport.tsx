import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReport } from '../contexts/ReportContext';

export function AddTextToReport() {
    const [showModal, setShowModal] = useState(false);
    const [title, setTitle] = useState('');
    const [text, setText] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);
    const { addItem } = useReport();

    const handleSubmit = async () => {
        if (!title.trim() || !text.trim()) {
            alert('Please provide both title and text');
            return;
        }

        try {
            await addItem({
                type: 'text',
                title: title.trim(),
                content: { text: text.trim() },
                comment: '',
            });

            setShowSuccess(true);
            setTitle('');
            setText('');
            setShowModal(false);
            setTimeout(() => setShowSuccess(false), 2000);
        } catch (error) {
            console.error('Failed to add text to report:', error);
            alert('Failed to add text to report');
        }
    };

    return (
        <>
            {/* Floating Success Badge */}
            <AnimatePresence>
                {showSuccess && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0, y: 50 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0 }}
                        className="fixed bottom-24 right-6 z-50 px-6 py-3 bg-green-500 text-white rounded-full shadow-2xl font-semibold"
                    >
                        <span className="flex items-center gap-2">
                            <span>✓</span>
                            <span>Text Added to Report!</span>
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Trigger Button */}
            <motion.button
                onClick={() => setShowModal(true)}
                className="fixed bottom-24 left-6 z-40 px-5 py-3 bg-white border-2 border-purple-300 text-purple-700 rounded-full shadow-lg hover:shadow-xl transition-all font-semibold"
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
            >
                <span className="flex items-center gap-2">
                    <span className="text-lg">✍️</span>
                    <span>Add Note to Report</span>
                </span>
            </motion.button>

            {/* Modal */}
            <AnimatePresence>
                {showModal && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowModal(false)}
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                        />

                        {/* Modal Content */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl"
                        >
                            <div className="bg-white rounded-2xl shadow-2xl p-8">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <span className="text-3xl">✍️</span>
                                        <div>
                                            <h2 className="text-2xl font-bold text-slate-800">Add Note to Report</h2>
                                            <p className="text-sm text-slate-600">Document observations, insights, or context</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="px-3 py-2 text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        ✕
                                    </button>
                                </div>

                                {/* Form */}
                                <div className="space-y-4">
                                    {/* Title Input */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Title
                                        </label>
                                        <input
                                            type="text"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            placeholder="e.g., Key Finding, Observation, Next Steps"
                                            autoFocus
                                        />
                                    </div>

                                    {/* Text Input */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Note
                                        </label>
                                        <textarea
                                            value={text}
                                            onChange={(e) => setText(e.target.value)}
                                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                            rows={6}
                                            placeholder="Write your observations, insights, conclusions, or next steps..."
                                        />
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-3 pt-4">
                                        <button
                                            onClick={handleSubmit}
                                            className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                                        >
                                            <span className="mr-2">📝</span>
                                            Add to Report
                                        </button>
                                        <button
                                            onClick={() => setShowModal(false)}
                                            className="px-6 py-3 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition-all"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}

