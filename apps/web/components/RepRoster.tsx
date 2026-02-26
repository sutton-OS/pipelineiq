"use client";

import Link from "next/link";
import { Syne } from "next/font/google";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { repsStore, type Rep } from "@/lib/reps-store";
import { fetchAndParseSheet, getRepStats, parseStoredRepData } from "@/lib/rep-sync";

const syne = Syne({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const YEAR_OPTIONS = [2025, 2026] as const;

type SortOption = "commission" | "units" | "fpRate" | "name" | "lastSynced";
type RosterView = "team" | "all";

type RepCardData = Rep & {
  teamLabel: string;
  syncedAt: number;
  stats: ReturnType<typeof getRepStats>;
};

const shellVars = {
  "--bg": "var(--paper)",
  "--surface": "var(--paper-2)",
  "--surface-2": "var(--paper-3)",
  "--border": "var(--border)",
  "--ink": "var(--ink)",
  "--ink-2": "var(--ink-2)",
  "--ink-3": "var(--ink-3)",
} as CSSProperties;

const cardHoverTransition = {
  transition: "all 0.15s ease",
} as CSSProperties;

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

function formatSyncedTime(value: string) {
  if (!value) return "Last synced never";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "Last synced never";
  const minutesAgo = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  return `Last synced ${minutesAgo} min ago`;
}

function buildRepId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `rep-${Date.now()}`;
}

export function RepRoster() {
  const [reps, setReps] = useState<Rep[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [sortBy, setSortBy] = useState<SortOption>("commission");
  const [viewMode, setViewMode] = useState<RosterView>("team");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [repName, setRepName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [syncingRepId, setSyncingRepId] = useState<string | null>(null);

  useEffect(() => {
    const nowYear = new Date().getFullYear();
    if (nowYear === 2025 || nowYear === 2026) setSelectedYear(nowYear);

    setReps(repsStore.getAll());

    const onStorage = () => setReps(repsStore.getAll());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
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

  const repsWithStats = useMemo<RepCardData[]>(() => {
    return reps.map((rep) => {
      const teamLabel = rep.team.trim() || "Unassigned";
      const syncedAt = Date.parse(rep.lastSynced);
      return {
        ...rep,
        teamLabel,
        syncedAt: Number.isNaN(syncedAt) ? 0 : syncedAt,
        stats: getRepStats(parseStoredRepData(rep.data), selectedYear),
      };
    });
  }, [reps, selectedYear]);

  const sortedReps = useMemo(() => {
    const next = [...repsWithStats];
    next.sort((a, b) => {
      if (sortBy === "commission") {
        return b.stats.commission - a.stats.commission || a.name.localeCompare(b.name);
      }
      if (sortBy === "units") {
        return b.stats.units - a.stats.units || a.name.localeCompare(b.name);
      }
      if (sortBy === "fpRate") {
        return b.stats.fpRate - a.stats.fpRate || a.name.localeCompare(b.name);
      }
      if (sortBy === "lastSynced") {
        return b.syncedAt - a.syncedAt || a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
    return next;
  }, [repsWithStats, sortBy]);

  const highestCommission = useMemo(
    () => sortedReps.reduce((max, rep) => Math.max(max, rep.stats.commission), 0),
    [sortedReps]
  );

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
        const teamCommission = members.reduce((sum, member) => sum + member.stats.commission, 0);
        const averageFpRate =
          members.length > 0
            ? members.reduce((sum, member) => sum + member.stats.fpRate, 0) / members.length
            : 0;
        return { team, members, teamCommission, averageFpRate };
      })
      .sort((a, b) => a.team.localeCompare(b.team));
  }, [sortedReps]);

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

      setReps(repsStore.getAll());
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

  async function handleSync(rep: RepCardData) {
    if (syncingRepId) return;
    setSyncingRepId(rep.id);

    try {
      const parsed = await fetchAndParseSheet(rep.sheetUrl);
      repsStore.update(rep.id, {
        data: parsed,
        lastSynced: new Date().toISOString(),
      });
      setReps(repsStore.getAll());
      toast.success(`Synced ${rep.name}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to sync rep.";
      toast.error(message);
    } finally {
      setSyncingRepId(null);
    }
  }

  function renderRepCard(rep: RepCardData) {
    const isSyncing = syncingRepId === rep.id;
    const commissionBarPercent =
      highestCommission > 0 ? Math.min((rep.stats.commission / highestCommission) * 100, 100) : 0;

    return (
      <article
        key={rep.id}
        style={cardHoverTransition}
        className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-7 py-6 hover:bg-[var(--surface-2)]"
      >
        <div className="flex items-start justify-between gap-4">
          <h3 className={`${syne.className} text-[15px] font-bold text-[var(--ink)]`}>
            {rep.name}
          </h3>
          <span
            className="inline-flex rounded-[99px] border border-[var(--border)] bg-[var(--surface-2)] px-[10px] py-[3px] text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {rep.teamLabel}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-5">
          <div>
            <p
              className="text-[26px] leading-none text-[var(--ink)]"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {formatCurrency(rep.stats.commission)}
            </p>
            <p
              className="mt-2 text-[9px] uppercase tracking-[0.08em] text-[var(--ink-3)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Commission
            </p>
          </div>
          <div>
            <p
              className="text-[26px] leading-none text-[var(--ink)]"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {formatUnits(rep.stats.units)}
            </p>
            <p
              className="mt-2 text-[9px] uppercase tracking-[0.08em] text-[var(--ink-3)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Units
            </p>
          </div>
          <div>
            <p
              className="text-[26px] leading-none text-[var(--ink)]"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {formatPercent(rep.stats.fpRate)}
            </p>
            <p
              className="mt-2 text-[9px] uppercase tracking-[0.08em] text-[var(--ink-3)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              FP Rate
            </p>
          </div>
        </div>

        <div className="my-4 h-1 overflow-hidden rounded-[99px] bg-[var(--border)]">
          <div
            className="h-full rounded-[99px] bg-[var(--accent)]"
            style={{ width: `${commissionBarPercent}%` }}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href={`/manager/${rep.id}`}
              className={`${syne.className} inline-flex items-center rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-[14px] py-[7px] text-[12px] text-[var(--ink)] [transition:all_0.15s_ease] hover:bg-[var(--surface)]`}
            >
              View Report
            </Link>
            <button
              type="button"
              onClick={() => void handleSync(rep)}
              disabled={isSyncing}
              className={`${syne.className} inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-[14px] py-[7px] text-[12px] text-[var(--ink)] [transition:all_0.15s_ease] hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Sync
            </button>
          </div>
          <p
            className="text-[10px] text-[var(--ink-3)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {formatSyncedTime(rep.lastSynced)}
          </p>
        </div>
      </article>
    );
  }

  return (
    <div
      style={shellVars}
      className="min-h-[calc(100vh-65px)] bg-[var(--bg)] px-5 py-8 text-[var(--ink)] md:px-8"
    >
      <div className="mx-auto max-w-[1180px]">
        <header className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p
              className="mb-2 text-[10px] uppercase tracking-[0.15em] text-[var(--ink-3)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              MANAGER VIEW
            </p>
            <h1
              className="text-[48px] leading-[1] text-[var(--ink)]"
              style={{ fontFamily: "var(--font-serif)", letterSpacing: "-1.5px" }}
            >
              Team Dashboard
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-[6px] bg-transparent">
              {YEAR_OPTIONS.map((year) => {
                const isActive = selectedYear === year;
                return (
                  <button
                    key={year}
                    type="button"
                    onClick={() => setSelectedYear(year)}
                    className="rounded-[6px] px-[14px] py-[6px] text-[12px] [transition:all_0.15s_ease]"
                    style={{
                      fontFamily: "var(--font-mono)",
                      background: isActive ? "var(--ink)" : "var(--surface-2)",
                      color: isActive ? "#ffffff" : "var(--ink-3)",
                    }}
                  >
                    {year}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={openAddDialog}
              className={`${syne.className} rounded-[6px] border-0 bg-[var(--accent)] px-5 py-[9px] text-[13px] font-semibold text-white [transition:all_0.15s_ease] hover:opacity-90`}
            >
              Add Rep
            </button>
          </div>
        </header>

        <section className="mb-7 border-b border-[var(--border)]">
          <div className="flex items-end justify-between gap-4">
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setViewMode("team")}
                className={`${syne.className} px-4 py-[10px] text-[13px] [transition:all_0.15s_ease] ${
                  viewMode === "team"
                    ? "border-b-2 border-[var(--accent)] font-semibold text-[var(--ink)]"
                    : "border-b-2 border-transparent text-[var(--ink-3)]"
                }`}
              >
                By Team
              </button>
              <button
                type="button"
                onClick={() => setViewMode("all")}
                className={`${syne.className} px-4 py-[10px] text-[13px] [transition:all_0.15s_ease] ${
                  viewMode === "all"
                    ? "border-b-2 border-[var(--accent)] font-semibold text-[var(--ink)]"
                    : "border-b-2 border-transparent text-[var(--ink-3)]"
                }`}
              >
                All Reps
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label
                htmlFor="sort-reps"
                className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                SORT
              </label>
              <select
                id="sort-reps"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortOption)}
                className={`${syne.className} rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-[7px] text-[12px] text-[var(--ink)] [transition:all_0.15s_ease] focus:border-[var(--accent)] focus:outline-none`}
              >
                <option value="commission">Most commission</option>
                <option value="units">Most units</option>
                <option value="fpRate">Best FP rate</option>
                <option value="name">Name A-Z</option>
                <option value="lastSynced">Last synced</option>
              </select>
            </div>
          </div>
        </section>

        {sortedReps.length === 0 ? (
          <div className="rounded-[10px] border-[1.5px] border-dashed border-[var(--border)] px-8 py-20 text-center">
            <p
              className="text-[56px] leading-none text-[var(--ink-3)]"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              +
            </p>
            <p
              className="mt-4 text-[28px] text-[var(--ink)]"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              No reps yet
            </p>
            <p className={`${syne.className} mx-auto mt-3 max-w-[460px] text-[13px] font-normal text-[var(--ink-3)]`}>
              Add your first rep and sync a Google Sheet to populate the roster.
            </p>
            <button
              type="button"
              onClick={openAddDialog}
              className={`${syne.className} mt-6 rounded-[6px] border-0 bg-[var(--accent)] px-5 py-[9px] text-[13px] font-semibold text-white [transition:all_0.15s_ease] hover:opacity-90`}
            >
              Add your first rep &rarr;
            </button>
          </div>
        ) : viewMode === "all" ? (
          <div className="grid gap-4 lg:grid-cols-2">{sortedReps.map(renderRepCard)}</div>
        ) : (
          <div className="space-y-4">
            {groupedByTeam.map((group) => (
              <section key={group.team}>
                <div className="mb-4 flex items-center gap-4">
                  <div className="flex shrink-0 items-center gap-3">
                    <h2
                      className={`${syne.className} text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ink-3)]`}
                    >
                      {group.team}
                    </h2>
                    <p
                      className="text-[11px] text-[var(--ink-3)]"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {group.members.length} reps &middot; {formatCurrency(group.teamCommission)} total &middot;{" "}
                      {formatPercent(group.averageFpRate)} avg FP
                    </p>
                  </div>
                  <div className="h-px flex-1 bg-[var(--border)]" />
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {group.members.map(renderRepCard)}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.75)] p-5"
          onClick={closeAddDialog}
        >
          <div
            className="w-full max-w-[480px] rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-10"
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              className="text-[32px] leading-none text-[var(--ink)]"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Add Rep
            </h2>

            <form className="mt-6 space-y-4" onSubmit={handleSaveAndSync}>
              <div>
                <label
                  htmlFor="rep-name"
                  className="mb-1.5 block text-[10px] uppercase tracking-[0.1em] text-[var(--ink-3)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Rep name
                </label>
                <input
                  id="rep-name"
                  value={repName}
                  onChange={(event) => setRepName(event.target.value)}
                  placeholder="Tyler Sutton"
                  className={`${syne.className} w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-[14px] py-[11px] text-[13px] text-[var(--ink)] [transition:all_0.15s_ease] placeholder:text-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none`}
                />
              </div>

              <div>
                <label
                  htmlFor="rep-team"
                  className="mb-1.5 block text-[10px] uppercase tracking-[0.1em] text-[var(--ink-3)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Team
                </label>
                <input
                  id="rep-team"
                  list="rep-team-options"
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  placeholder="North"
                  className={`${syne.className} w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-[14px] py-[11px] text-[13px] text-[var(--ink)] [transition:all_0.15s_ease] placeholder:text-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none`}
                />
                <datalist id="rep-team-options">
                  {teams.map((team) => (
                    <option key={team} value={team} />
                  ))}
                </datalist>
              </div>

              <div>
                <label
                  htmlFor="sheet-url"
                  className="mb-1.5 block text-[10px] uppercase tracking-[0.1em] text-[var(--ink-3)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Google Sheets URL
                </label>
                <input
                  id="sheet-url"
                  value={sheetUrl}
                  onChange={(event) => setSheetUrl(event.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className={`${syne.className} w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-[14px] py-[11px] text-[13px] text-[var(--ink)] [transition:all_0.15s_ease] placeholder:text-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none`}
                />
                <p
                  className="mt-2 text-[10px] text-[var(--ink-3)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Make sure the sheet is set to &apos;Anyone with link can view&apos;
                </p>
              </div>

              {formError ? (
                <p className={`${syne.className} rounded-[6px] border border-red-900/60 bg-red-950/40 px-3 py-2 text-[12px] text-red-200`}>
                  {formError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSaving}
                className={`${syne.className} mt-1 flex w-full items-center justify-center gap-2 rounded-[8px] bg-[var(--accent)] px-3 py-[14px] text-[14px] font-semibold text-white [transition:all_0.15s_ease] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {isSaving ? (
                  <span className="animate-pulse">Syncing...</span>
                ) : (
                  "Save & Sync"
                )}
              </button>

              <button
                type="button"
                onClick={closeAddDialog}
                className="mt-1 block w-full cursor-pointer text-center text-[11px] text-[var(--ink-3)] [transition:all_0.15s_ease] hover:text-[var(--ink-2)]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
