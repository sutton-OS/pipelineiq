import { parseCommissionCSV, type RepData } from "@/lib/parse-csv";

export const FP_COMMISSION_PER_MISSED = 10;

export type RepStats = {
  commission: number;
  units: number;
  fpRate: number;
  fpSold: number;
  sales: number;
  missedFpCommission: number;
};

export function normalizeGoogleSheetToCsvUrl(urlValue: string) {
  const trimmed = urlValue.trim();
  if (!trimmed) throw new Error("Google Sheets URL is required.");

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Enter a valid URL.");
  }

  if (url.pathname.endsWith(".csv")) return url.toString();
  if (url.pathname.endsWith("/export") && url.searchParams.get("format") === "csv") {
    return url.toString();
  }

  const sheetMatch = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!sheetMatch) {
    throw new Error("Use a Google Sheets URL or direct CSV export URL.");
  }

  const sheetId = sheetMatch[1];
  const searchGid = url.searchParams.get("gid");
  const hashGid = url.hash.match(/gid=(\d+)/)?.[1];
  const gid = searchGid ?? hashGid ?? "0";
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

export function parseStoredRepData(data: unknown): RepData | null {
  if (!data || typeof data !== "object") return null;
  const parsed = data as RepData;
  if (!Array.isArray(parsed.payPeriods) || !Array.isArray(parsed.transactionRows)) return null;
  return parsed;
}

export async function fetchAndParseSheet(sheetUrl: string) {
  const csvUrl = normalizeGoogleSheetToCsvUrl(sheetUrl);
  const response = await fetch(csvUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Unable to fetch sheet (${response.status}).`);
  }

  const csvText = await response.text();
  const parsed = await parseCommissionCSV(csvText);

  const hasRows =
    parsed.payPeriods.length > 0 || parsed.transactionRows.some((row) => row.commission !== 0);
  if (!hasRows) throw new Error("No commission data found after parsing.");

  return parsed;
}

export function getRepStats(data: RepData | null, selectedYear: number): RepStats {
  if (!data) {
    return {
      commission: 0,
      units: 0,
      fpRate: 0,
      fpSold: 0,
      sales: 0,
      missedFpCommission: 0,
    };
  }

  const periodsForYear = data.payPeriods.filter((period) => period.year === selectedYear);
  const rowsForYear = data.transactionRows.filter((row) => row.year === selectedYear);

  const commission = periodsForYear.reduce((sum, period) => sum + period.amount, 0);
  const periodUnits = periodsForYear.reduce((sum, period) => sum + period.units, 0);
  const fallbackUnits = rowsForYear.reduce((sum, row) => sum + Math.max(row.units, 0), 0);

  let salesCount = 0;
  let fpCount = 0;

  for (const row of rowsForYear) {
    if (row.commission <= 0) continue;
    salesCount += 1;
    if (row.hasTrainer) fpCount += 1;
  }

  const fpRate = salesCount > 0 ? (fpCount / salesCount) * 100 : 0;
  const missedFpCommission = Math.max(salesCount - fpCount, 0) * FP_COMMISSION_PER_MISSED;

  return {
    commission,
    units: periodUnits > 0 ? periodUnits : fallbackUnits,
    fpRate,
    fpSold: fpCount,
    sales: salesCount,
    missedFpCommission,
  };
}
