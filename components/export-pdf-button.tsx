"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
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
    <button
      type="button"
      onClick={handleExport}
      disabled={isExporting}
      className="fixed right-6 top-6 z-[100] inline-flex items-center gap-2 rounded-[6px] bg-[var(--ink)] px-[18px] py-[9px] text-xs font-medium tracking-[0.03em] text-white shadow-[0_2px_12px_rgba(0,0,0,0.15)] transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-70 print:hidden"
    >
      {isExporting ? (
        <>
          <Loader2 className="h-[13px] w-[13px] animate-spin" />
          Generating PDF...
        </>
      ) : (
        <>
          <Download className="h-[13px] w-[13px]" />
          Export PDF
        </>
      )}
    </button>
  )
}
