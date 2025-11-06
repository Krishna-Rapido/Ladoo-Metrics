import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useReport } from '../contexts/ReportContext';
import { updateReportComment, updateReportTitle, deleteReportItem, exportReport, clearReport } from '../lib/api';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReportItem } from '../lib/api';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

// Sortable Card Component
function SortableReportCard({
    item,
    editingComment,
    commentText,
    editingTitle,
    titleText,
    onEditComment,
    onCommentTextChange,
    onSaveComment,
    onCancelEdit,
    onEditTitle,
    onTitleTextChange,
    onSaveTitle,
    onCancelTitleEdit,
    onDelete,
}: {
    item: ReportItem;
    editingComment: string | null;
    commentText: string;
    editingTitle: string | null;
    titleText: string;
    onEditComment: (id: string, currentComment: string) => void;
    onCommentTextChange: (text: string) => void;
    onSaveComment: (id: string) => void;
    onCancelEdit: () => void;
    onEditTitle: (id: string, currentTitle: string) => void;
    onTitleTextChange: (text: string) => void;
    onSaveTitle: (id: string) => void;
    onCancelTitleEdit: () => void;
    onDelete: (id: string) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 100 }}
                className={`glass-card ${isDragging ? 'ring-2 ring-purple-400' : ''}`}
            >
                {/* Card Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-full text-xs font-bold uppercase">
                                {item.type}
                            </span>
                            <span className="text-xs text-slate-500">
                                {new Date(item.timestamp).toLocaleString()}
                            </span>
                        </div>
                        {editingTitle === item.id ? (
                            <div className="flex items-center gap-2 w-full">
                                <input
                                    type="text"
                                    value={titleText}
                                    onChange={(e) => onTitleTextChange(e.target.value)}
                                    className="flex-1 px-3 py-2 border border-purple-300 rounded-lg text-xl font-bold text-slate-800 focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            onSaveTitle(item.id);
                                        } else if (e.key === 'Escape') {
                                            onCancelTitleEdit();
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => onSaveTitle(item.id)}
                                    className="px-3 py-2 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition-all"
                                >
                                    ✓
                                </button>
                                <button
                                    onClick={onCancelTitleEdit}
                                    className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-300 transition-all"
                                >
                                    ✕
                                </button>
                            </div>
                        ) : (
                            <h3
                                className="text-xl font-bold text-slate-800 cursor-pointer hover:text-purple-600 transition-colors flex items-center gap-2"
                                onClick={() => onEditTitle(item.id, item.title)}
                                title="Click to edit title"
                            >
                                {item.title}
                                <span className="text-xs text-slate-400">✏️</span>
                            </h3>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            {...listeners}
                            className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-purple-600 transition-colors p-2"
                            title="Drag to reorder"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                            </svg>
                        </button>
                        <button
                            onClick={() => onDelete(item.id)}
                            className="text-red-400 hover:text-red-600 transition-colors p-2"
                            title="Remove from report"
                        >
                            🗑️
                        </button>
                    </div>
                </div>

                {/* Chart/Table Image Preview */}
                {item.type === 'chart' && item.content.imageDataUrl && (
                    <div className="mb-4 rounded-lg overflow-hidden border border-slate-200 shadow-sm bg-white">
                        <img
                            src={item.content.imageDataUrl}
                            alt={item.title}
                            className="w-full h-auto"
                        />
                    </div>
                )}

                {item.type === 'table' && item.content.imageDataUrl && (
                    <div className="mb-4 rounded-lg overflow-hidden border border-slate-200 shadow-sm bg-white">
                        <img
                            src={item.content.imageDataUrl}
                            alt={item.title}
                            className="w-full h-auto"
                        />
                    </div>
                )}

                {/* Text Content */}
                {item.type === 'text' && item.content.text && (
                    <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 leading-relaxed">
                        {item.content.text}
                    </div>
                )}

                {/* Comment Section */}
                {editingComment === item.id ? (
                    <div className="mt-4 bg-white rounded-lg border border-purple-300 p-4">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Add Comment</label>
                        <textarea
                            value={commentText}
                            onChange={(e) => onCommentTextChange(e.target.value)}
                            className="w-full p-3 border border-slate-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                            rows={4}
                            placeholder="Add your observations, insights, or next steps..."
                            autoFocus
                        />
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={() => onSaveComment(item.id)}
                                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-sm font-semibold hover:shadow-lg transition-all"
                            >
                                💾 Save
                            </button>
                            <button
                                onClick={onCancelEdit}
                                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-300 transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <div>
                        {item.comment ? (
                            <div
                                className="mt-4 p-4 bg-gradient-to-r from-yellow-50 to-amber-50 border-l-4 border-yellow-400 rounded-lg text-sm text-slate-800 cursor-pointer hover:bg-gradient-to-r hover:from-yellow-100 hover:to-amber-100 transition-all"
                                onClick={() => onEditComment(item.id, item.comment)}
                            >
                                <div className="font-semibold text-yellow-800 text-xs mb-1 uppercase">💬 Comment</div>
                                <div className="italic">{item.comment}</div>
                            </div>
                        ) : (
                            <button
                                onClick={() => onEditComment(item.id, '')}
                                className="mt-4 w-full px-4 py-3 border-2 border-dashed border-purple-300 rounded-lg text-sm text-purple-600 hover:border-purple-500 hover:bg-purple-50 transition-all font-medium"
                            >
                                + Add comment
                            </button>
                        )}
                    </div>
                )}
            </motion.div>
        </div>
    );
}

export function ReportBuilder() {
    const { reportId, items, refreshItems, isLoading, showReportBuilder, setShowReportBuilder } = useReport();
    const [editingComment, setEditingComment] = useState<string | null>(null);
    const [commentText, setCommentText] = useState('');
    const [editingTitle, setEditingTitle] = useState<string | null>(null);
    const [titleText, setTitleText] = useState('');
    const [localItems, setLocalItems] = useState<ReportItem[]>([]);
    const [exportLoading, setExportLoading] = useState<string | null>(null);

    // Sensors for drag and drop
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Sync items with local state for reordering
    useEffect(() => {
        setLocalItems(items);
    }, [items]);

    useEffect(() => {
        if (reportId && showReportBuilder) {
            refreshItems();
        }
    }, [reportId, showReportBuilder]);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setLocalItems((items) => {
                const oldIndex = items.findIndex(item => item.id === active.id);
                const newIndex = items.findIndex(item => item.id === over.id);

                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleUpdateComment = async (itemId: string) => {
        if (!reportId) return;

        try {
            await updateReportComment(itemId, commentText, reportId);
            await refreshItems();
            setEditingComment(null);
            setCommentText('');
        } catch (error) {
            console.error('Failed to update comment:', error);
            alert('Failed to update comment');
        }
    };

    const handleUpdateTitle = async (itemId: string) => {
        if (!reportId) return;

        try {
            await updateReportTitle(itemId, titleText, reportId);
            await refreshItems();
            setEditingTitle(null);
            setTitleText('');
        } catch (error) {
            console.error('Failed to update title:', error);
            alert('Failed to update title');
        }
    };

    const handleDeleteItem = async (itemId: string) => {
        if (!reportId || !confirm('Are you sure you want to remove this item from the report?')) return;

        try {
            await deleteReportItem(itemId, reportId);
            await refreshItems();
        } catch (error) {
            console.error('Failed to delete item:', error);
            alert('Failed to delete item');
        }
    };

    const handleExport = async (format: 'html' | 'pdf' | 'png' | 'word') => {
        if (!reportId) {
            alert('No active report session');
            return;
        }

        setExportLoading(format);

        try {
            if (format === 'html') {
                const { report_html } = await exportReport(reportId);
                const blob = new Blob([report_html], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `experiment_report_${new Date().toISOString().split('T')[0]}.html`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } else {
                // For PDF, PNG, and Word, call backend endpoints
                const headers = new Headers();
                headers.set('x-report-id', reportId);

                let res: Response;
                try {
                    res = await fetch(`${BASE_URL}/report/export/${format}`, {
                        method: 'GET',
                        headers,
                    });
                } catch (fetchError) {
                    console.error('Network error:', fetchError);
                    throw new Error(`Network error: Unable to connect to backend. Make sure the backend server is running and the required libraries (reportlab, python-docx) are installed.`);
                }

                if (!res.ok) {
                    let errorText = '';
                    try {
                        errorText = await res.text();
                    } catch {
                        errorText = `HTTP ${res.status}: ${res.statusText}`;
                    }

                    // Check for specific error messages
                    if (errorText.includes('library not available') || errorText.includes('ModuleNotFoundError')) {
                        throw new Error(`Export library not installed. Please run: pip install ${format === 'pdf' ? 'reportlab' : 'python-docx'} Pillow`);
                    }

                    throw new Error(`Failed to export as ${format.toUpperCase()}: ${errorText}`);
                }

                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');

                let extension: string = format;
                if (format === 'word') extension = 'docx';

                a.href = url;
                a.download = `experiment_report_${new Date().toISOString().split('T')[0]}.${extension}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error(`Failed to export as ${format}:`, error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            alert(`Failed to export as ${format.toUpperCase()}.\n\n${errorMessage}\n\nPlease check:\n1. Backend server is running\n2. Required libraries are installed (pip install reportlab python-docx Pillow)`);
        } finally {
            setExportLoading(null);
        }
    };

    const handleClearReport = async () => {
        if (!reportId || !confirm('Are you sure you want to clear all items from the report?')) return;

        try {
            await clearReport(reportId);
            await refreshItems();
        } catch (error) {
            console.error('Failed to clear report:', error);
            alert('Failed to clear report');
        }
    };

    if (!showReportBuilder) {
        return (
            <motion.button
                onClick={() => setShowReportBuilder(true)}
                className="fixed bottom-6 right-6 z-40 group"
                whileHover={{ scale: 1.05, y: -3 }}
                whileTap={{ scale: 0.95 }}
            >
                <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl blur-xl opacity-60 group-hover:opacity-80 transition-opacity" />
                    <div className="relative px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl shadow-2xl backdrop-blur-sm border border-white/20">
                        <span className="flex items-center gap-3 font-bold">
                            <span className="text-2xl">📝</span>
                            <span className="text-base">Report Builder</span>
                            {items.length > 0 && (
                                <motion.span
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="px-2.5 py-1 bg-white/90 text-purple-600 rounded-full text-xs font-extrabold"
                                >
                                    {items.length}
                                </motion.span>
                            )}
                        </span>
                    </div>
                </div>
            </motion.button>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, x: 400 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 400 }}
            className="fixed top-0 right-0 h-full w-full bg-gradient-to-br from-slate-50 to-blue-50 shadow-2xl z-50 overflow-hidden flex flex-col border-l-2 border-purple-200"
        >
            {/* Header Toolbar */}
            <div className="bg-white border-b border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl">
                            <span className="text-2xl">📝</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">Experiment Report</h2>
                            <p className="text-sm text-slate-500">
                                {localItems.length} {localItems.length === 1 ? 'item' : 'items'} • Live Document
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowReportBuilder(false)}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700 font-semibold transition-all"
                    >
                        ✕ Close
                    </button>
                </div>

                {/* Export Buttons - Big Button List */}
                <div className="flex flex-row w-full gap-16 py-6 px-2">
                    <motion.button
                        onClick={() => handleExport('html')}
                        disabled={localItems.length === 0 || exportLoading === 'html'}
                        whileHover={{ scale: localItems.length === 0 || exportLoading === 'html' ? 1 : 1.02 }}
                        whileTap={{ scale: localItems.length === 0 || exportLoading === 'html' ? 1 : 0.98 }}
                        className="flex-1 flex items-center justify-center px-10 py-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-base font-bold hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl gap-8"
                    >
                        <span className="text-2xl">{exportLoading === 'html' ? '⏳' : '📄'}</span>
                        <span className="text-lg">HTML</span>
                    </motion.button>
                    <motion.button
                        onClick={() => handleExport('pdf')}
                        disabled={localItems.length === 0 || exportLoading === 'pdf'}
                        whileHover={{ scale: localItems.length === 0 || exportLoading === 'pdf' ? 1 : 1.02 }}
                        whileTap={{ scale: localItems.length === 0 || exportLoading === 'pdf' ? 1 : 0.98 }}
                        className="flex-1 flex items-center justify-center px-10 py-6 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl text-base font-bold hover:from-red-700 hover:to-red-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl gap-8"
                    >
                        <span className="text-2xl">{exportLoading === 'pdf' ? '⏳' : '📄'}</span>
                        <span className="text-lg">PDF</span>
                    </motion.button>
                    <motion.button
                        onClick={() => handleExport('png')}
                        disabled={localItems.length === 0 || exportLoading === 'png'}
                        whileHover={{ scale: localItems.length === 0 || exportLoading === 'png' ? 1 : 1.02 }}
                        whileTap={{ scale: localItems.length === 0 || exportLoading === 'png' ? 1 : 0.98 }}
                        className="flex-1 flex items-center justify-center px-10 py-6 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl text-base font-bold hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl gap-8"
                    >
                        <span className="text-2xl">{exportLoading === 'png' ? '⏳' : '🖼️'}</span>
                        <span className="text-lg">PNG</span>
                    </motion.button>
                    <motion.button
                        onClick={() => handleExport('word')}
                        disabled={localItems.length === 0 || exportLoading === 'word'}
                        whileHover={{ scale: localItems.length === 0 || exportLoading === 'word' ? 1 : 1.02 }}
                        whileTap={{ scale: localItems.length === 0 || exportLoading === 'word' ? 1 : 0.98 }}
                        className="flex-1 flex items-center justify-center px-10 py-6 bg-gradient-to-r from-blue-700 to-indigo-700 text-white rounded-xl text-base font-bold hover:from-blue-800 hover:to-indigo-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl gap-8"
                    >
                        <span className="text-2xl">{exportLoading === 'word' ? '⏳' : '📝'}</span>
                        <span className="text-lg">Word</span>
                    </motion.button>
                    <motion.button
                        onClick={handleClearReport}
                        disabled={localItems.length === 0}
                        whileHover={{ scale: localItems.length === 0 ? 1 : 1.02 }}
                        whileTap={{ scale: localItems.length === 0 ? 1 : 0.98 }}
                        className="flex-1 flex items-center justify-center px-10 py-6 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl text-base font-bold hover:from-red-600 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl gap-8"
                    >
                        <span className="text-2xl">🗑️</span>
                        <span className="text-lg">Clear All</span>
                    </motion.button>
                </div>
            </div>

            {/* Content Area - Cards */}
            <div className="flex-1 overflow-y-auto p-6">
                {isLoading && localItems.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                        <div className="animate-spin text-5xl mb-3">⏳</div>
                        <p className="font-medium">Loading report...</p>
                    </div>
                ) : localItems.length === 0 ? (
                    <div className="text-center py-20 px-6">
                        <div className="max-w-sm mx-auto">
                            <p className="text-6xl mb-6">📝</p>
                            <h2 className="text-2xl font-bold text-slate-800 mb-3">Start Your Report</h2>
                            <p className="text-slate-600 leading-relaxed mb-4">
                                Click <span className="font-semibold text-purple-600">"📝 Add to Report"</span> on any chart or table throughout the app to build your experiment documentation.
                            </p>
                            <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                                <p className="text-sm text-purple-700 font-medium">
                                    ✨ Available on: Charts • Tables • Captain Dashboards
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={localItems.map(item => item.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-4">
                                {localItems.map((item) => (
                                    <SortableReportCard
                                        key={item.id}
                                        item={item}
                                        editingComment={editingComment}
                                        commentText={commentText}
                                        editingTitle={editingTitle}
                                        titleText={titleText}
                                        onEditComment={(id, comment) => {
                                            setEditingComment(id);
                                            setCommentText(comment);
                                        }}
                                        onCommentTextChange={setCommentText}
                                        onSaveComment={handleUpdateComment}
                                        onCancelEdit={() => {
                                            setEditingComment(null);
                                            setCommentText('');
                                        }}
                                        onEditTitle={(id, title) => {
                                            setEditingTitle(id);
                                            setTitleText(title);
                                        }}
                                        onTitleTextChange={setTitleText}
                                        onSaveTitle={handleUpdateTitle}
                                        onCancelTitleEdit={() => {
                                            setEditingTitle(null);
                                            setTitleText('');
                                        }}
                                        onDelete={handleDeleteItem}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}
            </div>
        </motion.div>
    );
}
