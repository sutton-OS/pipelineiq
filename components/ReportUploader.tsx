"use client";

import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

type CsvRecord = Record<string, unknown>;

type RepStatus = "On Track" | "At Risk" | "Behind";

type ParsedRep = {
  repName: string;
  revenue: number;
  quota: number;
  status: RepStatus;
};

const COLORS = {
  paper: [249, 245, 235] as const,
  ink: [26, 26, 26] as const,
  inkMuted: [88, 88, 88] as const,
  border: [216, 213, 206] as const,
  green: [26, 110, 60] as const,
  amber: [176, 125, 0] as const,
  red: [197, 34, 31] as const,
};

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function findHeader(headers: string[], aliases: string[]) {
  const headerMap = new Map(
    headers.map((header) => [normalizeHeader(header), header])
  );

  for (const alias of aliases) {
    const match = headerMap.get(alias);
    if (match) return match;
  }

  return null;
}

function parseMoney(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;

  const cleaned = value.replace(/[$,%\s,]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function deriveStatus(revenue: number, quota: number): RepStatus {
  const attainment = quota > 0 ? revenue / quota : 0;

  if (attainment >= 1) return "On Track";
  if (attainment >= 0.85) return "At Risk";
  return "Behind";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function sanitizeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/\.csv$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getStatusClass(status: RepStatus) {
  if (status === "On Track") return "bg-[#e2f0e8] text-[#1a6e3c]";
  if (status === "At Risk") return "bg-[#fdf4d8] text-[#b07d00]";
  return "bg-[#fce8e6] text-[#c5221f]";
}

function getStatusRgb(status: RepStatus) {
  if (status === "On Track") return COLORS.green;
  if (status === "At Risk") return COLORS.amber;
  return COLORS.red;
}

export function ReportUploader() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRep[]>([]);

  const totals = useMemo(() => {
    const teamRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
    const teamQuota = rows.reduce((sum, row) => sum + row.quota, 0);
    const attainment = teamQuota > 0 ? (teamRevenue / teamQuota) * 100 : 0;

    return {
      teamRevenue,
      teamQuota,
      attainment,
      onTrackCount: rows.filter((row) => row.status === "On Track").length,
      avgRevenue: rows.length > 0 ? teamRevenue / rows.length : 0,
    };
  }, [rows]);

  function parseFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setParseError("Please upload a .csv file.");
      setRows([]);
      setFileName("");
      return;
    }

    setParseError(null);

    Papa.parse<CsvRecord>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = (results.meta.fields ?? []).filter(Boolean);

        const repHeader = findHeader(headers, [
          "rep_name",
          "rep",
          "sales_rep",
          "name",
        ]);
        const revenueHeader = findHeader(headers, [
          "revenue",
          "sales",
          "amount",
          "bookings",
        ]);
        const quotaHeader = findHeader(headers, ["quota", "target", "goal"]);
        const statusHeader = findHeader(headers, ["status", "health", "state"]);

        if (!repHeader || !revenueHeader || !quotaHeader) {
          setParseError(
            "CSV must include rep name, revenue, and quota columns."
          );
          setRows([]);
          setFileName("");
          return;
        }

        const parsedRows = (results.data ?? [])
          .map((record) => {
            const repName = String(record[repHeader] ?? "").trim();
            if (!repName) return null;

            const revenue = parseMoney(record[revenueHeader]);
            const quota = parseMoney(record[quotaHeader]);
            const rawStatus = statusHeader
              ? String(record[statusHeader] ?? "").trim().toLowerCase()
              : "";

            let status: RepStatus;
            if (rawStatus === "on track") {
              status = "On Track";
            } else if (rawStatus === "at risk") {
              status = "At Risk";
            } else if (rawStatus === "behind") {
              status = "Behind";
            } else {
              status = deriveStatus(revenue, quota);
            }

            return {
              repName,
              revenue,
              quota,
              status,
            };
          })
          .filter((row): row is ParsedRep => Boolean(row));

        if (parsedRows.length === 0) {
          setParseError("No valid rows found. Add at least one rep row.");
          setRows([]);
          setFileName("");
          return;
        }

        setRows(parsedRows);
        setFileName(file.name);
      },
      error: (error) => {
        setParseError(`Unable to parse CSV: ${error.message}`);
        setRows([]);
        setFileName("");
      },
    });
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (file) parseFile(file);
  }

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) parseFile(file);
  }

  async function generatePdf() {
    if (rows.length === 0 || isGenerating) return;

    setIsGenerating(true);

    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const usableWidth = pageWidth - margin * 2;

      const drawBackground = () => {
        doc.setFillColor(COLORS.paper[0], COLORS.paper[1], COLORS.paper[2]);
        doc.rect(0, 0, pageWidth, pageHeight, "F");
      };

      const drawFooter = () => {
        doc.setTextColor(COLORS.inkMuted[0], COLORS.inkMuted[1], COLORS.inkMuted[2]);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("PipelineIQ • Generated from CSV", pageWidth / 2, pageHeight - 7, {
          align: "center",
        });
      };

      const drawTableHeader = (y: number) => {
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
        doc.roundedRect(margin, y, usableWidth, 9, 1.5, 1.5, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(COLORS.inkMuted[0], COLORS.inkMuted[1], COLORS.inkMuted[2]);

        doc.text("REP", margin + 4, y + 5.7);
        doc.text("REVENUE", margin + 84, y + 5.7);
        doc.text("QUOTA", margin + 118, y + 5.7);
        doc.text("STATUS", margin + 150, y + 5.7);
      };

      drawBackground();

      doc.setTextColor(COLORS.ink[0], COLORS.ink[1], COLORS.ink[2]);
      doc.setFont("times", "normal");
      doc.setFontSize(24);
      doc.text("PipelineIQ Performance Report", margin, 22);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(COLORS.inkMuted[0], COLORS.inkMuted[1], COLORS.inkMuted[2]);
      doc.text(
        `Source: ${fileName || "Uploaded CSV"} • ${new Date().toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}`,
        margin,
        28
      );

      doc.setDrawColor(COLORS.green[0], COLORS.green[1], COLORS.green[2]);
      doc.setLineWidth(0.8);
      doc.line(margin, 33, pageWidth - margin, 33);

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
          label: "Attainment",
          value: formatPercent(totals.attainment),
          hint: "Revenue / quota",
        },
        {
          label: "On Track",
          value: `${totals.onTrackCount}`,
          hint: "Reps above plan",
        },
      ];

      const cardGap = 6;
      const cardWidth = (usableWidth - cardGap) / 2;
      const cardHeight = 22;
      const firstCardY = 38;

      cards.forEach((card, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const x = margin + col * (cardWidth + cardGap);
        const y = firstCardY + row * (cardHeight + 5);

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
        doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "FD");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(COLORS.inkMuted[0], COLORS.inkMuted[1], COLORS.inkMuted[2]);
        doc.text(card.label, x + 3.5, y + 5.5);

        doc.setFont("times", "normal");
        doc.setFontSize(14);
        doc.setTextColor(COLORS.ink[0], COLORS.ink[1], COLORS.ink[2]);
        doc.text(card.value, x + 3.5, y + 13.5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(COLORS.green[0], COLORS.green[1], COLORS.green[2]);
        doc.text(card.hint, x + 3.5, y + 19);
      });

      let y = firstCardY + cardHeight * 2 + 16;
      drawTableHeader(y);
      y += 11;

      for (const row of rows) {
        if (y > pageHeight - 20) {
          drawFooter();
          doc.addPage();
          drawBackground();

          doc.setFont("times", "normal");
          doc.setFontSize(16);
          doc.setTextColor(COLORS.ink[0], COLORS.ink[1], COLORS.ink[2]);
          doc.text("Rep Performance (continued)", margin, 18);

          y = 24;
          drawTableHeader(y);
          y += 11;
        }

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
        doc.roundedRect(margin, y - 6.2, usableWidth, 8.4, 1.2, 1.2, "FD");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(COLORS.ink[0], COLORS.ink[1], COLORS.ink[2]);
        doc.text(row.repName, margin + 4, y - 0.5);
        doc.text(formatCurrency(row.revenue), margin + 84, y - 0.5);
        doc.text(formatCurrency(row.quota), margin + 118, y - 0.5);

        const statusColor = getStatusRgb(row.status);
        doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
        doc.text(row.status, margin + 150, y - 0.5);

        y += 10;
      }

      drawFooter();

      const safeName = sanitizeFileName(fileName) || "pipelineiq-report";
      doc.save(`${safeName}.pdf`);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section className="rounded-3xl border border-[#d8d5ce] bg-[#f9f5eb] p-6 text-[#1a1a1a] shadow-[0_22px_48px_rgba(26,26,26,0.08)] sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.11em] text-[#5a5a5a]">
            CSV to PDF
          </p>
          <h2 className="mt-2 font-serif text-4xl leading-tight">
            Upload sales data and export a beautiful report
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-[#444]">
            Drag in any CSV with rep name, revenue, and quota. We parse it,
            preview it instantly, then generate a polished PDF in the PipelineIQ
            paper + ink style.
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={onInputChange}
      />

      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={onDrop}
        className={`mt-7 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          isDragging
            ? "border-[#1a6e3c] bg-[#e4f2ea]"
            : "border-[#cfcabf] bg-white hover:bg-[#f4efe3]"
        }`}
      >
        <div className="mx-auto flex max-w-md flex-col items-center">
          <Upload className="h-12 w-12 text-[#1a1a1a]" />
          <p className="mt-4 text-lg font-medium">Drag and drop your CSV</p>
          <p className="mt-2 text-sm text-[#5b5b5b]">or click to select a file</p>
          <span className="mt-4 inline-flex items-center rounded-full bg-[#e2f0e8] px-3 py-1 text-xs font-semibold text-[#1a6e3c]">
            .csv only
          </span>
        </div>
      </div>

      {fileName ? (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#d8d5ce] bg-white px-3 py-1.5 text-sm text-[#404040]">
          <FileSpreadsheet className="h-4 w-4 text-[#1a6e3c]" />
          {fileName}
        </div>
      ) : null}

      {parseError ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {parseError}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <div className="mt-7 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-[#d8d5ce] bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-[#666]">Team Revenue</p>
              <p className="mt-2 font-serif text-2xl">{formatCurrency(totals.teamRevenue)}</p>
            </div>
            <div className="rounded-xl border border-[#d8d5ce] bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-[#666]">Team Quota</p>
              <p className="mt-2 font-serif text-2xl">{formatCurrency(totals.teamQuota)}</p>
            </div>
            <div className="rounded-xl border border-[#d8d5ce] bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-[#666]">Attainment</p>
              <p className="mt-2 font-serif text-2xl">{formatPercent(totals.attainment)}</p>
            </div>
            <div className="rounded-xl border border-[#d8d5ce] bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-[#666]">On Track Reps</p>
              <p className="mt-2 font-serif text-2xl">
                {totals.onTrackCount}/{rows.length}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#d8d5ce] bg-white">
            <div className="border-b border-[#d8d5ce] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[#666]">Live Preview</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-[#d8d5ce] bg-[#f6f1e7] text-left text-xs uppercase tracking-[0.08em] text-[#6a6a6a]">
                    <th className="px-4 py-3">Rep</th>
                    <th className="px-4 py-3">Revenue</th>
                    <th className="px-4 py-3">Quota</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.repName}-${index}`} className="border-b border-[#ece8dc] last:border-b-0">
                      <td className="px-4 py-3 font-medium text-[#1a1a1a]">{row.repName}</td>
                      <td className="px-4 py-3 font-mono text-[#1a1a1a]">{formatCurrency(row.revenue)}</td>
                      <td className="px-4 py-3 font-mono text-[#1a1a1a]">{formatCurrency(row.quota)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClass(
                            row.status
                          )}`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Button
            type="button"
            disabled={isGenerating}
            onClick={generatePdf}
            className="h-12 w-full bg-[#1a6e3c] text-sm font-semibold text-white hover:bg-[#14552f]"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating PDF...
              </>
            ) : (
              "Generate PDF"
            )}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
