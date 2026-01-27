import { useEffect, useState } from "react"
import {
  Code,
  Plus,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Download,
  Table,
  Eye,
  Merge,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { FunctionEditor } from "@/components/FunctionEditor"
import {
  listAllFunctions,
  getFunction,
  type MetricFunction,
  type FunctionParameter,
} from "@/lib/supabase"
import {
  joinFunctionWithCsv,
  previewFunctionResult,
  downloadSessionData,
  type FunctionJoinResponse,
  type FunctionPreviewResponse,
} from "@/lib/api"

type AddMetricsTabProps = {
  sessionId: string | null
  username: string
  onMetricsAdded?: (columns: string[]) => void
}

export function AddMetricsTab({ sessionId, username, onMetricsAdded }: AddMetricsTabProps) {
  // Saved functions state
  const [functions, setFunctions] = useState<MetricFunction[]>([])
  const [selectedFunctionId, setSelectedFunctionId] = useState<string | null>(null)
  const [selectedFunction, setSelectedFunction] = useState<MetricFunction | null>(null)
  const [isLoadingFunctions, setIsLoadingFunctions] = useState(true)

  // Parameter values for selected function
  const [parameterValues, setParameterValues] = useState<Record<string, string>>({})

  // Preview state
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [previewResult, setPreviewResult] = useState<FunctionPreviewResponse | null>(null)

  // Join configuration
  const [joinColumns, setJoinColumns] = useState<'captain_id' | 'captain_id_yyyymmdd'>('captain_id_yyyymmdd')
  const [joinType, setJoinType] = useState<'left' | 'inner'>('left')

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionResult, setExecutionResult] = useState<FunctionJoinResponse | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  // Load functions on mount
  useEffect(() => {
    loadFunctions()
  }, [])

  // Load selected function details
  useEffect(() => {
    if (selectedFunctionId) {
      loadFunctionDetails(selectedFunctionId)
    } else {
      setSelectedFunction(null)
      setParameterValues({})
    }
  }, [selectedFunctionId])

  // Check for function ID from localStorage (from Functions page)
  useEffect(() => {
    const storedFunctionId = localStorage.getItem("use_function_id")
    if (storedFunctionId) {
      setSelectedFunctionId(storedFunctionId)
      localStorage.removeItem("use_function_id")
    }
  }, [])

  const loadFunctions = async () => {
    setIsLoadingFunctions(true)
    try {
      const data = await listAllFunctions()
      setFunctions(data)
    } catch (err) {
      console.error("Failed to load functions:", err)
    } finally {
      setIsLoadingFunctions(false)
    }
  }

  const loadFunctionDetails = async (functionId: string) => {
    const func = await getFunction(functionId)
    setSelectedFunction(func)
    
    // Initialize parameter values with defaults
    if (func?.parameters) {
      const defaults: Record<string, string> = {}
      func.parameters.forEach(param => {
        defaults[param.name] = param.default || ""
      })
      setParameterValues(defaults)
    }
  }

  const updateParameterValue = (name: string, value: string) => {
    setParameterValues(prev => ({ ...prev, [name]: value }))
  }

  // Preview function result (without joining)
  const handlePreviewFunction = async () => {
    if (!selectedFunction) {
      alert("Please select a function")
      return
    }

    setIsPreviewing(true)
    setPreviewResult(null)
    setExecutionResult(null)

    try {
      const result = await previewFunctionResult({
        code: selectedFunction.code,
        parameters: parameterValues,
        username,
      })
      setPreviewResult(result)
    } catch (err) {
      setPreviewResult({
        success: false,
        error: err instanceof Error ? err.message : "Preview failed",
        row_count: 0,
      })
    } finally {
      setIsPreviewing(false)
    }
  }

  // Execute and join with CSV
  const handleExecuteFunction = async () => {
    if (!sessionId) {
      alert("Please upload data first")
      return
    }
    if (!selectedFunction) {
      alert("Please select a function")
      return
    }

    setIsExecuting(true)
    setExecutionResult(null)

    const joinCols = joinColumns === 'captain_id' 
      ? ['captain_id'] 
      : ['captain_id', 'yyyymmdd']

    try {
      const result = await joinFunctionWithCsv(
        {
          code: selectedFunction.code,
          parameters: parameterValues,
          username,
          join_columns: joinCols,
          join_type: joinType,
        },
        sessionId
      )
      setExecutionResult(result)

      if (result.success && result.added_columns) {
        onMetricsAdded?.(result.added_columns)
      }
    } catch (err) {
      setExecutionResult({
        success: false,
        error: err instanceof Error ? err.message : "Execution failed",
        row_count: 0,
        matched_rows: 0,
      })
    } finally {
      setIsExecuting(false)
    }
  }

  const handleDownload = async () => {
    if (!sessionId) return
    setIsDownloading(true)
    try {
      await downloadSessionData(sessionId)
    } catch (err) {
      console.error("Download failed:", err)
    } finally {
      setIsDownloading(false)
    }
  }

  const renderParameterInput = (param: FunctionParameter) => {
    const value = parameterValues[param.name] || ""

    if (param.type === "select" && param.options) {
      return (
        <Select
          value={value}
          onValueChange={(v) => updateParameterValue(param.name, v)}
        >
          <SelectTrigger className="rounded-lg">
            <SelectValue placeholder={`Select ${param.label}`} />
          </SelectTrigger>
          <SelectContent>
            {param.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }

    return (
      <Input
        type={param.type === "number" ? "number" : "text"}
        value={value}
        onChange={(e) => updateParameterValue(param.name, e.target.value)}
        placeholder={param.default || `Enter ${param.label}`}
        className="rounded-lg"
      />
    )
  }

  if (!sessionId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Code className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-2">No Data Uploaded</h3>
        <p className="text-muted-foreground text-sm max-w-md">
          Please upload a CSV file first to add computed metrics from functions.
        </p>
      </div>
    )
  }

  return (
    <Tabs defaultValue="use" className="space-y-6">
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="use">Use Saved Function</TabsTrigger>
        <TabsTrigger value="create">Create New Function</TabsTrigger>
      </TabsList>

      {/* Use Saved Function Tab */}
      <TabsContent value="use" className="space-y-6">
        {/* Function Selection */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Select Function</CardTitle>
            <CardDescription>
              Choose a validated function from the library to add metrics to your data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingFunctions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : functions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No functions available yet.</p>
                <p className="text-sm mt-1">Create a new function in the "Create New Function" tab.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <Select
                  value={selectedFunctionId || ""}
                  onValueChange={setSelectedFunctionId}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select a function..." />
                  </SelectTrigger>
                  <SelectContent>
                    {functions.map((func) => (
                      <SelectItem key={func.id} value={func.id}>
                        <div className="flex items-center gap-2">
                          <Code className="h-4 w-4 text-emerald-500" />
                          <span>{func.name}</span>
                          {func.output_columns && (
                            <Badge variant="secondary" className="text-xs">
                              {func.output_columns.length} columns
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedFunction && (
                  <div className="text-sm text-muted-foreground">
                    {selectedFunction.description}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Parameters */}
        {selectedFunction && selectedFunction.parameters.length > 0 && (
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Parameters</CardTitle>
              <CardDescription>
                Configure the function parameters
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {selectedFunction.parameters.map((param) => (
                  <div key={param.name} className="space-y-2">
                    <Label>{param.label}</Label>
                    {renderParameterInput(param)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Preview Function Result */}
        {selectedFunction && (
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Step 1: Preview Function Result
              </CardTitle>
              <CardDescription>
                Run the function to see what data it returns before joining
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handlePreviewFunction}
                disabled={isPreviewing}
                variant="outline"
                className="rounded-xl"
              >
                {isPreviewing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Running Query...
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Preview Function Output
                  </>
                )}
              </Button>

              {previewResult && !previewResult.success && previewResult.error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                  <pre className="text-sm text-destructive whitespace-pre-wrap">
                    {previewResult.error}
                  </pre>
                </div>
              )}

              {previewResult?.success && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <span className="text-sm text-emerald-600">
                      Function returned {previewResult.row_count} rows with {previewResult.columns?.length || 0} columns
                    </span>
                  </div>

                  {/* Statistics for all columns */}
                  {previewResult.stats && Object.keys(previewResult.stats).length > 0 && (
                    <div>
                      <Label className="text-sm font-medium">Column Statistics</Label>
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(previewResult.stats).map(([colName, stats]) => (
                          <div key={colName} className="rounded-lg border p-3 bg-muted/30">
                            <div className="font-medium text-sm mb-2 truncate flex items-center gap-2" title={colName}>
                              {colName}
                              <Badge variant="outline" className="text-xs">
                                {stats.type || 'unknown'}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              <div className="text-muted-foreground">Count:</div>
                              <div className="font-medium">{stats.count?.toLocaleString()}</div>
                              
                              {stats.mean !== undefined && stats.mean !== null && (
                                <>
                                  <div className="text-muted-foreground">Mean:</div>
                                  <div className="font-medium">{stats.mean?.toLocaleString()}</div>
                                </>
                              )}
                              
                              {stats.min !== undefined && stats.min !== null && (
                                <>
                                  <div className="text-muted-foreground">Min/Max:</div>
                                  <div className="font-medium">{stats.min} / {stats.max}</div>
                                </>
                              )}
                              
                              {stats.unique !== undefined && (
                                <>
                                  <div className="text-muted-foreground">Unique:</div>
                                  <div className="font-medium">{stats.unique?.toLocaleString()}</div>
                                </>
                              )}
                              
                              <div className="text-muted-foreground">Nulls:</div>
                              <div className={`font-medium ${stats.null_count > 0 ? 'text-orange-600' : ''}`}>
                                {stats.null_count?.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preview table */}
                  {previewResult.preview && previewResult.preview.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium">
                        Data Preview (first {Math.min(previewResult.preview.length, 100)} rows)
                      </Label>
                      <div className="mt-2 rounded-lg border overflow-hidden">
                        <ScrollArea className="max-h-64">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead className="bg-muted/50 sticky top-0">
                                <tr>
                                  {previewResult.columns?.map((col) => (
                                    <th key={col} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                                      {col}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {previewResult.preview.slice(0, 20).map((row, i) => (
                                  <tr key={i} className="border-t hover:bg-muted/30">
                                    {previewResult.columns?.map((col) => (
                                      <td key={col} className="px-3 py-2 whitespace-nowrap">
                                        {String(row[col] ?? "")}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Configure Join & Execute */}
        {selectedFunction && previewResult?.success && (
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Merge className="h-5 w-5" />
                Step 2: Join with CSV
              </CardTitle>
              <CardDescription>
                Configure how to join the function results with your uploaded data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Join Configuration */}
              <div className="grid grid-cols-2 gap-6 p-4 rounded-lg border bg-muted/30">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Join Columns</Label>
                  <RadioGroup
                    value={joinColumns}
                    onValueChange={(v) => setJoinColumns(v as 'captain_id' | 'captain_id_yyyymmdd')}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="captain_id" id="join-captain" />
                      <Label htmlFor="join-captain" className="text-sm font-normal cursor-pointer">
                        captain_id only
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="captain_id_yyyymmdd" id="join-both" />
                      <Label htmlFor="join-both" className="text-sm font-normal cursor-pointer">
                        captain_id + yyyymmdd
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Join Type</Label>
                  <RadioGroup
                    value={joinType}
                    onValueChange={(v) => setJoinType(v as 'left' | 'inner')}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="left" id="join-left" />
                      <Label htmlFor="join-left" className="text-sm font-normal cursor-pointer">
                        Left Join (keep all CSV rows)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="inner" id="join-inner" />
                      <Label htmlFor="join-inner" className="text-sm font-normal cursor-pointer">
                        Inner Join (only matching rows)
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Button
                  onClick={handleExecuteFunction}
                  disabled={isExecuting}
                  className="rounded-xl"
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Add Metrics to Data
                    </>
                  )}
                </Button>

                {executionResult && (
                  <div className="flex items-center gap-2">
                    {executionResult.success ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        <span className="text-sm text-emerald-600">
                          Added {executionResult.added_columns?.length || 0} columns, {executionResult.matched_rows} rows matched
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5 text-destructive" />
                        <span className="text-sm text-destructive">Failed</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {executionResult && !executionResult.success && executionResult.error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                  <pre className="text-sm text-destructive whitespace-pre-wrap">
                    {executionResult.error}
                  </pre>
                </div>
              )}

              {executionResult?.success && executionResult.added_columns && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm">Added Columns</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {executionResult.added_columns.map((col) => (
                        <Badge key={col} variant="secondary">
                          {col}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Metrics Statistics */}
                  {executionResult.metrics_stats && Object.keys(executionResult.metrics_stats).length > 0 && (
                    <div>
                      <Label className="text-sm">Metrics Statistics</Label>
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(executionResult.metrics_stats).map(([colName, stats]) => (
                          <div key={colName} className="rounded-lg border p-3 bg-muted/30">
                            <div className="font-medium text-sm mb-2 truncate" title={colName}>
                              {colName}
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              <div className="text-muted-foreground">Count:</div>
                              <div className="font-medium">{stats.count?.toLocaleString()}</div>
                              
                              {stats.mean !== undefined && stats.mean !== null && (
                                <>
                                  <div className="text-muted-foreground">Mean:</div>
                                  <div className="font-medium">{stats.mean?.toLocaleString()}</div>
                                </>
                              )}
                              
                              {stats.median !== undefined && stats.median !== null && (
                                <>
                                  <div className="text-muted-foreground">Median:</div>
                                  <div className="font-medium">{stats.median?.toLocaleString()}</div>
                                </>
                              )}
                              
                              {stats.min !== undefined && stats.min !== null && (
                                <>
                                  <div className="text-muted-foreground">Min:</div>
                                  <div className="font-medium">{stats.min?.toLocaleString()}</div>
                                </>
                              )}
                              
                              {stats.max !== undefined && stats.max !== null && (
                                <>
                                  <div className="text-muted-foreground">Max:</div>
                                  <div className="font-medium">{stats.max?.toLocaleString()}</div>
                                </>
                              )}
                              
                              {stats.std !== undefined && stats.std !== null && (
                                <>
                                  <div className="text-muted-foreground">Std:</div>
                                  <div className="font-medium">{stats.std?.toLocaleString()}</div>
                                </>
                              )}
                              
                              {stats.unique !== undefined && (
                                <>
                                  <div className="text-muted-foreground">Unique:</div>
                                  <div className="font-medium">{stats.unique?.toLocaleString()}</div>
                                </>
                              )}
                              
                              <div className="text-muted-foreground">Nulls:</div>
                              <div className="font-medium text-orange-600">{stats.null_count?.toLocaleString()}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Preview and Download Section */}
        {executionResult?.success && executionResult.preview && executionResult.preview.length > 0 && (
          <Card className="rounded-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Table className="h-5 w-5" />
                    Merged Data Preview
                  </CardTitle>
                  <CardDescription>
                    Showing first {executionResult.preview.length} of {executionResult.row_count} rows
                  </CardDescription>
                </div>
                <Button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="rounded-xl"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Download CSV
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <ScrollArea className="max-h-96">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          {executionResult.columns?.map((col) => (
                            <th
                              key={col}
                              className={`px-3 py-2 text-left font-medium whitespace-nowrap ${
                                executionResult.added_columns?.includes(col)
                                  ? "bg-emerald-50 text-emerald-700"
                                  : ""
                              }`}
                            >
                              {col}
                              {executionResult.added_columns?.includes(col) && (
                                <Badge variant="secondary" className="ml-2 text-xs">new</Badge>
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {executionResult.preview.map((row, i) => (
                          <tr key={i} className="border-t hover:bg-muted/30">
                            {executionResult.columns?.map((col) => (
                              <td
                                key={col}
                                className={`px-3 py-2 whitespace-nowrap ${
                                  executionResult.added_columns?.includes(col)
                                    ? "bg-emerald-50/50"
                                    : ""
                                }`}
                              >
                                {String(row[col] ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ScrollArea>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                New columns are highlighted in green. Download the full dataset using the button above.
              </p>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* Create New Function Tab */}
      <TabsContent value="create">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Create New Function</CardTitle>
            <CardDescription>
              Write a Python function that computes metrics at captain_id × yyyymmdd level
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FunctionEditor
              username={username}
              onFunctionSaved={() => {
                loadFunctions()
              }}
            />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
