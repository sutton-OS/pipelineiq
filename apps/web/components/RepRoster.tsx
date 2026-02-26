"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { Loader2, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { repsStore, type Rep } from "@/lib/reps-store";
import { fetchAndParseSheet, getRepStats, parseStoredRepData } from "@/lib/rep-sync";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  if (!value) return "Never";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "Never";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
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
  const [editingRepId, setEditingRepId] = useState<string | null>(null);
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
    setEditingRepId(null);
    setRepName("");
    setTeamName("");
    setSheetUrl("");
    setFormError(null);
  }

  function openAddDialog() {
    resetForm();
    setDialogOpen(true);
  }

  function openEditDialog(rep: RepCardData) {
    setEditingRepId(rep.id);
    setRepName(rep.name);
    setTeamName(rep.team);
    setSheetUrl(rep.sheetUrl);
    setFormError(null);
    setDialogOpen(true);
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
      const repId = editingRepId ?? buildRepId();
      const nowIso = new Date().toISOString();

      repsStore.save({
        id: repId,
        name: nextName,
        team: nextTeam,
        sheetUrl: nextSheetUrl,
        lastSynced: nowIso,
        data: parsed,
      });

      setReps(repsStore.getAll());
      setDialogOpen(false);
      resetForm();
      toast.success(editingRepId ? "Rep updated and synced." : "Rep added and synced.");
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

  function handleDelete(rep: RepCardData) {
    const confirmed = window.confirm(`Delete ${rep.name}? This cannot be undone.`);
    if (!confirmed) return;
    repsStore.delete(rep.id);
    setReps(repsStore.getAll());
  }

  function renderRepCard(rep: RepCardData) {
    const isSyncing = syncingRepId === rep.id;
    const commissionBarPercent =
      highestCommission > 0 ? Math.min((rep.stats.commission / highestCommission) * 100, 100) : 0;

    return (
      <article
        key={rep.id}
        className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[var(--ink)]">{rep.name}</h3>
            <span className="mt-1 inline-flex rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] uppercase tracking-[0.08em] text-[var(--ink-2)]">
              {rep.teamLabel}
            </span>
          </div>
          <p className="text-right text-[11px] text-[var(--ink-3)]">
            Last synced
            <br />
            {formatSyncedTime(rep.lastSynced)}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]">Commission</p>
            <p className="font-mono text-sm text-[var(--ink)]">{formatCurrency(rep.stats.commission)}</p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]">Units</p>
            <p className="font-mono text-sm text-[var(--ink)]">{formatUnits(rep.stats.units)}</p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]">FP Rate</p>
            <p className="font-mono text-sm text-[var(--ink)]">{formatPercent(rep.stats.fpRate)}</p>
          </div>
        </div>

        <div className="mt-3 h-1.5 rounded-full bg-[var(--surface-2)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all duration-200"
            style={{ width: `${commissionBarPercent}%` }}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/manager/${rep.id}`}
            className="inline-flex h-8 items-center rounded-md border border-[var(--border)] px-3 text-xs font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-2)]"
          >
            View Report
          </Link>
          <button
            type="button"
            onClick={() => void handleSync(rep)}
            disabled={isSyncing}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] px-3 text-xs font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sync
          </button>
          <button
            type="button"
            onClick={() => openEditDialog(rep)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] px-3 text-xs font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-2)]"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => handleDelete(rep)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] px-3 text-xs font-medium text-red-300 transition-colors hover:bg-[rgba(255,0,0,0.08)]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </article>
    );
  }

  return (
    <div
      style={shellVars}
      className="min-h-[calc(100vh-65px)] bg-[var(--bg)] px-6 py-6 text-[var(--ink)] md:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--ink-3)]">Manager View</p>
            <h1 className="text-2xl font-semibold tracking-tight">Team Dashboard</h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex overflow-hidden rounded-md border border-[var(--border)]">
              {YEAR_OPTIONS.map((year) => {
                const active = selectedYear === year;
                return (
                  <button
                    key={year}
                    type="button"
                    onClick={() => setSelectedYear(year)}
                    className={`px-4 py-2 text-xs font-medium ${
                      active
                        ? "bg-[var(--ink)] text-[var(--bg)]"
                        : "bg-transparent text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
                    }`}
                  >
                    {year}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={openAddDialog}
              className="inline-flex h-9 items-center rounded-md bg-[var(--ink)] px-4 text-sm font-medium text-[var(--bg)] transition-opacity hover:opacity-90"
            >
              Add Rep
            </button>
          </div>
        </header>

        <section className="mb-6 flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex overflow-hidden rounded-md border border-[var(--border)]">
            <button
              type="button"
              onClick={() => setViewMode("team")}
              className={`px-3 py-2 text-xs font-medium ${
                viewMode === "team"
                  ? "bg-[var(--ink)] text-[var(--bg)]"
                  : "bg-transparent text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
              }`}
            >
              By Team
            </button>
            <button
              type="button"
              onClick={() => setViewMode("all")}
              className={`px-3 py-2 text-xs font-medium ${
                viewMode === "all"
                  ? "bg-[var(--ink)] text-[var(--bg)]"
                  : "bg-transparent text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
              }`}
            >
              All Reps
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs uppercase tracking-[0.08em] text-[var(--ink-3)]">Sort</label>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger className="w-[200px] border-[var(--border)] bg-[var(--surface-2)] text-[var(--ink)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-[var(--border)] bg-[var(--surface)] text-[var(--ink)]">
                <SelectItem value="commission">Most commission</SelectItem>
                <SelectItem value="units">Most units</SelectItem>
                <SelectItem value="fpRate">Best FP rate</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
                <SelectItem value="lastSynced">Last synced</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        {sortedReps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center">
            <p className="text-lg font-medium text-[var(--ink)]">No reps yet</p>
            <p className="mt-1 text-sm text-[var(--ink-3)]">
              Add your first rep and sync a Google Sheet to populate the roster.
            </p>
          </div>
        ) : viewMode === "all" ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{sortedReps.map(renderRepCard)}</div>
        ) : (
          <div className="space-y-6">
            {groupedByTeam.map((group) => (
              <section key={group.team} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-base font-semibold text-[var(--ink)]">{group.team}</h2>
                    <Link
                      href={`/manager/teams/${encodeURIComponent(group.team)}`}
                      className="inline-flex h-7 items-center rounded-md border border-[var(--border)] px-2.5 text-[11px] font-medium text-[var(--ink-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                    >
                      Team Summary
                    </Link>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[var(--ink-2)]">
                    <span>
                      Team commission:{" "}
                      <strong className="font-mono text-[var(--ink)]">
                        {formatCurrency(group.teamCommission)}
                      </strong>
                    </span>
                    <span>
                      Avg FP rate:{" "}
                      <strong className="font-mono text-[var(--ink)]">
                        {formatPercent(group.averageFpRate)}
                      </strong>
                    </span>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {group.members.map(renderRepCard)}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setFormError(null);
        }}
      >
        <DialogContent
          className="border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] sm:max-w-[520px]"
        >
          <DialogHeader>
            <DialogTitle>{editingRepId ? "Edit Rep" : "Add Rep"}</DialogTitle>
            <DialogDescription className="text-[var(--ink-2)]">
              Save rep details and sync from the sheet&apos;s CSV export.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSaveAndSync}>
            <div className="space-y-1.5">
              <label htmlFor="rep-name" className="text-xs uppercase tracking-[0.08em] text-[var(--ink-3)]">
                Rep name
              </label>
              <Input
                id="rep-name"
                value={repName}
                onChange={(event) => setRepName(event.target.value)}
                placeholder="Tyler Sutton"
                className="border-[var(--border)] bg-[var(--surface-2)] text-[var(--ink)] placeholder:text-[var(--ink-3)]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="rep-team" className="text-xs uppercase tracking-[0.08em] text-[var(--ink-3)]">
                Team
              </label>
              <Input
                id="rep-team"
                list="rep-team-options"
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                placeholder="North"
                className="border-[var(--border)] bg-[var(--surface-2)] text-[var(--ink)] placeholder:text-[var(--ink-3)]"
              />
              <datalist id="rep-team-options">
                {teams.map((team) => (
                  <option key={team} value={team} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="sheet-url" className="text-xs uppercase tracking-[0.08em] text-[var(--ink-3)]">
                Google Sheets URL
              </label>
              <Input
                id="sheet-url"
                value={sheetUrl}
                onChange={(event) => setSheetUrl(event.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="border-[var(--border)] bg-[var(--surface-2)] text-[var(--ink)] placeholder:text-[var(--ink-3)]"
              />
            </div>

            {formError ? (
              <p className="rounded-md border border-red-800/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                {formError}
              </p>
            ) : null}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--ink)] px-4 text-sm font-medium text-[var(--bg)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save &amp; Sync
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
