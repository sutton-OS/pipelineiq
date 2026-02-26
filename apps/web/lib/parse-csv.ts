import Papa from "papaparse";

type CsvRawRow = string[];
type MembershipKey =
  | "Premium"
  | "Plus"
  | "FAO"
  | "Corporate"
  | "Upgrade"
  | "Other";

type PayPeriod = {
  label: string;
  amount: number;
  units: number;
  bonus: number;
};

type YearTaggedPayPeriod = PayPeriod & {
  year: number | null;
};

type ParsedTransactionRow = {
  year: number | null;
  transactionDate: string | null;
  commission: number;
  units: number;
  membershipType: MembershipKey;
  trainerName: string;
  hasTrainer: boolean;
  inCurrentPayPeriod: boolean;
};

export type RepData = {
  payPeriods: YearTaggedPayPeriod[];
  transactionRows: ParsedTransactionRow[];
  periodLabel: string;
};

const MONTH_HEADER_PATTERN =
  /^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}$/i;
const DATE_LIKE_VALUE_PATTERN = /^\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?$/;

function parseCommission(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;

  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCurrencyCell(value: string) {
  return parseCommission(value.replace(/"/g, ""));
}

function extractDollarValues(text: string) {
  const matches = text.match(/\$\s*-?[\d,]+(?:\.\d+)?/g) ?? [];
  return matches
    .map((match) => Number.parseFloat(match.replace(/[^0-9.-]/g, "")))
    .filter((value) => Number.isFinite(value));
}

function parseUnitsCell(value: string) {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseBonusFromPayPeriodRow(row: string[]) {
  const bonusCells = [row[7] ?? "", row[8] ?? ""];

  for (const cell of bonusCells) {
    if (!cell.includes("$")) continue;
    const values = extractDollarValues(cell);
    for (const amount of values) {
      if (amount > 0) return amount;
    }
  }

  return 0;
}

function parsePayPeriodSummary(row: string[], index: number): PayPeriod {
  const label = (row[0] ?? "").trim() || `Period ${index + 1}`;
  const amount = parseCurrencyCell(row[5] ?? "");
  const units = parseUnitsCell(row[6] ?? "");
  const bonus = parseBonusFromPayPeriodRow(row);

  return { label, amount, units, bonus };
}

function detectYearFromLabel(label: string) {
  if (label.includes("2026") || /\/26\b/.test(label)) return 2026;
  if (label.includes("2025") || /\/25\b/.test(label)) return 2025;

  const parsed = new Date(label);
  if (!Number.isNaN(parsed.getTime())) return parsed.getFullYear();
  return null;
}

function getCurrentPayPeriodRange() {
  const today = new Date();
  const day = today.getDate();
  const month = today.toLocaleString("en-US", { month: "long" });
  const year = today.getFullYear();

  let periodLabel = "";
  let periodStart: Date;
  let periodEnd: Date;

  if (day <= 15) {
    periodLabel = `${month} 1 – 15, ${year}`;
    periodStart = new Date(year, today.getMonth(), 1);
    periodEnd = new Date(year, today.getMonth(), 15);
  } else {
    const lastDay = new Date(year, today.getMonth() + 1, 0).getDate();
    periodLabel = `${month} 16 – ${lastDay}, ${year}`;
    periodStart = new Date(year, today.getMonth(), 16);
    periodEnd = new Date(year, today.getMonth() + 1, 0);
  }

  return { periodLabel, periodStart, periodEnd };
}

function parseTransactionDate(value: string, fallbackYear: number) {
  const trimmed = value.trim().replace(/"/g, "");
  if (!trimmed) return null;

  const numericDate = trimmed.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/);
  if (numericDate) {
    const month = Number.parseInt(numericDate[1], 10);
    const day = Number.parseInt(numericDate[2], 10);
    const yearToken = numericDate[3];
    const year = yearToken
      ? yearToken.length === 2
        ? 2000 + Number.parseInt(yearToken, 10)
        : Number.parseInt(yearToken, 10)
      : fallbackYear;

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && Number.isFinite(year)) {
      const candidate = new Date(year, month - 1, day);
      if (
        candidate.getFullYear() === year &&
        candidate.getMonth() === month - 1 &&
        candidate.getDate() === day
      ) {
        return candidate;
      }
    }
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function looksLikeMonthHeader(firstColumn: string) {
  return MONTH_HEADER_PATTERN.test(firstColumn.trim());
}

function looksLikeHeaderRow(row: string[]) {
  const first = (row[0] ?? "").toLowerCase();
  const second = (row[1] ?? "").toLowerCase();
  return first.includes("date") && second.includes("member");
}

function isPaySummaryRow(row: string[]) {
  const col0 = (row[0] ?? "").trim();
  const col5 = (row[5] ?? "").trim().replace(/"/g, "");
  const col6Units = parseUnitsCell(row[6] ?? "");
  return col0.toLowerCase().includes("pay") || (col0 === "" && col5.startsWith("$") && col6Units > 0);
}

function isValidMemberName(value: string) {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  if (DATE_LIKE_VALUE_PATTERN.test(trimmed)) return false;
  return /[a-z]/i.test(trimmed);
}

function looksLikeTrainerName(value: string) {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  if (DATE_LIKE_VALUE_PATTERN.test(trimmed)) return false;
  return /[a-z]/i.test(trimmed);
}

function categorizeMembership(value: string): MembershipKey {
  const normalized = value.toLowerCase();
  if (normalized.includes("premium")) return "Premium";
  if (normalized.includes("plus")) return "Plus";
  if (normalized.includes("fao")) return "FAO";
  if (normalized.includes("corporate")) return "Corporate";
  if (normalized.includes("upgrade")) return "Upgrade";
  return "Other";
}

function parseCommissionData(rawRows: CsvRawRow[]) {
  const payPeriods: YearTaggedPayPeriod[] = [];
  const transactionRows: ParsedTransactionRow[] = [];
  const { periodLabel, periodStart, periodEnd } = getCurrentPayPeriodRange();

  let headerSkipped = false;
  let scanYear = 2025;
  const currentCalendarYear = new Date().getFullYear();
  const periodStartTime = periodStart.getTime();
  const periodEndTime = periodEnd.getTime();

  for (const rawRow of rawRows) {
    const row = rawRow.map((cell) => String(cell ?? "").trim());
    if (row.every((cell) => cell === "")) continue;

    const firstColumn = row[0] ?? "";

    if (!headerSkipped && looksLikeHeaderRow(row)) {
      headerSkipped = true;
      continue;
    }

    if (looksLikeMonthHeader(firstColumn)) continue;

    if (isPaySummaryRow(row)) {
      const period = parsePayPeriodSummary(row, payPeriods.length);
      const periodYear = detectYearFromLabel(period.label);
      if (periodYear !== null) scanYear = periodYear;
      if (period.amount > 0 || period.bonus > 0 || period.units > 0) {
        payPeriods.push({ ...period, year: periodYear });
      }
      continue;
    }

    const memberName = row[1] ?? "";
    const membershipTypeRaw = row[2] ?? "";
    const trainer = row[4] ?? "";
    const commissionRaw = row[5] ?? "";
    if (!isValidMemberName(memberName)) continue;

    const commission = parseCommission(commissionRaw);
    const units = parseUnitsCell(row[6] ?? "");
    const fallbackRowYear = scanYear;
    const transactionDate = parseTransactionDate(firstColumn, fallbackRowYear);
    const transactionTime = transactionDate?.getTime();
    const rowYear = transactionDate ? transactionDate.getFullYear() : fallbackRowYear;
    const inCurrentPayPeriod =
      rowYear === currentCalendarYear &&
      transactionTime !== undefined &&
      transactionTime >= periodStartTime &&
      transactionTime <= periodEndTime;

    transactionRows.push({
      year: rowYear,
      transactionDate: transactionDate ? transactionDate.toISOString() : null,
      commission,
      units,
      membershipType: categorizeMembership(membershipTypeRaw),
      trainerName: trainer.trim(),
      hasTrainer: looksLikeTrainerName(trainer),
      inCurrentPayPeriod,
    });
  }

  return {
    payPeriods,
    transactionRows,
    periodLabel,
  } satisfies RepData;
}

export async function parseCommissionCSV(csvText: string): Promise<RepData> {
  return new Promise((resolve, reject) => {
    Papa.parse<CsvRawRow>(csvText, {
      header: false,
      skipEmptyLines: false,
      complete: (results) => {
        const rawRows = (results.data ?? []).filter((row) => Array.isArray(row));

        if (rawRows.length === 0) {
          reject(new Error("No valid rows found in this CSV."));
          return;
        }

        resolve(parseCommissionData(rawRows));
      },
      error: (error: Error) => {
        reject(error);
      },
    });
  });
}
