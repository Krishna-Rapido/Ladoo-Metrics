import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Trash2, Save, BookmarkPlus, Loader2, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    testCalculatedColumn,
    applyCalculatedColumn,
} from '@/lib/api';
import {
    listAllCalculatedColumns,
    createCalculatedColumn,
    type CalculatedColumn,
} from '@/lib/supabase';

interface CalculatedColumnPanelProps {
    sessionId: string;
    availableColumns: string[];
    appliedColumns: string[];
    onColumnApplied: (columnName: string) => void;
    onColumnRemoved: (columnName: string) => void;
}

type EditorMode = 'visual' | 'expression';
type Operator = '+' | '-' | '*' | '/' | '%';

const OPERATORS: { value: Operator; label: string; symbol: string }[] = [
    { value: '+', label: 'Add', symbol: '+' },
    { value: '-', label: 'Subtract', symbol: '\u2212' },
    { value: '*', label: 'Multiply', symbol: '\u00d7' },
    { value: '/', label: 'Divide', symbol: '\u00f7' },
    { value: '%', label: 'Modulo', symbol: '%' },
];

const TEMPLATES = [
    { name: 'Ratio', expression: "df['col_a'] / df['col_b']", description: 'Divide two columns' },
    { name: 'Sum', expression: "df['col_a'] + df['col_b']", description: 'Add two columns' },
    { name: 'Difference', expression: "df['col_a'] - df['col_b']", description: 'Subtract two columns' },
    { name: 'Percentage', expression: "(df['col_a'] / df['col_b']) * 100", description: 'Calculate percentage' },
    { name: 'Conditional', expression: "df['col_a'].apply(lambda x: 'high' if x > 100 else 'low')", description: 'Conditional logic' },
];

export function CalculatedColumnPanel({
    sessionId,
    availableColumns,
    appliedColumns,
    onColumnApplied,
    onColumnRemoved,
}: CalculatedColumnPanelProps) {
    const [mode, setMode] = useState<EditorMode>('visual');
    const [columnName, setColumnName] = useState('');

    // Visual mode state
    const [leftCol, setLeftCol] = useState('');
    const [operator, setOperator] = useState<Operator>('/');
    const [rightCol, setRightCol] = useState('');
    const [rightIsNumber, setRightIsNumber] = useState(false);
    const [rightNumber, setRightNumber] = useState('');

    // Expression mode state
    const [expression, setExpression] = useState('');

    // Test/apply state
    const [testing, setTesting] = useState(false);
    const [applying, setApplying] = useState(false);
    const [testResult, setTestResult] = useState<{
        success: boolean;
        error?: string | null;
        preview?: Record<string, unknown>[] | null;
        row_count: number;
    } | null>(null);

    // Supabase saved columns
    const [savedColumns, setSavedColumns] = useState<CalculatedColumn[]>([]);
    const [loadingSaved, setLoadingSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [showSaved, setShowSaved] = useState(false);

    // Load saved columns from Supabase
    useEffect(() => {
        loadSavedColumns();
    }, []);

    const loadSavedColumns = async () => {
        setLoadingSaved(true);
        try {
            const cols = await listAllCalculatedColumns();
            setSavedColumns(cols);
        } catch {
            // Silently fail — table might not exist
        } finally {
            setLoadingSaved(false);
        }
    };

    const getExpression = useCallback((): string => {
        if (mode === 'expression') return expression;
        if (!leftCol) return '';
        const right = rightIsNumber ? rightNumber : `df['${rightCol}']`;
        if (!right) return '';
        return `df['${leftCol}'] ${operator} ${right}`;
    }, [mode, expression, leftCol, operator, rightCol, rightIsNumber, rightNumber]);

    const handleTest = useCallback(async () => {
        const expr = getExpression();
        if (!expr) return;

        setTesting(true);
        setTestResult(null);
        try {
            const result = await testCalculatedColumn({
                expression: expr,
                session_id: sessionId,
            });
            setTestResult(result);
        } catch (err) {
            setTestResult({
                success: false,
                error: err instanceof Error ? err.message : 'Test failed',
                row_count: 0,
            });
        } finally {
            setTesting(false);
        }
    }, [getExpression, sessionId]);

    const handleApply = useCallback(async () => {
        const expr = getExpression();
        if (!expr || !columnName.trim()) return;

        setApplying(true);
        try {
            await applyCalculatedColumn({
                expression: expr,
                output_column: columnName.trim(),
                session_id: sessionId,
            });
            onColumnApplied(columnName.trim());
            setColumnName('');
            setExpression('');
            setLeftCol('');
            setRightCol('');
            setRightNumber('');
            setTestResult(null);
        } catch (err) {
            setTestResult({
                success: false,
                error: err instanceof Error ? err.message : 'Apply failed',
                row_count: 0,
            });
        } finally {
            setApplying(false);
        }
    }, [getExpression, columnName, sessionId, onColumnApplied]);

    const handleSaveToSupabase = useCallback(async () => {
        const expr = getExpression();
        if (!expr || !columnName.trim()) return;

        setSaving(true);
        try {
            // Extract input columns from expression
            const colMatches = expr.match(/df\['([^']+)'\]/g) || [];
            const inputCols = colMatches.map((m: string) => m.replace(/df\['|'\]/g, ''));

            await createCalculatedColumn(
                columnName.trim(),
                null,
                expr,
                columnName.trim(),
                inputCols,
            );
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
            await loadSavedColumns();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setSaving(false);
        }
    }, [getExpression, columnName]);

    const handleUseSaved = useCallback((saved: CalculatedColumn) => {
        setColumnName(saved.output_column);
        setExpression(saved.expression);
        setMode('expression');
        setShowSaved(false);
    }, []);

    const handleApplySavedDirectly = useCallback(async (saved: CalculatedColumn) => {
        setApplying(true);
        try {
            await applyCalculatedColumn({
                expression: saved.expression,
                output_column: saved.output_column,
                session_id: sessionId,
            });
            onColumnApplied(saved.output_column);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to apply');
        } finally {
            setApplying(false);
        }
    }, [sessionId, onColumnApplied]);

    const insertColumn = (col: string) => {
        setExpression((prev) => prev + `df['${col}']`);
    };

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
        >
            <div className="rounded-lg border-2 border-purple-200 bg-purple-50/30 p-5">
                {/* Header row: column name + mode toggle */}
                <div className="flex items-start gap-4 mb-4">
                    <div className="flex-1 space-y-1">
                        <Label className="text-xs font-medium text-slate-600">Column Name</Label>
                        <Input
                            value={columnName}
                            onChange={(e) => setColumnName(e.target.value)}
                            placeholder="e.g. earnings_per_trip"
                            className="font-mono text-sm h-9 bg-white"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs font-medium text-slate-600">Mode</Label>
                        <div className="flex gap-0.5 p-0.5 bg-slate-200 rounded-md">
                            <button
                                onClick={() => setMode('visual')}
                                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                                    mode === 'visual'
                                        ? 'bg-white text-slate-800 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                Visual
                            </button>
                            <button
                                onClick={() => setMode('expression')}
                                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                                    mode === 'expression'
                                        ? 'bg-white text-slate-800 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                Expression
                            </button>
                        </div>
                    </div>
                </div>

                {/* Visual Mode */}
                {mode === 'visual' && (
                    <div className="space-y-3 mb-4">
                        <div className="grid grid-cols-[1fr_80px_1fr] gap-3 items-end">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Column A</Label>
                                <select
                                    value={leftCol}
                                    onChange={(e) => setLeftCol(e.target.value)}
                                    className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                >
                                    <option value="">Select column...</option>
                                    {availableColumns.map((col) => (
                                        <option key={col} value={col}>{col}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Operator</Label>
                                <select
                                    value={operator}
                                    onChange={(e) => setOperator(e.target.value as Operator)}
                                    className="w-full rounded-md border border-input bg-white px-2 py-2 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                                >
                                    {OPERATORS.map((op) => (
                                        <option key={op.value} value={op.value}>{op.symbol}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground">
                                        {rightIsNumber ? 'Value' : 'Column B'}
                                    </Label>
                                    <button
                                        onClick={() => setRightIsNumber(!rightIsNumber)}
                                        className="text-[10px] font-medium text-purple-600 hover:text-purple-800"
                                    >
                                        {rightIsNumber ? 'Use column' : 'Use number'}
                                    </button>
                                </div>
                                {rightIsNumber ? (
                                    <Input
                                        type="number"
                                        value={rightNumber}
                                        onChange={(e) => setRightNumber(e.target.value)}
                                        placeholder="100"
                                        className="text-sm h-[38px] bg-white"
                                    />
                                ) : (
                                    <select
                                        value={rightCol}
                                        onChange={(e) => setRightCol(e.target.value)}
                                        className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    >
                                        <option value="">Select column...</option>
                                        {availableColumns.map((col) => (
                                            <option key={col} value={col}>{col}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </div>

                        {getExpression() && (
                            <div className="px-3 py-2 bg-white rounded-md border border-purple-200">
                                <span className="text-[10px] text-muted-foreground mr-2">Expression:</span>
                                <code className="text-xs font-mono text-purple-700">{getExpression()}</code>
                            </div>
                        )}
                    </div>
                )}

                {/* Expression Mode */}
                {mode === 'expression' && (
                    <div className="space-y-3 mb-4">
                        <Textarea
                            value={expression}
                            onChange={(e) => setExpression(e.target.value)}
                            placeholder="df['total_earnings'] / df['trips']"
                            className="font-mono text-sm min-h-[70px] resize-y bg-white"
                        />

                        {/* Available columns as clickable badges */}
                        <div>
                            <span className="text-[10px] text-muted-foreground mr-1">Insert column:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {availableColumns.slice(0, 20).map((col) => (
                                    <button
                                        key={col}
                                        onClick={() => insertColumn(col)}
                                        className="px-1.5 py-0.5 text-[11px] font-mono bg-white hover:bg-purple-100 hover:text-purple-700 rounded border border-slate-200 transition-colors"
                                    >
                                        {col}
                                    </button>
                                ))}
                                {availableColumns.length > 20 && (
                                    <span className="text-[10px] text-muted-foreground self-center">
                                        +{availableColumns.length - 20} more
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Templates */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-muted-foreground">Templates:</span>
                            {TEMPLATES.map((t) => (
                                <button
                                    key={t.name}
                                    onClick={() => {
                                        setExpression(t.expression);
                                    }}
                                    className="px-2 py-0.5 text-[11px] bg-purple-50 hover:bg-purple-100 text-purple-700 rounded border border-purple-200 transition-colors"
                                    title={t.description}
                                >
                                    {t.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Action row: Test + Apply + Save + Saved Columns */}
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={handleTest}
                        disabled={testing || !getExpression()}
                        className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {testing ? 'Testing...' : 'Test'}
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={applying || !getExpression() || !columnName.trim()}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {applying ? 'Applying...' : 'Apply to Dataset'}
                    </button>
                    <button
                        onClick={handleSaveToSupabase}
                        disabled={saving || !getExpression() || !columnName.trim()}
                        className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                            saveSuccess
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                        title="Save to library for reuse"
                    >
                        {saving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : saveSuccess ? (
                            <Check className="h-3.5 w-3.5" />
                        ) : (
                            <BookmarkPlus className="h-3.5 w-3.5" />
                        )}
                        {saveSuccess ? 'Saved!' : 'Save'}
                    </button>

                    <button
                        onClick={() => setShowSaved(!showSaved)}
                        disabled={loadingSaved}
                        className="ml-auto px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 transition-colors"
                    >
                        {loadingSaved ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Save className="h-3.5 w-3.5" />
                        )}
                        Saved ({savedColumns.length})
                        <ChevronDown className={`h-3 w-3 transition-transform ${showSaved ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                {/* Saved columns list — inline, not absolute */}
                <AnimatePresence>
                    {showSaved && savedColumns.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="mt-3 rounded-lg border border-slate-200 bg-white max-h-52 overflow-y-auto">
                                <div className="p-2 space-y-0.5">
                                    {savedColumns.map((saved) => (
                                        <div
                                            key={saved.id}
                                            className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-50 group"
                                        >
                                            <Badge
                                                variant="secondary"
                                                className="text-[9px] font-bold bg-purple-100 text-purple-700 px-1 shrink-0"
                                            >
                                                fx
                                            </Badge>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-800 truncate">
                                                    {saved.name}
                                                </p>
                                                <p className="text-[10px] font-mono text-slate-500 truncate">
                                                    {saved.expression}
                                                </p>
                                            </div>
                                            <div className="flex gap-1 shrink-0">
                                                <button
                                                    onClick={() => handleUseSaved(saved)}
                                                    className="px-2 py-1 text-[10px] font-medium bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                                                    title="Load into editor"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleApplySavedDirectly(saved)}
                                                    className="px-2 py-1 text-[10px] font-medium bg-purple-100 hover:bg-purple-200 text-purple-700 rounded transition-colors"
                                                    title="Apply directly to dataset"
                                                >
                                                    Apply
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Test Result */}
                <AnimatePresence>
                    {testResult && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            <div
                                className={`mt-3 rounded-lg border p-3 ${
                                    testResult.success
                                        ? 'bg-emerald-50 border-emerald-200'
                                        : 'bg-red-50 border-red-200'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    {testResult.success ? (
                                        <>
                                            <Check className="h-4 w-4 text-emerald-600" />
                                            <span className="text-sm font-medium text-emerald-700">
                                                Test passed — {testResult.row_count.toLocaleString()} rows
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <X className="h-4 w-4 text-red-600" />
                                            <span className="text-sm font-medium text-red-700">Test failed</span>
                                        </>
                                    )}
                                </div>
                                {testResult.error && (
                                    <p className="text-xs text-red-600 font-mono mt-1">{testResult.error}</p>
                                )}
                                {testResult.success && testResult.preview && testResult.preview.length > 0 && (
                                    <div className="mt-2 overflow-x-auto rounded border border-emerald-200">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-emerald-100/50">
                                                    {Object.keys(testResult.preview[0]).map((key) => (
                                                        <th key={key} className="px-2 py-1 text-left font-medium text-slate-600">
                                                            {key}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {testResult.preview.slice(0, 5).map((row, i) => (
                                                    <tr key={i} className="border-t border-emerald-100">
                                                        {Object.values(row).map((val, j) => (
                                                            <td key={j} className="px-2 py-1 text-slate-700">
                                                                {val == null ? '\u2014' : String(val)}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Applied Columns */}
                {appliedColumns.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-purple-200">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-slate-600">Applied:</span>
                            {appliedColumns.map((col) => (
                                <span
                                    key={col}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-white rounded-full border border-purple-200"
                                >
                                    <Badge
                                        variant="secondary"
                                        className="text-[8px] font-bold bg-purple-100 text-purple-700 px-1 py-0"
                                    >
                                        fx
                                    </Badge>
                                    {col}
                                    <button
                                        onClick={() => onColumnRemoved(col)}
                                        className="ml-0.5 hover:text-red-600 transition-colors"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
