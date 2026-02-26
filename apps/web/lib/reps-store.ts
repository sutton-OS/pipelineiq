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

function writeReps(reps: Rep[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(REPS_STORAGE_KEY, JSON.stringify(reps));
  } catch {}
}

export const repsStore = {
  getAll(): Rep[] {
    return readReps();
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
  },
  delete(id: string): void {
    const reps = readReps().filter((rep) => rep.id !== id);
    writeReps(reps);
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
  },
  getTeams(): string[] {
    const teams = new Set(
      readReps()
        .map((rep) => rep.team.trim())
        .filter((team) => team.length > 0)
    );
    return Array.from(teams);
  },
};
