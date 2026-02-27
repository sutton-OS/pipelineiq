"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Leaderboard, type LeaderboardPeriod } from "@/components/Leaderboard";
import { repsStore, type Rep } from "@/lib/reps-store";
import {
  FP_COMMISSION_PER_MISSED,
  fetchAndParseSheet,
  getRepStats,
  parseStoredRepData,
} from "@/lib/rep-sync";

const YEAR_OPTIONS = [2025, 2026] as const;
const PERIOD_COMMISSION_GOAL = 1000;

type SortOption = "commission" | "units" | "fpRate" | "name" | "lastSynced";
type RosterView = "team" | "all" | "leaderboard";
type SyncChipStatus = "pending" | "syncing" | "done" | "error";
type Half = "first" | "second";

type TransactionRow = {
  year: number | null;
  transactionDate?: string | null;
  commission: number;
  units: number;
  hasTrainer: boolean;
  inCurrentPayPeriod: boolean;
};

type CardMetrics = {
  periodCommission: number;
  monthUnits: number;
  fpRate: number;
  fpSold: number;
  missedFpCommission: number;
  periodLabel: string;
  monthLabel: string;
};

type RepCardData = Rep & {
  teamLabel: string;
  syncedAt: number;
  stats: ReturnType<typeof getRepStats>;
  cardMetrics: CardMetrics;
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

function formatLastSyncedStatus(value: string) {
  if (!value) return "never";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "never";
  const minutesAgo = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutesAgo < 1) return "just now";
  if (minutesAgo < 60) return `${minutesAgo} min ago`;
  const hours = Math.floor(minutesAgo / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function buildRepId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `rep-${Date.now()}`;
}

function formatRank(index: number) {
  return String(index + 1).padStart(2, "0");
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

function formatShortPeriodLabel(start: Date, end: Date) {
  const month = start.toLocaleString("en-US", { month: "short" });
  return `${month} ${start.getDate()}\u2013${end.getDate()}`;
}

function getRangeMetrics(
  rows: TransactionRow[],
  start: Date,
  end: Date,
  allowFallbackCurrentPeriod: boolean,
  fallbackYear: number
) {
  let commission = 0;
  let sales = 0;
  let fpSold = 0;

  for (const row of rows) {
    const rowDate = parseDay(row.transactionDate ?? null);

    let include = false;
    if (rowDate) {
      include = inRange(rowDate, start, end);
    } else if (allowFallbackCurrentPeriod && row.inCurrentPayPeriod && row.year === fallbackYear) {
      include = true;
    }

    if (!include) continue;

    const rowCommission = Number.isFinite(row.commission) ? row.commission : 0;
    commission += rowCommission;

    if (rowCommission > 0) {
      sales += 1;
      if (row.hasTrainer) fpSold += 1;
    }
  }

  const fpRate = sales > 0 ? (fpSold / sales) * 100 : 0;
  const missedFpCommission = Math.max(sales - fpSold, 0) * FP_COMMISSION_PER_MISSED;

  return {
    commission,
    units: sales,
    fpRate,
    fpSold,
    missedFpCommission,
  };
}

export function RepRoster() {
  const [reps, setReps] = useState<Rep[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [sortBy, setSortBy] = useState<SortOption>("commission");
  const [viewMode, setViewMode] = useState<RosterView>("team");
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<LeaderboardPeriod>("full");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [repName, setRepName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncStartedAt, setSyncStartedAt] = useState<string | null>(null);
  const [syncCompletedCount, setSyncCompletedCount] = useState(0);
  const [syncChipStatuses, setSyncChipStatuses] = useState<Record<string, SyncChipStatus>>({});
  const [lastSyncedAt, setLastSyncedAt] = useState<string>("");
  const [timeTick, setTimeTick] = useState(0);

  useEffect(() => {
    const nowYear = new Date().getFullYear();
    if (nowYear === 2025 || nowYear === 2026) setSelectedYear(nowYear);

    const initialReps = repsStore.getAll();
    setReps(initialReps);
    setLastSyncedAt(
      initialReps.reduce((latest, rep) => {
        if (!rep.lastSynced) return latest;
        if (!latest) return rep.lastSynced;
        return Date.parse(rep.lastSynced) > Date.parse(latest) ? rep.lastSynced : latest;
      }, "")
    );

    const onStorage = () => {
      const nextReps = repsStore.getAll();
      setReps(nextReps);
      setLastSyncedAt(
        nextReps.reduce((latest, rep) => {
          if (!rep.lastSynced) return latest;
          if (!latest) return rep.lastSynced;
          return Date.parse(rep.lastSynced) > Date.parse(latest) ? rep.lastSynced : latest;
        }, "")
      );
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTimeTick((tick) => tick + 1);
    }, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!dialogOpen) return;

    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDialogOpen(false);
        setFormError(null);
      }
    };

    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [dialogOpen]);

  const teams = useMemo(() => {
    const seen = new Set<string>();
    for (const rep of reps) {
      const team = rep.team.trim();
      if (team) seen.add(team);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [reps]);

  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const currentMonthIndex = today.getMonth();
  const currentHalf: Half = today.getDate() <= 15 ? "first" : "second";
  const selectedHalf: Half = leaderboardPeriod === "full" ? currentHalf : leaderboardPeriod === "firstHalf" ? "first" : "second";
  const selectedPeriodRange = useMemo(
    () => getHalfRange(currentYear, currentMonthIndex, selectedHalf),
    [currentMonthIndex, currentYear, selectedHalf]
  );
  const currentMonthRange = useMemo(
    () => ({
      start: new Date(currentYear, currentMonthIndex, 1),
      end: new Date(currentYear, currentMonthIndex + 1, 0),
    }),
    [currentMonthIndex, currentYear]
  );
  const periodLabel = useMemo(
    () => formatShortPeriodLabel(selectedPeriodRange.start, selectedPeriodRange.end),
    [selectedPeriodRange]
  );
  const monthLabel = useMemo(
    () => selectedPeriodRange.start.toLocaleString("en-US", { month: "long" }),
    [selectedPeriodRange]
  );

  const repsWithStats = useMemo<RepCardData[]>(() => {
    return reps.map((rep) => {
      const teamLabel = rep.team.trim() || "Unassigned";
      const syncedAt = Date.parse(rep.lastSynced);
      const parsedData = parseStoredRepData(rep.data);
      const transactionRows = ((parsedData?.transactionRows ?? []) as TransactionRow[]);
      const periodMetrics = getRangeMetrics(
        transactionRows,
        selectedPeriodRange.start,
        selectedPeriodRange.end,
        selectedHalf === currentHalf,
        currentYear
      );
      const monthMetrics = getRangeMetrics(
        transactionRows,
        currentMonthRange.start,
        currentMonthRange.end,
        true,
        currentYear
      );

      return {
        ...rep,
        teamLabel,
        syncedAt: Number.isNaN(syncedAt) ? 0 : syncedAt,
        stats: getRepStats(parsedData, selectedYear),
        cardMetrics: {
          periodCommission: periodMetrics.commission,
          monthUnits: monthMetrics.units,
          fpRate: monthMetrics.fpRate,
          fpSold: monthMetrics.fpSold,
          missedFpCommission: monthMetrics.missedFpCommission,
          periodLabel,
          monthLabel,
        },
      };
    });
  }, [
    reps,
    selectedYear,
    selectedPeriodRange,
    selectedHalf,
    currentHalf,
    currentYear,
    currentMonthRange,
    periodLabel,
    monthLabel,
  ]);

  const sortedReps = useMemo(() => {
    const next = [...repsWithStats];
    next.sort((a, b) => {
      if (sortBy === "commission") {
        return b.cardMetrics.periodCommission - a.cardMetrics.periodCommission || a.name.localeCompare(b.name);
      }
      if (sortBy === "units") {
        return b.cardMetrics.monthUnits - a.cardMetrics.monthUnits || a.name.localeCompare(b.name);
      }
      if (sortBy === "fpRate") {
        return b.cardMetrics.fpRate - a.cardMetrics.fpRate || a.name.localeCompare(b.name);
      }
      if (sortBy === "lastSynced") {
        return b.syncedAt - a.syncedAt || a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
    return next;
  }, [repsWithStats, sortBy]);

  const repsByPeriodCommission = useMemo(() => {
    const next = [...repsWithStats];
    next.sort(
      (a, b) => b.cardMetrics.periodCommission - a.cardMetrics.periodCommission || a.name.localeCompare(b.name)
    );
    return next;
  }, [repsWithStats]);

  const groupedByTeam = useMemo(() => {
    const groups = new Map<string, RepCardData[]>();

    for (const rep of sortedReps) {
      const existing = groups.get(rep.teamLabel);
      if (existing) {
        existing.push(rep);
      } else {
        groups.set(rep.teamLabel, [rep]);
      }
    }

    return Array.from(groups.entries())
      .map(([team, members]) => {
        const teamCommission = members.reduce((sum, member) => sum + member.cardMetrics.periodCommission, 0);
        const averageFpRate =
          members.length > 0
            ? members.reduce((sum, member) => sum + member.cardMetrics.fpRate, 0) / members.length
            : 0;
        return { team, members, teamCommission, averageFpRate };
      })
      .sort((a, b) => a.team.localeCompare(b.team));
  }, [sortedReps]);

  const totalTeamCommission = useMemo(
    () => sortedReps.reduce((sum, rep) => sum + rep.stats.commission, 0),
    [sortedReps]
  );

  const totalUnits = useMemo(
    () => sortedReps.reduce((sum, rep) => sum + rep.stats.units, 0),
    [sortedReps]
  );

  const averageTeamFpRate = useMemo(() => {
    if (sortedReps.length === 0) return 0;
    return sortedReps.reduce((sum, rep) => sum + rep.stats.fpRate, 0) / sortedReps.length;
  }, [sortedReps]);

  const totalMissedCommission = useMemo(
    () => sortedReps.reduce((sum, rep) => sum + rep.stats.missedFpCommission, 0),
    [sortedReps]
  );

  const rankByRepId = useMemo(() => {
    const ranks = new Map<string, number>();
    repsByPeriodCommission.forEach((rep, index) => {
      ranks.set(rep.id, index);
    });
    return ranks;
  }, [repsByPeriodCommission]);

  const syncProgressPercent = useMemo(() => {
    if (reps.length === 0) return 0;
    return Math.min((syncCompletedCount / reps.length) * 100, 100);
  }, [reps.length, syncCompletedCount]);

  const syncStatusLabel = useMemo(() => {
    void timeTick;
    return formatLastSyncedStatus(lastSyncedAt || syncStartedAt || "");
  }, [lastSyncedAt, syncStartedAt, timeTick]);

  function resetForm() {
    setRepName("");
    setTeamName("");
    setSheetUrl("");
    setFormError(null);
  }

  function openAddDialog() {
    resetForm();
    setDialogOpen(true);
  }

  function closeAddDialog() {
    setDialogOpen(false);
    setFormError(null);
  }

  async function handleSaveAndSync(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    const nextName = repName.trim();
    const nextTeam = teamName.trim();
    const nextSheetUrl = sheetUrl.trim();

    if (!nextName || !nextTeam || !nextSheetUrl) {
      setFormError("Rep name, team, and Google Sheets URL are required.");
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const parsed = await fetchAndParseSheet(nextSheetUrl);
      const nowIso = new Date().toISOString();

      repsStore.save({
        id: buildRepId(),
        name: nextName,
        team: nextTeam,
        sheetUrl: nextSheetUrl,
        lastSynced: nowIso,
        data: parsed,
      });

      const nextReps = repsStore.getAll();
      setReps(nextReps);
      setLastSyncedAt(nowIso);
      closeAddDialog();
      resetForm();
      toast.success("Rep added and synced.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to sync sheet.";
      setFormError(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSyncAll() {
    if (isSyncingAll || reps.length === 0) return;

    const repsSnapshot = repsStore.getAll();
    if (repsSnapshot.length === 0) return;

    setIsSyncingAll(true);
    setSyncStartedAt(new Date().toISOString());
    setSyncCompletedCount(0);
    setSyncChipStatuses(
      Object.fromEntries(repsSnapshot.map((rep) => [rep.id, "syncing" as SyncChipStatus]))
    );

    const syncTasks = repsSnapshot.map(async (rep) => {
      try {
        const parsed = await fetchAndParseSheet(rep.sheetUrl);
        repsStore.update(rep.id, {
          data: parsed,
          lastSynced: new Date().toISOString(),
        });

        setSyncChipStatuses((current) => ({ ...current, [rep.id]: "done" }));
      } catch {
        setSyncChipStatuses((current) => ({ ...current, [rep.id]: "error" }));
      } finally {
        setSyncCompletedCount((count) => count + 1);
      }
    });

    await Promise.all(syncTasks);

    const syncedAtIso = new Date().toISOString();
    const nextReps = repsStore.getAll();
    setReps(nextReps);
    setLastSyncedAt(syncedAtIso);
    setIsSyncingAll(false);
    setSyncStartedAt(null);
    toast.success("Sync complete.");
  }

  function renderRepCard(rep: RepCardData, showTeamBadge: boolean) {
    const rank = rankByRepId.get(rep.id) ?? 0;
    const commissionBarPercent =
      PERIOD_COMMISSION_GOAL > 0
        ? Math.min((Math.max(rep.cardMetrics.periodCommission, 0) / PERIOD_COMMISSION_GOAL) * 100, 100)
        : 0;

    return (
      <div key={rep.id} className="rep-card">
        <div className="rep-card-top">
          <div>
            <div className="rep-card-name">{rep.name}</div>
            {showTeamBadge ? (
              <div className="rep-card-badges">
                <span className="rep-team-badge">{rep.teamLabel}</span>
              </div>
            ) : null}
          </div>
          <div className="rep-rank">{formatRank(rank)}</div>
        </div>

        <div className="rep-stats">
          <div className="rep-stat-item">
            <div className="rep-stat-value">{formatCurrency(rep.cardMetrics.periodCommission)}</div>
            <div className="rep-stat-label">This period</div>
            <div className="rep-stat-sub">{rep.cardMetrics.periodLabel}</div>
          </div>
          <div className="rep-stat-item">
            <div className="rep-stat-value">{formatUnits(rep.cardMetrics.monthUnits)}</div>
            <div className="rep-stat-label">Units sold</div>
            <div className="rep-stat-sub">{rep.cardMetrics.monthLabel}</div>
          </div>
          <div className="rep-stat-item">
            <div className="rep-stat-value">{formatPercent(rep.cardMetrics.fpRate)}</div>
            <div className="rep-stat-label">FP rate</div>
          </div>
        </div>

        <div className="commission-bar-wrap">
          <div className="commission-bar-track">
            <div
              className="commission-bar-fill"
              style={{
                width: `${commissionBarPercent}%`,
              }}
            />
          </div>
        </div>

        <div className="rep-card-footer">
          <div className="rep-card-actions">
            <Link href={`/manager/${rep.id}`} className="btn-sm primary">
              View Report
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="manager-dashboard">
      {dialogOpen ? (
        <div className="modal-overlay" onClick={closeAddDialog}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={closeAddDialog}>
              ✕
            </button>
            <div className="modal-title">Add Rep</div>
            <form onSubmit={handleSaveAndSync}>
              <div className="form-group">
                <label htmlFor="rep-name" className="form-label">
                  Rep Name
                </label>
                <input
                  id="rep-name"
                  className="form-input"
                  placeholder="e.g. Tyler Williams"
                  value={repName}
                  onChange={(event) => setRepName(event.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="rep-team" className="form-label">
                  Team
                </label>
                <input
                  id="rep-team"
                  list="rep-team-options"
                  className="form-input"
                  placeholder="e.g. Morning Team"
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                />
                <datalist id="rep-team-options">
                  {teams.map((team) => (
                    <option key={team} value={team} />
                  ))}
                </datalist>
              </div>

              <div className="form-group">
                <label htmlFor="sheet-url" className="form-label">
                  Google Sheets URL
                </label>
                <input
                  id="sheet-url"
                  className="form-input"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={sheetUrl}
                  onChange={(event) => setSheetUrl(event.target.value)}
                />
                <div className="form-hint">Sheet must be set to &quot;Anyone with link can view&quot;</div>
              </div>

              {formError ? (
                <div className="form-hint" style={{ color: "var(--red)", marginBottom: "14px" }}>
                  {formError}
                </div>
              ) : null}

              <button className="modal-submit" type="submit" disabled={isSaving}>
                {isSaving ? "Syncing..." : "Save & Sync"}
              </button>
              <button className="modal-cancel" type="button" onClick={closeAddDialog}>
                Cancel
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <div className="page">
        <div className="page-header">
          <div className="page-header-left">
            <div className="page-eyebrow">Manager View</div>
            <div className="page-title">Team Dashboard</div>
          </div>
          <div className="page-header-right">
            <div className="sync-status">
              Last synced: <span>{syncStatusLabel}</span>
            </div>
            <button
              className={`sync-all-btn ${isSyncingAll ? "syncing" : ""}`}
              type="button"
              onClick={() => void handleSyncAll()}
              disabled={isSyncingAll || reps.length === 0}
            >
              <svg
                className="sync-icon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              {isSyncingAll ? "Syncing..." : "Sync All"}
            </button>
            <div className="year-toggle">
              {YEAR_OPTIONS.map((year) => {
                const isActive = year === selectedYear;
                return (
                  <button
                    key={year}
                    type="button"
                    className={`year-btn ${isActive ? "active" : "inactive"}`}
                    onClick={() => setSelectedYear(year)}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
            <button className="add-rep-btn" type="button" onClick={openAddDialog}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Rep
            </button>
          </div>
        </div>

        <div className={`sync-progress ${isSyncingAll || syncStartedAt ? "visible" : ""}`}>
          <div className="sync-progress-label">
            <span>Syncing all reps...</span>
            <span>
              {syncCompletedCount} / {reps.length} complete
            </span>
          </div>
          <div className="sync-track">
            <div className="sync-fill" style={{ width: `${syncProgressPercent}%` }} />
          </div>
          <div className="sync-reps">
            {reps.map((rep) => {
              const chipStatus = syncChipStatuses[rep.id] ?? "pending";
              const className =
                chipStatus === "done"
                  ? "sync-rep-chip done"
                  : chipStatus === "syncing"
                    ? "sync-rep-chip syncing"
                    : chipStatus === "error"
                      ? "sync-rep-chip error"
                      : "sync-rep-chip";
              return (
                <div key={`sync-chip-${rep.id}`} className={className}>
                  <span className={`chip-dot ${chipStatus === "syncing" ? "spinning" : ""}`} />
                  {rep.name}
                </div>
              );
            })}
          </div>
        </div>

        {viewMode !== "leaderboard" ? (
          <div className="summary-bar">
            <div className="summary-stat">
              <div className="summary-stat-label">Total Team Commission</div>
              <div className="summary-stat-value">{formatCurrency(totalTeamCommission)}</div>
              <div className="summary-stat-sub">across all reps · {selectedYear}</div>
            </div>
            <div className="summary-stat">
              <div className="summary-stat-label">Total Units</div>
              <div className="summary-stat-value">{formatUnits(totalUnits)}</div>
              <div className="summary-stat-sub">members sold</div>
            </div>
            <div className="summary-stat">
              <div className="summary-stat-label">Avg FP Rate</div>
              <div className="summary-stat-value">{formatPercent(averageTeamFpRate)}</div>
              <div className="summary-stat-sub">across {sortedReps.length} reps</div>
            </div>
            <div className="summary-stat">
              <div className="summary-stat-label">Missed FP Commission</div>
              <div className="summary-stat-value" style={{ color: "var(--amber)" }}>
                {formatCurrency(totalMissedCommission)}
              </div>
              <div className="summary-stat-sub">team-wide opportunity</div>
            </div>
          </div>
        ) : null}

        <div className="toolbar">
          <div className="tabs">
            <button
              type="button"
              className={`tab ${viewMode === "team" ? "active" : "inactive"}`}
              onClick={() => setViewMode("team")}
            >
              By Team
            </button>
            <button
              type="button"
              className={`tab ${viewMode === "all" ? "active" : "inactive"}`}
              onClick={() => setViewMode("all")}
            >
              All Reps
            </button>
            <button
              type="button"
              className={`tab ${viewMode === "leaderboard" ? "active" : "inactive"}`}
              onClick={() => setViewMode("leaderboard")}
            >
              Leaderboard
            </button>
          </div>
          <div className="toolbar-right">
            {viewMode === "leaderboard" ? (
              <div className="period-toggle">
                <button
                  type="button"
                  className={`period-btn ${leaderboardPeriod === "full" ? "active" : "inactive"}`}
                  onClick={() => setLeaderboardPeriod("full")}
                >
                  Full Period
                </button>
                <button
                  type="button"
                  className={`period-btn ${leaderboardPeriod === "firstHalf" ? "active" : "inactive"}`}
                  onClick={() => setLeaderboardPeriod("firstHalf")}
                >
                  1st - 15th
                </button>
                <button
                  type="button"
                  className={`period-btn ${leaderboardPeriod === "secondHalf" ? "active" : "inactive"}`}
                  onClick={() => setLeaderboardPeriod("secondHalf")}
                >
                  16th - End
                </button>
              </div>
            ) : (
              <>
                <span className="sort-label">Sort</span>
                <select
                  className="sort-select"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as SortOption)}
                >
                  <option value="commission">Most this period commission</option>
                  <option value="units">Most units</option>
                  <option value="fpRate">Best month FP rate</option>
                  <option value="name">Name A-Z</option>
                  <option value="lastSynced">Last synced</option>
                </select>
              </>
            )}
          </div>
        </div>

        {viewMode === "leaderboard" ? (
          <Leaderboard reps={reps} selectedYear={selectedYear} period={leaderboardPeriod} />
        ) : (
          <>
            {sortedReps.length === 0 ? (
              <div className="team-section">
                <div className="rep-card" style={{ cursor: "default" }}>
                  <div className="rep-card-name">No reps yet</div>
                  <p className="rep-synced" style={{ marginTop: "8px" }}>
                    Add your first rep and sync a Google Sheet to populate the dashboard.
                  </p>
                  <div className="rep-card-actions" style={{ marginTop: "16px" }}>
                    <button type="button" className="btn-sm primary" onClick={openAddDialog}>
                      Add Rep
                    </button>
                  </div>
                </div>
              </div>
            ) : viewMode === "all" ? (
              <div className="team-section">
                <div className="reps-grid">{sortedReps.map((rep) => renderRepCard(rep, true))}</div>
              </div>
            ) : (
              groupedByTeam.map((group) => (
                <div className="team-section" key={group.team}>
                  <div className="team-header">
                    <span className="team-name">{group.team}</span>
                    <span className="team-meta">{group.members.length} reps</span>
                    <div className="team-divider" />
                    <span className="team-total-badge">
                      {formatCurrency(group.teamCommission)} total · {formatPercent(group.averageFpRate)} avg FP
                    </span>
                  </div>
                  <div className="reps-grid">{group.members.map((rep) => renderRepCard(rep, false))}</div>
                </div>
              ))
            )}

            <div className="comparison-wrap">
              <div className="comparison-title">All Reps Comparison</div>
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Rep</th>
                    <th>Commission</th>
                    <th>Units</th>
                    <th>FP Rate</th>
                    <th>FPs Sold</th>
                    <th>Missed $</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedReps.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "left", color: "var(--ink-3)" }}>
                        No reps yet.
                      </td>
                    </tr>
                  ) : (
                    sortedReps.map((rep, index) => {
                      const isTopCommission = index < 3;

                      return (
                        <tr key={`table-${rep.id}`}>
                          <td>
                            <span className="comp-rank">{formatRank(index)}</span>
                            <span className="comp-name">{rep.name}</span>
                            <div className="comp-team" style={{ paddingLeft: "26px" }}>
                              {rep.teamLabel}
                            </div>
                          </td>
                          <td>
                            <span
                              className={`comp-mono ${isTopCommission ? "comp-accent" : ""}`}
                            >
                              {formatCurrency(rep.cardMetrics.periodCommission)}
                            </span>
                          </td>
                          <td>
                            <span className="comp-mono">{formatUnits(rep.cardMetrics.monthUnits)}</span>
                          </td>
                          <td>
                            <span className="comp-mono">{formatPercent(rep.cardMetrics.fpRate)}</span>
                          </td>
                          <td>
                            <span className="comp-mono">{formatUnits(rep.cardMetrics.fpSold)}</span>
                          </td>
                          <td>
                            <span className="comp-missed">{formatCurrency(rep.cardMetrics.missedFpCommission)}</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=Syne:wght@400;500;600;700;800&display=swap');

        .manager-dashboard,
        .manager-dashboard *,
        .manager-dashboard *::before,
        .manager-dashboard *::after {
          box-sizing: border-box;
        }

        .manager-dashboard * {
          margin: 0;
          padding: 0;
        }

        .manager-dashboard {
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
          --blue: #3b82f6;
          background: var(--bg);
          color: var(--ink);
          font-family: "Syne", sans-serif;
          font-size: 14px;
          line-height: 1.5;
          min-height: calc(100vh - 65px);
        }

        .manager-dashboard .mono {
          font-family: "DM Mono", monospace;
        }

        .manager-dashboard .serif {
          font-family: "Instrument Serif", serif;
        }

        .manager-dashboard .page {
          max-width: 1100px;
          margin: 0 auto;
          padding: 48px 40px 80px;
        }

        .manager-dashboard .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 36px;
        }

        .manager-dashboard .page-eyebrow {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: var(--ink-3);
          margin-bottom: 8px;
        }

        .manager-dashboard .page-title {
          font-family: "Instrument Serif", serif;
          font-size: 44px;
          letter-spacing: -1.5px;
          line-height: 1;
        }

        .manager-dashboard .page-header-right {
          display: flex;
          align-items: center;
          gap: 10px;
          padding-top: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .manager-dashboard .sync-status {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          color: var(--ink-3);
        }

        .manager-dashboard .sync-status span {
          color: var(--green);
        }

        .manager-dashboard .sync-all-btn {
          background: var(--surface-2);
          color: var(--ink-2);
          border: 1px solid var(--border);
          padding: 9px 18px;
          border-radius: 7px;
          font-family: "Syne", sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.15s;
        }

        .manager-dashboard .sync-all-btn:hover {
          border-color: var(--ink-3);
          color: var(--ink);
        }

        .manager-dashboard .sync-all-btn.syncing {
          border-color: var(--accent);
          color: var(--accent);
        }

        .manager-dashboard .sync-all-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .manager-dashboard .sync-icon {
          transition: transform 0.6s ease;
        }

        .manager-dashboard .sync-all-btn.syncing .sync-icon {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }

        .manager-dashboard .year-toggle {
          display: flex;
          gap: 2px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 3px;
        }

        .manager-dashboard .year-btn {
          font-family: "DM Mono", monospace;
          font-size: 12px;
          padding: 6px 14px;
          border-radius: 5px;
          border: none;
          cursor: pointer;
          transition: all 0.15s;
        }

        .manager-dashboard .year-btn.active {
          background: var(--ink);
          color: var(--bg);
          font-weight: 500;
        }

        .manager-dashboard .year-btn.inactive {
          background: transparent;
          color: var(--ink-3);
        }

        .manager-dashboard .add-rep-btn {
          background: var(--accent);
          color: white;
          border: none;
          padding: 9px 18px;
          border-radius: 7px;
          font-family: "Syne", sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 7px;
          transition: background 0.15s;
        }

        .manager-dashboard .add-rep-btn:hover {
          background: var(--accent-2);
        }

        .manager-dashboard .toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border);
          margin-bottom: 28px;
        }

        .manager-dashboard .tabs {
          display: flex;
        }

        .manager-dashboard .tab {
          font-family: "Syne", sans-serif;
          font-size: 13px;
          font-weight: 500;
          padding: 12px 18px;
          border: none;
          background: transparent;
          cursor: pointer;
          transition: all 0.15s;
          position: relative;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
        }

        .manager-dashboard .tab.active {
          color: var(--ink);
          border-bottom-color: var(--accent);
        }

        .manager-dashboard .tab.inactive {
          color: var(--ink-3);
        }

        .manager-dashboard .tab.inactive:hover {
          color: var(--ink-2);
        }

        .manager-dashboard .toolbar-right {
          display: flex;
          align-items: center;
          gap: 10px;
          padding-bottom: 12px;
        }

        .manager-dashboard .period-toggle {
          display: flex;
          gap: 2px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 7px;
          padding: 3px;
        }

        .manager-dashboard .period-btn {
          font-family: "DM Mono", monospace;
          font-size: 11px;
          padding: 5px 12px;
          border-radius: 5px;
          border: none;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .manager-dashboard .period-btn.active {
          background: var(--accent);
          color: white;
          font-weight: 500;
        }

        .manager-dashboard .period-btn.inactive {
          background: transparent;
          color: var(--ink-3);
        }

        .manager-dashboard .sort-label {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--ink-3);
        }

        .manager-dashboard .sort-select {
          background: var(--surface-2);
          border: 1px solid var(--border);
          color: var(--ink);
          border-radius: 6px;
          padding: 7px 28px 7px 12px;
          font-family: "Syne", sans-serif;
          font-size: 12px;
          cursor: pointer;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%234a5060' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
        }

        .manager-dashboard .sync-progress {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 16px 24px;
          margin-bottom: 24px;
          display: none;
        }

        .manager-dashboard .sync-progress.visible {
          display: block;
        }

        .manager-dashboard .sync-progress-label {
          font-family: "DM Mono", monospace;
          font-size: 11px;
          color: var(--ink-3);
          margin-bottom: 10px;
          display: flex;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
        }

        .manager-dashboard .sync-progress-label span {
          color: var(--accent);
        }

        .manager-dashboard .sync-track {
          height: 3px;
          background: var(--border);
          border-radius: 99px;
          overflow: hidden;
        }

        .manager-dashboard .sync-fill {
          height: 100%;
          border-radius: 99px;
          background: var(--accent);
          transition: width 0.3s ease;
        }

        .manager-dashboard .sync-reps {
          display: flex;
          gap: 8px;
          margin-top: 10px;
          flex-wrap: wrap;
        }

        .manager-dashboard .sync-rep-chip {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          padding: 3px 10px;
          border-radius: 99px;
          border: 1px solid var(--border);
          color: var(--ink-3);
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .manager-dashboard .sync-rep-chip.done {
          border-color: rgba(34, 197, 94, 0.3);
          color: var(--green);
          background: var(--green-light);
        }

        .manager-dashboard .sync-rep-chip.syncing {
          border-color: rgba(224, 90, 32, 0.3);
          color: var(--accent);
          background: rgba(224, 90, 32, 0.08);
        }

        .manager-dashboard .sync-rep-chip.error {
          border-color: rgba(239, 68, 68, 0.3);
          color: var(--red);
          background: var(--red-light);
        }

        .manager-dashboard .chip-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: currentColor;
        }

        .manager-dashboard .chip-dot.spinning {
          animation: pulse 0.8s infinite;
        }

        .manager-dashboard .summary-bar {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1px;
          background: var(--border);
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 32px;
        }

        .manager-dashboard .summary-stat {
          background: var(--surface);
          padding: 20px 24px;
        }

        .manager-dashboard .summary-stat-label {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--ink-3);
          margin-bottom: 6px;
        }

        .manager-dashboard .summary-stat-value {
          font-family: "Instrument Serif", serif;
          font-size: 30px;
          letter-spacing: -0.5px;
          line-height: 1;
        }

        .manager-dashboard .summary-stat-sub {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          color: var(--ink-3);
          margin-top: 4px;
        }

        .manager-dashboard .team-section {
          margin-bottom: 36px;
        }

        .manager-dashboard .team-header {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 14px;
        }

        .manager-dashboard .team-name {
          font-family: "Syne", sans-serif;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--ink-2);
        }

        .manager-dashboard .team-meta {
          font-family: "DM Mono", monospace;
          font-size: 11px;
          color: var(--ink-3);
        }

        .manager-dashboard .team-divider {
          flex: 1;
          height: 1px;
          background: var(--border);
        }

        .manager-dashboard .team-total-badge {
          font-family: "DM Mono", monospace;
          font-size: 11px;
          color: var(--accent);
          background: rgba(224, 90, 32, 0.1);
          border: 1px solid rgba(224, 90, 32, 0.2);
          padding: 3px 10px;
          border-radius: 99px;
        }

        .manager-dashboard .reps-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .manager-dashboard .rep-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 22px 24px;
          transition: background 0.15s, border-color 0.15s;
          cursor: pointer;
        }

        .manager-dashboard .rep-card:hover {
          background: var(--surface-2);
          border-color: var(--ink-3);
        }

        .manager-dashboard .rep-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .manager-dashboard .rep-card-name {
          font-family: "Syne", sans-serif;
          font-size: 15px;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .manager-dashboard .rep-card-badges {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .manager-dashboard .rep-team-badge {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--ink-3);
          background: var(--surface-2);
          border: 1px solid var(--border);
          padding: 3px 10px;
          border-radius: 99px;
        }

        .manager-dashboard .rep-rank {
          font-family: "Instrument Serif", serif;
          font-size: 32px;
          color: var(--ink-3);
          line-height: 1;
          letter-spacing: -1px;
        }

        .manager-dashboard .rep-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 14px;
        }

        .manager-dashboard .rep-stat-item {
          min-width: 0;
        }

        .manager-dashboard .rep-stat-value {
          font-family: "Instrument Serif", serif;
          font-size: 24px;
          letter-spacing: -0.5px;
          line-height: 1;
          margin-bottom: 3px;
        }

        .manager-dashboard .rep-stat-label {
          font-family: "DM Mono", monospace;
          font-size: 9px;
          letter-spacing: 0.04em;
          color: var(--ink-2);
        }

        .manager-dashboard .rep-stat-sub {
          font-family: "DM Mono", monospace;
          font-size: 9px;
          letter-spacing: 0.04em;
          color: var(--ink-3);
        }

        .manager-dashboard .commission-bar-wrap {
          margin-bottom: 14px;
        }

        .manager-dashboard .commission-bar-track {
          height: 4px;
          background: var(--border);
          border-radius: 99px;
          overflow: hidden;
        }

        .manager-dashboard .commission-bar-fill {
          height: 100%;
          border-radius: 99px;
          background: var(--accent);
          transition: width 0.8s ease;
        }

        .manager-dashboard .rep-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .manager-dashboard .rep-card-actions {
          display: flex;
          gap: 8px;
        }

        .manager-dashboard .btn-sm {
          font-family: "Syne", sans-serif;
          font-size: 12px;
          font-weight: 500;
          padding: 6px 14px;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--ink-2);
          cursor: pointer;
          transition: all 0.15s;
          text-decoration: none;
        }

        .manager-dashboard .btn-sm:hover {
          border-color: var(--ink-3);
          color: var(--ink);
        }

        .manager-dashboard .btn-sm.primary {
          background: var(--accent);
          border-color: var(--accent);
          color: white;
        }

        .manager-dashboard .btn-sm.primary:hover {
          background: var(--accent-2);
          border-color: var(--accent-2);
          color: white;
        }

        .manager-dashboard .btn-sm:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .manager-dashboard .rep-synced {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          color: var(--ink-3);
        }

        .manager-dashboard .comparison-wrap {
          margin-top: 40px;
          overflow-x: auto;
        }

        .manager-dashboard .comparison-title {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--ink-3);
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .manager-dashboard .comparison-title::after {
          content: "";
          flex: 1;
          height: 1px;
          background: var(--border);
        }

        .manager-dashboard .comparison-table {
          width: 100%;
          min-width: 760px;
          border-collapse: collapse;
        }

        .manager-dashboard .comparison-table th {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--ink-3);
          padding: 0 14px 12px;
          text-align: right;
          border-bottom: 1px solid var(--border);
        }

        .manager-dashboard .comparison-table th:first-child {
          text-align: left;
          padding-left: 0;
        }

        .manager-dashboard .comparison-table td {
          padding: 13px 14px;
          text-align: right;
          border-bottom: 1px solid rgba(39, 42, 51, 0.6);
          font-size: 13px;
        }

        .manager-dashboard .comparison-table td:first-child {
          text-align: left;
          padding-left: 0;
        }

        .manager-dashboard .comparison-table tbody tr:hover td {
          background: var(--surface-2);
        }

        .manager-dashboard .comp-rank {
          font-family: "DM Mono", monospace;
          font-size: 11px;
          color: var(--ink-3);
          width: 24px;
          display: inline-block;
        }

        .manager-dashboard .comp-name {
          font-weight: 600;
        }

        .manager-dashboard .comp-team {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          color: var(--ink-3);
          margin-top: 2px;
        }

        .manager-dashboard .comp-mono {
          font-family: "DM Mono", monospace;
          font-size: 12px;
        }

        .manager-dashboard .comp-accent {
          color: var(--accent);
        }

        .manager-dashboard .comp-missed {
          color: var(--amber);
          font-family: "DM Mono", monospace;
          font-size: 12px;
        }

        .manager-dashboard .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
          padding: 16px;
        }

        .manager-dashboard .modal {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 40px;
          width: 100%;
          max-width: 480px;
          position: relative;
        }

        .manager-dashboard .modal-title {
          font-family: "Instrument Serif", serif;
          font-size: 32px;
          letter-spacing: -1px;
          margin-bottom: 28px;
        }

        .manager-dashboard .form-group {
          margin-bottom: 20px;
        }

        .manager-dashboard .form-label {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--ink-3);
          display: block;
          margin-bottom: 7px;
        }

        .manager-dashboard .form-input {
          width: 100%;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 7px;
          padding: 11px 14px;
          color: var(--ink);
          font-family: "Syne", sans-serif;
          font-size: 13px;
          transition: border-color 0.15s;
          outline: none;
        }

        .manager-dashboard .form-input:focus {
          border-color: var(--accent);
        }

        .manager-dashboard .form-input::placeholder {
          color: var(--ink-3);
        }

        .manager-dashboard .form-hint {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          color: var(--ink-3);
          margin-top: 5px;
        }

        .manager-dashboard .modal-submit {
          width: 100%;
          background: var(--accent);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 14px;
          font-family: "Syne", sans-serif;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 8px;
          transition: background 0.15s;
        }

        .manager-dashboard .modal-submit:hover {
          background: var(--accent-2);
        }

        .manager-dashboard .modal-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .manager-dashboard .modal-cancel {
          display: block;
          width: 100%;
          text-align: center;
          font-family: "DM Mono", monospace;
          font-size: 11px;
          color: var(--ink-3);
          margin-top: 14px;
          cursor: pointer;
          background: transparent;
          border: 0;
        }

        .manager-dashboard .modal-cancel:hover {
          color: var(--ink-2);
        }

        .manager-dashboard .modal-close {
          position: absolute;
          top: 16px;
          right: 16px;
          background: none;
          border: none;
          color: var(--ink-3);
          cursor: pointer;
          font-size: 18px;
          line-height: 1;
          padding: 4px;
        }

        @media (max-width: 1024px) {
          .manager-dashboard .page {
            padding: 32px 24px 64px;
          }
        }

        @media (max-width: 880px) {
          .manager-dashboard .page-header {
            flex-direction: column;
            gap: 16px;
          }

          .manager-dashboard .page-header-right {
            width: 100%;
            justify-content: space-between;
          }

          .manager-dashboard .toolbar {
            flex-direction: column;
            align-items: flex-start;
          }

          .manager-dashboard .toolbar-right {
            width: 100%;
            justify-content: flex-end;
          }

          .manager-dashboard .summary-bar {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .manager-dashboard .reps-grid {
            grid-template-columns: 1fr;
          }

          .manager-dashboard .team-header {
            flex-wrap: wrap;
          }

          .manager-dashboard .team-divider {
            width: 100%;
          }
        }

        @media (max-width: 640px) {
          .manager-dashboard .page {
            padding: 28px 16px 48px;
          }

          .manager-dashboard .page-title {
            font-size: 36px;
          }

          .manager-dashboard .year-btn {
            padding: 6px 10px;
          }

          .manager-dashboard .add-rep-btn {
            padding: 9px 12px;
          }

          .manager-dashboard .summary-bar {
            grid-template-columns: 1fr;
          }

          .manager-dashboard .rep-card-footer {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }

          .manager-dashboard .modal {
            padding: 28px 20px;
          }
        }
      `}</style>
    </div>
  );
}
