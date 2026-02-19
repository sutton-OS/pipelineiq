"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import Papa from "papaparse"
import { Loader2, UploadCloud } from "lucide-react"
import { saveReport } from "@/app/actions/upload"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Step = "upload" | "map" | "preview" | "done"
type PeriodType = "weekly" | "monthly"
type CsvRow = Record<string, unknown>
type RequiredField = "rep_name" | "revenue" | "quota"
type OptionalField =
  | "role"
  | "deals_closed"
  | "calls"
  | "emails"
  | "demos"
  | "leads"
  | "contacts"
  | "qualified"
  | "avg_deal_size"
  | "avg_days_to_close"
type FieldKey = RequiredField | OptionalField
type NumericOptionalField = Exclude<OptionalField, "role">

type ImportedRow = {
  rep_name: string
  role?: string
  revenue: number
  quota: number
  deals_closed?: number
  calls?: number
  emails?: number
  demos?: number
  leads?: number
  contacts?: number
  qualified?: number
  avg_deal_size?: number
  avg_days_to_close?: number
}

const requiredFieldMeta: Array<{ key: RequiredField; label: string }> = [
  { key: "rep_name", label: "Rep Name" },
  { key: "revenue", label: "Revenue" },
  { key: "quota", label: "Quota" },
]

const optionalFieldMeta: Array<{ key: OptionalField; label: string }> = [
  { key: "role", label: "Role" },
  { key: "deals_closed", label: "Deals Closed" },
  { key: "calls", label: "Calls" },
  { key: "emails", label: "Emails" },
  { key: "demos", label: "Demos" },
  { key: "leads", label: "Leads" },
  { key: "contacts", label: "Contacts" },
  { key: "qualified", label: "Qualified" },
  { key: "avg_deal_size", label: "Avg Deal Size" },
  { key: "avg_days_to_close", label: "Avg Days to Close" },
]

const optionalNumericFields: NumericOptionalField[] = [
  "deals_closed",
  "calls",
  "emails",
  "demos",
  "leads",
  "contacts",
  "qualified",
  "avg_deal_size",
  "avg_days_to_close",
]

const allFields = [...requiredFieldMeta, ...optionalFieldMeta]
const UNMAPPED = "__unmapped__"

function monthName(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long" }).format(date)
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[$,%\s,]/g, ""))
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function formatCellValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—"
  return String(value)
}

function getInitialMappings(headers: string[]): Record<FieldKey, string> {
  const normalizedToOriginal = new Map<string, string>(
    headers.map((header) => [normalizeHeader(header), header])
  )

  const aliases: Record<FieldKey, string[]> = {
    rep_name: ["rep_name", "rep", "name", "sales_rep", "repname"],
    revenue: ["revenue", "sales", "amount", "arr", "mrr"],
    quota: ["quota", "target", "goal"],
    role: ["role", "title", "position"],
    deals_closed: ["deals_closed", "deals", "closed_deals"],
    calls: ["calls", "call_count"],
    emails: ["emails", "email_count"],
    demos: ["demos", "demo_count"],
    leads: ["leads", "lead_count"],
    contacts: ["contacts", "contact_count"],
    qualified: ["qualified", "qualified_leads"],
    avg_deal_size: ["avg_deal_size", "average_deal_size"],
    avg_days_to_close: ["avg_days_to_close", "days_to_close"],
  }

  const mappings = Object.fromEntries(
    allFields.map(({ key }) => [key, ""])
  ) as Record<FieldKey, string>

  for (const { key } of allFields) {
    const match = aliases[key]
      .map((alias) => normalizedToOriginal.get(alias))
      .find(Boolean)
    mappings[key] = match ?? ""
  }

  return mappings
}

export function UploadFlow() {
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const [step, setStep] = useState<Step>("upload")
  const [isDragging, setIsDragging] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [uploadedFileName, setUploadedFileName] = useState<string>("")
  const [reportId, setReportId] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<CsvRow[]>([])
  const [mappings, setMappings] = useState<Record<FieldKey, string>>(
    Object.fromEntries(allFields.map(({ key }) => [key, ""])) as Record<
      FieldKey,
      string
    >
  )
  const [reportName, setReportName] = useState(`Monthly Report — ${monthName(now)}`)
  const [periodType, setPeriodType] = useState<PeriodType>("monthly")
  const [periodStart, setPeriodStart] = useState(toDateInputValue(firstOfMonth))
  const [periodEnd, setPeriodEnd] = useState(toDateInputValue(endOfMonth))

  const fileInputRef = useRef<HTMLInputElement>(null)

  const requiredMapped = requiredFieldMeta.every(
    ({ key }) => mappings[key] && headers.includes(mappings[key])
  )

  const importedRows = useMemo<ImportedRow[]>(() => {
    return rows
      .map((row) => {
        const repName = String(row[mappings.rep_name] ?? "").trim()
        const roleValue = mappings.role ? String(row[mappings.role] ?? "").trim() : ""

        const imported: ImportedRow = {
          rep_name: repName,
          revenue: toNumber(row[mappings.revenue]),
          quota: toNumber(row[mappings.quota]),
        }

        if (roleValue) imported.role = roleValue

        for (const key of optionalNumericFields) {
          if (!mappings[key]) continue
          imported[key] = toNumber(row[mappings[key]])
        }

        return imported
      })
      .filter((row) => row.rep_name)
  }, [mappings, rows])

  const previewColumns = useMemo(
    () =>
      allFields
        .filter(({ key }) => Boolean(mappings[key]))
        .map(({ key, label }) => ({ key, label })),
    [mappings]
  )

  function resetImportState() {
    setImportError(null)
    setReportId(null)
  }

  function parseFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setParseError("Please upload a CSV file.")
      return
    }

    setParseError(null)
    resetImportState()
    setUploadedFileName(file.name)

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedRows = results.data ?? []
        const parsedHeaders = (results.meta.fields ?? []).filter(Boolean)

        if (!parsedRows.length || !parsedHeaders.length) {
          setParseError("No CSV rows were detected. Please check your file.")
          return
        }

        setRows(parsedRows)
        setHeaders(parsedHeaders)
        setMappings(getInitialMappings(parsedHeaders))
        setStep("map")
      },
      error: (error) => {
        setParseError(`Unable to parse CSV: ${error.message}`)
      },
    })
  }

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    parseFile(file)
  }

  async function importData() {
    if (!requiredMapped) return
    if (!reportName.trim() || !periodStart || !periodEnd) return

    setStep("done")
    setIsImporting(true)
    setImportError(null)
    setReportId(null)

    const result = await saveReport({
      reportName,
      periodType,
      periodStart,
      periodEnd,
      rows: importedRows,
    })

    setIsImporting(false)

    if ("error" in result) {
      setImportError(result.error)
      return
    }

    setReportId(result.reportId)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>CSV Import</CardTitle>
        <CardDescription>
          Step {step === "upload" ? "1" : step === "map" ? "2" : step === "preview" ? "3" : "4"} of 4
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {step === "upload" && (
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={onInputChange}
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
              className={`flex min-h-64 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-opacity duration-150 hover:opacity-95 ${
                isDragging ? "border-[var(--accent)] bg-[var(--accent-light)]/40" : "border-[var(--border)]"
              }`}
            >
              <UploadCloud className="mb-4 h-10 w-10 text-[var(--ink-2)]" />
              <p className="text-base font-medium">Drag and drop your CSV file here</p>
              <p className="mt-1 text-sm text-[var(--ink-3)]">or click to select a file</p>
              <p className="mt-3 text-xs text-[var(--ink-3)]">Accepted format: .csv</p>
            </button>

            {uploadedFileName && (
              <p className="text-sm">
                Selected file: <span className="font-medium">{uploadedFileName}</span>
              </p>
            )}

            {parseError && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {parseError}
              </p>
            )}
          </div>
        )}

        {step === "map" && (
          <div className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-base font-semibold">Required Fields</h3>
              <div className="grid gap-4 md:grid-cols-3">
                {requiredFieldMeta.map(({ key, label }) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={`map-${key}`}>{label}</Label>
                    <Select
                      value={mappings[key] || undefined}
                      onValueChange={(value) =>
                        setMappings((previous) => ({ ...previous, [key]: value }))
                      }
                    >
                      <SelectTrigger id={`map-${key}`} className="w-full">
                        <SelectValue placeholder="Select a column" />
                      </SelectTrigger>
                      <SelectContent>
                        {headers.map((header) => (
                          <SelectItem key={`${key}-${header}`} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <p className="text-xs text-[var(--ink-3)]">
                      Preview:{" "}
                      <span className="font-medium text-[var(--ink)]">
                        {formatCellValue(rows[0]?.[mappings[key]])}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-base font-semibold">Optional Fields</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {optionalFieldMeta.map(({ key, label }) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={`map-${key}`}>{label}</Label>
                    <Select
                      value={mappings[key] || UNMAPPED}
                      onValueChange={(value) =>
                        setMappings((previous) => ({
                          ...previous,
                          [key]: value === UNMAPPED ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger id={`map-${key}`} className="w-full">
                        <SelectValue placeholder="Not mapped" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNMAPPED}>Not mapped</SelectItem>
                        {headers.map((header) => (
                          <SelectItem key={`${key}-${header}`} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 border-t pt-6">
              <h3 className="text-base font-semibold">Report Details</h3>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="report-name">Report Name</Label>
                  <Input
                    id="report-name"
                    value={reportName}
                    onChange={(event) => setReportName(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="period-start">Period Start</Label>
                  <Input
                    id="period-start"
                    type="date"
                    value={periodStart}
                    onChange={(event) => setPeriodStart(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="period-end">Period End</Label>
                  <Input
                    id="period-end"
                    type="date"
                    value={periodEnd}
                    onChange={(event) => setPeriodEnd(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="period-type">Period Type</Label>
                  <Select
                    value={periodType}
                    onValueChange={(value) => setPeriodType(value as PeriodType)}
                  >
                    <SelectTrigger id="period-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button
                onClick={() => setStep("preview")}
                disabled={!requiredMapped || !reportName.trim() || !periodStart || !periodEnd}
              >
                Preview Import
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-5">
            <div className="rounded-lg border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    {previewColumns.map((column) => (
                      <TableHead key={column.key}>{column.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importedRows.slice(0, 5).map((row, index) => (
                    <TableRow key={`${row.rep_name}-${index}`}>
                      {previewColumns.map((column) => (
                        <TableCell key={`${column.key}-${index}`}>
                          {formatCellValue(row[column.key as keyof ImportedRow])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <p className="text-sm text-[var(--ink-3)]">
              Showing first {Math.min(importedRows.length, 5)} rows of {importedRows.length}.
            </p>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep("map")}>
                Back
              </Button>
              <Button onClick={importData} disabled={importedRows.length === 0}>
                Looks good
              </Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="rounded-lg border bg-white p-6">
            {isImporting && (
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
                <p className="text-sm font-medium">Saving report and metrics...</p>
              </div>
            )}

            {!isImporting && importError && (
              <div className="space-y-4">
                <p className="text-sm text-red-700">{importError}</p>
                <Button variant="outline" onClick={() => setStep("preview")}>
                  Back to Preview
                </Button>
              </div>
            )}

            {!isImporting && !importError && reportId && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Import complete</h3>
                <p className="text-sm text-[var(--ink-2)]">
                  Your report and rep metrics were saved successfully.
                </p>
                <Button asChild>
                  <Link href={`/dashboard/reports/${reportId}`}>View report</Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
