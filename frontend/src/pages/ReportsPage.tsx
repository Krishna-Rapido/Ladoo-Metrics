import { useEffect, useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import {
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  FolderPlus,
  Home,
  MoreVertical,
  Trash2,
  Edit2,
  ArrowRight,
} from "lucide-react"

import { PrimarySidebar } from "@/components/nav/PrimarySidebar"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Separator } from "@/components/ui/separator"

import {
  supabase,
  listFolders,
  listAllReports,
  createFolder,
  renameFolder,
  deleteFolder,
  moveReportToFolder,
  type ReportFolder,
  type SavedReport,
} from "@/lib/supabase"

type BreadcrumbItem = {
  id: string | null
  name: string
}

export function ReportsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [folders, setFolders] = useState<ReportFolder[]>([])
  const [reports, setReports] = useState<SavedReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Current folder navigation
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)

  // Dialog states
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string; type: "folder" } | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: "folder" | "report" } | null>(null)
  const [openReportModal, setOpenReportModal] = useState<SavedReport | null>(null)

  // Load data
  const loadData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [foldersData, reportsData] = await Promise.all([
        listFolders(),
        listAllReports(),
      ])
      setFolders(foldersData)
      setReports(reportsData)
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
    const path: BreadcrumbItem[] = [{ id: null, name: "Reports" }]
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
    const folderReports = reports.filter(r => r.folder_id === currentFolderId)
    return { subFolders, reports: folderReports }
  }, [folders, reports, currentFolderId])

  // Handlers
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    try {
      await createFolder(newFolderName.trim(), currentFolderId)
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
      await renameFolder(renameTarget.id, newFolderName.trim())
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
        await deleteFolder(deleteTarget.id)
      } else {
        await supabase.from("saved_reports").delete().eq("id", deleteTarget.id)
      }
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  const handleOpenReportClick = (report: SavedReport) => {
    setOpenReportModal(report)
  }

  const handleConfirmOpenInInsights = () => {
    if (!openReportModal) return
    localStorage.setItem("load_report_id", openReportModal.id)
    setOpenReportModal(null)
    navigate("/insights")
  }

  const openRenameDialog = (folder: ReportFolder) => {
    setRenameTarget({ id: folder.id, name: folder.name, type: "folder" })
    setNewFolderName(folder.name)
    setRenameDialogOpen(true)
  }

  const openDeleteDialog = (item: ReportFolder | SavedReport, type: "folder" | "report") => {
    setDeleteTarget({ id: item.id, name: item.name, type })
    setDeleteDialogOpen(true)
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="flex w-full">
        <PrimarySidebar activeOverride="reports" />

        <main className="flex-1 p-8">
          <div className="mx-auto max-w-5xl">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold">Reports Library</h1>
              <p className="text-muted-foreground">Browse and organize saved reports from all users</p>
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
                ) : currentFolderItems.subFolders.length === 0 && currentFolderItems.reports.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Folder className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>This folder is empty</p>
                    <p className="text-sm mt-1">Create a folder or save a report here</p>
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

                    {currentFolderItems.subFolders.length > 0 && currentFolderItems.reports.length > 0 && (
                      <Separator className="my-2" />
                    )}

                    {/* Reports */}
                    {currentFolderItems.reports.map((report) => (
                      <div
                        key={report.id}
                        className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 group"
                      >
                        <button
                          onClick={() => handleOpenReportClick(report)}
                          className="flex items-center gap-3 flex-1 text-left"
                        >
                          <File className="h-5 w-5 text-blue-500" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{report.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {report.items?.length || 0} items • Updated {new Date(report.updated_at).toLocaleDateString()}
                            </div>
                          </div>
                        </button>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 opacity-0 group-hover:opacity-100"
                            onClick={() => handleOpenReportClick(report)}
                          >
                            Open
                            <ArrowRight className="h-4 w-4 ml-1" />
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
                                onClick={() => openDeleteDialog(report, "report")}
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
                placeholder="e.g. Q4 2025 Reports"
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
            <DialogTitle style={{ color: '#1a1a1a' }}>Delete {deleteTarget?.type === "folder" ? "Folder" : "Report"}</DialogTitle>
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

      {/* Open report modal – redirects to Insights */}
      <Dialog open={!!openReportModal} onOpenChange={(open) => !open && setOpenReportModal(null)}>
        <DialogContent className="sm:max-w-md rounded-xl" style={{ backgroundColor: 'white', color: '#1a1a1a' }}>
          <DialogHeader>
            <DialogTitle style={{ color: '#1a1a1a' }}>Open report</DialogTitle>
            <DialogDescription style={{ color: '#666' }}>
              Opening "{openReportModal?.name}" will take you to the Insights page where you can view and edit the report.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenReportModal(null)} className="rounded-lg">
              Cancel
            </Button>
            <Button onClick={handleConfirmOpenInInsights} className="rounded-lg">
              Open in Insights
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
