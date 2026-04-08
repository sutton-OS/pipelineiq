"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Download, Loader2 } from "lucide-react";
import { parseCommissionCSV } from "@/lib/parse-csv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

type TrainerCount = {
  name: string;
  count: number;
};

type CurrentPayPeriod = {
  periodLabel: string;
  currentCommission: number;
  currentUnits: number;
  currentSales: number;
  currentFP: number;
  currentPeriodRows: Array<{ trainer: string }>;
};

type CommissionReport = {
  totalRevenue: number;
  totalSales: number;
  totalFP: number;
  fpRate: number;
  avgCommission: number;
  membershipCounts: Record<MembershipKey, number>;
  trainerCounts: TrainerCount[];
  payPeriods: PayPeriod[];
  totalBonuses: number;
  bestPeriod: PayPeriod | null;
  cancellations: number;
  currentPayPeriod: CurrentPayPeriod;
};

type ParsedTransactionRow = {
  year: number | null;
  transactionDate?: string | null;
  commission: number;
  units: number;
  membershipType: MembershipKey;
  trainerName: string;
  hasTrainer: boolean;
  inCurrentPayPeriod: boolean;
};

export type ParsedCommissionData = {
  payPeriods: YearTaggedPayPeriod[];
  transactionRows: ParsedTransactionRow[];
  periodLabel: string;
};

type SyncNowResult = {
  parsedData: ParsedCommissionData;
  fileName?: string;
  lastSyncedAt?: Date | string;
};

type ReportUploaderProps = {
  initialParsedData?: ParsedCommissionData | null;
  initialFileName?: string;
  initialLastSyncedAt?: Date | string | null;
  repName?: string;
  showUploadControls?: boolean;
  breadcrumb?: ReactNode;
  syncButtonLabel?: string;
  onSyncNow?: () => Promise<SyncNowResult>;
};

const MEMBERSHIP_ORDER: MembershipKey[] = [
  "Premium",
  "Plus",
  "FAO",
  "Corporate",
  "Upgrade",
  "Other",
];

const MEMBERSHIP_COLORS: Record<MembershipKey, string> = {
  Plus: "#0f0f0f",
  Premium: "#3a3a3a",
  FAO: "#666666",
  Upgrade: "#888888",
  Corporate: "#c8491a",
  Other: "#aca59a",
};

const GOOGLE_SHEETS_SYNC_URL =
  "https://docs.google.com/spreadsheets/d/1mHZEg4MZrkrwb5Yb17Sy55yL_AEg40UDEY6gYa43_7Q/export?format=csv&gid=1050163422";
const DEFAULT_PAY_PERIOD_GOAL = 1000;
const PAY_PERIOD_GOAL_STORAGE_KEY = "pipelineiq:pay-period-goal";

function buildEmptyMembershipCounts(): Record<MembershipKey, number> {
  return {
    Premium: 0,
    Plus: 0,
    FAO: 0,
    Corporate: 0,
    Upgrade: 0,
    Other: 0,
  };
}

const TRAINER_NAME_NORMALIZATION: Record<string, string> = {
  sariah: "Sariah",
  sairah: "Sariah",
  britany: "Brittany",
  brittany: "Brittany",
  janess: "Janessa",
  janessa: "Janessa",
  maddy: "Maddie",
  maddie: "Maddie",
};

function detectYearFromLabel(label: string) {
  if (label.includes("2026") || /\/26\b/.test(label)) return 2026;
  if (label.includes("2025") || /\/25\b/.test(label)) return 2025;

  const parsed = new Date(label);
  if (!Number.isNaN(parsed.getTime())) return parsed.getFullYear();
  return null;
}

function normalizeTrainerName(value: string) {
  const cleaned = value.trim().replace(/\s+/g, " ");
  const normalized = TRAINER_NAME_NORMALIZATION[cleaned.toLowerCase()];
  return normalized ?? cleaned;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number, fractionDigits = 1) {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)}%`;
}

function formatUnits(value: number) {
  if (!Number.isFinite(value) || value === 0) return "0";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1).replace(/\.0$/, "");
}

function sanitizeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/\.csv$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizePayPeriodGoal(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_PAY_PERIOD_GOAL;
  return Math.max(Math.round(value), 1);
}

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatPayPeriodShortLabel(label: string) {
  const normalized = label.trim();
  if (!normalized) return "";

  const namedMonth = normalized.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})\b/i
  );
  if (namedMonth) {
    const monthToken = namedMonth[1].slice(0, 3).toLowerCase();
    const monthIndex = SHORT_MONTHS.findIndex((month) => month.toLowerCase() === monthToken);
    const day = Number.parseInt(namedMonth[2], 10);
    if (monthIndex >= 0 && Number.isFinite(day)) {
      return `${SHORT_MONTHS[monthIndex]} ${day}`;
    }
  }

  const numericMonth = normalized.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-]\d{2,4})?\b/);
  if (numericMonth) {
    const monthIndex = Number.parseInt(numericMonth[1], 10) - 1;
    const day = Number.parseInt(numericMonth[2], 10);
    if (monthIndex >= 0 && monthIndex < SHORT_MONTHS.length && Number.isFinite(day)) {
      return `${SHORT_MONTHS[monthIndex]} ${day}`;
    }
  }

  return normalized.length > 10 ? `${normalized.slice(0, 10)}...` : normalized;
}

function extractMonthIndexFromLabel(label: string) {
  const normalized = label.trim();
  if (!normalized) return null;

  const namedMonth = normalized.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i
  );
  if (namedMonth) {
    const monthToken = namedMonth[1].slice(0, 3).toLowerCase();
    const monthIndex = SHORT_MONTHS.findIndex((month) => month.toLowerCase() === monthToken);
    if (monthIndex >= 0) return monthIndex;
  }

  const numericMonth = normalized.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-]\d{2,4})?\b/);
  if (numericMonth) {
    const monthIndex = Number.parseInt(numericMonth[1], 10) - 1;
    if (monthIndex >= 0 && monthIndex < SHORT_MONTHS.length) return monthIndex;
  }

  return null;
}

function formatSvgNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function buildSmoothLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  if (points.length === 1) {
    return `M ${formatSvgNumber(points[0].x)} ${formatSvgNumber(points[0].y)}`;
  }

  return points
    .map((point, index) => {
      if (index === 0) return `M ${formatSvgNumber(point.x)} ${formatSvgNumber(point.y)}`;

      const previous = points[index - 1];
      const controlX = (previous.x + point.x) / 2;
      return `C ${formatSvgNumber(controlX)} ${formatSvgNumber(previous.y)}, ${formatSvgNumber(
        controlX
      )} ${formatSvgNumber(point.y)}, ${formatSvgNumber(point.x)} ${formatSvgNumber(point.y)}`;
    })
    .join(" ");
}

function buildCommissionReport(data: ParsedCommissionData, selectedYear: number) {
  const membershipCounts = buildEmptyMembershipCounts();
  const trainerMap = new Map<string, TrainerCount>();
  const thisYearPeriods = data.payPeriods.filter((period) => period.year === selectedYear);
  const thisYearRows = data.transactionRows.filter((row) => row.year === selectedYear);

  let totalSales = 0;
  let totalFP = 0;
  let cancellations = 0;

  for (const row of thisYearRows) {
    if (row.commission <= 0) {
      if (row.commission < 0) cancellations += 1;
      continue;
    }

    totalSales += 1;
    membershipCounts[row.membershipType] += 1;

    if (row.hasTrainer) {
      totalFP += 1;
      const normalizedTrainer = normalizeTrainerName(row.trainerName);
      const key = normalizedTrainer.toLowerCase();
      const existing = trainerMap.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        trainerMap.set(key, { name: normalizedTrainer, count: 1 });
      }
    }
  }

  const trainerCounts = Array.from(trainerMap.values()).sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name)
  );
  const totalRevenue = thisYearPeriods.reduce((sum, period) => sum + period.amount, 0);
  const totalBonuses = thisYearPeriods.reduce((sum, period) => sum + period.bonus, 0);
  const bestPeriod =
    thisYearPeriods.reduce<PayPeriod | null>((best, current) => {
      if (!best || current.amount > best.amount) return current;
      return best;
    }, null) ?? null;

  const currentPeriodRowsForYear = thisYearRows.filter((row) => row.inCurrentPayPeriod);
  const currentCommission = currentPeriodRowsForYear.reduce((sum, row) => sum + row.commission, 0);
  const currentMonthIndex = new Date().getMonth();
  const monthDatedRows = thisYearRows.filter((row) => {
    if (!row.transactionDate) return false;
    const parsed = new Date(row.transactionDate);
    if (Number.isNaN(parsed.getTime())) return false;
    return parsed.getMonth() === currentMonthIndex;
  });
  const currentUnitsFromRows = monthDatedRows.reduce((sum, row) => sum + row.units, 0);
  const currentUnitsFromPayPeriods = thisYearPeriods.reduce((sum, period) => {
    if (extractMonthIndexFromLabel(period.label) !== currentMonthIndex) return sum;
    return sum + period.units;
  }, 0);
  const currentUnits = monthDatedRows.length > 0 ? currentUnitsFromRows : currentUnitsFromPayPeriods;
  const currentSalesRows = currentPeriodRowsForYear.filter((row) => row.commission > 0);
  const currentSales = currentSalesRows.length;
  const currentFP = currentPeriodRowsForYear.filter((row) => row.hasTrainer).length;
  const currentPeriodRows = currentSalesRows.map((row) => ({ trainer: row.trainerName }));

  const fpRate = totalSales > 0 ? (totalFP / totalSales) * 100 : 0;
  const avgCommission = totalSales > 0 ? totalRevenue / totalSales : 0;

  return {
    totalRevenue,
    totalSales,
    totalFP,
    fpRate,
    avgCommission,
    membershipCounts,
    trainerCounts,
    payPeriods: thisYearPeriods.map(({ label, amount, units, bonus }) => ({
      label,
      amount,
      units,
      bonus,
    })),
    totalBonuses,
    bestPeriod,
    cancellations,
    currentPayPeriod: {
      periodLabel: data.periodLabel,
      currentCommission,
      currentUnits,
      currentSales,
      currentFP,
      currentPeriodRows,
    },
  } satisfies CommissionReport;
}

export function ReportUploader({
  initialParsedData = null,
  initialFileName = "",
  initialLastSyncedAt = null,
  repName = "Tyler",
  showUploadControls = true,
  breadcrumb,
  syncButtonLabel = "Sync from Google Sheets",
  onSyncNow,
}: ReportUploaderProps = {}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportExportRef = useRef<HTMLDivElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [fileName, setFileName] = useState(initialFileName);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(() => {
    if (!initialLastSyncedAt) return null;
    const parsed =
      initialLastSyncedAt instanceof Date ? initialLastSyncedAt : new Date(initialLastSyncedAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  });
  const [parseError, setParseError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [parsedData, setParsedData] = useState<ParsedCommissionData | null>(initialParsedData);
  const [payPeriodGoal, setPayPeriodGoal] = useState(DEFAULT_PAY_PERIOD_GOAL);
  const [payPeriodGoalInput, setPayPeriodGoalInput] = useState(String(DEFAULT_PAY_PERIOD_GOAL));

  useEffect(() => {
    if (initialParsedData !== undefined) {
      setParsedData(initialParsedData);
    }
  }, [initialParsedData]);

  useEffect(() => {
    setFileName(initialFileName);
  }, [initialFileName]);

  useEffect(() => {
    if (!initialLastSyncedAt) {
      setLastSyncedAt(null);
      return;
    }
    const parsed =
      initialLastSyncedAt instanceof Date ? initialLastSyncedAt : new Date(initialLastSyncedAt);
    setLastSyncedAt(Number.isNaN(parsed.getTime()) ? null : parsed);
  }, [initialLastSyncedAt]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedGoal = window.localStorage.getItem(PAY_PERIOD_GOAL_STORAGE_KEY);
    if (!storedGoal) return;

    const parsedGoal = Number.parseInt(storedGoal, 10);
    if (!Number.isFinite(parsedGoal)) return;

    const normalizedGoal = normalizePayPeriodGoal(parsedGoal);
    setPayPeriodGoal(normalizedGoal);
    setPayPeriodGoalInput(String(normalizedGoal));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PAY_PERIOD_GOAL_STORAGE_KEY, String(payPeriodGoal));
  }, [payPeriodGoal]);

  const availableYears = useMemo(() => {
    if (!parsedData) return [];

    const years = parsedData.payPeriods
      .map((period) => period.year ?? detectYearFromLabel(period.label))
      .filter((year): year is number => typeof year === "number");

    return [...new Set(years)].sort((a, b) => a - b);
  }, [parsedData]);

  useEffect(() => {
    if (availableYears.length === 0) return;
    if (availableYears.includes(selectedYear)) return;

    const currentYear = new Date().getFullYear();
    const fallbackYear = availableYears.includes(currentYear)
      ? currentYear
      : availableYears[availableYears.length - 1];
    setSelectedYear(fallbackYear);
  }, [availableYears, selectedYear]);

  const report = useMemo(() => {
    if (!parsedData) return null;
    return buildCommissionReport(parsedData, selectedYear);
  }, [parsedData, selectedYear]);

  const isSheetConnected = Boolean(fileName);

  const connectedSheetName = useMemo(() => {
    if (!fileName) return "GGIF Commissions";

    const rawName = fileName.replace(/\.[^/.]+$/, "").trim();
    if (!rawName || rawName.toLowerCase() === "google-sheets-sync") {
      return "GGIF Commissions";
    }

    return rawName.replace(/[-_]+/g, " ");
  }, [fileName]);

  const lastSyncedAgoLabel = useMemo(() => {
    if (!lastSyncedAt) return null;

    const elapsedMs = Date.now() - lastSyncedAt.getTime();
    if (!Number.isFinite(elapsedMs) || elapsedMs < 60_000) return "just now";

    const elapsedMinutes = Math.floor(elapsedMs / 60_000);
    if (elapsedMinutes < 60) {
      return `${elapsedMinutes} min ago`;
    }

    const elapsedHours = Math.floor(elapsedMinutes / 60);
    return `${elapsedHours} hr ago`;
  }, [lastSyncedAt]);

  useEffect(() => {
    if (!report) return;

    const frame = requestAnimationFrame(() => {
      const fills = document.querySelectorAll<HTMLElement>(".current-goal-fill[data-goal-width]");
      fills.forEach((fill) => {
        const targetWidth = fill.dataset.goalWidth;
        fill.style.width = targetWidth ? `${targetWidth}%` : "0%";
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [payPeriodGoal, report]);

  const reportHTML = useMemo(() => {
    if (!report) return "";

    const avgPayPeriod =
      report.payPeriods.length > 0
        ? report.payPeriods.reduce((sum, period) => sum + period.amount, 0) /
          report.payPeriods.length
        : 0;
    const GOAL = payPeriodGoal;
    const currentCommission = report.currentPayPeriod.currentCommission;
    const currentSales = report.currentPayPeriod.currentSales;
    const remaining = Math.max(GOAL - currentCommission, 0);
    const goalPercent = Math.min((currentCommission / GOAL) * 100, 100);
    const isHit = currentCommission >= GOAL;
    const goalPercentText = formatPercent(goalPercent, 0);
    const goalFillColor =
      goalPercent >= 100 ? "var(--green)" : goalPercent >= 60 ? "var(--amber)" : "var(--accent)";
    const goalOverAmount = Math.max(currentCommission - GOAL, 0);

    const today = new Date();
    const day = today.getDate();
    const currentYear = today.getFullYear();
    const isCurrentYearView = selectedYear === currentYear;
    const periodEndDate =
      day <= 15
        ? new Date(currentYear, today.getMonth(), 15)
        : new Date(currentYear, today.getMonth() + 1, 0);
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysLeft = Math.max(Math.ceil((periodEndDate.getTime() - today.getTime()) / msPerDay), 1);
    const dailyNeeded = remaining > 0 ? (remaining / daysLeft).toFixed(2) : 0;
    const FP_COMMISSION = 10;
    const currentPeriodRows = report.currentPayPeriod.currentPeriodRows;
    const currentSalesWithFP = currentPeriodRows.filter((row) => row.trainer).length;
    const currentSalesWithoutFP = currentSales - currentSalesWithFP;
    const fpConversionRateValue =
      currentSales > 0 ? (currentSalesWithFP / currentSales) * 100 : 0;
    const fpConversionRate = currentSales > 0 ? fpConversionRateValue.toFixed(1) : "0";
    const missedCommission = currentSalesWithoutFP * FP_COMMISSION;
    const potentialTotal = currentCommission + missedCommission;
    const fpConversionBarWidth = Math.min(Math.max(fpConversionRateValue, 0), 100);

    const maxPeriodAmount =
      report.payPeriods.length > 0
        ? Math.max(...report.payPeriods.map((period) => period.amount), 0)
        : 0;

    const membershipRows = MEMBERSHIP_ORDER.map((type) => ({
      type,
      count: report.membershipCounts[type],
    })).sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));

    const topMembershipType = membershipRows[0] ?? null;
    const maxMembershipCount = membershipRows[0]?.count ?? 0;
    const trackedMembershipCount = membershipRows.reduce(
      (sum, membership) => sum + membership.count,
      0
    );

    const topTrainer = report.trainerCounts[0] ?? null;
    const displayedTrainers = report.trainerCounts.slice(0, 7);
    const maxTrainerCount = displayedTrainers[0]?.count ?? 0;

    const bonusPeriods = report.payPeriods.filter((period) => period.bonus > 0);
    const withoutFp = Math.max(report.totalSales - report.totalFP, 0);

    const firstPeriod = report.payPeriods[0]?.label ?? "";
    const lastPeriod = report.payPeriods[report.payPeriods.length - 1]?.label ?? "";
    const periodRangeLabel =
      firstPeriod && lastPeriod ? `${firstPeriod} - ${lastPeriod}` : "Uploaded CSV";

    const bestPeriodIndex = report.bestPeriod
      ? report.payPeriods.findIndex(
          (period) =>
            period.label === report.bestPeriod?.label &&
            period.amount === report.bestPeriod?.amount &&
            period.units === report.bestPeriod?.units &&
            period.bonus === report.bestPeriod?.bonus
        )
      : -1;

    const payPeriodRowsHTML =
      report.payPeriods.length > 0
        ? report.payPeriods
            .map((period, index) => {
              const isBest = index === bestPeriodIndex;
              const trendWidth =
                maxPeriodAmount > 0
                  ? Math.max((period.amount / maxPeriodAmount) * 100, 2)
                  : 2;

              return `
      <tr${isBest ? ' style="background:var(--paper-2)"' : ""}>
        <td><span class="period-name">${escapeHtml(period.label)}</span></td>
        <td><span class="mono"${isBest ? ' style="color:var(--accent)"' : ""}>${formatCurrency(period.amount)}</span></td>
        <td><span class="mono">${formatUnits(period.units)}</span></td>
        <td>${
          period.bonus > 0
            ? `<span class="bonus-badge">+${formatCurrency(period.bonus)} bonus</span>`
            : "-"
        }</td>
        <td class="bar-cell"><div class="mini-bar"><div class="mini-bar-fill" style="width:${trendWidth}%;${
                  isBest ? "background:var(--accent);" : ""
                }"></div></div></td>
      </tr>`;
            })
            .join("")
        : `
      <tr>
        <td colspan="5" style="padding:16px 0;color:var(--ink-3)">No pay period summary rows found.</td>
      </tr>`;

    const membershipRowsHTML = membershipRows
      .map((membership) => {
        const width =
          maxMembershipCount > 0
            ? Math.max((membership.count / maxMembershipCount) * 100, membership.count > 0 ? 7 : 0)
            : 0;

        return `
        <div class="mem-row">
          <div class="mem-label">${membership.type}</div>
          <div class="mem-track">
            <div class="mem-fill" style="width:${width}%;background:${MEMBERSHIP_COLORS[membership.type]}">${membership.count}</div>
          </div>
          <div class="mem-count">${membership.count}</div>
        </div>`;
      })
      .join("");

    const trainerRowsHTML =
      displayedTrainers.length > 0
        ? displayedTrainers
            .map((trainer, index) => {
              const width =
                maxTrainerCount > 0
                  ? Math.max((trainer.count / maxTrainerCount) * 100, 4)
                  : 4;

              return `
          <tr>
            <td>
              <span class="trainer-rank">${String(index + 1).padStart(2, "0")}</span>
              <span class="trainer-name">${escapeHtml(trainer.name)}</span>
              <span class="fp-bar"><span class="fp-bar-fill" style="width:${width}%"></span></span>
            </td>
            <td><span${index === 0 ? ' style="color:var(--green);font-weight:600"' : ""}>${trainer.count} FPs</span></td>
          </tr>`;
            })
            .join("")
        : `
          <tr>
            <td colspan="2" style="color:var(--ink-3)">No trainer assignments found.</td>
          </tr>`;

    const bonusRowsHTML =
      bonusPeriods.length > 0
        ? bonusPeriods
            .map(
              (period) => `
          <tr>
            <td style="color:var(--ink-2)">${escapeHtml(period.label)} bonus (${formatUnits(period.units)} units)</td>
            <td style="color:var(--green);font-weight:600">+${formatCurrency(period.bonus)}</td>
          </tr>`
            )
            .join("")
        : `
          <tr>
            <td colspan="2" style="color:var(--ink-3)">No bonus amounts found in pay period summary rows.</td>
          </tr>`;

    const peakPeriod =
      report.payPeriods.reduce<PayPeriod | null>((peak, period) => {
        if (!peak || period.amount > peak.amount) return period;
        return peak;
      }, null) ?? null;
    const lowPeriod =
      report.payPeriods.reduce<PayPeriod | null>((low, period) => {
        if (!low || period.amount < low.amount) return period;
        return low;
      }, null) ?? null;

    const trendWindowSize = Math.min(3, report.payPeriods.length);
    const firstTrendPeriods = report.payPeriods.slice(0, trendWindowSize);
    const lastTrendPeriods = report.payPeriods.slice(-trendWindowSize);
    const firstTrendAvg =
      firstTrendPeriods.length > 0
        ? firstTrendPeriods.reduce((sum, period) => sum + period.amount, 0) / firstTrendPeriods.length
        : 0;
    const lastTrendAvg =
      lastTrendPeriods.length > 0
        ? lastTrendPeriods.reduce((sum, period) => sum + period.amount, 0) / lastTrendPeriods.length
        : 0;
    const trendDelta = lastTrendAvg - firstTrendAvg;
    const trendPercent = firstTrendAvg > 0 ? (Math.abs(trendDelta) / firstTrendAvg) * 100 : 0;
    const trendDirectionUp = trendDelta >= 0;
    const trendText =
      trendWindowSize > 0
        ? `${trendDirectionUp ? "↑" : "↓"} ${formatPercent(trendPercent)} trending ${
            trendDirectionUp ? "up" : "down"
          }`
        : "No trend data";

    const W = 860;
    const H = 160;
    const PAD = { top: 10, right: 20, bottom: 30, left: 50 };
    const baselineY = H - PAD.bottom;
    const amounts = report.payPeriods.map((period) => period.amount);
    const minVal = amounts.length > 0 ? Math.min(...amounts) : 0;
    const maxVal = amounts.length > 0 ? Math.max(...amounts) : 0;
    const range = maxVal - minVal;
    const xStep =
      report.payPeriods.length > 1 ? (W - PAD.left - PAD.right) / (report.payPeriods.length - 1) : 0;
    const toX = (index: number) => PAD.left + index * xStep;
    const toY = (value: number) => {
      if (amounts.length === 0) return baselineY;
      if (range === 0) return PAD.top + (H - PAD.top - PAD.bottom) / 2;
      return PAD.top + (H - PAD.top - PAD.bottom) * (1 - (value - minVal) / range);
    };

    const trendPoints = report.payPeriods.map((period, index) => ({
      period,
      shortLabel: formatPayPeriodShortLabel(period.label),
      x: toX(index),
      y: toY(period.amount),
    }));

    const linePath = buildSmoothLinePath(trendPoints.map(({ x, y }) => ({ x, y })));
    const areaPath =
      trendPoints.length > 1 && linePath
        ? `${linePath} L ${formatSvgNumber(trendPoints[trendPoints.length - 1].x)} ${formatSvgNumber(
            baselineY
          )} L ${formatSvgNumber(trendPoints[0].x)} ${formatSvgNumber(baselineY)} Z`
        : "";

    const gridLinesHTML = Array.from({ length: 5 }, (_, index) => {
      const ratio = index / 4;
      const y = PAD.top + (H - PAD.top - PAD.bottom) * ratio;
      const value = maxVal - (maxVal - minVal) * ratio;

      return `<g>
        <line class="pay-trend-grid-line chart-grid-line" x1="${formatSvgNumber(PAD.left)}" y1="${formatSvgNumber(
          y
        )}" x2="${formatSvgNumber(W - PAD.right)}" y2="${formatSvgNumber(y)}"></line>
        <text class="pay-trend-y-label" x="${formatSvgNumber(PAD.left - 8)}" y="${formatSvgNumber(
          y + 3
        )}" text-anchor="end">${formatCurrency(value)}</text>
      </g>`;
    }).join("");

    const xLabelsHTML = trendPoints
      .map(
        (point) =>
          `<text class="pay-trend-x-label" x="${formatSvgNumber(point.x)}" y="${formatSvgNumber(
            H - 8
          )}" text-anchor="middle">${escapeHtml(point.shortLabel)}</text>`
      )
      .join("");

    const pointMarkersHTML = trendPoints
      .map((point) => {
        const detailRows = [
          point.period.label,
          `Commission: ${formatCurrency(point.period.amount)}`,
          `Units: ${formatUnits(point.period.units)}`,
          point.period.bonus > 0 ? `Bonus: +${formatCurrency(point.period.bonus)}` : null,
        ].filter(Boolean) as string[];
        const tooltipHeight = 12 + detailRows.length * 13;
        const tooltipWidth = 210;
        const tooltipX = Math.min(
          Math.max(point.x - tooltipWidth / 2, PAD.left),
          W - PAD.right - tooltipWidth
        );
        const tooltipY = Math.max(4, point.y - tooltipHeight - 10);
        const tooltipRowsHTML = detailRows
          .map(
            (line, index) =>
              `<text class="pay-trend-tooltip-line${
                index === 0 ? " pay-trend-tooltip-title" : ""
              }" x="10" y="${16 + index * 13}">${escapeHtml(line)}</text>`
          )
          .join("");

        return `<g class="pay-trend-point-group">
          <circle class="pay-trend-point-hit" cx="${formatSvgNumber(point.x)}" cy="${formatSvgNumber(
            point.y
          )}" r="10"></circle>
          <circle class="pay-trend-point" cx="${formatSvgNumber(point.x)}" cy="${formatSvgNumber(
            point.y
          )}" r="3.5"></circle>
          <g class="pay-trend-tooltip" transform="translate(${formatSvgNumber(tooltipX)} ${formatSvgNumber(
            tooltipY
          )})">
            <rect rx="6" ry="6" width="${tooltipWidth}" height="${tooltipHeight}"></rect>
            ${tooltipRowsHTML}
          </g>
          <title>${escapeHtml(detailRows.join("\n"))}</title>
        </g>`;
      })
      .join("");

    const payTrendStatsHTML =
      report.payPeriods.length > 0
        ? `
      <div class="pay-trend-stat">
        <div class="pay-trend-stat-label">Peak</div>
        <div class="pay-trend-stat-value">${peakPeriod ? formatCurrency(peakPeriod.amount) : "-"}</div>
        <div class="pay-trend-stat-sub">${peakPeriod ? escapeHtml(peakPeriod.label) : "-"}</div>
      </div>
      <div class="pay-trend-stat">
        <div class="pay-trend-stat-label">Low</div>
        <div class="pay-trend-stat-value">${lowPeriod ? formatCurrency(lowPeriod.amount) : "-"}</div>
        <div class="pay-trend-stat-sub">${lowPeriod ? escapeHtml(lowPeriod.label) : "-"}</div>
      </div>
      <div class="pay-trend-stat">
        <div class="pay-trend-stat-label">Trend</div>
        <div class="pay-trend-stat-value ${trendDirectionUp ? "up" : "down"}">${trendText}</div>
        <div class="pay-trend-stat-sub">last ${trendWindowSize} avg ${formatCurrency(
            lastTrendAvg
          )} vs first ${trendWindowSize} avg ${formatCurrency(firstTrendAvg)}</div>
      </div>`
        : `
      <div class="pay-trend-stat">
        <div class="pay-trend-stat-label">Peak</div>
        <div class="pay-trend-stat-value">-</div>
        <div class="pay-trend-stat-sub">No pay period rows</div>
      </div>
      <div class="pay-trend-stat">
        <div class="pay-trend-stat-label">Low</div>
        <div class="pay-trend-stat-value">-</div>
        <div class="pay-trend-stat-sub">No pay period rows</div>
      </div>
      <div class="pay-trend-stat">
        <div class="pay-trend-stat-label">Trend</div>
        <div class="pay-trend-stat-value">-</div>
        <div class="pay-trend-stat-sub">Need at least one pay period</div>
      </div>`;

    const payTrendChartHTML =
      report.payPeriods.length > 0
        ? `
      <div class="pay-trend-chart-scroll">
        <div class="pay-trend-chart-wrap">
          <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Pay period trend chart" role="img">
            ${gridLinesHTML}
            ${
              areaPath
                ? `<path class="pay-trend-area" d="${areaPath}"></path>`
                : ""
            }
            ${
              linePath
                ? `<path class="pay-trend-line" d="${linePath}"></path>`
                : ""
            }
            ${pointMarkersHTML}
            ${xLabelsHTML}
          </svg>
        </div>
      </div>`
        : `<div class="pay-trend-empty">No pay period summary rows found.</div>`;

    const generatedDate = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return `
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --ink: #f2f3f5;
    --ink-2: #9098a8;
    --ink-3: #4a5060;
    --paper: #0e0f13;
    --paper-2: #1e2028;
    --paper-3: #272a33;
    --accent: #e05a20;
    --green: #22c55e;
    --green-light: rgba(34, 197, 94, 0.1);
    --amber: #f59e0b;
    --amber-light: rgba(245, 158, 11, 0.1);
    --border: #272a33;
    --blue: #3b82f6;
    --blue-light: rgba(59, 130, 246, 0.1);
  }
  body {
    background: var(--paper);
    color: var(--ink);
    font-family: 'Syne', sans-serif;
    font-size: 14px;
    line-height: 1.5;
  }
  .page {
    max-width: 960px;
    margin: 0 auto;
    padding: 48px 40px 80px;
    background: var(--paper);
    transition: background 0.3s ease, color 0.3s ease;
  }

  /* HEADER */
  .report-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 28px;
    border-bottom: 2px solid var(--ink);
    margin-bottom: 36px;
  }
  .brand-name {
    font-family: 'Instrument Serif', serif;
    font-size: 22px;
    letter-spacing: -0.3px;
  }
  .brand-name span { color: var(--accent); font-style: italic; }
  .brand-sub { font-size: 11px; color: var(--ink-3); margin-top: 2px; }
  .report-title { font-family: 'Instrument Serif', serif; font-size: 28px; letter-spacing: -0.5px; line-height: 1.1; text-align: right; }
  .report-period { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.08em; text-align: right; margin-top: 4px; }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  .pulse-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
    animation: pulse 2s infinite;
    display: inline-block;
    margin-right: 6px;
  }

  /* CURRENT PERIOD */
  .current-period-card {
    background: #0d0f14;
    border: none;
    color: white;
    border-radius: 8px;
    padding: 20px 24px;
    margin-bottom: 20px;
    transition: background 0.3s ease, border-color 0.3s ease;
  }
  .current-period-badge {
    display: inline-flex;
    align-items: center;
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .current-period-label {
    margin-top: 8px;
    color: rgba(255,255,255,0.45);
    font-size: 14px;
  }
  .current-period-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
    margin-top: 18px;
  }
  .current-period-value {
    font-family: 'Instrument Serif', serif;
    font-size: 42px;
    letter-spacing: -1.2px;
    line-height: 1;
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .current-period-units {
    font-size: 20px;
    color: rgba(255,255,255,0.7);
    letter-spacing: 0;
  }
  .current-period-sub {
    margin-top: 6px;
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: rgba(255,255,255,0.45);
    text-transform: lowercase;
  }
  .current-period-footer {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid rgba(255,255,255,0.14);
    color: rgba(255,255,255,0.45);
    font-size: 12px;
  }
  .historical-period-note {
    margin-bottom: 20px;
    border-radius: 8px;
    border: 1px dashed var(--border);
    background: #16181f;
    color: var(--ink-3);
    font-family: 'DM Mono', monospace;
    font-size: 12px;
    text-align: center;
    padding: 14px 16px;
  }
  .current-goal-block { margin-top: 14px; }
  .current-goal-meta {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 6px;
  }
  .current-goal-meta-text {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: rgba(255,255,255,0.45);
  }
  .current-goal-bar {
    width: 100%;
    height: 8px;
    background: rgba(255,255,255,0.1);
    border-radius: 99px;
    overflow: hidden;
  }
  .current-goal-fill {
    height: 100%;
    width: 0;
    border-radius: 99px;
    transition: width 1s ease-out;
  }
  .current-goal-status {
    margin-top: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }
  .current-goal-status-text {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: rgba(255,255,255,0.45);
  }
  .current-goal-hit-text {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: var(--green);
  }
  .current-goal-row {
    margin-top: 10px;
    background: rgba(255,255,255,0.07);
    border-radius: 6px;
    padding: 10px 14px;
    display: flex;
    justify-content: space-between;
    gap: 20px;
  }
  .current-goal-col { min-width: 0; }
  .current-goal-col-label {
    color: rgba(255,255,255,0.45);
    font-size: 11px;
    line-height: 1.2;
  }
  .current-goal-col-value {
    margin-top: 4px;
    font-family: 'Instrument Serif', serif;
    font-size: 20px;
    letter-spacing: -0.3px;
    line-height: 1;
  }
  .current-goal-hit-row {
    margin-top: 10px;
    background: var(--green-light);
    border-radius: 6px;
    padding: 10px 14px;
  }
  .current-goal-hit-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--green);
    line-height: 1.3;
  }
  .current-goal-hit-sub {
    margin-top: 4px;
    color: var(--green);
    font-family: 'DM Mono', monospace;
    font-size: 11px;
  }
  .fitness-profile-block {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid rgba(255,255,255,0.14);
  }
  .fitness-profile-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .fitness-profile-badge {
    display: inline-flex;
    align-items: center;
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--blue);
  }
  .fitness-profile-rate {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: rgba(255,255,255,0.45);
  }
  .fitness-profile-grid {
    margin-top: 12px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
  }
  .fitness-profile-label {
    color: rgba(255,255,255,0.45);
    font-size: 11px;
    line-height: 1.2;
  }
  .fitness-profile-value {
    margin-top: 4px;
    font-family: 'Instrument Serif', serif;
    font-size: 28px;
    letter-spacing: -0.6px;
    line-height: 1;
  }
  .fitness-profile-value.accent { color: var(--accent); }
  .fitness-profile-value.green { color: var(--green); }
  .fitness-profile-sub {
    margin-top: 4px;
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: rgba(255,255,255,0.45);
  }
  .fitness-profile-bar-wrap { margin-top: 12px; }
  .fitness-profile-bar {
    width: 100%;
    height: 6px;
    background: rgba(255,255,255,0.1);
    border-radius: 99px;
    overflow: hidden;
  }
  .fitness-profile-bar-fill {
    height: 100%;
    border-radius: 99px;
    background: var(--blue);
  }
  .fitness-profile-bar-meta {
    margin-top: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    color: rgba(255,255,255,0.45);
    font-size: 11px;
  }
  .fitness-profile-bar-meta .mono {
    font-size: 11px;
    color: white;
  }
  .fitness-profile-opportunity {
    margin-top: 10px;
    background: rgba(255,255,255,0.07);
    border-radius: 6px;
    padding: 10px 14px;
    display: flex;
    justify-content: space-between;
    gap: 20px;
  }
  .fitness-profile-opportunity-col { min-width: 0; }

  /* HERO BANNER */
  .hero-banner {
    background: #16181f;
    border: 1.5px solid var(--border);
    color: var(--ink);
    border-radius: 10px;
    padding: 28px 32px;
    margin-bottom: 28px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 32px;
    transition: background 0.3s ease, border-color 0.3s ease;
  }
  .hero-left { display: flex; flex-direction: column; gap: 8px; }
  .hero-label { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink-3); }
  .hero-amount { font-family: 'Instrument Serif', serif; font-size: 52px; letter-spacing: -2px; line-height: 1; color: var(--ink); }
  .hero-sub { font-size: 13px; color: var(--ink-3); }
  .hero-badges { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
  .hero-badge {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11px; font-weight: 500; padding: 4px 12px;
    border-radius: 99px;
  }
  .badge-green { background: rgba(26,110,60,0.3); color: #7ad39f; }
  .badge-amber { background: rgba(200,73,26,0.25); color: #f08060; }
  .hero-right { display: flex; flex-direction: column; gap: 16px; min-width: 260px; }
  .hero-stat-row { display: flex; justify-content: space-between; align-items: baseline; }
  .hero-stat-label { font-size: 12px; color: var(--ink-3); }
  .hero-stat-value { font-family: 'DM Mono', monospace; font-size: 14px; color: var(--ink); }
  .hero-divider { height: 1px; background: var(--border); }

  /* STAT GRID */
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 36px;
  }
  .stat-card {
    background: #16181f;
    border: 1.5px solid var(--border);
    border-radius: 8px;
    padding: 18px 20px;
    transition: background 0.3s ease, border-color 0.3s ease;
  }
  .stat-label { font-size: 11px; font-weight: 500; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
  .stat-value { font-family: 'Instrument Serif', serif; font-size: 30px; letter-spacing: -0.5px; line-height: 1; }
  .stat-sub { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--ink-3); margin-top: 8px; }
  .stat-sub.up { color: var(--green); }
  .stat-sub.accent { color: var(--accent); }

  /* SECTION LABEL */
  .section-label {
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.1em; color: var(--ink-3);
    margin-bottom: 14px;
    display: flex; align-items: center; gap: 10px;
  }
  .section-label::after { content: ''; flex: 1; height: 1px; background: var(--border); }

  /* PAY PERIOD TREND */
  .pay-trend-card { margin-bottom: 22px; }
  .pay-trend-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    margin-bottom: 14px;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--paper-3);
  }
  .pay-trend-stat { min-width: 170px; flex: 1; }
  .pay-trend-stat-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--ink-3);
    margin-bottom: 6px;
  }
  .pay-trend-stat-value {
    font-family: 'DM Mono', monospace;
    font-size: 14px;
    color: var(--ink);
    font-weight: 500;
    line-height: 1.2;
  }
  .pay-trend-stat-value.up { color: var(--green); }
  .pay-trend-stat-value.down { color: #b42318; }
  .pay-trend-stat-sub {
    margin-top: 4px;
    color: var(--ink-3);
    font-size: 11px;
  }
  .pay-trend-chart-scroll { width: 100%; overflow-x: auto; }
  .pay-trend-chart-wrap { height: 200px; min-width: 720px; }
  .pay-trend-chart-wrap svg { width: 100%; height: 100%; display: block; overflow: visible; }
  .pay-trend-grid-line { stroke: var(--paper-3); stroke-width: 1; }
  .pay-trend-y-label, .pay-trend-x-label {
    font-family: 'DM Mono', monospace;
    font-size: 9px;
    fill: var(--ink-3);
  }
  .pay-trend-line {
    stroke: var(--accent);
    stroke-width: 2.5;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .pay-trend-area { fill: var(--accent); fill-opacity: 0.1; }
  .pay-trend-point-group { cursor: default; }
  .pay-trend-point-hit { fill: transparent; }
  .pay-trend-point { fill: var(--accent); stroke: white; stroke-width: 1.5; }
  .pay-trend-tooltip {
    opacity: 0;
    transition: opacity 0.12s ease-out;
    pointer-events: none;
  }
  .pay-trend-point-group:hover .pay-trend-tooltip { opacity: 1; }
  .pay-trend-tooltip rect { fill: rgba(15, 15, 15, 0.95); }
  .pay-trend-tooltip-line {
    fill: #f7f5f0;
    font-size: 10px;
    font-family: 'Syne', sans-serif;
  }
  .pay-trend-tooltip-title {
    fill: #ffffff;
    font-family: 'DM Mono', monospace;
    font-size: 10px;
  }
  .pay-trend-empty {
    height: 200px;
    border: 1px dashed var(--border);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ink-3);
    font-size: 12px;
  }

  /* PAY PERIOD TABLE */
  .pay-table { width: 100%; border-collapse: collapse; margin-bottom: 36px; }
  .pay-table thead tr { border-bottom: 1.5px solid var(--ink); }
  .pay-table th {
    font-size: 10px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.1em; color: var(--ink-3);
    padding: 0 12px 12px; text-align: right;
  }
  .pay-table th:first-child { text-align: left; padding-left: 0; }
  .pay-table td { padding: 13px 12px; text-align: right; border-bottom: 1px solid var(--paper-3); font-size: 13px; }
  .pay-table td:first-child { text-align: left; padding-left: 0; }
  .pay-table tbody tr:hover { background: var(--paper-2); }
  .period-name { font-weight: 500; }
  .mono { font-family: 'DM Mono', monospace; }
  .bar-cell { width: 140px; }
  .mini-bar { height: 4px; background: var(--paper-3); border-radius: 99px; overflow: hidden; margin-top: 5px; }
  .mini-bar-fill { height: 100%; border-radius: 99px; background: var(--accent); }
  .bonus-badge {
    display: inline-block; font-size: 10px; font-weight: 600;
    padding: 2px 8px; border-radius: 99px;
    background: var(--green-light); color: var(--green);
  }

  /* BOTTOM GRID */
  .bottom-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 36px; }
  .card { background: #16181f; border: 1.5px solid var(--border); border-radius: 8px; padding: 22px 24px; }
  .card { transition: background 0.3s ease, border-color 0.3s ease; }
  .card-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-3); margin-bottom: 18px; }

  /* MEMBERSHIP BREAKDOWN */
  .membership-bars { display: flex; flex-direction: column; gap: 10px; }
  .mem-row { display: flex; align-items: center; gap: 12px; }
  .mem-label { font-size: 12px; color: var(--ink-2); width: 80px; flex-shrink: 0; }
  .mem-track { flex: 1; height: 22px; background: var(--paper-2); border-radius: 4px; overflow: hidden; }
  .mem-fill { height: 100%; border-radius: 4px; display: flex; align-items: center; padding-left: 10px; font-size: 11px; font-weight: 600; color: white; font-family: 'DM Mono', monospace; }
  .mem-count { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--ink-3); width: 32px; text-align: right; flex-shrink: 0; }

  /* TRAINER TABLE */
  .trainer-table { width: 100%; border-collapse: collapse; }
  .trainer-table td { padding: 9px 0; font-size: 13px; border-bottom: 1px solid var(--paper-3); }
  .trainer-table tr:last-child td { border-bottom: none; }
  .trainer-table td:last-child { text-align: right; font-family: 'DM Mono', monospace; }
  .trainer-rank { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--ink-3); width: 24px; display: inline-block; }
  .trainer-name { font-weight: 500; }
  .fp-bar { height: 3px; background: var(--paper-3); border-radius: 99px; overflow: hidden; margin-top: 3px; width: 100px; display: inline-block; vertical-align: middle; margin-left: 8px; }
  .fp-bar-fill { height: 100%; border-radius: 99px; background: var(--blue); }

  /* FP RATE CARD */
  .fp-rate-display { text-align: center; padding: 12px 0 20px; }
  .fp-rate-big { font-family: 'Instrument Serif', serif; font-size: 56px; letter-spacing: -2px; color: var(--ink); line-height: 1; }
  .fp-rate-label { font-size: 12px; color: var(--ink-3); margin-top: 6px; }
  .fp-breakdown { display: flex; justify-content: space-around; padding-top: 16px; border-top: 1px solid var(--paper-3); margin-top: 16px; }
  .fp-stat { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .fp-stat-val { font-family: 'Instrument Serif', serif; font-size: 22px; color: var(--ink); }
  .fp-stat-lab { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-3); }

  /* MONTHLY TREND */
  .trend-bars { display: flex; align-items: flex-end; gap: 8px; height: 80px; padding-top: 8px; }
  .trend-col { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
  .trend-bar { width: 100%; border-radius: 3px 3px 0 0; background: var(--accent); min-height: 4px; }
  .trend-month { font-family: 'DM Mono', monospace; font-size: 9px; color: var(--ink-3); text-transform: uppercase; }
  .trend-val { font-family: 'DM Mono', monospace; font-size: 9px; color: var(--ink-3); }

  /* FOOTER */
  .report-footer {
    padding-top: 28px; border-top: 1px solid var(--border);
    display: flex; justify-content: space-between; align-items: center;
  }
  .footer-brand { font-family: 'Instrument Serif', serif; font-size: 14px; color: var(--ink-3); }
  .footer-brand span { color: var(--accent); font-style: italic; }
  .footer-note { font-size: 11px; color: var(--ink-3); font-family: 'DM Mono', monospace; }

  /* YEAR CONTROLS */
  .year-label {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: var(--ink-3);
  }
  .year-btn {
    border: none;
    border-radius: 6px;
    padding: 6px 14px;
    font-family: 'DM Mono', monospace;
    font-size: 12px;
    transition: background 0.3s ease, color 0.3s ease;
    cursor: pointer;
  }
  .year-btn-active {
    background: var(--accent);
    color: #ffffff;
  }
  .year-btn-inactive {
    background: var(--paper-2);
    color: var(--ink-3);
  }
  .theme-toggle-btn {
    border: none;
    background: none;
    padding: 6px;
    cursor: pointer;
    line-height: 0;
    transition: opacity 0.2s ease;
  }
  .theme-toggle-btn:hover { opacity: 0.7; }

  /* Dark mode card/surface overrides */
  .page {
    background: var(--paper);
    color: var(--ink);
  }
  .card,
  .stat-card {
    background: #16181f;
    border-color: var(--border);
  }
  .current-period-card {
    background: #0d0f14;
    border: 1px solid var(--border);
  }
  .current-goal-bar { background: rgba(255,255,255,0.08); }
  .current-goal-row { background: rgba(255,255,255,0.04); }
  .hero-banner {
    background: #16181f;
    border-color: var(--border);
    color: var(--ink);
  }
  .report-header { border-bottom-color: var(--border); }
  .report-title,
  .hero-amount,
  .hero-stat-value,
  .stat-value,
  .fp-rate-big,
  .fp-stat-val,
  .pay-trend-stat-value {
    color: var(--ink);
  }
  .brand-sub,
  .report-period,
  .hero-label,
  .hero-sub,
  .hero-stat-label,
  .stat-label,
  .stat-sub,
  .card-title,
  .mem-count,
  .trainer-rank,
  .fp-rate-label,
  .fp-stat-lab,
  .pay-trend-stat-label,
  .pay-trend-stat-sub,
  .year-label {
    color: var(--ink-3);
  }
  .mem-label { color: var(--ink-2); }
  .period-name,
  .mono,
  .trainer-name { color: var(--ink); }
  .pay-table th { color: var(--ink-3); }
  .pay-table thead tr { border-bottom-color: #2e3340; }
  .pay-table td { border-bottom-color: #1e2028; }
  .pay-table tbody tr:hover { background: #1e2028; }
  svg text { fill: #4a5060; }
  .chart-grid-line,
  .pay-trend-grid-line { stroke: #272a33; }
  .pay-trend-area { fill-opacity: 0.15; }
  .pay-trend-tooltip-line { fill: #f2f3f5; }
  .pay-trend-tooltip-title { fill: #ffffff; }
  .mini-bar { background: #272a33; }
  .mem-track { background: #1e2028; }
  .year-btn-active { background: #f2f3f5; color: #0e0f13; }
  .year-btn-inactive { background: #1e2028; color: #4a5060; }
  .report-footer { border-top-color: #272a33; }
  .footer-brand, .footer-note { color: #4a5060; }

  /* EXPORT BTN */
  .export-btn {
    position: fixed; top: 24px; right: 24px;
    background: var(--accent); color: white; border: none; border-radius: 6px;
    padding: 9px 18px; font-family: 'Syne', sans-serif; font-size: 12px;
    font-weight: 500; cursor: pointer; letter-spacing: 0.03em;
    display: flex; align-items: center; gap: 7px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.15); transition: opacity 0.15s; z-index: 100;
  }
  .export-btn:hover { opacity: 0.85; }
  @media print { .export-btn { display: none; } .page { padding: 32px; } }
</style>

<div class="page">
  <div class="report-header">
    <div>
      <div class="brand-name">Pipeline<span>IQ</span></div>
      <div class="brand-sub">Sales Intelligence</div>
    </div>
    <div>
      <div class="report-title">Commission Report</div>
      <div class="report-period">${escapeHtml(repName)} &middot; GGIF &middot; ${escapeHtml(periodRangeLabel)}</div>
    </div>
  </div>

  ${
    isCurrentYearView
      ? `<div class="current-period-card">
    <div class="current-period-badge">
      <span class="pulse-dot"></span>
      CURRENT PERIOD
    </div>
    <div class="current-period-label">${escapeHtml(report.currentPayPeriod.periodLabel)}</div>
    <div class="current-period-grid">
      <div>
        <div class="current-period-value">${formatCurrency(report.currentPayPeriod.currentCommission)}</div>
        <div class="current-period-sub">commission so far</div>
      </div>
      <div>
        <div class="current-period-value">
          ${formatUnits(report.currentPayPeriod.currentUnits)}
          <span class="current-period-units">units</span>
        </div>
        <div class="current-period-sub">units for month</div>
      </div>
    </div>
    <div class="current-goal-block">
      <div class="current-goal-meta">
        <span class="current-goal-meta-text">${formatCurrency(currentCommission)} of ${formatCurrency(
          GOAL
        )} goal</span>
      </div>
      <div class="current-goal-bar">
        <div class="current-goal-fill" data-goal-width="${formatSvgNumber(goalPercent)}" style="background:${goalFillColor}"></div>
      </div>
      <div class="current-goal-status">
        <span class="current-goal-status-text">${goalPercentText} there</span>
        ${
          isHit
            ? '<span class="current-goal-hit-text">🎯 Goal hit!</span>'
            : `<span class="current-goal-status-text">${daysLeft} ${
                daysLeft === 1 ? "day" : "days"
              } left in period</span>`
        }
      </div>
      ${
        isHit
          ? `<div class="current-goal-hit-row">
              <div class="current-goal-hit-title">You've hit your ${formatCurrency(
                GOAL
              )} goal this period 🎉</div>
              <div class="current-goal-hit-sub">You're ${formatCurrency(goalOverAmount)} over goal</div>
            </div>`
          : `<div class="current-goal-row">
              <div class="current-goal-col">
                <div class="current-goal-col-label">Daily target to hit goal</div>
                <div class="current-goal-col-value">$${dailyNeeded} / day</div>
              </div>
              <div class="current-goal-col" style="text-align:right">
                <div class="current-goal-col-label">Days remaining</div>
                <div class="current-goal-col-value">${daysLeft}</div>
              </div>
            </div>`
      }
    </div>
    <div class="fitness-profile-block">
      <div class="fitness-profile-header">
        <span class="fitness-profile-badge">FITNESS PROFILES</span>
        <span class="fitness-profile-rate">${fpConversionRate}% attach rate</span>
      </div>
      <div class="fitness-profile-grid">
        <div>
          <div class="fitness-profile-label">Sold this period</div>
          <div class="fitness-profile-value">${currentSalesWithFP}</div>
          <div class="fitness-profile-sub">of ${currentSales} total sales</div>
        </div>
        <div style="text-align:right">
          <div class="fitness-profile-label">Missed FP commission</div>
          <div class="fitness-profile-value accent">${formatCurrency(missedCommission)}</div>
          <div class="fitness-profile-sub">${currentSalesWithoutFP} sales without FP</div>
        </div>
      </div>
      <div class="fitness-profile-bar-wrap">
        <div class="fitness-profile-bar">
          <div class="fitness-profile-bar-fill" style="width:${fpConversionBarWidth}%"></div>
        </div>
        <div class="fitness-profile-bar-meta">
          <span>${currentSalesWithoutFP} members didn't get a trainer</span>
          <span class="mono">${fpConversionRate}% conversion</span>
        </div>
      </div>
      ${
        missedCommission > 0
          ? `<div class="fitness-profile-opportunity">
              <div class="fitness-profile-opportunity-col">
                <div class="fitness-profile-label">If you hit 100% FP rate</div>
                <div class="fitness-profile-value">${formatCurrency(potentialTotal)} total this period</div>
              </div>
              <div class="fitness-profile-opportunity-col" style="text-align:right">
                <div class="fitness-profile-label">Extra you'd earn</div>
                <div class="fitness-profile-value green">+${formatCurrency(missedCommission)}</div>
              </div>
            </div>`
          : ""
      }
    </div>
    <div class="current-period-footer">
      ${report.currentPayPeriod.currentSales} members sold &middot; ${report.currentPayPeriod.currentFP} fitness profiles
    </div>
  </div>`
      : `<div class="historical-period-note">Viewing historical data for ${selectedYear}</div>`
  }

  <div class="hero-banner">
    <div class="hero-left">
      <div class="hero-label">Verified Commission (Pay Period Totals)</div>
      <div class="hero-amount">${formatCurrency(report.totalRevenue)}</div>
      <div class="hero-sub">${selectedYear} earnings &middot; ${report.payPeriods.length} pay periods</div>
      <div class="hero-badges">
        <span class="hero-badge badge-green">
          <span style="width:5px;height:5px;border-radius:50%;background:#7ad39f;flex-shrink:0"></span>
          ${report.totalFP} Fitness Profiles sold
        </span>
        <span class="hero-badge badge-amber">
          <span style="width:5px;height:5px;border-radius:50%;background:#f08060;flex-shrink:0"></span>
          ${report.cancellations} cancellations
        </span>
      </div>
    </div>
    <div class="hero-right">
      <div class="hero-stat-row">
        <span class="hero-stat-label">Avg commission / sale</span>
        <span class="hero-stat-value">${formatCurrency(report.avgCommission)}</span>
      </div>
      <div class="hero-divider"></div>
      <div class="hero-stat-row">
        <span class="hero-stat-label">FP attach rate</span>
        <span class="hero-stat-value">${formatPercent(report.fpRate)}</span>
      </div>
      <div class="hero-divider"></div>
      <div class="hero-stat-row">
        <span class="hero-stat-label">Best pay period</span>
        <span class="hero-stat-value">${
          report.bestPeriod
            ? `${formatCurrency(report.bestPeriod.amount)} (${escapeHtml(report.bestPeriod.label)})`
            : "-"
        }</span>
      </div>
      <div class="hero-divider"></div>
      <div class="hero-stat-row">
        <span class="hero-stat-label">Top trainer assigned</span>
        <span class="hero-stat-value">${
          topTrainer ? `${escapeHtml(topTrainer.name)} (${topTrainer.count})` : "-"
        }</span>
      </div>
    </div>
  </div>

  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-label">Total Members</div>
      <div class="stat-value">${report.totalSales}</div>
      <div class="stat-sub">sold this period</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Premium Sales</div>
      <div class="stat-value">${report.membershipCounts.Premium}</div>
      <div class="stat-sub up">${
        report.totalSales > 0
          ? `${formatPercent((report.membershipCounts.Premium / report.totalSales) * 100)} of all sales`
          : "0.0% of all sales"
      }</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">FP Attach Rate</div>
      <div class="stat-value">${formatPercent(report.fpRate)}</div>
      <div class="stat-sub">${report.totalFP} of ${report.totalSales} got a trainer</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Avg Pay Period</div>
      <div class="stat-value">${formatCurrency(avgPayPeriod)}</div>
      <div class="stat-sub accent">${report.payPeriods.length} pay periods</div>
    </div>
  </div>

  <div class="card pay-trend-card">
    <div class="card-title">Pay Period Trend</div>
    <div class="pay-trend-stats">
      ${payTrendStatsHTML}
    </div>
    ${payTrendChartHTML}
  </div>

  <div class="section-label">Pay Period Breakdown</div>
  <table class="pay-table">
    <thead>
      <tr>
        <th>Period</th>
        <th>Commission</th>
        <th>Units</th>
        <th>Bonus</th>
        <th style="text-align:left;padding-left:12px">Trend</th>
      </tr>
    </thead>
    <tbody>
      ${payPeriodRowsHTML}
    </tbody>
  </table>

  <div class="bottom-grid">
    <div class="card">
      <div class="card-title">Sales by Membership Type</div>
      <div class="membership-bars">
        ${membershipRowsHTML}
      </div>
      <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--paper-3);display:flex;justify-content:space-between;font-size:12px;color:var(--ink-3)">
        <span>Top type: ${topMembershipType ? topMembershipType.type : "-"}</span>
        <span style="font-family:'DM Mono',monospace">${trackedMembershipCount} total tracked</span>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Fitness Profile Trainers Assigned</div>
      <table class="trainer-table">
        <tbody>
          ${trainerRowsHTML}
        </tbody>
      </table>
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--paper-3);font-size:11px;color:var(--ink-3);font-family:'DM Mono',monospace">
        ${report.totalFP} total FPs across ${report.trainerCounts.length} trainers
      </div>
    </div>

    <div class="card">
      <div class="card-title">Fitness Profile Attach Rate</div>
      <div class="fp-rate-display">
        <div class="fp-rate-big">${formatPercent(report.fpRate)}</div>
        <div class="fp-rate-label">of new members also bought a Fitness Profile</div>
      </div>
      <div style="height:8px;background:var(--paper-2);border-radius:99px;overflow:hidden;margin:0 8px">
        <div style="height:100%;width:${Math.min(Math.max(report.fpRate, 0), 100)}%;background:var(--accent);border-radius:99px"></div>
      </div>
      <div class="fp-breakdown">
        <div class="fp-stat">
          <div class="fp-stat-val">${report.totalFP}</div>
          <div class="fp-stat-lab">With FP</div>
        </div>
        <div class="fp-stat">
          <div class="fp-stat-val">${withoutFp}</div>
          <div class="fp-stat-lab">Without FP</div>
        </div>
        <div class="fp-stat">
          <div class="fp-stat-val" style="color:var(--green)">${formatCurrency(
            report.totalFP > 0 ? report.totalBonuses / report.totalFP : 0
          )}</div>
          <div class="fp-stat-lab">FP Bonus</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Bonus Earnings</div>
      <table class="trainer-table">
        <tbody>
          ${bonusRowsHTML}
        </tbody>
      </table>
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--paper-3);display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:12px;color:var(--ink-3)">Total bonuses earned</span>
        <span style="font-family:'DM Mono',monospace;font-size:15px;font-weight:600;color:var(--green)">+${formatCurrency(
          report.totalBonuses
        )}</span>
      </div>
    </div>
  </div>

  <div class="report-footer">
    <div class="footer-brand">Pipeline<span>IQ</span></div>
    <div class="footer-note">Generated ${generatedDate} &middot; ${escapeHtml(repName)} &middot; GGIF Commissions</div>
  </div>
</div>`;
  }, [payPeriodGoal, report, repName, selectedYear]);

  function updatePayPeriodGoal(value: string) {
    const digitsOnly = value.replace(/[^\d]/g, "");
    setPayPeriodGoalInput(digitsOnly);

    if (!digitsOnly) return;

    const nextGoal = Number.parseInt(digitsOnly, 10);
    if (!Number.isFinite(nextGoal)) return;

    setPayPeriodGoal(normalizePayPeriodGoal(nextGoal));
  }

  function commitPayPeriodGoal() {
    const parsedGoal = Number.parseInt(payPeriodGoalInput, 10);
    const normalizedGoal = normalizePayPeriodGoal(parsedGoal);
    setPayPeriodGoal(normalizedGoal);
    setPayPeriodGoalInput(String(normalizedGoal));
  }

  function resetPayPeriodGoal() {
    setPayPeriodGoal(DEFAULT_PAY_PERIOD_GOAL);
    setPayPeriodGoalInput(String(DEFAULT_PAY_PERIOD_GOAL));
  }

  async function parseFile(file: File, onSuccess?: () => void) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setParseError("Please upload a .csv file.");
      setParsedData(null);
      setFileName("");
      return;
    }

    setParseError(null);

    try {
      const csvText = await file.text();
      const parsed = await parseCommissionCSV(csvText);
      const hasPositiveSales = parsed.transactionRows.some((row) => row.commission > 0);

      if (!hasPositiveSales && parsed.payPeriods.length === 0) {
        setParseError("No commission data found after applying parsing rules.");
        setParsedData(null);
        setFileName("");
        return;
      }

      setParsedData(parsed);
      setFileName(file.name);
      onSuccess?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (message === "No valid rows found in this CSV.") {
        setParseError(message);
      } else {
        setParseError(`Unable to parse CSV: ${message}`);
      }
      setParsedData(null);
      setFileName("");
    }
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

  async function syncReportData() {
    if (isSyncing) return;

    setIsSyncing(true);
    setParseError(null);

    try {
      if (onSyncNow) {
        const synced = await onSyncNow();
        setParsedData(synced.parsedData);
        if (synced.fileName) setFileName(synced.fileName);

        if (synced.lastSyncedAt) {
          const parsed =
            synced.lastSyncedAt instanceof Date
              ? synced.lastSyncedAt
              : new Date(synced.lastSyncedAt);
          setLastSyncedAt(Number.isNaN(parsed.getTime()) ? new Date() : parsed);
        } else {
          setLastSyncedAt(new Date());
        }
        return;
      }

      const response = await fetch(GOOGLE_SHEETS_SYNC_URL);
      if (!response.ok) throw new Error(`Unable to fetch sheet: ${response.status}`);

      const csvText = await response.text();
      const syncedFile = new File([csvText], "google-sheets-sync.csv", { type: "text/csv" });
      await parseFile(syncedFile, () => setLastSyncedAt(new Date()));
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setParseError(
        message ||
          "Could not access sheet. Make sure it's set to 'Anyone with the link can view' in Google Sheets sharing settings."
      );
    } finally {
      setIsSyncing(false);
    }
  }

  async function exportPdf() {
    if (!report || isGenerating) return;
    const reportNode = reportExportRef.current;
    if (!reportNode) return;

    setIsGenerating(true);
    const safeName = sanitizeFileName(fileName) || "commission-report";
    const printFrame = document.createElement("iframe");
    printFrame.setAttribute("aria-hidden", "true");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.opacity = "0";
    printFrame.style.pointerEvents = "none";
    printFrame.style.border = "0";
    document.body.appendChild(printFrame);
    const removePrintFrame = () => {
      if (document.body.contains(printFrame)) {
        document.body.removeChild(printFrame);
      }
    };

    try {
      const printWindow = printFrame.contentWindow;
      const printDoc = printFrame.contentDocument;
      if (!printWindow || !printDoc) {
        throw new Error("Unable to initialize PDF print frame.");
      }

      const clonedReport = reportNode.cloneNode(true) as HTMLDivElement;

      printDoc.open();
      printDoc.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeName}.pdf</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=Syne:wght@400;500;600;700;800&display=swap" />
    <style>
      @page { size: auto; margin: 10mm; }
      html, body { margin: 0; padding: 0; }
      body {
        background: #0e0f13;
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    </style>
  </head>
  <body></body>
</html>`);
      printDoc.close();

      printDoc.body.appendChild(clonedReport);

      await new Promise<void>((resolve) => {
        if (printDoc.readyState === "complete") {
          resolve();
          return;
        }
        printWindow.addEventListener("load", () => resolve(), { once: true });
      });

      try {
        await printDoc.fonts.ready;
      } catch {}

      await new Promise((resolve) => window.setTimeout(resolve, 120));

      const cleanup = () => {
        window.setTimeout(() => {
          removePrintFrame();
        }, 250);
      };

      printWindow.addEventListener("afterprint", cleanup, { once: true });
      printWindow.focus();
      printWindow.print();
      window.setTimeout(cleanup, 60_000);
    } catch {
      removePrintFrame();
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section className="relative w-full">
      <div className="mx-auto w-full max-w-[960px] space-y-6">
        {breadcrumb ? <div className="mb-4 text-sm text-[#464646]">{breadcrumb}</div> : null}

        {showUploadControls ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={onInputChange}
            />

            {isSheetConnected && !isSyncing ? (
              <div
                style={{
                  width: "100%",
                  maxWidth: "720px",
                  background: "#16181f",
                  border: "1px solid #272a33",
                  borderRadius: "10px",
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}
                >
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "6px",
                      background: "#1a7a4a",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M7 8h10M7 12h10M7 16h6"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--font-sans), sans-serif",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#f2f3f5",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {connectedSheetName}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono), monospace",
                        fontSize: "10px",
                        color: "rgba(255,255,255,0.35)",
                        marginTop: "2px",
                      }}
                    >
                      Connected via Google Sheets
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: "10px",
                      color: "#22c55e",
                    }}
                  >
                    <div
                      className="report-live-dot"
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: "#22c55e",
                      }}
                    />
                    Live
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: "10px",
                      color: "#4a5060",
                    }}
                  >
                    Synced {lastSyncedAgoLabel ?? "just now"}
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void syncReportData();
                    }}
                    disabled={isSyncing}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      background: "transparent",
                      color: "#9098a8",
                      border: "1px solid #272a33",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontFamily: "var(--font-sans), sans-serif",
                      fontSize: "12px",
                      fontWeight: 500,
                      cursor: isSyncing ? "not-allowed" : "pointer",
                    }}
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className={isSyncing ? "report-sync-icon-spin" : undefined}
                    >
                      <path d="M23 4v6h-6M1 20v-6h6" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    Sync
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    maxWidth: "720px",
                    marginBottom: "14px",
                  }}
                >
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void syncReportData();
                    }}
                    disabled={isSyncing}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      background: isSyncing ? "#c94e1b" : "#e05a20",
                      color: "white",
                      border: "none",
                      padding: "11px 20px",
                      borderRadius: "8px",
                      fontFamily: "var(--font-sans), sans-serif",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: isSyncing ? "not-allowed" : "pointer",
                      transition: "background 0.15s",
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className={isSyncing ? "report-sync-icon-spin" : undefined}
                    >
                      <path d="M23 4v6h-6M1 20v-6h6" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    {isSyncing ? "Syncing..." : syncButtonLabel}
                  </button>
                </div>

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
                  style={{
                    width: "100%",
                    maxWidth: "720px",
                    border: isSyncing
                      ? "1.5px dashed #e05a20"
                      : isDragging
                        ? "1.5px dashed #22c55e"
                        : "1.5px dashed #272a33",
                    borderRadius: "12px",
                    background: isSyncing
                      ? "rgba(224,90,32,0.03)"
                      : isDragging
                        ? "rgba(34,197,94,0.04)"
                        : "transparent",
                    padding: "40px 32px",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "border-color 0.15s, background 0.15s",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      color: isSyncing ? "#e05a20" : isDragging ? "#22c55e" : "#4a5060",
                      marginBottom: "4px",
                    }}
                  >
                    {isSyncing ? (
                      <svg
                        className="report-sync-icon-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M23 4v6h-6M1 20v-6h6" />
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    )}
                  </div>
                  {isSyncing ? (
                    <>
                      <div
                        style={{
                          fontFamily: "var(--font-sans), sans-serif",
                          fontSize: "15px",
                          fontWeight: 600,
                          color: "#e05a20",
                        }}
                      >
                        Fetching from Google Sheets...
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-mono), monospace",
                          fontSize: "12px",
                          color: "#4a5060",
                        }}
                      >
                        Parsing your commission data
                      </div>
                    </>
                  ) : (
                    <>
                      <div
                        style={{
                          fontFamily: "var(--font-sans), sans-serif",
                          fontSize: "15px",
                          fontWeight: 600,
                          color: isDragging ? "#22c55e" : "#f2f3f5",
                        }}
                      >
                        {isDragging ? "Drop to upload" : "Drop your CSV here"}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-mono), monospace",
                          fontSize: "12px",
                          color: isDragging ? "#22c55e" : "#4a5060",
                        }}
                      >
                        {isDragging ? "Release to parse your CSV" : "or click to browse your files"}
                      </div>
                      {!isDragging ? (
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            background: "rgba(34,197,94,0.08)",
                            border: "1px solid rgba(34,197,94,0.2)",
                            color: "#22c55e",
                            fontFamily: "var(--font-mono), monospace",
                            fontSize: "11px",
                            fontWeight: 500,
                            padding: "4px 12px",
                            borderRadius: "99px",
                            marginTop: "4px",
                          }}
                        >
                          .csv only
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              maxWidth: "720px",
              marginBottom: "14px",
            }}
          >
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void syncReportData();
              }}
              disabled={isSyncing}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: isSyncing ? "#c94e1b" : "#e05a20",
                color: "white",
                border: "none",
                padding: "11px 20px",
                borderRadius: "8px",
                fontFamily: "var(--font-sans), sans-serif",
                fontSize: "13px",
                fontWeight: 600,
                cursor: isSyncing ? "not-allowed" : "pointer",
                transition: "background 0.15s",
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className={isSyncing ? "report-sync-icon-spin" : undefined}
              >
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              {isSyncing ? "Syncing..." : syncButtonLabel}
            </button>
            {lastSyncedAgoLabel ? (
              <p
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: "10px",
                  color: "#4a5060",
                }}
              >
                Synced {lastSyncedAgoLabel}
              </p>
            ) : null}
          </div>
        )}

        {parseError ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {parseError}
          </p>
        ) : null}

        {report ? (
          <div
            className="space-y-3"
            style={{ transition: "background 0.3s ease, color 0.3s ease" }}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div
                className="rounded-xl border px-4 py-3"
                style={{
                  borderColor: "#272a33",
                  background: "#16181f",
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p
                      style={{
                        fontFamily: "var(--font-mono), monospace",
                        fontSize: "10px",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "#4a5060",
                      }}
                    >
                      Pay Period Sales Goal
                    </p>
                    <p
                      style={{
                        marginTop: "6px",
                        fontFamily: "var(--font-sans), sans-serif",
                        fontSize: "13px",
                        color: "#9098a8",
                      }}
                    >
                      Updates the progress bar and daily target for the current period.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={resetPayPeriodGoal}
                    disabled={payPeriodGoal === DEFAULT_PAY_PERIOD_GOAL}
                    style={{
                      border: "1px solid #272a33",
                      borderRadius: "6px",
                      background: "transparent",
                      color:
                        payPeriodGoal === DEFAULT_PAY_PERIOD_GOAL ? "rgba(144,152,168,0.45)" : "#9098a8",
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: "10px",
                      padding: "6px 10px",
                      cursor:
                        payPeriodGoal === DEFAULT_PAY_PERIOD_GOAL ? "not-allowed" : "pointer",
                    }}
                  >
                    Reset
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="relative w-full max-w-[180px]">
                    <span
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                      style={{
                        fontFamily: "var(--font-mono), monospace",
                        fontSize: "13px",
                        color: "#9098a8",
                      }}
                    >
                      $
                    </span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={payPeriodGoalInput}
                      onChange={(event) => updatePayPeriodGoal(event.target.value)}
                      onBlur={commitPayPeriodGoal}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitPayPeriodGoal();
                          event.currentTarget.blur();
                        }
                      }}
                      aria-label="Pay period sales goal"
                      className="h-10 border-[#2f3340] bg-[#0f1117] pl-7 text-sm font-semibold text-[#f2f3f5] focus-visible:border-[#e05a20] focus-visible:ring-[rgba(224,90,32,0.18)]"
                    />
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: "11px",
                      color: "#4a5060",
                    }}
                  >
                    Goal applies immediately
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {availableYears.length > 0 ? (
                  <>
                    <span className="year-label">Viewing:</span>
                    <div className="inline-flex items-center gap-1 rounded-md bg-transparent">
                      {availableYears.map((year) => {
                        const isActive = year === selectedYear;
                        return (
                          <button
                            key={year}
                            type="button"
                            onClick={() => setSelectedYear(year)}
                            className={`year-btn ${
                              isActive ? "year-btn-active" : "year-btn-inactive"
                            }`}
                          >
                            {year}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : null}
                <Button
                  type="button"
                  disabled={isGenerating || !report}
                  onClick={exportPdf}
                  className="h-9 border border-[#2f2f2f] bg-[#0f0f0f] px-3.5 text-xs font-semibold text-[#f7f5f0] hover:bg-[#1a1a1a] disabled:bg-[#1a1a1a] disabled:text-[#8f8f8f]"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Preparing PDF...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Export PDF
                    </>
                  )}
                </Button>
              </div>
            </div>
            <div ref={reportExportRef} dangerouslySetInnerHTML={{ __html: reportHTML }} />
          </div>
        ) : null}
      </div>
      <style jsx>{`
        @keyframes reportUploaderPulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }
        @keyframes reportUploaderSpin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        .report-live-dot {
          animation: reportUploaderPulse 2s infinite;
        }
        .report-sync-icon-spin {
          transform-origin: center;
          animation: reportUploaderSpin 1s linear infinite;
        }
      `}</style>
    </section>
  );
}
