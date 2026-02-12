import { useState, useEffect, useMemo } from 'react';
import { Code, Play, Save, Loader2, CheckCircle2, XCircle, Plus, Trash2, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    listAllCalculatedColumns,
    createCalculatedColumn,
    deleteCalculatedColumn,
    type CalculatedColumn,
} from '@/lib/supabase';
import {
    testCalculatedColumn,
    applyCalculatedColumn,
    getSessionData,
    type CalculatedColumnTestResponse,
    type CalculatedColumnApplyResponse,
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface CalculatedColumnsEditorProps {
    sessionId: string | null;
    onColumnAdded?: () => void | Promise<void>;
}

export function CalculatedColumnsEditor({ sessionId, onColumnAdded }: CalculatedColumnsEditorProps) {
    const { user } = useAuth();
    const [columns, setColumns] = useState<CalculatedColumn[]>([]);
    const [isLoadingColumns, setIsLoadingColumns] = useState(true);
    const [availableColumns, setAvailableColumns] = useState<string[]>([]);

    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [expression, setExpression] = useState('');
    const [outputColumn, setOutputColumn] = useState('');

    // Test/Apply state
    const [isTesting, setIsTesting] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [testResult, setTestResult] = useState<CalculatedColumnTestResponse | null>(null);
    const [applyResult, setApplyResult] = useState<CalculatedColumnApplyResponse | null>(null);

    // Load saved columns and session columns
    useEffect(() => {
        loadColumns();
    }, []);

    useEffect(() => {
        if (sessionId) {
            loadSessionColumns();
        }
    }, [sessionId]);

    const loadColumns = async () => {
        setIsLoadingColumns(true);
        try {
            const data = await listAllCalculatedColumns();
            setColumns(data);
        } catch (err) {
            console.error('Failed to load calculated columns:', err);
            // Set empty array on error to allow component to continue working
            setColumns([]);
        } finally {
            setIsLoadingColumns(false);
        }
    };

    const loadSessionColumns = async () => {
        if (!sessionId) return;
        try {
            const data = await getSessionData(sessionId);
            setAvailableColumns(data.columns || []);
        } catch (err) {
            console.error('Failed to load session columns:', err);
        }
    };

    const handleTest = async () => {
        if (!sessionId || !expression.trim() || !outputColumn.trim()) {
            alert('Please enter an expression and output column name');
            return;
        }

        setIsTesting(true);
        setTestResult(null);
        try {
            const result = await testCalculatedColumn({
                expression: expression.trim(),
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
            setIsTesting(false);
        }
    };

    const handleApply = async () => {
        if (!sessionId || !expression.trim() || !outputColumn.trim()) {
            alert('Please enter an expression and output column name');
            return;
        }

        setIsApplying(true);
        setApplyResult(null);
        try {
            const result = await applyCalculatedColumn({
                expression: expression.trim(),
                output_column: outputColumn.trim(),
                session_id: sessionId,
            });
            setApplyResult(result);
            if (result.success) {
                await onColumnAdded?.();
                await loadSessionColumns();
                // Clear form
                setExpression('');
                setOutputColumn('');
                setName('');
                setDescription('');
            }
        } catch (err) {
            setApplyResult({
                success: false,
                error: err instanceof Error ? err.message : 'Apply failed',
                row_count: 0,
            });
        } finally {
            setIsApplying(false);
        }
    };

    const handleSave = async () => {
        if (!name.trim() || !expression.trim() || !outputColumn.trim()) {
            alert('Please enter a name, expression, and output column name');
            return;
        }

        setIsSaving(true);
        try {
            // Extract input columns from expression (simple heuristic)
            const inputCols = availableColumns.filter(col => 
                expression.includes(`df['${col}']`) || expression.includes(`df["${col}"]`)
            );

            await createCalculatedColumn(
                name.trim(),
                description.trim() || null,
                expression.trim(),
                outputColumn.trim(),
                inputCols
            );
            await loadColumns();
            alert('Calculated column saved successfully!');
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to save calculated column');
        } finally {
            setIsSaving(false);
        }
    };

    const handleUseSaved = async (column: CalculatedColumn) => {
        if (!sessionId) {
            alert('No session available');
            return;
        }

        setExpression(column.expression);
        setOutputColumn(column.output_column);
        setName(column.name);
        setDescription(column.description || '');
    };

    const handleDelete = async (columnId: string) => {
        if (!confirm('Are you sure you want to delete this calculated column?')) return;
        try {
            await deleteCalculatedColumn(columnId);
            await loadColumns();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete calculated column');
        }
    };

    // Common expression templates
    const templates = [
        { name: 'Ratio', expression: "df['col_a'] / df['col_b']", description: 'Divide two columns' },
        { name: 'Sum', expression: "df['col_a'] + df['col_b']", description: 'Add two columns' },
        { name: 'Difference', expression: "df['col_a'] - df['col_b']", description: 'Subtract two columns' },
        { name: 'Conditional', expression: "df['col_a'].apply(lambda x: 'high' if x > 100 else 'low')", description: 'Conditional logic' },
        { name: 'Percentage', expression: "(df['col_a'] / df['col_b']) * 100", description: 'Calculate percentage' },
    ];

    if (!sessionId) {
        return (
            <Card className="rounded-2xl">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <Code className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium mb-2">No dataset available</p>
                    <p className="text-sm text-muted-foreground">Create a dataset first to add calculated columns</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Saved Columns */}
            {columns.length > 0 && (
                <Card className="rounded-2xl">
                    <CardHeader>
                        <CardTitle className="text-lg">Saved Calculated Columns</CardTitle>
                        <CardDescription>Reuse previously saved calculated columns</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {columns.map((col) => (
                                <div
                                    key={col.id}
                                    className="flex items-center justify-between p-3 rounded-lg border bg-background"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm flex items-center gap-2">
                                            <Code className="h-4 w-4 text-emerald-500" />
                                            {col.name}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1 truncate">
                                            {col.output_column} = {col.expression.substring(0, 60)}...
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleUseSaved(col)}
                                            className="h-8"
                                        >
                                            <Eye className="h-4 w-4 mr-1" />
                                            Use
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(col.id)}
                                            className="h-8 text-destructive hover:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Editor */}
            <Card className="rounded-2xl">
                <CardHeader>
                    <CardTitle className="text-lg">Create Calculated Column</CardTitle>
                    <CardDescription>
                        Define a new column using pandas expressions on your dataset
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Column Name (for saving)</Label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Revenue per Ride"
                                className="rounded-lg"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Output Column Name</Label>
                            <Input
                                value={outputColumn}
                                onChange={(e) => setOutputColumn(e.target.value)}
                                placeholder="e.g., revenue_per_ride"
                                className="rounded-lg"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Description (optional)</Label>
                        <Input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief description of this calculated column"
                            className="rounded-lg"
                        />
                    </div>

                    {/* Expression Editor */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Pandas Expression</Label>
                            <div className="flex gap-2">
                                <Select
                                    value=""
                                    onValueChange={(templateName) => {
                                        const template = templates.find(t => t.name === templateName);
                                        if (template) {
                                            setExpression(template.expression);
                                        }
                                    }}
                                >
                                    <SelectTrigger className="h-8 w-40 text-xs">
                                        <SelectValue placeholder="Templates" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {templates.map((t) => (
                                            <SelectItem key={t.name} value={t.name}>
                                                {t.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <Textarea
                            value={expression}
                            onChange={(e) => setExpression(e.target.value)}
                            placeholder="df['col_a'] / df['col_b']"
                            className="min-h-[120px] font-mono text-sm rounded-lg"
                        />
                        <p className="text-xs text-muted-foreground">
                            Reference columns using df['column_name']. Use pandas operations like +, -, *, /, apply(), etc.
                        </p>
                    </div>

                    {/* Available Columns Reference */}
                    {availableColumns.length > 0 && (
                        <div className="space-y-2">
                            <Label>Available Columns</Label>
                            <div className="border rounded-lg p-3 max-h-32 overflow-y-auto bg-muted/30">
                                <div className="flex flex-wrap gap-2">
                                    {availableColumns.map((col) => (
                                        <Badge
                                            key={col}
                                            variant="outline"
                                            className="text-xs cursor-pointer hover:bg-emerald-100"
                                            onClick={() => {
                                                const snippet = `df['${col}']`;
                                                setExpression(prev => prev + (prev ? ' + ' : '') + snippet);
                                            }}
                                        >
                                            {col}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                        <Button
                            onClick={handleTest}
                            disabled={isTesting || !expression.trim() || !outputColumn.trim()}
                            variant="outline"
                            className="rounded-xl"
                        >
                            {isTesting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Testing...
                                </>
                            ) : (
                                <>
                                    <Play className="h-4 w-4 mr-2" />
                                    Test Expression
                                </>
                            )}
                        </Button>
                        <Button
                            onClick={handleApply}
                            disabled={isApplying || !expression.trim() || !outputColumn.trim()}
                            className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
                        >
                            {isApplying ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Applying...
                                </>
                            ) : (
                                <>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Apply to Dataset
                                </>
                            )}
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isSaving || !name.trim() || !expression.trim() || !outputColumn.trim()}
                            variant="outline"
                            className="rounded-xl"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    Save for Reuse
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Test Results */}
                    {testResult && (
                        <div className="space-y-3">
                            {testResult.success ? (
                                <div className="flex items-center gap-2 text-emerald-600">
                                    <CheckCircle2 className="h-5 w-5" />
                                    <span className="text-sm font-medium">
                                        Test successful - {testResult.row_count} rows
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-destructive">
                                    <XCircle className="h-5 w-5" />
                                    <span className="text-sm font-medium">Test failed</span>
                                </div>
                            )}
                            {testResult.error && (
                                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                                    <pre className="text-xs text-destructive whitespace-pre-wrap">
                                        {testResult.error}
                                    </pre>
                                </div>
                            )}
                            {testResult.preview && testResult.preview.length > 0 && (
                                <div className="rounded-lg border overflow-hidden">
                                    <ScrollArea className="max-h-48">
                                        <table className="w-full text-xs">
                                            <thead className="bg-muted/50 sticky top-0">
                                                <tr>
                                                    {Object.keys(testResult.preview[0]).map((col) => (
                                                        <th key={col} className="px-3 py-2 text-left font-medium">
                                                            {col}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {testResult.preview.slice(0, 10).map((row, i) => (
                                                    <tr key={i} className="border-t">
                                                        {Object.keys(row).map((col) => (
                                                            <td key={col} className="px-3 py-2">
                                                                {String(row[col] ?? '')}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </ScrollArea>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Apply Results */}
                    {applyResult && (
                        <div className="space-y-3">
                            {applyResult.success ? (
                                <div className="flex items-center gap-2 text-emerald-600">
                                    <CheckCircle2 className="h-5 w-5" />
                                    <span className="text-sm font-medium">
                                        Column "{applyResult.new_column}" added successfully!
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-destructive">
                                    <XCircle className="h-5 w-5" />
                                    <span className="text-sm font-medium">Failed to apply column</span>
                                </div>
                            )}
                            {applyResult.error && (
                                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                                    <pre className="text-xs text-destructive whitespace-pre-wrap">
                                        {applyResult.error}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
