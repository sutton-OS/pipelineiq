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

if (process.env.NODE_ENV === "production") {
  const publishableKey = parsed.data.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const secretKey = parsed.data.CLERK_SECRET_KEY;

  if (!secretKey.startsWith("sk_live_")) {
    console.error(
      "[env_invalid] scope=env.check key=CLERK_SECRET_KEY expected_prefix=sk_live_",
    );
    console.error(
      "Production requires a live Clerk secret key (CLERK_SECRET_KEY must start with sk_live_).",
    );
    process.exit(1);
  }

  if (publishableKey.startsWith("pk_test_")) {
    console.warn(
      "[env_warn] scope=env.check key=NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY prefix=pk_test_ expected=pk_live_",
    );
    console.warn(
      "Production is using a Clerk test publishable key (pk_test_). Use pk_live_ when ready.",
    );
  } else if (!publishableKey.startsWith("pk_live_")) {
    console.error(
      "[env_invalid] scope=env.check key=NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY expected_prefix=pk_live_",
    );
    console.error(
      "Production requires a Clerk publishable key prefixed with pk_live_ (pk_test_ is warning-only).",
    );
    process.exit(1);
  }
}

console.log(`[env_ok] scope=env.check keys=${requiredKeys.length}`);
