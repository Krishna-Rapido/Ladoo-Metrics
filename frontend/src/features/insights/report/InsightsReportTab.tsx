import { useEffect, useMemo, useState } from "react"
import { Cloud, CloudDownload, Folder, Trash2 } from "lucide-react"

import { useReport } from "@/contexts/ReportContext"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  clearReport,
  deleteReportItem,
  exportReport,
  type ReportItem,
} from "@/lib/api"
import { listFolders, type ReportFolder } from "@/lib/supabase"

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function exportBinary(reportId: string, format: "pdf" | "png" | "word") {
  const headers = new Headers()
  headers.set("x-report-id", reportId)

  const res = await fetch(`${BASE_URL}/report/export/${format}`, {
    method: "GET",
    headers,
  })
  if (!res.ok) throw new Error(await res.text())

  const blob = await res.blob()
  const ext = format === "word" ? "docx" : format
  downloadBlob(blob, `experiment_report_${new Date().toISOString().split("T")[0]}.${ext}`)
}

function itemLabel(item: ReportItem) {
  const ts = item.timestamp ? new Date(item.timestamp).toLocaleString() : ""
  return `${item.type.toUpperCase()} • ${ts}`
}

export function InsightsReportTab() {
  const { user } = useAuth()
  const {
    reportId,
    items,
    isLoading,
    refreshItems,
    addItem,
    savedReports,
    isSavingToCloud,
    isLoadingFromCloud,
    saveToCloud,
    loadFromCloud,
    listSavedReports,
    deleteSavedReport,
    currentSavedReportName,
  } = useReport()

  const [exportLoading, setExportLoading] = useState<string | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  const [noteTitle, setNoteTitle] = useState("")
  const [noteText, setNoteText] = useState("")

  // Cloud save dialog state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [reportName, setReportName] = useState("")
  const [cloudError, setCloudError] = useState<string | null>(null)
  const [folders, setFolders] = useState<ReportFolder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [isLoadingFolders, setIsLoadingFolders] = useState(false)

  // Load saved reports when component mounts and user is authenticated
  useEffect(() => {
    if (user) {
      listSavedReports()
    }
  }, [user, listSavedReports])

  // Load folders when save dialog opens
  const loadFolders = async () => {
    setIsLoadingFolders(true)
    try {
      const data = await listFolders()
      setFolders(data)
    } catch (err) {
      console.error("Failed to load folders:", err)
    } finally {
      setIsLoadingFolders(false)
    }
  }

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => (a.timestamp ?? "").localeCompare(b.timestamp ?? ""))
  }, [items])

  const handleSaveLocal = () => {
    try {
      localStorage.setItem(
        "insights_report_cache",
        JSON.stringify({
          reportId,
          savedAt: new Date().toISOString(),
          items,
        })
      )
      setSaveMsg("Saved locally.")
      setTimeout(() => setSaveMsg(null), 2000)
    } catch {
      setSaveMsg("Failed to save locally (storage full).")
      setTimeout(() => setSaveMsg(null), 2500)
    }
  }

  const handleSaveToCloud = async () => {
    if (!reportName.trim()) return
    setCloudError(null)

    try {
      await saveToCloud(reportName.trim(), selectedFolderId)
      setSaveDialogOpen(false)
      setReportName("")
      setSelectedFolderId(null)
      setSaveMsg("Saved to cloud!")
      setTimeout(() => setSaveMsg(null), 2000)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save to cloud"
      setCloudError(errorMessage)
      // Don't auto-clear error in dialog so user can see it
    }
  }

  const openSaveDialog = () => {
    setCloudError(null)
    setReportName("")
    setSelectedFolderId(null)
    loadFolders()
    setSaveDialogOpen(true)
  }

  const handleLoadFromCloud = async (savedReportId: string) => {
    if (!savedReportId) return
    setCloudError(null)

    try {
      await loadFromCloud(savedReportId)
      setSaveMsg("Report loaded!")
      setTimeout(() => setSaveMsg(null), 2000)
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : "Failed to load report")
      setTimeout(() => setCloudError(null), 3000)
    }
  }

  const handleDeleteSavedReport = async (savedReportId: string) => {
    try {
      await deleteSavedReport(savedReportId)
      setSaveMsg("Report deleted")
      setTimeout(() => setSaveMsg(null), 2000)
    } catch (error) {
      console.error("Failed to delete report:", error)
    }
  }

  const handleExportHtml = async () => {
    if (!reportId) return
    setExportLoading("html")
    try {
      const { report_html } = await exportReport(reportId)
      downloadBlob(new Blob([report_html], { type: "text/html" }), `experiment_report_${new Date().toISOString().split("T")[0]}.html`)
    } finally {
      setExportLoading(null)
    }
  }

  const handleExport = async (fmt: "pdf" | "png" | "word") => {
    if (!reportId) return
    setExportLoading(fmt)
    try {
      await exportBinary(reportId, fmt)
    } finally {
      setExportLoading(null)
    }
  }

  const handleDelete = async (itemId: string) => {
    if (!reportId) return
    await deleteReportItem(itemId, reportId)
    await refreshItems()
  }

  const handleClear = async () => {
    if (!reportId) return
    await clearReport(reportId)
    await refreshItems()
  }

  const handleAddNote = async () => {
    if (!noteTitle.trim() || !noteText.trim()) return
    await addItem({
      type: "text",
      title: noteTitle.trim(),
      content: { text: noteText.trim() },
      comment: "",
    })
    setNoteTitle("")
    setNoteText("")
  }

  return (
    <>
      <div className="flex flex-col gap-6 overflow-x-hidden">
        <Card className="rounded-2xl border-border/60 shadow-sm overflow-x-hidden">
          <CardHeader className="pb-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground">[In 3]:</span>
                <CardTitle className="text-base font-semibold">Report</CardTitle>
                <span className="text-xs text-muted-foreground">{items.length} items</span>
                {currentSavedReportName && (
                  <span className="text-xs text-primary font-medium">• {currentSavedReportName}</span>
                )}
                {saveMsg ? <span className="text-xs text-emerald-700">{saveMsg}</span> : null}
                {cloudError ? <span className="text-xs text-destructive">{cloudError}</span> : null}
              </div>
            </div>

            {/* Action buttons row 1 - Local actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="h-9 rounded-xl" onClick={() => refreshItems()} disabled={!reportId || isLoading}>
                Refresh
              </Button>
              <Button variant="outline" className="h-9 rounded-xl" onClick={handleSaveLocal} disabled={!reportId}>
                Save Local
              </Button>
              <Button variant="outline" className="h-9 rounded-xl" onClick={handleExportHtml} disabled={!reportId || items.length === 0 || exportLoading !== null}>
                Export HTML
              </Button>
              <Button variant="outline" className="h-9 rounded-xl" onClick={() => handleExport("pdf")} disabled={!reportId || items.length === 0 || exportLoading !== null}>
                Export PDF
              </Button>
              <Button variant="outline" className="h-9 rounded-xl" onClick={() => handleExport("png")} disabled={!reportId || items.length === 0 || exportLoading !== null}>
                Export PNG
              </Button>
              <Button variant="outline" className="h-9 rounded-xl" onClick={() => handleExport("word")} disabled={!reportId || items.length === 0 || exportLoading !== null}>
                Export Word
              </Button>
              <Button variant="destructive" className="h-9 rounded-xl" onClick={handleClear} disabled={!reportId || items.length === 0 || exportLoading !== null}>
                Clear
              </Button>
            </div>

            {/* Action buttons row 2 - Cloud actions (only for authenticated users) */}
            {user && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
                <span className="text-xs text-muted-foreground mr-2">Cloud:</span>

                {/* Save to Cloud Button */}
                <Button
                  variant="outline"
                  className="h-9 rounded-xl"
                  disabled={!reportId || items.length === 0 || isSavingToCloud}
                  onClick={openSaveDialog}
                >
                  <Cloud className="h-4 w-4 mr-2" />
                  {isSavingToCloud ? "Saving..." : "Save to Cloud"}
                </Button>

                {/* Load from Cloud Dropdown */}
                <div className="flex items-center gap-2">
                  <Select
                    value=""
                    onValueChange={handleLoadFromCloud}
                    disabled={isLoadingFromCloud || savedReports.length === 0}
                  >
                    <SelectTrigger className="h-9 w-[200px] rounded-xl">
                      <CloudDownload className="h-4 w-4 mr-2" />
                      <SelectValue placeholder={isLoadingFromCloud ? "Loading..." : "Load Report"} />
                    </SelectTrigger>
                    <SelectContent>
                      {savedReports.length === 0 ? (
                        <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                          No saved reports
                        </div>
                      ) : (
                        savedReports.map((report) => (
                          <SelectItem key={report.id} value={report.id}>
                            <div className="flex items-center justify-between w-full">
                              <span className="truncate">{report.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                {new Date(report.updated_at).toLocaleDateString()}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  {/* Refresh saved reports */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-lg"
                    onClick={() => listSavedReports()}
                    title="Refresh saved reports"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </Button>
                </div>
              </div>
            )}

            {/* Saved Reports List (collapsible) */}
            {user && savedReports.length > 0 && (
              <div className="pt-2 border-t border-border/40">
                <div className="text-xs font-semibold text-muted-foreground mb-2">MY SAVED REPORTS</div>
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                  {savedReports.slice(0, 5).map((report) => (
                    <div
                      key={report.id}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border/60 bg-muted/30 text-xs"
                    >
                      <button
                        onClick={() => handleLoadFromCloud(report.id)}
                        className="hover:text-primary truncate max-w-[150px]"
                        title={report.name}
                      >
                        {report.name}
                      </button>
                      <button
                        onClick={() => handleDeleteSavedReport(report.id)}
                        className="text-muted-foreground hover:text-destructive ml-1"
                        title="Delete report"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {savedReports.length > 5 && (
                    <span className="text-xs text-muted-foreground py-1">
                      +{savedReports.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
              <div className="rounded-xl border border-border/60 p-4">
                <div className="text-xs font-semibold tracking-widest text-muted-foreground">ADD NOTE</div>
                <div className="mt-3 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Title</Label>
                    <Input className="h-9 rounded-lg" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="e.g. Key finding" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Note</Label>
                    <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Write your note..." className="min-h-[120px] rounded-lg" />
                  </div>
                  <Button className="w-full rounded-lg" onClick={handleAddNote} disabled={!noteTitle.trim() || !noteText.trim() || !reportId}>
                    Add to Report
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 overflow-x-hidden">
                <div className="flex min-w-0 items-center justify-between gap-3 px-4 py-3">
                  <div className="text-sm font-semibold">Items</div>
                  <div className="min-w-0 text-xs text-muted-foreground truncate" title={reportId ?? ""}>
                    {reportId ? `report_id: ${reportId}` : "no report session"}
                  </div>
                </div>
                <Separator />
                <div className="p-4 space-y-4">
                  {isLoading && sortedItems.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Loading…</div>
                  ) : sortedItems.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No items yet. Use "Add to Report" on a chart/table.</div>
                  ) : (
                    sortedItems.map((item) => (
                      <div key={item.id} className="rounded-xl border border-border/60 bg-background">
                        <div className="flex items-start justify-between gap-4 p-4">
                          <div className="min-w-0">
                            <div className="text-xs text-muted-foreground truncate">{itemLabel(item)}</div>
                            <div className="mt-1 font-semibold truncate">{item.title}</div>
                          </div>
                          <Button variant="outline" className="h-8 rounded-lg" onClick={() => handleDelete(item.id)} disabled={!reportId}>
                            Remove
                          </Button>
                        </div>
                        {"imageDataUrl" in (item.content ?? {}) && item.content?.imageDataUrl ? (
                          <div className="border-t border-border/60 bg-white">
                            <img src={item.content.imageDataUrl} alt={item.title} className="w-full h-auto" />
                          </div>
                        ) : item.type === "text" && item.content?.text ? (
                          <div className="border-t border-border/60 p-4 text-sm whitespace-pre-wrap">{String(item.content.text)}</div>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save to Cloud Dialog - rendered outside the card for proper modal behavior */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-xl" style={{ backgroundColor: 'white', color: '#1a1a1a' }}>
          <DialogHeader>
            <DialogTitle style={{ color: '#1a1a1a' }}>Save Report to Cloud</DialogTitle>
            <DialogDescription style={{ color: '#666' }}>
              Give your report a name and choose where to save it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="report-name" style={{ color: '#1a1a1a' }}>Report Name</Label>
              <Input
                id="report-name"
                placeholder="e.g. Q4 Captain Performance Analysis"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                className="rounded-lg"
                style={{ backgroundColor: 'white', color: '#1a1a1a', borderColor: '#e5e5e5' }}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: '#1a1a1a' }}>Save Location</Label>
              <Select
                value={selectedFolderId || "root"}
                onValueChange={(value) => setSelectedFolderId(value === "root" ? null : value)}
                disabled={isLoadingFolders}
              >
                <SelectTrigger className="rounded-lg" style={{ backgroundColor: 'white', color: '#1a1a1a', borderColor: '#e5e5e5' }}>
                  <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4 text-amber-500" />
                    <SelectValue placeholder={isLoadingFolders ? "Loading folders..." : "Select folder"} />
                  </div>
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: 'white', color: '#1a1a1a' }}>
                  <SelectItem value="root">
                    <div className="flex items-center gap-2">
                      <Folder className="h-4 w-4 text-gray-500" />
                      <span>Reports (root)</span>
                    </div>
                  </SelectItem>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      <div className="flex items-center gap-2">
                        <Folder className="h-4 w-4 text-amber-500" />
                        <span>{folder.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs" style={{ color: '#888' }}>
                You can create new folders in the Reports page
              </p>
            </div>
            {cloudError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {cloudError}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setSaveDialogOpen(false)
                setReportName("")
                setSelectedFolderId(null)
                setCloudError(null)
              }}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveToCloud}
              disabled={!reportName.trim() || isSavingToCloud}
              className="rounded-lg"
            >
              {isSavingToCloud ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
