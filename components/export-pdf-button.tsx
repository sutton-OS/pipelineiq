"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { exportReportPDF, type ReportPDFData } from "@/lib/pdf-export"

type ExportPDFButtonProps = ReportPDFData

export function ExportPDFButton(props: ExportPDFButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    if (isExporting) return

    setIsExporting(true)
    try {
      await exportReportPDF(props)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      onClick={handleExport}
      disabled={isExporting}
      className="h-8 bg-[var(--ink)] px-3 text-xs font-medium text-[var(--paper)] hover:bg-[var(--ink-2)]"
    >
      {isExporting ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Generating PDF...
        </>
      ) : (
        <>
          <Download className="h-3.5 w-3.5" />
          Export PDF
        </>
      )}
    </Button>
  )
}
