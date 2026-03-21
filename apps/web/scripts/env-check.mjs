#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { z } from "zod";

const { loadEnvConfig } = nextEnv;

const contractPath = new URL("../lib/env-contract.json", import.meta.url);
const envContract = JSON.parse(readFileSync(contractPath, "utf8"));

const requiredKeys = [...new Set((envContract.required || []).map((key) => String(key).trim()))]
  .filter(Boolean)
  .sort();

const nonEmptyEnvValue = z.string().trim().min(1);
const envSchema = z.object(
  Object.fromEntries(requiredKeys.map((key) => [key, nonEmptyEnvValue])),
);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(scriptDir, "..");
loadEnvConfig(webDir, process.env.NODE_ENV !== "production");

const scopedInput = Object.fromEntries(requiredKeys.map((key) => [key, process.env[key]]));
const parsed = envSchema.safeParse(scopedInput);

if (!parsed.success) {
  const missing = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0] || "")))]
    .filter(Boolean)
    .sort();

  console.error(`[env_missing] scope=env.check missing=${missing.join(",")}`);
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  console.error(
    "Run `npm run env:pull` to sync Production env into apps/web/.env.local, then run `npm run env:check` again.",
  );
  process.exit(1);
}

console.log(`[env_ok] scope=env.check keys=${requiredKeys.length}`);
