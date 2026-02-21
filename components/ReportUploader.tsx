"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

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

type TrainerCount = {
  name: string;
  count: number;
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
};

const MONTH_HEADER_PATTERN =
  /^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}$/i;

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

function parseCommission(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;

  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

const DATE_LIKE_VALUE_PATTERN = /^\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?$/;

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

function normalizeTrainerName(value: string) {
  const cleaned = value.trim().replace(/\s+/g, " ");
  const normalized = TRAINER_NAME_NORMALIZATION[cleaned.toLowerCase()];
  return normalized ?? cleaned;
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

function parseCommissionReport(rawRows: CsvRawRow[]) {
  const membershipCounts = buildEmptyMembershipCounts();
  const trainerMap = new Map<string, TrainerCount>();
  const payPeriods: PayPeriod[] = [];

  let totalRevenue = 0;
  let totalSales = 0;
  let totalFP = 0;
  let cancellations = 0;
  let headerSkipped = false;

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
      if (period.amount > 0 || period.bonus > 0 || period.units > 0) {
        payPeriods.push(period);
        totalRevenue += period.amount;
      }
      continue;
    }

    const memberName = row[1] ?? "";
    const membershipType = row[2] ?? "";
    const trainer = row[4] ?? "";
    const commissionRaw = row[5] ?? "";
    if (!isValidMemberName(memberName)) continue;

    const commission = parseCommission(commissionRaw);
    if (commission <= 0) {
      if (commission < 0) cancellations += 1;
      continue;
    }

    totalSales += 1;
    membershipCounts[categorizeMembership(membershipType)] += 1;

    if (looksLikeTrainerName(trainer)) {
      totalFP += 1;
      const normalizedTrainer = normalizeTrainerName(trainer);
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

  const totalBonuses = payPeriods.reduce((sum, period) => sum + period.bonus, 0);
  const bestPeriod =
    payPeriods.reduce<PayPeriod | null>((best, current) => {
      if (!best || current.amount > best.amount) return current;
      return best;
    }, null) ?? null;

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
    payPeriods,
    totalBonuses,
    bestPeriod,
    cancellations,
  } satisfies CommissionReport;
}

export function ReportUploader() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [fileName, setFileName] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [report, setReport] = useState<CommissionReport | null>(null);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap";
    document.head.appendChild(link);
  }, []);

  const reportHTML = useMemo(() => {
    if (!report) return "";

    const avgPayPeriod =
      report.payPeriods.length > 0
        ? report.payPeriods.reduce((sum, period) => sum + period.amount, 0) /
          report.payPeriods.length
        : 0;

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
        <line class="pay-trend-grid-line" x1="${formatSvgNumber(PAD.left)}" y1="${formatSvgNumber(
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
    --ink: #0f0f0f;
    --ink-2: #3a3a3a;
    --ink-3: #888;
    --paper: #f7f5f0;
    --paper-2: #eceae4;
    --paper-3: #e0ddd6;
    --accent: #c8491a;
    --green: #1a6e3c;
    --green-light: #e2f0e8;
    --amber: #b07d00;
    --amber-light: #fdf4d8;
    --border: #d8d5ce;
    --blue: #1a4fa0;
    --blue-light: #e8f0fe;
  }
  body {
    background: var(--paper);
    color: var(--ink);
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    line-height: 1.5;
  }
  .page {
    max-width: 960px;
    margin: 0 auto;
    padding: 48px 40px 80px;
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

  /* HERO BANNER */
  .hero-banner {
    background: var(--ink);
    color: white;
    border-radius: 10px;
    padding: 28px 32px;
    margin-bottom: 28px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 32px;
  }
  .hero-left { display: flex; flex-direction: column; gap: 8px; }
  .hero-label { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.45); }
  .hero-amount { font-family: 'Instrument Serif', serif; font-size: 52px; letter-spacing: -2px; line-height: 1; }
  .hero-sub { font-size: 13px; color: rgba(255,255,255,0.45); }
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
  .hero-stat-label { font-size: 12px; color: rgba(255,255,255,0.45); }
  .hero-stat-value { font-family: 'DM Mono', monospace; font-size: 14px; color: white; }
  .hero-divider { height: 1px; background: rgba(255,255,255,0.1); }

  /* STAT GRID */
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 36px;
  }
  .stat-card {
    background: white;
    border: 1.5px solid var(--border);
    border-radius: 8px;
    padding: 18px 20px;
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
    font-family: 'DM Sans', sans-serif;
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
  .card { background: white; border: 1.5px solid var(--border); border-radius: 8px; padding: 22px 24px; }
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
  .trend-bar { width: 100%; border-radius: 3px 3px 0 0; background: var(--ink); min-height: 4px; }
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

  /* EXPORT BTN */
  .export-btn {
    position: fixed; top: 24px; right: 24px;
    background: var(--ink); color: white; border: none; border-radius: 6px;
    padding: 9px 18px; font-family: 'DM Sans', sans-serif; font-size: 12px;
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
      <div class="report-period">Tyler &middot; GGIF &middot; ${escapeHtml(periodRangeLabel)}</div>
    </div>
  </div>

  <div class="hero-banner">
    <div class="hero-left">
      <div class="hero-label">Verified Commission (Pay Period Totals)</div>
      <div class="hero-amount">${formatCurrency(report.totalRevenue)}</div>
      <div class="hero-sub">Commission ${formatCurrency(report.totalRevenue)} + Bonuses ${formatCurrency(report.totalBonuses)} across ${report.payPeriods.length} pay periods</div>
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
    <div class="footer-note">Generated ${generatedDate} &middot; Tyler &middot; GGIF Commissions</div>
  </div>
</div>`;
  }, [report]);

  function parseFile(file: File, onSuccess?: () => void) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setParseError("Please upload a .csv file.");
      setReport(null);
      setFileName("");
      return;
    }

    setParseError(null);

    Papa.parse<CsvRawRow>(file, {
      header: false,
      skipEmptyLines: false,
      complete: (results) => {
        const rawRows = (results.data ?? []).filter((row) => Array.isArray(row));

        if (rawRows.length === 0) {
          setParseError("No valid rows found in this CSV.");
          setReport(null);
          setFileName("");
          return;
        }

        const parsed = parseCommissionReport(rawRows);

        if (parsed.totalSales === 0 && parsed.payPeriods.length === 0) {
          setParseError("No commission data found after applying parsing rules.");
          setReport(null);
          setFileName("");
          return;
        }

        setReport(parsed);
        setFileName(file.name);
        onSuccess?.();
      },
      error: (error) => {
        setParseError(`Unable to parse CSV: ${error.message}`);
        setReport(null);
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

  async function syncFromGoogleSheets() {
    if (isSyncing) return;

    setIsSyncing(true);
    setParseError(null);

    try {
      const response = await fetch(GOOGLE_SHEETS_SYNC_URL);

      if (!response.ok) {
        throw new Error(`Unable to fetch sheet: ${response.status}`);
      }

      const csvText = await response.text();
      const syncedFile = new File([csvText], "google-sheets-sync.csv", { type: "text/csv" });
      parseFile(syncedFile, () => setLastSyncedAt(new Date()));
    } catch {
      setParseError(
        "Could not access sheet. Make sure it's set to 'Anyone with the link can view' in Google Sheets sharing settings."
      );
    } finally {
      setIsSyncing(false);
    }
  }

  async function exportPdf() {
    if (!report || isGenerating) return;

    setIsGenerating(true);

    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      let y = 18;

      const drawFooter = () => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(
          `PipelineIQ - Generated ${new Date().toLocaleDateString("en-US")}`,
          pageWidth / 2,
          pageHeight - 8,
          { align: "center" }
        );
      };

      doc.setFillColor(247, 245, 240);
      doc.rect(0, 0, pageWidth, pageHeight, "F");

      doc.setTextColor(15, 15, 15);
      doc.setFont("times", "normal");
      doc.setFontSize(24);
      doc.text("Commission Report", margin, y);

      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(90, 90, 90);
      doc.text(`Source: ${fileName || "Uploaded CSV"}`, margin, y);

      y += 10;
      doc.setTextColor(15, 15, 15);
      doc.setFontSize(12);
      doc.text(`Total Commissions: ${formatCurrency(report.totalRevenue)}`, margin, y);
      y += 6;
      doc.text(`Total Sales: ${report.totalSales}`, margin, y);
      y += 6;
      doc.text(`FP Attach Rate: ${formatPercent(report.fpRate)}`, margin, y);
      y += 6;
      doc.text(`Avg Commission / Sale: ${formatCurrency(report.avgCommission)}`, margin, y);
      y += 6;
      doc.text(`Total Bonuses: ${formatCurrency(report.totalBonuses)}`, margin, y);

      y += 10;
      doc.setFont("helvetica", "bold");
      doc.text("Pay Periods", margin, y);
      y += 6;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      for (const period of report.payPeriods) {
        if (y > pageHeight - 20) {
          drawFooter();
          doc.addPage();
          doc.setFillColor(247, 245, 240);
          doc.rect(0, 0, pageWidth, pageHeight, "F");
          y = 16;
        }

        doc.text(period.label, margin, y);
        doc.text(formatCurrency(period.amount), margin + 86, y);
        doc.text(formatUnits(period.units), margin + 122, y);
        doc.text(period.bonus > 0 ? `+${formatCurrency(period.bonus)}` : "-", margin + 150, y);
        y += 5.5;
      }

      y += 4;
      doc.setFont("helvetica", "bold");
      doc.text("Top Trainers", margin, y);
      y += 6;
      doc.setFont("helvetica", "normal");

      for (const trainer of report.trainerCounts.slice(0, 10)) {
        if (y > pageHeight - 20) {
          drawFooter();
          doc.addPage();
          doc.setFillColor(247, 245, 240);
          doc.rect(0, 0, pageWidth, pageHeight, "F");
          y = 16;
        }

        doc.text(trainer.name, margin, y);
        doc.text(`${trainer.count} FPs`, margin + 80, y);
        y += 5.5;
      }

      drawFooter();
      const safeName = sanitizeFileName(fileName) || "commission-report";
      doc.save(`${safeName}.pdf`);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section
      className="relative min-h-screen bg-[#f7f5f0] px-4 pb-32 pt-8 text-[#0f0f0f] sm:px-6 lg:px-8"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className="mx-auto w-full max-w-[960px] space-y-6">
        <div className="rounded-2xl border border-[#d8d5ce] bg-white p-6 shadow-[0_16px_36px_rgba(15,15,15,0.06)]">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onInputChange}
          />

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              onClick={syncFromGoogleSheets}
              disabled={isSyncing}
              className="h-10 border border-[#2f2f2f] bg-[#0f0f0f] px-4 text-sm font-semibold text-[#f7f5f0] hover:bg-[#1a1a1a] disabled:bg-[#1a1a1a] disabled:text-[#8f8f8f]"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                "Sync from Google Sheets"
              )}
            </Button>

            {lastSyncedAt ? (
              <p className="text-sm text-[#5b5b5b]">
                Last synced:{" "}
                {lastSyncedAt.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
            ) : null}
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
            className={`rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
              isDragging
                ? "border-[#1a6e3c] bg-[#edf7f1]"
                : "border-[#cfcabf] bg-[#fbfaf7] hover:bg-[#f5f2eb]"
            }`}
          >
            <div className="mx-auto flex max-w-md flex-col items-center">
              <Upload className="h-12 w-12 text-[#1a1a1a]" />
              <p className="mt-4 text-lg font-medium">Drop your CSV transactions here</p>
              <p className="mt-2 text-sm text-[#5b5b5b]">
                We parse commission summaries and render a styled report
              </p>
              <span className="mt-4 inline-flex items-center rounded-full bg-[#e7f2eb] px-3 py-1 text-xs font-semibold text-[#1a6e3c]">
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
        </div>

        {report ? <div dangerouslySetInnerHTML={{ __html: reportHTML }} /> : null}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#232323] bg-[#0f0f0f] px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[960px]">
          <Button
            type="button"
            disabled={isGenerating || !report}
            onClick={exportPdf}
            className="h-12 w-full border border-[#2f2f2f] bg-[#0f0f0f] text-sm font-semibold text-[#f7f5f0] hover:bg-[#1a1a1a] disabled:bg-[#1a1a1a] disabled:text-[#8f8f8f]"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exporting PDF...
              </>
            ) : (
              "Export PDF"
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}
