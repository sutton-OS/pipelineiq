"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getRepStats, parseStoredRepData } from "@/lib/rep-sync";
import { repsStore, type Rep } from "@/lib/reps-store";

type SortColumn =
  | "rank"
  | "name"
  | "commission"
  | "units"
  | "fpRate"
  | "fpSold"
  | "missedFpCommission"
  | "status";
type SortDirection = "asc" | "desc";
type StatusLevel = "Strong" | "Average" | "Behind";

type TeamRepRow = {
  id: string;
  name: string;
  team: string;
  commission: number;
  units: number;
  fpRate: number;
  fpSold: number;
  missedFpCommission: number;
  status: StatusLevel;
};

type ChartSeries = {
  name: string;
  color: string;
  values: number[];
};

const SERIES_COLORS = [
  "#c8491a",
  "#1a4fa0",
  "#1a6e3c",
  "#7f56d9",
  "#b54708",
  "#0e7090",
  "#a435f0",
  "#ca8504",
];

function readTeamName(value: string | string[] | undefined) {
  if (Array.isArray(value)) return decodeURIComponent(value[0] ?? "");
  return decodeURIComponent(value ?? "");
}

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

function formatPercent(value: number, decimals = 1) {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)}%`;
}

function parsePeriodLabelToTimestamp(label: string) {
  const direct = Date.parse(label);
  if (!Number.isNaN(direct)) return direct;

  const monthDay = label.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (monthDay) {
    const month = Number.parseInt(monthDay[1], 10);
    const day = Number.parseInt(monthDay[2], 10);
    const yearToken = monthDay[3];
    const year = yearToken
      ? yearToken.length === 2
        ? 2000 + Number.parseInt(yearToken, 10)
        : Number.parseInt(yearToken, 10)
      : new Date().getFullYear();
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && Number.isFinite(year)) {
      return new Date(year, month - 1, day).getTime();
    }
  }

  return Number.POSITIVE_INFINITY;
}

function formatPayPeriodShortLabel(label: string) {
  const parsed = parsePeriodLabelToTimestamp(label);
  if (Number.isFinite(parsed)) {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(parsed);
  }
  return label.length > 11 ? `${label.slice(0, 11)}...` : label;
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

function StatusBadge({ status }: { status: StatusLevel }) {
  const style =
    status === "Strong"
      ? "border-[#1a6e3c]/35 bg-[#e6f4ec] text-[#1a6e3c]"
      : status === "Average"
        ? "border-[#b07d00]/35 bg-[#fdf4d8] text-[#b07d00]"
        : "border-[#d92d20]/35 bg-[#fde8e8] text-[#d92d20]";

  return (
    <span
      className={`inline-flex h-7 min-w-[76px] items-center justify-center rounded-full border px-3 text-xs font-semibold ${style}`}
    >
      {status}
    </span>
  );
}

function TrendChart({
  labels,
  series,
  title,
  subtitle,
  showLegend = true,
}: {
  labels: string[];
  series: ChartSeries[];
  title: string;
  subtitle?: string;
  showLegend?: boolean;
}) {
  if (labels.length === 0 || series.length === 0) {
    return (
      <section className="rounded-xl border border-[var(--border)] bg-[var(--paper-2)] p-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">{title}</h3>
        <p className="mt-8 rounded-lg border border-dashed border-[var(--border)] py-10 text-center text-sm text-[var(--ink-3)]">
          No pay period trend data found.
        </p>
      </section>
    );
  }

  const W = 860;
  const H = 220;
  const PAD = { top: 12, right: 24, bottom: 34, left: 56 };
  const allValues = series.flatMap((item) => item.values);
  const minValue = allValues.length > 0 ? Math.min(...allValues) : 0;
  const maxValue = allValues.length > 0 ? Math.max(...allValues) : 0;
  const range = Math.max(maxValue - minValue, 1);
  const xStep = labels.length > 1 ? (W - PAD.left - PAD.right) / (labels.length - 1) : 0;

  const pointsBySeries = series.map((item) => {
    const points = item.values.map((value, index) => {
      const x = PAD.left + index * xStep;
      const y = PAD.top + (H - PAD.top - PAD.bottom) * (1 - (value - minValue) / range);
      return { x, y, value };
    });
    return { ...item, points, path: buildSmoothLinePath(points) };
  });

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--paper-2)] p-5">
      <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">{title}</h3>
      {subtitle ? <p className="mt-1 text-xs text-[var(--ink-2)]">{subtitle}</p> : null}

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[760px]">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} className="h-[220px] w-full">
            {Array.from({ length: 5 }, (_, index) => {
              const ratio = index / 4;
              const y = PAD.top + (H - PAD.top - PAD.bottom) * ratio;
              const value = maxValue - (maxValue - minValue) * ratio;

              return (
                <g key={`grid-${index}`}>
                  <line
                    x1={formatSvgNumber(PAD.left)}
                    y1={formatSvgNumber(y)}
                    x2={formatSvgNumber(W - PAD.right)}
                    y2={formatSvgNumber(y)}
                    stroke="var(--paper-3)"
                    strokeWidth="1"
                  />
                  <text
                    x={formatSvgNumber(PAD.left - 10)}
                    y={formatSvgNumber(y + 3)}
                    textAnchor="end"
                    fill="var(--ink-3)"
                    style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}
                  >
                    {formatCurrency(value)}
                  </text>
                </g>
              );
            })}

            {pointsBySeries.map((item) => (
              <g key={item.name}>
                <path d={item.path} fill="none" stroke={item.color} strokeWidth="2.5" strokeLinecap="round" />
                {item.points.map((point, index) => (
                  <circle
                    key={`${item.name}-${index}`}
                    cx={formatSvgNumber(point.x)}
                    cy={formatSvgNumber(point.y)}
                    r="3"
                    fill={item.color}
                    stroke="#ffffff"
                    strokeWidth="1"
                  />
                ))}
              </g>
            ))}

            {labels.map((label, index) => {
              const x = PAD.left + index * xStep;
              return (
                <text
                  key={`x-${label}-${index}`}
                  x={formatSvgNumber(x)}
                  y={formatSvgNumber(H - 10)}
                  textAnchor="middle"
                  fill="var(--ink-3)"
                  style={{ fontFamily: "var(--font-mono)", fontSize: "9px" }}
                >
                  {formatPayPeriodShortLabel(label)}
                </text>
              );
            })}
          </svg>
        </div>
      </div>

      {showLegend ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {series.map((item) => (
            <span
              key={`legend-${item.name}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--paper)] px-2.5 py-1 text-xs text-[var(--ink-2)]"
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {item.name}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default function TeamSummaryPage() {
  const params = useParams<{ teamName: string }>();
  const teamName = readTeamName(params.teamName).trim();
  const [reps, setReps] = useState<Rep[]>(() => repsStore.getAll());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [sortColumn, setSortColumn] = useState<SortColumn>("commission");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useEffect(() => {
    const onStorage = () => setReps(repsStore.getAll());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const teamReps = useMemo(() => {
    return reps.filter((rep) => {
      const repTeam = rep.team.trim();
      return repTeam.localeCompare(teamName, undefined, { sensitivity: "accent" }) === 0;
    });
  }, [reps, teamName]);

  const availableYears = useMemo(() => {
    const years = teamReps.flatMap((rep) => {
      const data = parseStoredRepData(rep.data);
      return (data?.payPeriods ?? [])
        .map((period) => period.year)
        .filter((year): year is number => typeof year === "number");
    });
    return [...new Set(years)].sort((a, b) => a - b);
  }, [teamReps]);

  const activeYear =
    availableYears.length === 0
      ? selectedYear
      : availableYears.includes(selectedYear)
        ? selectedYear
        : availableYears[availableYears.length - 1];

  const teamRows = useMemo<TeamRepRow[]>(() => {
    if (teamReps.length === 0) return [];

    const statsRows = teamReps.map((rep) => {
      const stats = getRepStats(parseStoredRepData(rep.data), activeYear);
      return {
        id: rep.id,
        name: rep.name,
        team: rep.team.trim(),
        commission: stats.commission,
        units: stats.units,
        fpRate: stats.fpRate,
        fpSold: stats.fpSold,
        missedFpCommission: stats.missedFpCommission,
        status: "Average" as StatusLevel,
      };
    });

    const averageCommission =
      statsRows.length > 0
        ? statsRows.reduce((sum, row) => sum + row.commission, 0) / statsRows.length
        : 0;

    return statsRows.map((row) => {
      const status: StatusLevel =
        row.commission > averageCommission
          ? "Strong"
          : row.commission >= averageCommission * 0.8
            ? "Average"
            : "Behind";
      return { ...row, status };
    });
  }, [activeYear, teamReps]);

  const sortedRows = useMemo(() => {
    const next = [...teamRows];
    const statusRank: Record<StatusLevel, number> = {
      Strong: 3,
      Average: 2,
      Behind: 1,
    };

    next.sort((a, b) => {
      let delta = 0;
      if (sortColumn === "rank" || sortColumn === "commission") {
        delta = b.commission - a.commission;
      } else if (sortColumn === "name") {
        delta = a.name.localeCompare(b.name);
      } else if (sortColumn === "units") {
        delta = b.units - a.units;
      } else if (sortColumn === "fpRate") {
        delta = b.fpRate - a.fpRate;
      } else if (sortColumn === "fpSold") {
        delta = b.fpSold - a.fpSold;
      } else if (sortColumn === "missedFpCommission") {
        delta = b.missedFpCommission - a.missedFpCommission;
      } else if (sortColumn === "status") {
        delta = statusRank[b.status] - statusRank[a.status];
      }

      if (delta === 0) {
        delta = a.name.localeCompare(b.name);
      }

      return sortDirection === "desc" ? delta : -delta;
    });

    return next;
  }, [sortColumn, sortDirection, teamRows]);

  const aggregate = useMemo(() => {
    const totalTeamCommission = teamRows.reduce((sum, row) => sum + row.commission, 0);
    const totalTeamUnits = teamRows.reduce((sum, row) => sum + row.units, 0);
    const avgFPRate =
      teamRows.length > 0 ? teamRows.reduce((sum, row) => sum + row.fpRate, 0) / teamRows.length : 0;
    const topEarner =
      teamRows.reduce<TeamRepRow | null>((best, row) => {
        if (!best || row.commission > best.commission) return row;
        return best;
      }, null) ?? null;
    const mostFPs =
      teamRows.reduce<TeamRepRow | null>((best, row) => {
        if (!best || row.fpSold > best.fpSold) return row;
        return best;
      }, null) ?? null;

    return {
      totalTeamCommission,
      totalTeamUnits,
      avgFPRate,
      topEarner,
      mostFPs,
      averageCommission: teamRows.length > 0 ? totalTeamCommission / teamRows.length : 0,
    };
  }, [teamRows]);

  const trendData = useMemo(() => {
    const labelsSet = new Set<string>();
    const perRepMap = new Map<string, Map<string, number>>();

    for (const rep of teamReps) {
      const data = parseStoredRepData(rep.data);
      const periods = (data?.payPeriods ?? []).filter((period) => period.year === activeYear);
      const map = new Map<string, number>();

      for (const period of periods) {
        labelsSet.add(period.label);
        map.set(period.label, (map.get(period.label) ?? 0) + period.amount);
      }

      perRepMap.set(rep.id, map);
    }

    const labels = Array.from(labelsSet).sort((a, b) => {
      const left = parsePeriodLabelToTimestamp(a);
      const right = parsePeriodLabelToTimestamp(b);
      if (Number.isFinite(left) && Number.isFinite(right) && left !== right) {
        return left - right;
      }
      return a.localeCompare(b);
    });

    const teamTotals = labels.map((label) => {
      let total = 0;
      for (const rep of teamReps) {
        total += perRepMap.get(rep.id)?.get(label) ?? 0;
      }
      return total;
    });

    const perRepSeries: ChartSeries[] = teamReps.map((rep, index) => {
      const rowValues = labels.map((label) => perRepMap.get(rep.id)?.get(label) ?? 0);
      return {
        name: rep.name,
        color: SERIES_COLORS[index % SERIES_COLORS.length],
        values: rowValues,
      };
    });

    return {
      labels,
      teamSeries: [{ name: "Team Total", color: "#c8491a", values: teamTotals }],
      repSeries: perRepSeries,
    };
  }, [activeYear, teamReps]);

  function toggleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }
    setSortColumn(column);
    setSortDirection(column === "name" ? "asc" : "desc");
  }

  if (teamReps.length === 0) {
    return (
      <section className="mx-auto max-w-6xl rounded-xl border border-[var(--border)] bg-[var(--paper-2)] p-6">
        <p className="text-sm uppercase tracking-[0.08em] text-[var(--ink-3)]">Manager View</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--ink)]">Team not found</h1>
        <p className="mt-2 text-sm text-[var(--ink-2)]">
          No reps are currently assigned to this team.
        </p>
        <Link
          href="/manager"
          className="mt-4 inline-flex rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--paper-3)]"
        >
          Back to Team Dashboard
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <header className="rounded-xl border border-[var(--border)] bg-[var(--paper-2)] px-5 py-4">
        <p className="text-xs uppercase tracking-[0.08em] text-[var(--ink-3)]">
          <Link href="/manager" className="hover:text-[var(--ink)]">
            Team Dashboard
          </Link>{" "}
          / {teamName}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-[var(--ink)]">{teamName} Team Summary</h1>
          {availableYears.length > 0 ? (
            <div className="inline-flex overflow-hidden rounded-md border border-[var(--border)]">
              {availableYears.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => setSelectedYear(year)}
                  className={`px-4 py-2 text-xs font-medium ${
                    activeYear === year
                      ? "bg-[var(--ink)] text-[var(--paper)]"
                      : "text-[var(--ink-2)] hover:bg-[var(--paper-3)]"
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-xl border border-[var(--border)] bg-[var(--paper-2)] p-4">
          <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--ink-3)]">Total Team Commission</p>
          <p className="mt-2 font-mono text-2xl text-[var(--ink)]">{formatCurrency(aggregate.totalTeamCommission)}</p>
        </article>
        <article className="rounded-xl border border-[var(--border)] bg-[var(--paper-2)] p-4">
          <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--ink-3)]">Total Team Units</p>
          <p className="mt-2 font-mono text-2xl text-[var(--ink)]">{formatUnits(aggregate.totalTeamUnits)}</p>
        </article>
        <article className="rounded-xl border border-[var(--border)] bg-[var(--paper-2)] p-4">
          <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--ink-3)]">Avg FP Attach Rate</p>
          <p className="mt-2 font-mono text-2xl text-[var(--ink)]">{formatPercent(aggregate.avgFPRate)}</p>
        </article>
        <article className="rounded-xl border border-[var(--border)] bg-[var(--paper-2)] p-4">
          <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--ink-3)]">Top Earner</p>
          <p className="mt-2 text-lg font-semibold text-[var(--ink)]">{aggregate.topEarner?.name ?? "-"}</p>
          <p className="text-sm text-[var(--ink-2)]">
            {aggregate.topEarner ? formatCurrency(aggregate.topEarner.commission) : "-"}
          </p>
        </article>
        <article className="rounded-xl border border-[var(--border)] bg-[var(--paper-2)] p-4">
          <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--ink-3)]">Most FPs</p>
          <p className="mt-2 text-lg font-semibold text-[var(--ink)]">{aggregate.mostFPs?.name ?? "-"}</p>
          <p className="text-sm text-[var(--ink-2)]">
            {aggregate.mostFPs ? `${aggregate.mostFPs.fpSold} sold` : "-"}
          </p>
        </article>
      </div>

      <TrendChart
        labels={trendData.labels}
        series={trendData.teamSeries}
        title="Pay Period Trend (Team Total)"
        subtitle="Combined team commission per pay period"
        showLegend={false}
      />

      <TrendChart
        labels={trendData.labels}
        series={trendData.repSeries}
        title="Rep Trend Comparison"
        subtitle="One line per rep to compare momentum over time"
      />

      <section className="rounded-xl border border-[var(--border)] bg-[var(--paper-2)] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">
            Rep Comparison
          </h2>
          <p className="text-xs text-[var(--ink-2)]">
            Team avg commission: <span className="font-mono text-[var(--ink)]">{formatCurrency(aggregate.averageCommission)}</span>
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[940px] w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-left">
                {[
                  { key: "rank", label: "Rank" },
                  { key: "name", label: "Rep Name" },
                  { key: "commission", label: "Commission" },
                  { key: "units", label: "Units" },
                  { key: "fpRate", label: "FP Rate" },
                  { key: "fpSold", label: "FP Sold" },
                  { key: "missedFpCommission", label: "Missed FP Commission" },
                  { key: "status", label: "Status" },
                ].map((column) => (
                  <th key={column.key} className="py-2 pr-3">
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key as SortColumn)}
                      className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.08em] text-[var(--ink-3)] hover:text-[var(--ink)]"
                    >
                      {column.label}
                      {sortColumn === column.key ? (
                        <span>{sortDirection === "desc" ? "↓" : "↑"}</span>
                      ) : null}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, index) => (
                <tr key={row.id} className="border-b border-[var(--border)]/70 text-sm">
                  <td className="py-2 pr-3 font-mono text-[var(--ink-2)]">{index + 1}</td>
                  <td className="py-2 pr-3">
                    <Link href={`/manager/${row.id}`} className="font-medium text-[var(--ink)] hover:underline">
                      {row.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 font-mono text-[var(--ink)]">{formatCurrency(row.commission)}</td>
                  <td className="py-2 pr-3 font-mono text-[var(--ink)]">{formatUnits(row.units)}</td>
                  <td className="py-2 pr-3 font-mono text-[var(--ink)]">{formatPercent(row.fpRate)}</td>
                  <td className="py-2 pr-3 font-mono text-[var(--ink)]">{row.fpSold}</td>
                  <td className="py-2 pr-3 font-mono text-[var(--ink)]">{formatCurrency(row.missedFpCommission)}</td>
                  <td className="py-2 pr-3">
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
