"use client"

import { useMemo, useRef, useState } from "react"
import Papa from "papaparse"
import { Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type CsvRecord = Record<string, unknown>

type ParsedRep = {
  repName: string
  revenue: number
  quota: number
  status: "On Track" | "At Risk" | "Behind"
}

const PAPER_RGB = [249, 245, 235] as const
const INK_RGB = [26, 26, 26] as const
const GREEN_RGB = [22, 101, 52] as const
const BORDER_RGB = [220, 213, 196] as const

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
}

function findHeader(headers: string[], aliases: string[]) {
  const map = new Map(headers.map((header) => [normalizeHeader(header), header]))

  for (const alias of aliases) {
    const match = map.get(alias)
    if (match) return match
  }

  return null
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,%\s,]/g, "")
    const parsed = Number.parseFloat(cleaned)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function deriveStatus(revenue: number, quota: number): ParsedRep["status"] {
  const attainment = quota > 0 ? revenue / quota : 0
  if (attainment >= 1) return "On Track"
  if (attainment >= 0.85) return "At Risk"
  return "Behind"
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function statusPillClasses(status: ParsedRep["status"]) {
  if (status === "On Track") return "bg-green-100 text-green-800"
  if (status === "At Risk") return "bg-amber-100 text-amber-800"
  return "bg-red-100 text-red-800"
}

function sanitizeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/\.csv$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function ReportUploader() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isDragging, setIsDragging] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [fileName, setFileName] = useState("")
  const [parseError, setParseError] = useState<string | null>(null)
  const [rows, setRows] = useState<ParsedRep[]>([])

  const totals = useMemo(() => {
    const teamRevenue = rows.reduce((sum, row) => sum + row.revenue, 0)
    const teamQuota = rows.reduce((sum, row) => sum + row.quota, 0)
    const attainment = teamQuota > 0 ? (teamRevenue / teamQuota) * 100 : 0
    const onTrackCount = rows.filter((row) => row.status === "On Track").length
    const avgRepRevenue = rows.length > 0 ? teamRevenue / rows.length : 0

    return {
      teamRevenue,
      teamQuota,
      attainment,
      onTrackCount,
      avgRepRevenue,
    }
  }, [rows])

  function parseFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setParseError("Only .csv files are supported.")
      return
    }

    setParseError(null)

    Papa.parse<CsvRecord>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = (results.meta.fields ?? []).filter(Boolean)

        const repHeader = findHeader(headers, ["rep_name", "rep", "name", "sales_rep", "repname"])
        const revenueHeader = findHeader(headers, ["revenue", "sales", "amount", "arr", "mrr"])
        const quotaHeader = findHeader(headers, ["quota", "target", "goal"])
        const statusHeader = findHeader(headers, ["status", "health", "state"])

        if (!repHeader || !revenueHeader || !quotaHeader) {
          setParseError("CSV must include columns for rep name, revenue, and quota.")
          setRows([])
          setFileName("")
          return
        }

        const parsedRows = (results.data ?? [])
          .map((record) => {
            const repName = String(record[repHeader] ?? "").trim()
            const revenue = parseNumber(record[revenueHeader])
            const quota = parseNumber(record[quotaHeader])
            const rawStatus = statusHeader ? String(record[statusHeader] ?? "").trim() : ""

            if (!repName) return null

            const normalizedStatus = rawStatus.toLowerCase()
            const status: ParsedRep["status"] =
              normalizedStatus === "on track"
                ? "On Track"
                : normalizedStatus === "at risk"
                  ? "At Risk"
                  : normalizedStatus === "behind"
                    ? "Behind"
                    : deriveStatus(revenue, quota)

            return {
              repName,
              revenue,
              quota,
              status,
            }
          })
          .filter((row): row is ParsedRep => Boolean(row))

        if (parsedRows.length === 0) {
          setParseError("No valid rows found. Ensure your CSV has rep names.")
          setRows([])
          setFileName("")
          return
        }

        setRows(parsedRows)
        setFileName(file.name)
      },
      error: (error) => {
        setParseError(`Unable to parse CSV: ${error.message}`)
        setRows([])
        setFileName("")
      },
    })
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    parseFile(file)
  }

  async function generatePdf() {
    if (rows.length === 0 || isGenerating) return

    setIsGenerating(true)

    try {
      const { default: JsPDF } = await import("jspdf")
      const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" })

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 14

      const fontList = doc.getFontList() as Record<string, string[]>
      const sansFont = fontList["DM Sans"] ? "DM Sans" : "helvetica"
      const serifFont = fontList["Instrument Serif"] ? "Instrument Serif" : "times"

      const drawPageBackground = () => {
        doc.setFillColor(PAPER_RGB[0], PAPER_RGB[1], PAPER_RGB[2])
        doc.rect(0, 0, pageWidth, pageHeight, "F")
      }

      const drawFooter = () => {
        doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2])
        doc.setFont(sansFont, "normal")
        doc.setFontSize(9)
        doc.text(
          "Generated by PipelineIQ — Beautiful sales reporting",
          pageWidth / 2,
          pageHeight - 8,
          { align: "center" }
        )
      }

      const drawTableHeader = (y: number) => {
        doc.setFillColor(232, 242, 234)
        doc.roundedRect(margin, y, pageWidth - margin * 2, 9, 1.5, 1.5, "F")
        doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2])
        doc.roundedRect(margin, y, pageWidth - margin * 2, 9, 1.5, 1.5)

        doc.setFont(sansFont, "bold")
        doc.setFontSize(9)
        doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2])

        doc.text("Rep Name", margin + 4, y + 5.8)
        doc.text("Revenue", margin + 76, y + 5.8)
        doc.text("Quota", margin + 112, y + 5.8)
        doc.text("Status", margin + 144, y + 5.8)
      }

      drawPageBackground()

      doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2])
      doc.setFont(serifFont, "normal")
      doc.setFontSize(20)
      doc.text("April Performance Snapshot • PipelineIQ", margin, 20)

      doc.setFont(sansFont, "normal")
      doc.setFontSize(9)
      doc.text(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }), margin, 26)

      const cards = [
        {
          label: "Team Revenue",
          value: formatCurrency(totals.teamRevenue),
          hint: `${rows.length} reps`,
        },
        {
          label: "Team Quota",
          value: formatCurrency(totals.teamQuota),
          hint: "Monthly target",
        },
        {
          label: "Goal Attainment",
          value: `${Math.round(totals.attainment)}%`,
          hint: "Revenue vs quota",
        },
        {
          label: "Avg Rep Revenue",
          value: formatCurrency(totals.avgRepRevenue),
          hint: `${totals.onTrackCount}/${rows.length} on track`,
        },
      ]

      const cardWidth = (pageWidth - margin * 2 - 8) / 2
      const cardHeight = 24
      let cardY = 34

      cards.forEach((card, index) => {
        const col = index % 2
        const row = Math.floor(index / 2)
        const x = margin + col * (cardWidth + 8)
        const y = cardY + row * (cardHeight + 6)

        doc.setFillColor(255, 255, 255)
        doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2])
        doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "FD")

        doc.setFont(sansFont, "normal")
        doc.setFontSize(8)
        doc.setTextColor(70, 70, 70)
        doc.text(card.label, x + 4, y + 6)

        doc.setFont(serifFont, "normal")
        doc.setFontSize(14)
        doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2])
        doc.text(card.value, x + 4, y + 14)

        doc.setFont(sansFont, "normal")
        doc.setFontSize(8)
        doc.setTextColor(GREEN_RGB[0], GREEN_RGB[1], GREEN_RGB[2])
        doc.text(card.hint, x + 4, y + 20)
      })

      let y = cardY + (cardHeight + 6) * 2 + 6
      drawTableHeader(y)
      y += 11

      doc.setFont(sansFont, "normal")
      doc.setFontSize(9)

      for (const row of rows) {
        if (y > pageHeight - 20) {
          drawFooter()
          doc.addPage()
          drawPageBackground()
          doc.setFont(serifFont, "normal")
          doc.setFontSize(14)
          doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2])
          doc.text("Rep Performance (Continued)", margin, 18)
          y = 24
          drawTableHeader(y)
          y += 11
        }

        doc.setFillColor(255, 255, 255)
        doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2])
        doc.roundedRect(margin, y - 6.2, pageWidth - margin * 2, 8.4, 1.2, 1.2, "FD")

        doc.setFont(sansFont, "normal")
        doc.setFontSize(9)
        doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2])
        doc.text(row.repName, margin + 4, y - 0.6)
        doc.text(formatCurrency(row.revenue), margin + 76, y - 0.6)
        doc.text(formatCurrency(row.quota), margin + 112, y - 0.6)

        const statusColor =
          row.status === "On Track"
            ? GREEN_RGB
            : row.status === "At Risk"
              ? ([176, 125, 0] as const)
              : ([197, 34, 31] as const)

        doc.setTextColor(statusColor[0], statusColor[1], statusColor[2])
        doc.text(row.status, margin + 144, y - 0.6)

        y += 10
      }

      drawFooter()

      const slug = fileName ? sanitizeFileName(fileName) : "pipelineiq-report"
      doc.save(`${slug || "pipelineiq-report"}.pdf`)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Card className="border-border bg-paper">
      <CardHeader>
        <CardTitle className="font-serif text-3xl text-ink">CSV Report Uploader</CardTitle>
        <CardDescription className="text-ink-2">
          Drop a CSV to preview rep performance and generate a polished PDF.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleInputChange}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={(event) => {
            event.preventDefault()
            setIsDragging(false)
          }}
          onDrop={(event) => {
            event.preventDefault()
            setIsDragging(false)
            const file = event.dataTransfer.files?.[0]
            if (file) parseFile(file)
          }}
          className={`flex min-h-56 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
            isDragging
              ? "border-[#166534] bg-[#e9f4ec]"
              : "border-border bg-white hover:bg-[var(--paper-2)]"
          }`}
        >
          <Upload className="h-12 w-12 text-ink" />
          <p className="mt-4 text-lg font-medium text-ink">Drag & drop your .csv here</p>
          <p className="mt-2 text-sm text-ink-3">or click to browse files</p>
        </button>

        {fileName ? (
          <p className="text-sm text-ink-2">
            Loaded file: <span className="font-medium text-ink">{fileName}</span>
          </p>
        ) : null}

        {parseError ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{parseError}</p>
        ) : null}

        {rows.length > 0 ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-ink-3">Live Preview</p>
              <Table className="mt-3">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-ink-3">Rep Name</TableHead>
                    <TableHead className="text-ink-3">Revenue</TableHead>
                    <TableHead className="text-ink-3">Quota</TableHead>
                    <TableHead className="text-ink-3">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={`${row.repName}-${index}`}>
                      <TableCell className="font-medium text-ink">{row.repName}</TableCell>
                      <TableCell className="font-mono text-ink">{formatCurrency(row.revenue)}</TableCell>
                      <TableCell className="font-mono text-ink">{formatCurrency(row.quota)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusPillClasses(row.status)}`}>
                          {row.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button
              type="button"
              onClick={generatePdf}
              disabled={isGenerating}
              className="h-14 w-full bg-[#166534] text-base font-semibold text-white hover:bg-[#14532d]"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating PDF Report...
                </>
              ) : (
                "Generate PDF Report"
              )}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
