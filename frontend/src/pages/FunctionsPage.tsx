import { useEffect, useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import {
  ChevronRight,
  Code,
  Folder,
  FolderOpen,
  FolderPlus,
  Home,
  MoreVertical,
  Trash2,
  Edit2,
  Eye,
  Copy,
  Play,
  X,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Save,
} from "lucide-react"

import { PrimarySidebar } from "@/components/nav/PrimarySidebar"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"

import {
  listFunctionFolders,
  listAllFunctions,
  createFunctionFolder,
  renameFunctionFolder,
  deleteFunctionFolder,
  deleteFunction,
  updateFunction,
  type FunctionFolder,
  type MetricFunction,
  type FunctionParameter,
} from "@/lib/supabase"
import { testFunction, type FunctionTestResponse } from "@/lib/api"

type BreadcrumbItem = {
  id: string | null
  name: string
}

export function FunctionsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [folders, setFolders] = useState<FunctionFolder[]>([])
  const [functions, setFunctions] = useState<MetricFunction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Current folder navigation
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)

  // Dialog states
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: "folder" | "function" } | null>(null)

  // View/Edit function dialog
  const [functionDialogOpen, setFunctionDialogOpen] = useState(false)
  const [selectedFunction, setSelectedFunction] = useState<MetricFunction | null>(null)
  const [dialogMode, setDialogMode] = useState<"view" | "edit">("view")

  // Edit mode state
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editCode, setEditCode] = useState("")
  const [editParameters, setEditParameters] = useState<FunctionParameter[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Test state
  const [isTestRunning, setIsTestRunning] = useState(false)
  const [testResult, setTestResult] = useState<FunctionTestResponse | null>(null)
  const [testParamValues, setTestParamValues] = useState<Record<string, string>>({})

  // Load data
  const loadData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [foldersData, functionsData] = await Promise.all([
        listFunctionFolders(),
        listAllFunctions(),
      ])
      setFolders(foldersData)
      setFunctions(functionsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  // Build breadcrumb path
  const breadcrumbs = useMemo(() => {
    const path: BreadcrumbItem[] = [{ id: null, name: "Functions" }]
    if (!currentFolderId) return path

    const buildPath = (folderId: string | null): BreadcrumbItem[] => {
      if (!folderId) return []
      const folder = folders.find(f => f.id === folderId)
      if (!folder) return []
      const parentPath = folder.parent_id ? buildPath(folder.parent_id) : []
      return [...parentPath, { id: folder.id, name: folder.name }]
    }

    return [...path, ...buildPath(currentFolderId)]
  }, [currentFolderId, folders])

  // Get items in current folder
  const currentFolderItems = useMemo(() => {
    const subFolders = folders.filter(f => f.parent_id === currentFolderId)
    const folderFunctions = functions.filter(f => f.folder_id === currentFolderId)
    return { subFolders, functions: folderFunctions }
  }, [folders, functions, currentFolderId])

  // Handlers
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    try {
      await createFunctionFolder(newFolderName.trim(), currentFolderId)
      setNewFolderDialogOpen(false)
      setNewFolderName("")
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create folder")
    }
  }

  const handleRename = async () => {
    if (!renameTarget || !newFolderName.trim()) return
    try {
      await renameFunctionFolder(renameTarget.id, newFolderName.trim())
      setRenameDialogOpen(false)
      setRenameTarget(null)
      setNewFolderName("")
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename")
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      if (deleteTarget.type === "folder") {
        await deleteFunctionFolder(deleteTarget.id)
      } else {
        await deleteFunction(deleteTarget.id)
      }
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  const handleViewFunction = (func: MetricFunction, mode: "view" | "edit" = "view") => {
    setSelectedFunction(func)
    setDialogMode(mode)
    setEditName(func.name)
    setEditDescription(func.description || "")
    setEditCode(func.code)
    setEditParameters(func.parameters || [])
    setTestResult(null)
    // Initialize test param values with defaults
    const paramValues: Record<string, string> = {}
    func.parameters?.forEach(p => {
      paramValues[p.name] = p.default || ""
    })
    setTestParamValues(paramValues)
    setFunctionDialogOpen(true)
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
  }

  const handleUseFunction = (func: MetricFunction) => {
    // Store function ID to use in Insights page
    localStorage.setItem("use_function_id", func.id)
    navigate("/insights")
  }

  // Edit handlers
  const addParameter = () => {
    setEditParameters([
      ...editParameters,
      { name: "", type: "string", default: "", label: "" }
    ])
  }

  const updateParameter = (index: number, field: keyof FunctionParameter, value: string) => {
    const updated = [...editParameters]
    updated[index] = { ...updated[index], [field]: value }
    setEditParameters(updated)
  }

  const removeParameter = (index: number) => {
    setEditParameters(editParameters.filter((_, i) => i !== index))
    // Also remove from test param values
    const paramName = editParameters[index]?.name
    if (paramName) {
      const newTestValues = { ...testParamValues }
      delete newTestValues[paramName]
      setTestParamValues(newTestValues)
    }
  }

  // Test function handler
  const handleTestFunction = async () => {
    if (!user) return
    setIsTestRunning(true)
    setTestResult(null)

    try {
      const result = await testFunction({
        code: dialogMode === "edit" ? editCode : (selectedFunction?.code || ""),
        parameters: testParamValues,
        username: user.email || "anonymous",
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

  // Save edited function
  const handleSaveEdit = async () => {
    if (!selectedFunction) return
    setIsSaving(true)

    try {
      await updateFunction(selectedFunction.id, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        code: editCode,
        parameters: editParameters.filter(p => p.name.trim()),
        output_columns: testResult?.output_columns || selectedFunction.output_columns,
      })
      await loadData()
      setFunctionDialogOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes")
    } finally {
      setIsSaving(false)
    }
  }

  const openRenameDialog = (folder: FunctionFolder) => {
    setRenameTarget({ id: folder.id, name: folder.name })
    setNewFolderName(folder.name)
    setRenameDialogOpen(true)
  }

  const openDeleteDialog = (item: FunctionFolder | MetricFunction, type: "folder" | "function") => {
    setDeleteTarget({ id: item.id, name: item.name, type })
    setDeleteDialogOpen(true)
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="flex w-full">
        <PrimarySidebar activeOverride="functions" />

        <main className="flex-1 p-8">
          <div className="mx-auto max-w-5xl">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold">Metric Functions Library</h1>
              <p className="text-muted-foreground">Browse and manage saved Python functions for computing metrics</p>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            <Card className="rounded-2xl">
              <CardHeader className="pb-4">
                {/* Breadcrumbs */}
                <div className="flex items-center gap-1 text-sm mb-4">
                  {breadcrumbs.map((item, index) => (
                    <div key={item.id ?? "root"} className="flex items-center gap-1">
                      {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      <button
                        onClick={() => setCurrentFolderId(item.id)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-muted ${
                          index === breadcrumbs.length - 1 ? "font-semibold text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {index === 0 && <Home className="h-4 w-4" />}
                        {item.name}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      setNewFolderName("")
                      setNewFolderDialogOpen(true)
                    }}
                  >
                    <FolderPlus className="h-4 w-4 mr-2" />
                    New Folder
                  </Button>
                  <Button variant="outline" className="rounded-xl" onClick={loadData} disabled={isLoading}>
                    Refresh
                  </Button>
                </div>
              </CardHeader>

              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                ) : currentFolderItems.subFolders.length === 0 && currentFolderItems.functions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Folder className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>This folder is empty</p>
                    <p className="text-sm mt-1">Create a folder or save a function from the Insights page</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {/* Folders */}
                    {currentFolderItems.subFolders.map((folder) => (
                      <div
                        key={folder.id}
                        className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 group"
                      >
                        <button
                          onClick={() => setCurrentFolderId(folder.id)}
                          className="flex items-center gap-3 flex-1 text-left"
                        >
                          <FolderOpen className="h-5 w-5 text-amber-500" />
                          <div>
                            <div className="font-medium">{folder.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(folder.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </button>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-40 p-1" align="end">
                            <button
                              onClick={() => openRenameDialog(folder)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted"
                            >
                              <Edit2 className="h-4 w-4" />
                              Rename
                            </button>
                            <button
                              onClick={() => openDeleteDialog(folder, "folder")}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-destructive/10 text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </PopoverContent>
                        </Popover>
                      </div>
                    ))}

                    {currentFolderItems.subFolders.length > 0 && currentFolderItems.functions.length > 0 && (
                      <Separator className="my-2" />
                    )}

                    {/* Functions */}
                    {currentFolderItems.functions.map((func) => (
                      <div
                        key={func.id}
                        className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 group"
                      >
                        <button
                          onClick={() => handleViewFunction(func)}
                          className="flex items-center gap-3 flex-1 text-left"
                        >
                          <Code className="h-5 w-5 text-emerald-500" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate flex items-center gap-2">
                              {func.name}
                              {func.is_validated && (
                                <Badge variant="secondary" className="text-xs">Validated</Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {func.output_columns?.length || 0} output columns • {func.parameters?.length || 0} parameters
                            </div>
                            {func.description && (
                              <div className="text-xs text-muted-foreground truncate mt-1">
                                {func.description}
                              </div>
                            )}
                          </div>
                        </button>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleViewFunction(func, "edit")
                            }}
                          >
                            <Edit2 className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleUseFunction(func)
                            }}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Use
                          </Button>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-40 p-1" align="end">
                              <button
                                onClick={() => handleViewFunction(func, "view")}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted"
                              >
                                <Eye className="h-4 w-4" />
                                View
                              </button>
                              <button
                                onClick={() => handleViewFunction(func, "edit")}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted"
                              >
                                <Edit2 className="h-4 w-4" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleCopyCode(func.code)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted"
                              >
                                <Copy className="h-4 w-4" />
                                Copy Code
                              </button>
                              <button
                                onClick={() => openDeleteDialog(func, "function")}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-destructive/10 text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </button>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* New Folder Dialog */}
      <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-xl" style={{ backgroundColor: 'white', color: '#1a1a1a' }}>
          <DialogHeader>
            <DialogTitle style={{ color: '#1a1a1a' }}>Create New Folder</DialogTitle>
            <DialogDescription style={{ color: '#666' }}>
              Enter a name for the new folder
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name" style={{ color: '#1a1a1a' }}>Folder Name</Label>
              <Input
                id="folder-name"
                placeholder="e.g. Revenue Metrics"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="rounded-lg"
                style={{ backgroundColor: 'white', color: '#1a1a1a', borderColor: '#e5e5e5' }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderDialogOpen(false)} className="rounded-lg">
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()} className="rounded-lg">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-xl" style={{ backgroundColor: 'white', color: '#1a1a1a' }}>
          <DialogHeader>
            <DialogTitle style={{ color: '#1a1a1a' }}>Rename Folder</DialogTitle>
            <DialogDescription style={{ color: '#666' }}>
              Enter a new name for "{renameTarget?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rename-name" style={{ color: '#1a1a1a' }}>New Name</Label>
              <Input
                id="rename-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="rounded-lg"
                style={{ backgroundColor: 'white', color: '#1a1a1a', borderColor: '#e5e5e5' }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)} className="rounded-lg">
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={!newFolderName.trim()} className="rounded-lg">
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-xl" style={{ backgroundColor: 'white', color: '#1a1a1a' }}>
          <DialogHeader>
            <DialogTitle style={{ color: '#1a1a1a' }}>Delete {deleteTarget?.type === "folder" ? "Folder" : "Function"}</DialogTitle>
            <DialogDescription style={{ color: '#666' }}>
              Are you sure you want to delete "{deleteTarget?.name}"?
              {deleteTarget?.type === "folder" && " This will also delete all contents inside."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="rounded-lg">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} className="rounded-lg">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View/Edit Function Dialog */}
      <Dialog open={functionDialogOpen} onOpenChange={setFunctionDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] rounded-xl p-0 overflow-hidden" style={{ backgroundColor: 'white', color: '#1a1a1a' }}>
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b" style={{ backgroundColor: '#fafafa' }}>
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                {dialogMode === "edit" ? (
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="text-xl font-semibold border-none shadow-none p-0 h-auto focus-visible:ring-0"
                    style={{ backgroundColor: 'transparent', color: '#1a1a1a' }}
                    placeholder="Function name"
                  />
                ) : (
                  <h2 className="text-xl font-semibold truncate" style={{ color: '#1a1a1a' }}>
                    {selectedFunction?.name}
                  </h2>
                )}
                {dialogMode === "edit" ? (
                  <Input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="text-sm border-none shadow-none p-0 h-auto mt-1 focus-visible:ring-0"
                    style={{ backgroundColor: 'transparent', color: '#666' }}
                    placeholder="Add a description..."
                  />
                ) : (
                  selectedFunction?.description && (
                    <p className="text-sm mt-1" style={{ color: '#666' }}>{selectedFunction.description}</p>
                  )
                )}
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Button
                  variant={dialogMode === "view" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDialogMode("view")}
                  className="rounded-lg"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
                <Button
                  variant={dialogMode === "edit" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDialogMode("edit")}
                  className="rounded-lg"
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </div>
            </div>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1 max-h-[calc(90vh-200px)]">
            <div className="p-6 space-y-6">
              {/* Parameters Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-medium" style={{ color: '#1a1a1a' }}>
                    Parameters
                  </Label>
                  {dialogMode === "edit" && (
                    <Button variant="outline" size="sm" onClick={addParameter} className="rounded-lg h-7 text-xs">
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  )}
                </div>

                {dialogMode === "view" ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedFunction?.parameters && selectedFunction.parameters.length > 0 ? (
                      selectedFunction.parameters.map((param) => (
                        <div
                          key={param.name}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                          style={{ backgroundColor: '#f5f5f5' }}
                        >
                          <span className="font-medium text-sm" style={{ color: '#1a1a1a' }}>{param.label || param.name}</span>
                          <Badge variant="outline" className="text-xs">{param.type}</Badge>
                          {param.default && (
                            <span className="text-xs" style={{ color: '#666' }}>= {param.default}</span>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm" style={{ color: '#999' }}>No parameters defined</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {editParameters.map((param, index) => (
                      <div key={index} className="flex items-center gap-2 p-3 rounded-lg border" style={{ backgroundColor: '#fafafa' }}>
                        <div className="grid grid-cols-4 gap-2 flex-1">
                          <Input
                            value={param.name}
                            onChange={(e) => updateParameter(index, "name", e.target.value)}
                            placeholder="name"
                            className="h-8 text-sm"
                            style={{ backgroundColor: 'white', color: '#1a1a1a' }}
                          />
                          <Input
                            value={param.label}
                            onChange={(e) => updateParameter(index, "label", e.target.value)}
                            placeholder="Label"
                            className="h-8 text-sm"
                            style={{ backgroundColor: 'white', color: '#1a1a1a' }}
                          />
                          <Select
                            value={param.type}
                            onValueChange={(value) => updateParameter(index, "type", value)}
                          >
                            <SelectTrigger className="h-8 text-sm" style={{ backgroundColor: 'white' }}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="string">String</SelectItem>
                              <SelectItem value="date">Date</SelectItem>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="select">Select</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            value={param.default || ""}
                            onChange={(e) => updateParameter(index, "default", e.target.value)}
                            placeholder="default"
                            className="h-8 text-sm"
                            style={{ backgroundColor: 'white', color: '#1a1a1a' }}
                          />
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
                    {editParameters.length === 0 && (
                      <p className="text-sm py-2" style={{ color: '#999' }}>No parameters. Click "Add" to create one.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Output Columns */}
              {((dialogMode === "view" && selectedFunction?.output_columns?.length) || 
                (dialogMode === "edit" && (testResult?.output_columns?.length || selectedFunction?.output_columns?.length))) && (
                <div>
                  <Label className="text-sm font-medium" style={{ color: '#1a1a1a' }}>Output Columns</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(dialogMode === "edit" && testResult?.output_columns 
                      ? testResult.output_columns 
                      : selectedFunction?.output_columns
                    )?.map((col) => (
                      <Badge key={col} variant="secondary" className="text-xs">
                        {col}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Code Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-medium" style={{ color: '#1a1a1a' }}>Code</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyCode(dialogMode === "edit" ? editCode : (selectedFunction?.code || ""))}
                    className="h-7 text-xs"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
                {dialogMode === "view" ? (
                  <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: '#1e1e1e' }}>
                    <ScrollArea className="h-64">
                      <pre className="p-4 text-sm font-mono" style={{ color: '#d4d4d4' }}>
                        {selectedFunction?.code}
                      </pre>
                    </ScrollArea>
                  </div>
                ) : (
                  <Textarea
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="min-h-[250px] font-mono text-sm rounded-lg resize-y"
                    style={{ backgroundColor: '#1e1e1e', color: '#d4d4d4', borderColor: '#333' }}
                    spellCheck={false}
                  />
                )}
              </div>

              {/* Test Section */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-sm font-medium" style={{ color: '#1a1a1a' }}>Test Function</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestFunction}
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
                        Run Test
                      </>
                    )}
                  </Button>
                </div>

                {/* Test Parameter Inputs */}
                {((dialogMode === "edit" ? editParameters : selectedFunction?.parameters) || []).length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                    {(dialogMode === "edit" ? editParameters : selectedFunction?.parameters || [])
                      .filter(p => p.name.trim())
                      .map((param) => (
                        <div key={param.name}>
                          <Label className="text-xs" style={{ color: '#666' }}>{param.label || param.name}</Label>
                          <Input
                            value={testParamValues[param.name] || ""}
                            onChange={(e) => setTestParamValues({ ...testParamValues, [param.name]: e.target.value })}
                            placeholder={param.default || ""}
                            className="h-8 text-sm mt-1"
                            style={{ backgroundColor: 'white', color: '#1a1a1a' }}
                          />
                        </div>
                      ))}
                  </div>
                )}

                {/* Test Results */}
                {testResult && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-3">
                      {testResult.success ? (
                        <>
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          <span className="font-medium text-sm" style={{ color: '#1a1a1a' }}>
                            Success - {testResult.row_count} rows returned
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 text-destructive" />
                          <span className="font-medium text-sm text-destructive">Test Failed</span>
                        </>
                      )}
                    </div>

                    {testResult.success ? (
                      testResult.preview && testResult.preview.length > 0 && (
                        <div className="rounded-lg border overflow-hidden">
                          <ScrollArea className="max-h-48">
                            <table className="w-full text-xs">
                              <thead style={{ backgroundColor: '#f5f5f5' }}>
                                <tr>
                                  {testResult.columns?.map((col) => (
                                    <th key={col} className="px-3 py-2 text-left font-medium" style={{ color: '#1a1a1a' }}>
                                      {col}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {testResult.preview.slice(0, 10).map((row, i) => (
                                  <tr key={i} className="border-t">
                                    {testResult.columns?.map((col) => (
                                      <td key={col} className="px-3 py-2" style={{ color: '#1a1a1a' }}>
                                        {String(row[col] ?? "")}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </ScrollArea>
                          {testResult.preview.length > 10 && (
                            <div className="px-3 py-2 text-xs border-t" style={{ backgroundColor: '#fafafa', color: '#666' }}>
                              Showing first 10 of {testResult.preview.length} preview rows
                            </div>
                          )}
                        </div>
                      )
                    ) : (
                      <div className="rounded-lg border border-destructive/20 p-4" style={{ backgroundColor: '#fef2f2' }}>
                        <pre className="text-xs text-destructive whitespace-pre-wrap">
                          {testResult.error}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="px-6 py-4 border-t flex items-center justify-between" style={{ backgroundColor: '#fafafa' }}>
            <Button
              variant="outline"
              onClick={() => setFunctionDialogOpen(false)}
              className="rounded-lg"
            >
              Close
            </Button>
            <div className="flex items-center gap-2">
              {dialogMode === "edit" && (
                <Button
                  onClick={handleSaveEdit}
                  disabled={isSaving || !editName.trim()}
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
                      Save Changes
                    </>
                  )}
                </Button>
              )}
              <Button
                variant={dialogMode === "edit" ? "outline" : "default"}
                className="rounded-lg"
                onClick={() => {
                  if (selectedFunction) {
                    handleUseFunction(selectedFunction)
                    setFunctionDialogOpen(false)
                  }
                }}
              >
                <Play className="h-4 w-4 mr-1" />
                Use Function
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
