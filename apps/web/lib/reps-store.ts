import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface Rep {
  id: string;
  name: string;
  team: string;
  sheetUrl: string;
  lastSynced: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

const REPS_STORAGE_KEY = "piq-reps";
const REPS_TABLE = "reps";
const REFRESH_MIN_INTERVAL_MS = 5_000;

type RepRow = {
  id: string;
  name: string;
  team: string | null;
  sheet_url: string;
  last_synced: string | null;
  data: unknown;
  created_at: string;
};

let supabaseClient: SupabaseClient | null | undefined;
let refreshInFlight: Promise<void> | null = null;
let lastRefreshAt = 0;

function getSupabaseClient(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (supabaseClient !== undefined) return supabaseClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    supabaseClient = null;
    return supabaseClient;
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseClient;
}

function mapRowToRep(row: RepRow): Rep {
  return {
    id: row.id,
    name: row.name,
    team: row.team ?? "",
    sheetUrl: row.sheet_url,
    lastSynced: row.last_synced ?? "",
    data: row.data,
  };
}

function mapRepToInsertRow(rep: Rep) {
  return {
    id: rep.id,
    name: rep.name,
    team: rep.team.trim() || null,
    sheet_url: rep.sheetUrl,
    last_synced: rep.lastSynced || null,
    data: rep.data,
  };
}

function mapRepChangesToUpdateRow(changes: Partial<Rep>) {
  const updateRow: {
    name?: string;
    team?: string | null;
    sheet_url?: string;
    last_synced?: string | null;
    data?: unknown;
  } = {};

  if (Object.prototype.hasOwnProperty.call(changes, "name") && typeof changes.name === "string") {
    updateRow.name = changes.name;
  }
  if (Object.prototype.hasOwnProperty.call(changes, "team")) {
    updateRow.team = typeof changes.team === "string" ? changes.team.trim() || null : null;
  }
  if (
    Object.prototype.hasOwnProperty.call(changes, "sheetUrl") &&
    typeof changes.sheetUrl === "string"
  ) {
    updateRow.sheet_url = changes.sheetUrl;
  }
  if (Object.prototype.hasOwnProperty.call(changes, "lastSynced")) {
    updateRow.last_synced =
      typeof changes.lastSynced === "string" && changes.lastSynced.length > 0
        ? changes.lastSynced
        : null;
  }
  if (Object.prototype.hasOwnProperty.call(changes, "data")) {
    updateRow.data = changes.data ?? null;
  }

  return updateRow;
}

function readReps(): Rep[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(REPS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Rep[]) : [];
  } catch {
    return [];
  }
}

function emitStorageEvent(previousValue: string | null, nextValue: string) {
  if (typeof window === "undefined") return;

  try {
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: REPS_STORAGE_KEY,
        oldValue: previousValue,
        newValue: nextValue,
        storageArea: window.localStorage,
        url: window.location.href,
      })
    );
  } catch {
    window.dispatchEvent(new Event("storage"));
  }
}

function writeReps(reps: Rep[]) {
  if (typeof window === "undefined") return;

  try {
    const serialized = JSON.stringify(reps);
    const previousValue = window.localStorage.getItem(REPS_STORAGE_KEY);
    if (previousValue === serialized) return;
    window.localStorage.setItem(REPS_STORAGE_KEY, serialized);
    emitStorageEvent(previousValue, serialized);
  } catch {}
}

async function refreshFromSupabase(force = false): Promise<void> {
  if (typeof window === "undefined") return;
  const client = getSupabaseClient();
  if (!client) return;

  if (refreshInFlight) {
    await refreshInFlight;
    return;
  }
  if (!force && Date.now() - lastRefreshAt < REFRESH_MIN_INTERVAL_MS) return;

  refreshInFlight = (async () => {
    const { data, error } = await client
      .from(REPS_TABLE)
      .select("id,name,team,sheet_url,last_synced,data,created_at")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[repsStore.getAll] Failed to fetch reps from Supabase:", error.message);
      return;
    }

    const reps = Array.isArray(data) ? (data as RepRow[]).map(mapRowToRep) : [];
    writeReps(reps);
  })().finally(() => {
    lastRefreshAt = Date.now();
    refreshInFlight = null;
  });

  await refreshInFlight;
}

async function saveToSupabase(rep: Rep) {
  const client = getSupabaseClient();
  if (!client) return;

  const { error } = await client.from(REPS_TABLE).insert(mapRepToInsertRow(rep));
  if (error) {
    console.error("[repsStore.save] Failed to insert rep:", error.message);
    return;
  }

  await refreshFromSupabase(true);
}

async function updateInSupabase(id: string, changes: Partial<Rep>) {
  const client = getSupabaseClient();
  if (!client) return;

  const updates = mapRepChangesToUpdateRow(changes);
  if (Object.keys(updates).length === 0) return;

  const { error } = await client.from(REPS_TABLE).update(updates).eq("id", id);
  if (error) {
    console.error("[repsStore.update] Failed to update rep:", error.message);
    return;
  }

  await refreshFromSupabase(true);
}

async function deleteFromSupabase(id: string) {
  const client = getSupabaseClient();
  if (!client) return;

  const { error } = await client.from(REPS_TABLE).delete().eq("id", id);
  if (error) {
    console.error("[repsStore.delete] Failed to delete rep:", error.message);
    return;
  }

  await refreshFromSupabase(true);
}

export const repsStore = {
  getAll(): Rep[] {
    const cached = readReps();
    void refreshFromSupabase();
    return cached;
  },
  save(rep: Rep): void {
    const reps = readReps();
    const existingIndex = reps.findIndex((existingRep) => existingRep.id === rep.id);

    if (existingIndex >= 0) {
      reps[existingIndex] = rep;
    } else {
      reps.push(rep);
    }

    writeReps(reps);
    void saveToSupabase(rep);
  },
  delete(id: string): void {
    const reps = readReps().filter((rep) => rep.id !== id);
    writeReps(reps);
    void deleteFromSupabase(id);
  },
  update(id: string, changes: Partial<Rep>): void {
    const reps = readReps();
    const existingIndex = reps.findIndex((rep) => rep.id === id);
    if (existingIndex < 0) return;

    reps[existingIndex] = {
      ...reps[existingIndex],
      ...changes,
      id: reps[existingIndex].id,
    };

    writeReps(reps);
    void updateInSupabase(id, changes);
  },
  getTeams(): string[] {
    void refreshFromSupabase();
    const teams = new Set(
      readReps()
        .map((rep) => rep.team.trim())
        .filter((team) => team.length > 0)
    );
    return Array.from(teams);
  },
};
