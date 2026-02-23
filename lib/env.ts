import "server-only";

export const CLERK_ENV_KEYS = [
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
] as const;

export const SUPABASE_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export const GOLDBOT_DASHBOARD_ENV_KEYS = [
  "DATABASE_URL",
  ...CLERK_ENV_KEYS,
  ...SUPABASE_ENV_KEYS,
] as const;

export const REPORTS_DASHBOARD_ENV_KEYS = [...CLERK_ENV_KEYS, ...SUPABASE_ENV_KEYS] as const;

function uniqueKeys(keys: readonly string[]): string[] {
  return [...new Set(keys.map((key) => key.trim()).filter(Boolean))];
}

export function getEnvStatus(keys: string[]): { missing: string[]; present: string[] } {
  const normalizedKeys = uniqueKeys(keys);
  const missing: string[] = [];
  const present: string[] = [];

  for (const key of normalizedKeys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim().length > 0) {
      present.push(key);
    } else {
      missing.push(key);
    }
  }

  return { missing, present };
}

export function requireEnv(keys: string[], scopeLabel: string): void {
  const { missing } = getEnvStatus(keys);
  if (missing.length > 0) {
    throw new Error(`[env_missing] scope=${scopeLabel} missing=${missing.join(",")}`);
  }
}
