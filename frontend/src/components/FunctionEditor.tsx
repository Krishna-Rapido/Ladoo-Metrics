import { useState, useEffect } from "react"
import {
  Play,
  Save,
  Plus,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  FolderOpen,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

import {
  testFunction,
  getFunctionTemplate,
  type FunctionTestResponse,
} from "@/lib/api"
import {
  createFunction,
  listFunctionFolders,
  type FunctionParameter,
  type FunctionFolder,
} from "@/lib/supabase"

type Parameter = FunctionParameter

type FunctionEditorProps = {
  username: string
  onFunctionSaved?: () => void
}

const FUNCTION_TEMPLATE = `def compute_metrics(params):
    """
    Compute metrics at captain_id x yyyymmdd level.
    
    Args:
        params: Dictionary with parameter values
            - start_date: Start date in YYYYMMDD format
            - end_date: End date in YYYYMMDD format
    
    Returns:
        pandas DataFrame with columns:
            - captain_id: Captain identifier
            - yyyymmdd: Date in YYYYMMDD format
            - (your metric columns)
    """
    start_date = params.get('start_date', '20250101')
    end_date = params.get('end_date', '20251231')
    
    # Example SQL query
    query = f"""
    SELECT 
        captain_id,
        yyyymmdd,
        SUM(metric_value) as my_metric
    FROM your_table
    WHERE yyyymmdd BETWEEN '{start_date}' AND '{end_date}'
    GROUP BY captain_id, yyyymmdd
    """
    
    # Execute query using run_query helper
    df = run_query(query)
    
    return df
`

export function FunctionEditor({ username, onFunctionSaved }: FunctionEditorProps) {
  // Code editor state
  const [code, setCode] = useState(FUNCTION_TEMPLATE)
  const [functionName, setFunctionName] = useState("")
  const [description, setDescription] = useState("")

  // Parameters state
  const [parameters, setParameters] = useState<Parameter[]>([
    { name: "start_date", type: "date", default: "20250101", label: "Start Date" },
    { name: "end_date", type: "date", default: "20251231", label: "End Date" },
  ])

  // Test results state
  const [isTestRunning, setIsTestRunning] = useState(false)
  const [testResult, setTestResult] = useState<FunctionTestResponse | null>(null)

  // Save dialog state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [folders, setFolders] = useState<FunctionFolder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Sections state
  const [parametersOpen, setParametersOpen] = useState(true)
  const [resultsOpen, setResultsOpen] = useState(true)

  // Load folders on mount
  useEffect(() => {
    loadFolders()
  }, [])

  const loadFolders = async () => {
    try {
      const data = await listFunctionFolders()
      setFolders(data)
    } catch (err) {
      console.error("Failed to load folders:", err)
    }
  }

  // Build parameter values object
  const getParameterValues = (): Record<string, string | number> => {
    const values: Record<string, string | number> = {}
    parameters.forEach(param => {
      values[param.name] = param.default || ""
    })
    return values
  }

  // Add new parameter
  const addParameter = () => {
    setParameters([
      ...parameters,
      { name: "", type: "string", default: "", label: "" }
    ])
  }

  // Update parameter
  const updateParameter = (index: number, field: keyof Parameter, value: string) => {
    const updated = [...parameters]
    updated[index] = { ...updated[index], [field]: value }
    setParameters(updated)
  }

  // Remove parameter
  const removeParameter = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index))
  }

  // Test function
  const handleTest = async () => {
    setIsTestRunning(true)
    setTestResult(null)

    try {
      const result = await testFunction({
        code,
        parameters: getParameterValues(),
        username,
      })
      setTestResult(result)
    } catch (err) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : "Test failed",
        row_count: 0,
      })
    } finally {
      setIsTestRunning(false)
    }
  }

  // Save function
  const handleSave = async () => {
    if (!functionName.trim()) return
    if (!testResult?.success) {
      alert("Please test the function successfully before saving")
      return
    }

    setIsSaving(true)
    try {
      await createFunction(
        functionName.trim(),
        description.trim() || null,
        code,
        parameters.filter(p => p.name.trim()),
        testResult.output_columns || [],
        selectedFolderId
      )
      setSaveDialogOpen(false)
      onFunctionSaved?.()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save function")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Code Editor Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Python Code</Label>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={isTestRunning}
              className="rounded-lg"
            >
              {isTestRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Test Function
                </>
              )}
            </Button>
            <Button
              size="sm"
              onClick={() => setSaveDialogOpen(true)}
              disabled={!testResult?.success}
              className="rounded-lg"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Function
            </Button>
          </div>
        </div>
        <div className="rounded-lg border bg-[#1e1e1e] overflow-hidden">
          <Textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="min-h-[400px] font-mono text-sm border-0 bg-transparent resize-y"
            style={{ color: '#d4d4d4' }}
            placeholder="def compute_metrics(params):&#10;    # Your code here..."
            spellCheck={false}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Your function must be named <code className="px-1 py-0.5 bg-muted rounded">compute_metrics</code> and return a DataFrame with <code className="px-1 py-0.5 bg-muted rounded">captain_id</code> and <code className="px-1 py-0.5 bg-muted rounded">yyyymmdd</code> columns.
          Use <code className="px-1 py-0.5 bg-muted rounded">run_query(sql)</code> to execute Presto queries.
        </p>
      </div>

      {/* Parameters Section */}
      <Collapsible open={parametersOpen} onOpenChange={setParametersOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between px-0 h-auto py-2">
            <span className="text-base font-semibold">Parameters</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${parametersOpen ? '' : '-rotate-90'}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-3">
          {parameters.map((param, index) => (
            <div key={index} className="flex items-start gap-2 p-3 rounded-lg border bg-muted/30">
              <div className="flex-1 grid grid-cols-4 gap-2">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={param.name}
                    onChange={(e) => updateParameter(index, "name", e.target.value)}
                    placeholder="param_name"
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Label</Label>
                  <Input
                    value={param.label}
                    onChange={(e) => updateParameter(index, "label", e.target.value)}
                    placeholder="Display Name"
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={param.type}
                    onValueChange={(value) => updateParameter(index, "type", value)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">String</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="select">Select</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Default</Label>
                  <Input
                    value={param.default || ""}
                    onChange={(e) => updateParameter(index, "default", e.target.value)}
                    placeholder="default value"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeParameter(index)}
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={addParameter}
            className="rounded-lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Parameter
          </Button>
        </CollapsibleContent>
      </Collapsible>

      {/* Test Results Section */}
      {testResult && (
        <Collapsible open={resultsOpen} onOpenChange={setResultsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between px-0 h-auto py-2">
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <span className="text-base font-semibold">
                  Test Results
                  {testResult.success && testResult.row_count > 0 && (
                    <span className="font-normal text-muted-foreground ml-2">
                      ({testResult.row_count} rows)
                    </span>
                  )}
                </span>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${resultsOpen ? '' : '-rotate-90'}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            {testResult.success ? (
              <div className="space-y-3">
                {/* Output columns */}
                {testResult.output_columns && testResult.output_columns.length > 0 && (
                  <div>
                    <Label className="text-sm">Output Columns</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {testResult.output_columns.map((col) => (
                        <Badge key={col} variant="secondary">
                          {col}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preview table */}
                {testResult.preview && testResult.preview.length > 0 && (
                  <div>
                    <Label className="text-sm">Preview (first {testResult.preview.length} rows)</Label>
                    <div className="mt-2 rounded-lg border overflow-hidden">
                      <ScrollArea className="max-h-64">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50 sticky top-0">
                            <tr>
                              {testResult.columns?.map((col) => (
                                <th key={col} className="px-3 py-2 text-left font-medium">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {testResult.preview.map((row, i) => (
                              <tr key={i} className="border-t">
                                {testResult.columns?.map((col) => (
                                  <td key={col} className="px-3 py-2">
                                    {String(row[col] ?? "")}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </ScrollArea>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                <pre className="text-sm text-destructive whitespace-pre-wrap">
                  {testResult.error}
                </pre>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-xl" style={{ backgroundColor: 'white', color: '#1a1a1a' }}>
          <DialogHeader>
            <DialogTitle style={{ color: '#1a1a1a' }}>Save Function</DialogTitle>
            <DialogDescription style={{ color: '#666' }}>
              Save this function to the library for all users to use
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="function-name" style={{ color: '#1a1a1a' }}>Function Name *</Label>
              <Input
                id="function-name"
                placeholder="e.g. Daily Revenue Metric"
                value={functionName}
                onChange={(e) => setFunctionName(e.target.value)}
                className="rounded-lg"
                style={{ backgroundColor: 'white', color: '#1a1a1a', borderColor: '#e5e5e5' }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="function-desc" style={{ color: '#1a1a1a' }}>Description</Label>
              <Textarea
                id="function-desc"
                placeholder="Brief description of what this function computes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-lg resize-none"
                style={{ backgroundColor: 'white', color: '#1a1a1a', borderColor: '#e5e5e5' }}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: '#1a1a1a' }}>Save to Folder</Label>
              <Select
                value={selectedFolderId || "root"}
                onValueChange={(v) => setSelectedFolderId(v === "root" ? null : v)}
              >
                <SelectTrigger className="rounded-lg" style={{ backgroundColor: 'white', color: '#1a1a1a', borderColor: '#e5e5e5' }}>
                  <SelectValue placeholder="Root folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4" />
                      Root folder
                    </div>
                  </SelectItem>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4" />
                        {folder.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Summary */}
            <Separator />
            <div className="space-y-2">
              <Label style={{ color: '#1a1a1a' }}>Summary</Label>
              <div className="text-sm space-y-1" style={{ color: '#666' }}>
                <p>Parameters: {parameters.filter(p => p.name.trim()).length}</p>
                <p>Output columns: {testResult?.output_columns?.join(", ") || "N/A"}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)} className="rounded-lg">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!functionName.trim() || isSaving}
              className="rounded-lg"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
