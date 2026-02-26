"use client";

import { useMemo, useState } from "react";
import { FP_COMMISSION_PER_MISSED, getRepStats, parseStoredRepData } from "@/lib/rep-sync";
import type { Rep } from "@/lib/reps-store";

export type LeaderboardPeriod = "full" | "firstHalf" | "secondHalf";

type SortColumn = "name" | "commission" | "units" | "fpRate" | "fpSold" | "missedFpCommission" | "vsLastPeriod" | "status";
type SortDirection = "asc" | "desc";
type StatusTone = "strong" | "average" | "behind";
type Half = "first" | "second";

type TransactionRow = {
  year: number | null;
  transactionDate?: string | null;
  commission: number;
  units: number;
  hasTrainer: boolean;
  inCurrentPayPeriod: boolean;
};

type LeaderboardRow = {
  id: string;
  name: string;
  teamLabel: string;
  commission: number;
  units: number;
  fpRate: number;
  fpSold: number;
  missedFpCommission: number;
  vsLastPeriod: number;
  status: StatusTone;
};

type PeriodMetrics = {
  commission: number;
  units: number;
  sales: number;
  fpSold: number;
  fpRate: number;
  missedFpCommission: number;
};

type CurrentPeriodBannerStats = {
  label: string;
  teamCommission: number;
  units: number;
  missedFpCommission: number;
  daysLeft: number;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatUnits(value: number) {
  if (!Number.isFinite(value) || value === 0) return "0";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1).replace(/\.0$/, "");
}

function formatPercent(value: number) {
  return `${value.toFixed(1).replace(/\.0$/, "")}%`;
}

function formatRank(rank: number) {
  return String(rank).padStart(2, "0");
}

function parseDay(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function inRange(date: Date, start: Date, end: Date) {
  const time = date.getTime();
  return time >= start.getTime() && time <= end.getTime();
}

function getHalfRange(year: number, monthIndex: number, half: Half) {
  if (half === "first") {
    return {
      start: new Date(year, monthIndex, 1),
      end: new Date(year, monthIndex, 15),
    };
  }

  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return {
    start: new Date(year, monthIndex, 16),
    end: new Date(year, monthIndex, lastDay),
  };
}

function getPreviousHalfRange(year: number, monthIndex: number, half: Half) {
  if (half === "second") {
    return getHalfRange(year, monthIndex, "first");
  }

  const previousMonth = new Date(year, monthIndex - 1, 1);
  return getHalfRange(previousMonth.getFullYear(), previousMonth.getMonth(), "second");
}

function formatHalfLabel(start: Date, end: Date) {
  const month = start.toLocaleString("en-US", { month: "long" });
  return `${month} ${start.getDate()} \u2013 ${end.getDate()}, ${start.getFullYear()}`;
}

function parsePeriodLabelToTimestamp(label: string) {
  const direct = Date.parse(label);
  if (!Number.isNaN(direct)) return direct;

  const monthDay = label.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (!monthDay) return Number.POSITIVE_INFINITY;

  const month = Number.parseInt(monthDay[1], 10);
  const day = Number.parseInt(monthDay[2], 10);
  const yearToken = monthDay[3];
  const year = yearToken
    ? yearToken.length === 2
      ? 2000 + Number.parseInt(yearToken, 10)
      : Number.parseInt(yearToken, 10)
    : new Date().getFullYear();

  if (month < 1 || month > 12 || day < 1 || day > 31 || !Number.isFinite(year)) {
    return Number.POSITIVE_INFINITY;
  }

  return new Date(year, month - 1, day).getTime();
}

function getHalfMetrics(rows: TransactionRow[], start: Date, end: Date, allowFallbackCurrentPeriod: boolean): PeriodMetrics {
  let commission = 0;
  let units = 0;
  let sales = 0;
  let fpSold = 0;

  for (const row of rows) {
    const rowDate = parseDay(row.transactionDate ?? null);

    let include = false;
    if (rowDate) {
      include = inRange(rowDate, start, end);
    } else if (allowFallbackCurrentPeriod && row.inCurrentPayPeriod && row.year === start.getFullYear()) {
      include = true;
    }

    if (!include) continue;

    const rowCommission = Number.isFinite(row.commission) ? row.commission : 0;
    const rowUnits = Number.isFinite(row.units) ? row.units : 0;

    commission += rowCommission;
    units += Math.max(rowUnits, 0);

    if (rowCommission > 0) {
      sales += 1;
      if (row.hasTrainer) fpSold += 1;
    }
  }

  const fpRate = sales > 0 ? (fpSold / sales) * 100 : 0;

  return {
    commission,
    units,
    sales,
    fpSold,
    fpRate,
    missedFpCommission: Math.max(sales - fpSold, 0) * FP_COMMISSION_PER_MISSED,
  };
}

function getStatusTone(commission: number, averageCommission: number): StatusTone {
  if (commission > averageCommission) return "strong";
  if (commission >= averageCommission * 0.8) return "average";
  return "behind";
}

function statusLabel(status: StatusTone) {
  if (status === "strong") return "Strong";
  if (status === "average") return "Average";
  return "Behind";
}

const SORTED_LABEL: Record<SortColumn, string> = {
  name: "name",
  commission: "commission",
  units: "units",
  fpRate: "fp rate",
  fpSold: "fps sold",
  missedFpCommission: "missed",
  vsLastPeriod: "vs last period",
  status: "status",
};

export function Leaderboard({ reps, selectedYear, period }: { reps: Rep[]; selectedYear: number; period: LeaderboardPeriod }) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("commission");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const today = useMemo(() => new Date(), []);
  const currentMonthIndex = today.getMonth();
  const currentYear = today.getFullYear();
  const currentHalf: Half = today.getDate() <= 15 ? "first" : "second";

  const selectedHalf: Half = period === "firstHalf" ? "first" : "second";
  const selectedHalfRange = period === "full" ? null : getHalfRange(selectedYear, currentMonthIndex, selectedHalf);
  const previousHalfRange = period === "full" ? null : getPreviousHalfRange(selectedYear, currentMonthIndex, selectedHalf);

  const rows = useMemo<LeaderboardRow[]>(() => {
    const mapped = reps.map((rep) => {
      const data = parseStoredRepData(rep.data);
      const transactionRows = ((data?.transactionRows ?? []) as TransactionRow[]);

      let commission = 0;
      let units = 0;
      let fpRate = 0;
      let fpSold = 0;
      let missedFpCommission = 0;
      let vsLastPeriod = 0;

      if (period === "full") {
        const stats = getRepStats(data, selectedYear);
        commission = stats.commission;
        units = stats.units;
        fpRate = stats.fpRate;
        fpSold = stats.fpSold;
        missedFpCommission = stats.missedFpCommission;

        const periodsForYear = [...(data?.payPeriods ?? [])]
          .filter((payPeriod) => payPeriod.year === selectedYear)
          .sort((left, right) => parsePeriodLabelToTimestamp(left.label) - parsePeriodLabelToTimestamp(right.label));

        const currentPayPeriodAmount = periodsForYear.length > 0 ? periodsForYear[periodsForYear.length - 1].amount : 0;
        const previousPayPeriodAmount = periodsForYear.length > 1 ? periodsForYear[periodsForYear.length - 2].amount : 0;
        vsLastPeriod = currentPayPeriodAmount - previousPayPeriodAmount;
      } else if (selectedHalfRange && previousHalfRange) {
        const allowFallbackCurrentPeriod =
          selectedYear === currentYear && selectedHalf === currentHalf;

        const currentMetrics = getHalfMetrics(
          transactionRows,
          selectedHalfRange.start,
          selectedHalfRange.end,
          allowFallbackCurrentPeriod
        );
        const previousMetrics = getHalfMetrics(
          transactionRows,
          previousHalfRange.start,
          previousHalfRange.end,
          false
        );

        commission = currentMetrics.commission;
        units = currentMetrics.units;
        fpRate = currentMetrics.fpRate;
        fpSold = currentMetrics.fpSold;
        missedFpCommission = currentMetrics.missedFpCommission;
        vsLastPeriod = currentMetrics.commission - previousMetrics.commission;
      }

      return {
        id: rep.id,
        name: rep.name,
        teamLabel: rep.team.trim() || "Unassigned",
        commission,
        units,
        fpRate,
        fpSold,
        missedFpCommission,
        vsLastPeriod,
        status: "average" as StatusTone,
      };
    });

    const averageCommission =
      mapped.length > 0 ? mapped.reduce((sum, row) => sum + row.commission, 0) / mapped.length : 0;

    return mapped.map((row) => ({
      ...row,
      status: getStatusTone(row.commission, averageCommission),
    }));
  }, [reps, period, selectedHalf, selectedHalfRange, previousHalfRange, selectedYear, currentHalf, currentYear]);

  const sortedRows = useMemo(() => {
    const sorted = [...rows];
    const statusRank: Record<StatusTone, number> = {
      strong: 3,
      average: 2,
      behind: 1,
    };

    sorted.sort((left, right) => {
      let delta = 0;

      if (sortColumn === "name") {
        delta = left.name.localeCompare(right.name);
      } else if (sortColumn === "commission") {
        delta = right.commission - left.commission;
      } else if (sortColumn === "units") {
        delta = right.units - left.units;
      } else if (sortColumn === "fpRate") {
        delta = right.fpRate - left.fpRate;
      } else if (sortColumn === "fpSold") {
        delta = right.fpSold - left.fpSold;
      } else if (sortColumn === "missedFpCommission") {
        delta = right.missedFpCommission - left.missedFpCommission;
      } else if (sortColumn === "vsLastPeriod") {
        delta = right.vsLastPeriod - left.vsLastPeriod;
      } else if (sortColumn === "status") {
        delta = statusRank[right.status] - statusRank[left.status];
      }

      if (delta === 0) {
        delta = left.name.localeCompare(right.name);
      }

      return sortDirection === "desc" ? delta : -delta;
    });

    return sorted;
  }, [rows, sortColumn, sortDirection]);

  const currentBanner = useMemo<CurrentPeriodBannerStats>(() => {
    const range = getHalfRange(currentYear, currentMonthIndex, currentHalf);
    const label = formatHalfLabel(range.start, range.end);

    let teamCommission = 0;
    let units = 0;
    let missedFpCommission = 0;

    for (const rep of reps) {
      const data = parseStoredRepData(rep.data);
      const transactionRows = ((data?.transactionRows ?? []) as TransactionRow[]);
      const metrics = getHalfMetrics(transactionRows, range.start, range.end, true);
      teamCommission += metrics.commission;
      units += metrics.units;
      missedFpCommission += metrics.missedFpCommission;
    }

    const daysLeft = Math.max(0, range.end.getDate() - today.getDate());

    return {
      label,
      teamCommission,
      units,
      missedFpCommission,
      daysLeft,
    };
  }, [currentHalf, currentMonthIndex, currentYear, reps, today]);

  const periodLabel = useMemo(() => {
    if (period === "full") {
      return `${selectedYear} Full Period`;
    }
    if (!selectedHalfRange) return "Current Period";
    return formatHalfLabel(selectedHalfRange.start, selectedHalfRange.end);
  }, [period, selectedHalfRange, selectedYear]);

  const highestCommission = useMemo(
    () => sortedRows.reduce((max, row) => Math.max(max, row.commission), 0),
    [sortedRows]
  );

  const podiumRows = [sortedRows[1] ?? null, sortedRows[0] ?? null, sortedRows[2] ?? null] as const;

  function toggleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }

    setSortColumn(column);
    setSortDirection(column === "name" ? "asc" : "desc");
  }

  return (
    <div className="leaderboard-view">
      <div className="period-banner">
        <div className="period-banner-left">
          <div className="period-pulse" />
          <div>
            <div className="period-label">Current Pay Period</div>
            <div className="period-name">{currentBanner.label}</div>
          </div>
        </div>
        <div className="period-banner-stats">
          <div className="period-banner-stat">
            <div className="period-banner-stat-value">{formatCurrency(currentBanner.teamCommission)}</div>
            <div className="period-banner-stat-label">Team total so far</div>
          </div>
          <div className="period-banner-stat">
            <div className="period-banner-stat-value">{formatUnits(currentBanner.units)}</div>
            <div className="period-banner-stat-label">Units sold</div>
          </div>
          <div className="period-banner-stat">
            <div className="period-banner-stat-value" style={{ color: "var(--amber)" }}>
              {formatCurrency(currentBanner.missedFpCommission)}
            </div>
            <div className="period-banner-stat-label">Missed FP</div>
          </div>
        </div>
        <div className="period-banner-right">
          <span className="days-badge">
            {currentBanner.daysLeft} {currentBanner.daysLeft === 1 ? "day" : "days"} left
          </span>
        </div>
      </div>

      <div className="podium">
        {["second", "first", "third"].map((slot, index) => {
          const row = podiumRows[index];
          if (!row) {
            return <div key={`podium-empty-${slot}`} className={`podium-card ${slot}`} aria-hidden="true" />;
          }

          const rank = slot === "first" ? 1 : slot === "second" ? 2 : 3;
          const barWidth = highestCommission > 0 ? Math.min((row.commission / highestCommission) * 100, 100) : 0;
          const amountClass = slot === "first" ? "podium-amount gold" : "podium-amount";
          const rankClass =
            slot === "first"
              ? "podium-rank gold"
              : slot === "second"
                ? "podium-rank silver"
                : "podium-rank bronze";
          const barColor =
            slot === "first"
              ? "var(--gold)"
              : slot === "second"
                ? "var(--silver)"
                : "var(--bronze)";

          return (
            <div key={`podium-${row.id}-${slot}`} className={`podium-card ${slot}`}>
              {slot === "first" ? <div className="podium-crown">\ud83d\udc51</div> : null}
              <div className={rankClass}>{formatRank(rank)}</div>
              <div className="podium-name">{row.name}</div>
              <div className="podium-team">{row.teamLabel}</div>
              <div className={amountClass}>{formatCurrency(row.commission)}</div>
              <div className="podium-period-label">This period</div>
              <div className="podium-stats">
                <div className="podium-stat">
                  <div className="podium-stat-val">{formatPercent(row.fpRate)}</div>
                  <div className="podium-stat-lab">FP Rate</div>
                </div>
                <div className="podium-stat">
                  <div className="podium-stat-val">{formatUnits(row.fpSold)}</div>
                  <div className="podium-stat-lab">FPs</div>
                </div>
              </div>
              <div className="podium-bar">
                <div className="podium-bar-fill" style={{ width: `${barWidth}%`, background: barColor }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="leaderboard-wrap">
        <div className="leaderboard-header">
          <div className="leaderboard-title">Full Rankings \u00b7 {periodLabel}</div>
          <div className="leaderboard-meta">
            {sortedRows.length} reps \u00b7 sorted by {SORTED_LABEL[sortColumn]}
          </div>
        </div>

        <table className="lb-table">
          <thead>
            <tr>
              {[
                { key: "name", label: "Rep" },
                { key: "commission", label: "Commission" },
                { key: "units", label: "Units" },
                { key: "fpRate", label: "FP Rate" },
                { key: "fpSold", label: "FPs Sold" },
                { key: "missedFpCommission", label: "Missed $" },
                { key: "vsLastPeriod", label: "vs Last Period" },
                { key: "status", label: "Status" },
              ].map((column) => {
                const isSorted = sortColumn === column.key;
                return (
                  <th
                    key={column.key}
                    onClick={() => toggleSort(column.key as SortColumn)}
                    className={isSorted ? `sorted ${sortDirection === "asc" ? "sorted-asc" : ""}` : ""}
                  >
                    {column.label}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "left", color: "var(--ink-3)" }}>
                  No reps yet.
                </td>
              </tr>
            ) : (
              sortedRows.map((row, index) => {
                const barWidth = highestCommission > 0 ? Math.min((row.commission / highestCommission) * 100, 100) : 0;
                const movement = row.vsLastPeriod;

                return (
                  <tr key={row.id} className={index === 0 ? "highlight" : ""}>
                    <td>
                      <div className="rank-cell">
                        {index === 0 ? (
                          <div className="rank-medal">\ud83e\udd47</div>
                        ) : index === 1 ? (
                          <div className="rank-medal">\ud83e\udd48</div>
                        ) : index === 2 ? (
                          <div className="rank-medal">\ud83e\udd49</div>
                        ) : (
                          <div className="rank-num rank-other">{formatRank(index + 1)}</div>
                        )}
                        <div className="rep-info">
                          <div className="rep-name-lb">{row.name}</div>
                          <div className="rep-team-lb">{row.teamLabel}</div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div
                        className={`val-primary ${
                          index === 0 ? "val-gold" : row.status === "behind" ? "val-red" : ""
                        }`}
                      >
                        {formatCurrency(row.commission)}
                      </div>
                      <div className="mini-bar-cell">
                        <div className="mini-bar">
                          <div
                            className="mini-bar-fill"
                            style={{
                              width: `${barWidth}%`,
                              background:
                                index === 0
                                  ? "var(--gold)"
                                  : row.status === "behind"
                                    ? "var(--red)"
                                    : undefined,
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="val-mono">{formatUnits(row.units)}</span>
                    </td>
                    <td>
                      <span className="val-mono">{formatPercent(row.fpRate)}</span>
                    </td>
                    <td>
                      <span className={`val-mono ${row.fpSold > 0 ? "val-green" : ""}`}>{formatUnits(row.fpSold)}</span>
                    </td>
                    <td>
                      <span className="val-mono val-amber">{formatCurrency(row.missedFpCommission)}</span>
                    </td>
                    <td>
                      {movement > 0 ? (
                        <div className="move move-up">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M12 19V5M5 12l7-7 7 7" />
                          </svg>
                          +{formatCurrency(movement)}
                        </div>
                      ) : movement < 0 ? (
                        <div className="move move-down">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M12 5v14M5 12l7 7 7-7" />
                          </svg>
                          -{formatCurrency(Math.abs(movement))}
                        </div>
                      ) : (
                        <div className="move move-same">\u2014 same</div>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge status-${row.status}`}>{statusLabel(row.status)}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=Syne:wght@400;500;600;700;800&display=swap');

        .manager-dashboard .leaderboard-view,
        .manager-dashboard .leaderboard-view *,
        .manager-dashboard .leaderboard-view *::before,
        .manager-dashboard .leaderboard-view *::after {
          box-sizing: border-box;
        }

        .manager-dashboard .leaderboard-view {
          --bg: #0e0f13;
          --surface: #16181f;
          --surface-2: #1e2028;
          --border: #272a33;
          --ink: #f2f3f5;
          --ink-2: #9098a8;
          --ink-3: #4a5060;
          --accent: #e05a20;
          --accent-2: #ff7a42;
          --green: #22c55e;
          --green-light: rgba(34, 197, 94, 0.1);
          --amber: #f59e0b;
          --amber-light: rgba(245, 158, 11, 0.1);
          --red: #ef4444;
          --red-light: rgba(239, 68, 68, 0.1);
          --gold: #f59e0b;
          --silver: #9098a8;
          --bronze: #cd7c3a;
        }

        .manager-dashboard .period-banner {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 16px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .manager-dashboard .period-banner-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .manager-dashboard .period-pulse {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--accent);
          animation: pulse 2s infinite;
          flex-shrink: 0;
        }

        .manager-dashboard .period-label {
          font-family: "DM Mono", monospace;
          font-size: 11px;
          color: var(--ink-3);
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .manager-dashboard .period-name {
          font-family: "Syne", sans-serif;
          font-size: 14px;
          font-weight: 600;
        }

        .manager-dashboard .period-banner-stats {
          display: flex;
          gap: 32px;
        }

        .manager-dashboard .period-banner-stat {
          text-align: right;
        }

        .manager-dashboard .period-banner-stat-value {
          font-family: "Instrument Serif", serif;
          font-size: 20px;
          letter-spacing: -0.5px;
        }

        .manager-dashboard .period-banner-stat-label {
          font-family: "DM Mono", monospace;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--ink-3);
        }

        .manager-dashboard .period-banner-right {
          font-family: "DM Mono", monospace;
          font-size: 11px;
          color: var(--ink-3);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .manager-dashboard .days-badge {
          background: rgba(224, 90, 32, 0.1);
          border: 1px solid rgba(224, 90, 32, 0.2);
          color: var(--accent);
          padding: 4px 10px;
          border-radius: 99px;
          font-size: 11px;
        }

        .manager-dashboard .podium {
          display: grid;
          grid-template-columns: 1fr 1.1fr 1fr;
          gap: 12px;
          margin-bottom: 24px;
          align-items: end;
        }

        .manager-dashboard .podium-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 24px 20px;
          text-align: center;
          position: relative;
          transition: all 0.15s;
          min-height: 276px;
        }

        .manager-dashboard .podium-card:hover {
          background: var(--surface-2);
        }

        .manager-dashboard .podium-card.first {
          border-color: rgba(245, 158, 11, 0.4);
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.06) 0%, var(--surface) 60%);
          padding-top: 32px;
        }

        .manager-dashboard .podium-card.second {
          border-color: rgba(144, 152, 168, 0.3);
        }

        .manager-dashboard .podium-card.third {
          border-color: rgba(205, 124, 58, 0.3);
        }

        .manager-dashboard .podium-crown {
          position: absolute;
          top: -14px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 22px;
          line-height: 1;
        }

        .manager-dashboard .podium-rank {
          font-family: "Instrument Serif", serif;
          font-size: 48px;
          letter-spacing: -2px;
          line-height: 1;
          margin-bottom: 4px;
        }

        .manager-dashboard .podium-rank.gold {
          color: var(--gold);
        }

        .manager-dashboard .podium-rank.silver {
          color: var(--silver);
        }

        .manager-dashboard .podium-rank.bronze {
          color: var(--bronze);
        }

        .manager-dashboard .podium-name {
          font-family: "Syne", sans-serif;
          font-size: 15px;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .manager-dashboard .podium-team {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          color: var(--ink-3);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 14px;
        }

        .manager-dashboard .podium-amount {
          font-family: "Instrument Serif", serif;
          font-size: 28px;
          letter-spacing: -0.5px;
          margin-bottom: 2px;
        }

        .manager-dashboard .podium-amount.gold {
          color: var(--gold);
        }

        .manager-dashboard .podium-period-label {
          font-family: "DM Mono", monospace;
          font-size: 9px;
          color: var(--ink-3);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 12px;
        }

        .manager-dashboard .podium-stats {
          display: flex;
          justify-content: center;
          gap: 16px;
        }

        .manager-dashboard .podium-stat-val {
          font-family: "DM Mono", monospace;
          font-size: 12px;
          color: var(--ink-2);
        }

        .manager-dashboard .podium-stat-lab {
          font-family: "DM Mono", monospace;
          font-size: 9px;
          color: var(--ink-3);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .manager-dashboard .podium-bar {
          height: 3px;
          background: var(--border);
          border-radius: 99px;
          margin-top: 14px;
          overflow: hidden;
        }

        .manager-dashboard .podium-bar-fill {
          height: 100%;
          border-radius: 99px;
        }

        .manager-dashboard .leaderboard-wrap {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
        }

        .manager-dashboard .leaderboard-header {
          padding: 16px 24px;
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .manager-dashboard .leaderboard-title {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--ink-3);
        }

        .manager-dashboard .leaderboard-meta {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          color: var(--ink-3);
        }

        .manager-dashboard .lb-table {
          width: 100%;
          border-collapse: collapse;
        }

        .manager-dashboard .lb-table thead tr {
          border-bottom: 1px solid var(--border);
        }

        .manager-dashboard .lb-table th {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--ink-3);
          padding: 12px 20px;
          text-align: right;
          font-weight: 400;
          cursor: pointer;
          transition: color 0.15s;
          user-select: none;
        }

        .manager-dashboard .lb-table th:first-child {
          text-align: left;
        }

        .manager-dashboard .lb-table th:hover {
          color: var(--ink-2);
        }

        .manager-dashboard .lb-table th.sorted {
          color: var(--accent);
        }

        .manager-dashboard .lb-table th.sorted::after {
          content: " \\2193";
        }

        .manager-dashboard .lb-table th.sorted.sorted-asc::after {
          content: " \\2191";
        }

        .manager-dashboard .lb-table tbody tr {
          border-bottom: 1px solid rgba(39, 42, 51, 0.6);
          transition: background 0.1s;
          cursor: pointer;
        }

        .manager-dashboard .lb-table tbody tr:last-child {
          border-bottom: none;
        }

        .manager-dashboard .lb-table tbody tr:hover {
          background: var(--surface-2);
        }

        .manager-dashboard .lb-table tbody tr.highlight {
          background: rgba(245, 158, 11, 0.04);
        }

        .manager-dashboard .lb-table td {
          padding: 16px 20px;
          text-align: right;
        }

        .manager-dashboard .lb-table td:first-child {
          text-align: left;
        }

        .manager-dashboard .rank-cell {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .manager-dashboard .rank-num {
          font-family: "DM Mono", monospace;
          font-size: 13px;
          width: 28px;
          text-align: center;
          flex-shrink: 0;
        }

        .manager-dashboard .rank-other {
          color: var(--ink-3);
        }

        .manager-dashboard .rank-medal {
          font-size: 14px;
          width: 28px;
          text-align: center;
          flex-shrink: 0;
        }

        .manager-dashboard .rep-name-lb {
          font-family: "Syne", sans-serif;
          font-size: 14px;
          font-weight: 600;
        }

        .manager-dashboard .rep-team-lb {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          color: var(--ink-3);
          margin-top: 1px;
        }

        .manager-dashboard .val-primary {
          font-family: "Instrument Serif", serif;
          font-size: 18px;
          letter-spacing: -0.3px;
        }

        .manager-dashboard .val-mono {
          font-family: "DM Mono", monospace;
          font-size: 12px;
          color: var(--ink-2);
        }

        .manager-dashboard .val-gold {
          color: var(--gold);
        }

        .manager-dashboard .val-green {
          color: var(--green);
        }

        .manager-dashboard .val-amber {
          color: var(--amber);
        }

        .manager-dashboard .val-red {
          color: var(--red);
        }

        .manager-dashboard .mini-bar-cell {
          min-width: 100px;
        }

        .manager-dashboard .mini-bar {
          height: 3px;
          background: var(--border);
          border-radius: 99px;
          overflow: hidden;
          margin-top: 4px;
        }

        .manager-dashboard .mini-bar-fill {
          height: 100%;
          border-radius: 99px;
          background: var(--accent);
        }

        .manager-dashboard .status-badge {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          font-weight: 500;
          padding: 3px 10px;
          border-radius: 99px;
          white-space: nowrap;
        }

        .manager-dashboard .status-strong {
          background: var(--green-light);
          color: var(--green);
        }

        .manager-dashboard .status-average {
          background: var(--amber-light);
          color: var(--amber);
        }

        .manager-dashboard .status-behind {
          background: var(--red-light);
          color: var(--red);
        }

        .manager-dashboard .move {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          display: flex;
          align-items: center;
          gap: 3px;
          justify-content: flex-end;
        }

        .manager-dashboard .move-up {
          color: var(--green);
        }

        .manager-dashboard .move-down {
          color: var(--red);
        }

        .manager-dashboard .move-same {
          color: var(--ink-3);
        }

        @media (max-width: 1024px) {
          .manager-dashboard .period-banner {
            flex-wrap: wrap;
            gap: 14px;
          }

          .manager-dashboard .period-banner-stats {
            gap: 20px;
          }
        }

        @media (max-width: 880px) {
          .manager-dashboard .podium {
            grid-template-columns: 1fr;
          }

          .manager-dashboard .lb-table {
            min-width: 920px;
          }
        }

        @media (max-width: 640px) {
          .manager-dashboard .period-banner {
            padding: 14px 16px;
          }

          .manager-dashboard .period-banner-stats {
            width: 100%;
            justify-content: space-between;
            gap: 10px;
          }

          .manager-dashboard .leaderboard-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 6px;
          }
        }
      `}</style>
    </div>
  );
}
