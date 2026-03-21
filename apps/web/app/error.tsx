"use client";

import { useEffect } from "react";
import { getMissingEnvKeysFromError } from "@/lib/env-error";

type RootErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function RootError({ error, reset }: RootErrorProps) {
  const missingKeys = getMissingEnvKeysFromError(error.message ?? "");

  useEffect(() => {
    const referenceId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.error("[app_error]", {
      group: "root",
      referenceId,
      message: error.message,
      stack: error.stack,
    });
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--paper)] px-6 text-[var(--ink)]">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8">
        <p className="text-xs uppercase tracking-[0.11em] text-[var(--ink-3)]">PipelineIQ</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight">Something went wrong</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--ink-2)]">
          We hit an unexpected error while rendering this view. Retry to reload the page.
        </p>
        {missingKeys.length > 0 ? (
          <div className="mt-3 rounded-md border border-[var(--amber)]/30 bg-[var(--amber-light)] px-3 py-2 text-sm text-[var(--amber)]">
            <p>
              Missing environment keys: <strong>{missingKeys.join(", ")}</strong>.
            </p>
            <p className="mt-1">
              Local fix: run <code>npm run env:pull</code> and <code>npm run env:check</code>.
              Vercel fix: add these in Project Settings -&gt; Environment Variables (Production),
              then redeploy.
            </p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white hover:opacity-90"
        >
          Retry
        </button>
      </div>
    </main>
  );
}
