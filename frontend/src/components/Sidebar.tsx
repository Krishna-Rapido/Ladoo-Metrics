import { useState } from "react"
import { 
  LayoutDashboard, 
  Upload, 
  TrendingUp, 
  FileText,
  Calendar,
  Users,
  ChevronRight,
  ChevronDown
} from "lucide-react"
import { CardHeader, CardTitle, CardDescription, CardContent } from "./ui/card"
import { Button } from "./ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible"

type Page = "dashboard" | "experiment" | "funnel"
type ExperimentStep = "upload" | "date-range" | "cohort-selection" | null

interface SidebarProps {
  activePage: Page
  activeStep?: ExperimentStep
  onPageChange: (page: Page) => void
  onStepChange?: (step: ExperimentStep) => void
}

export function Sidebar({ activePage, onPageChange, onStepChange }: SidebarProps) {
  const [isExperimentOpen, setIsExperimentOpen] = useState(activePage === "experiment")

  const handleExperimentClick = () => {
    if (activePage !== "experiment") {
      onPageChange("experiment")
      setIsExperimentOpen(true)
      if (onStepChange) onStepChange("upload")
    } else {
      setIsExperimentOpen(!isExperimentOpen)
    }
  }

  const handleStepClick = (step: ExperimentStep) => {
    if (onStepChange) {
      onStepChange(step)
    }
    onPageChange("experiment")
    setIsExperimentOpen(true)
  }

  return (
    <aside className="w-64 border-r bg-card flex-shrink-0 h-screen sticky top-0 overflow-hidden">
      <div className="h-full flex flex-col">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-lg">Ladoo Metrics</CardTitle>
          <CardDescription>Analytics Dashboard</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-6 pt-0">
          <nav className="space-y-2">
            {/* Experiment Analysis - Collapsible */}
            <Collapsible open={isExperimentOpen} onOpenChange={setIsExperimentOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={handleExperimentClick}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Experiment Analysis
                  {isExperimentOpen ? (
                    <ChevronDown className="ml-auto h-4 w-4" />
                  ) : (
                    <ChevronRight className="ml-auto h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1">
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => handleStepClick("upload")}
                >
                  <FileText className="mr-2 h-3.5 w-3.5" />
                  Upload CSV
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => handleStepClick("date-range")}
                >
                  <Calendar className="mr-2 h-3.5 w-3.5" />
                  Date Range Filter
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => handleStepClick("cohort-selection")}
                >
                  <Users className="mr-2 h-3.5 w-3.5" />
                  Cohort Selection
                </Button>
              </CollapsibleContent>
            </Collapsible>

            {/* Dashboards */}
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => onPageChange("dashboard")}
            >
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Dashboards
            </Button>

            {/* Funnel Analysis */}
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => onPageChange("funnel")}
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              Funnel Analysis
            </Button>
          </nav>
        </CardContent>
      </div>
    </aside>
  )
}
