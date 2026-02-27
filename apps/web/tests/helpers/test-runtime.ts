import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

type Restorable = { restore: () => void };

export function repoPath(...segments: string[]): string {
  return path.join(process.cwd(), ...segments);
}

export async function importFresh<T>(absolutePath: string): Promise<T> {
  const moduleUrl = pathToFileURL(absolutePath);
  moduleUrl.searchParams.set("t", `${Date.now()}-${Math.random()}`);
  return import(moduleUrl.href) as Promise<T>;
}

export async function measureMs<T>(fn: () => Promise<T> | T): Promise<{ ms: number; value: T }> {
  const startedAt = performance.now();
  const value = await fn();
  const ms = performance.now() - startedAt;
  return { ms, value };
}

export function assertUnder(ms: number, thresholdMs: number, message: string): void {
  assert.ok(
    ms < thresholdMs,
    `${message}. Expected < ${thresholdMs}ms, received ${ms.toFixed(2)}ms`,
  );
}

export function restoreAll(restorables: Restorable[]): void {
  for (const restorable of restorables.reverse()) {
    if (restorable && typeof restorable.restore === "function") {
      restorable.restore();
    }
  }
}

export async function jsonBody(response: Response): Promise<unknown> {
  return response.json();
}
