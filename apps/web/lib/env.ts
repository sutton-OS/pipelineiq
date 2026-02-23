import "server-only";
import { z } from "zod";
import envContract from "./env-contract.json";

const ENV_MISSING_TAG = "[env_missing]";
const nonEmptyEnvValue = z.string().trim().min(1);

type EnvSource = Record<string, string | undefined>;

function uniqueKeys(keys: readonly string[]): string[] {
  return [...new Set(keys.map((key) => key.trim()).filter(Boolean))];
}

function getContractGroup(name: keyof typeof envContract.groups): string[] {
  return uniqueKeys(envContract.groups[name] ?? []);
}

function createScopeSchema(keys: readonly string[]) {
  const scopeShape = Object.fromEntries(
    keys.map((key) => [key, nonEmptyEnvValue]),
  ) as Record<string, typeof nonEmptyEnvValue>;
  return z.object(scopeShape);
}

function getMissingKeys(error: z.ZodError): string[] {
  return uniqueKeys(
    error.issues
      .map((issue) => issue.path[0])
      .filter((segment): segment is string => typeof segment === "string"),
  ).sort();
}

export const WEB_REQUIRED_ENV_KEYS = uniqueKeys(envContract.required);
export const CLERK_ENV_KEYS = getContractGroup("clerk");
export const SUPABASE_ENV_KEYS = getContractGroup("supabase");
export const GOLDBOT_DASHBOARD_ENV_KEYS = getContractGroup("goldbotDashboard");
export const REPORTS_DASHBOARD_ENV_KEYS = getContractGroup("reportsDashboard");

export function getEnvStatus(
  keys: readonly string[],
  source: EnvSource = process.env,
): { missing: string[]; present: string[] } {
  const normalizedKeys = uniqueKeys(keys);
  const missing: string[] = [];
  const present: string[] = [];

  for (const key of normalizedKeys) {
    if (nonEmptyEnvValue.safeParse(source[key]).success) {
      present.push(key);
    } else {
      missing.push(key);
    }
  }

  return { missing, present };
}

export function formatEnvMissingMessage(scopeLabel: string, missingKeys: readonly string[]): string {
  const normalizedMissing = uniqueKeys(missingKeys).sort();
  return `${ENV_MISSING_TAG} scope=${scopeLabel} missing=${normalizedMissing.join(",")} hint=Run npm run env:pull locally or set Production vars in Vercel.`;
}

export function requireEnv(
  keys: readonly string[],
  scopeLabel: string,
  source: EnvSource = process.env,
): void {
  const normalizedKeys = uniqueKeys(keys);
  const schema = createScopeSchema(normalizedKeys);
  const scopedInput = Object.fromEntries(
    normalizedKeys.map((key) => [key, source[key]]),
  );

  const parsed = schema.safeParse(scopedInput);
  if (!parsed.success) {
    const missing = getMissingKeys(parsed.error);
    throw new Error(formatEnvMissingMessage(scopeLabel, missing));
  }
}

export function requireStartupEnv(scopeLabel = "app.startup", source: EnvSource = process.env): void {
  requireEnv(WEB_REQUIRED_ENV_KEYS, scopeLabel, source);
}
