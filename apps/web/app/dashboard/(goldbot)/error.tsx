"use client";

import { useEffect } from "react";
import { getMissingEnvKeysFromError } from "@/lib/env-error";

type GoldBotErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GoldBotError({ error, reset }: GoldBotErrorProps) {
  const missingKeys = getMissingEnvKeysFromError(error.message ?? "");

  useEffect(() => {
    const referenceId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.error("[dashboard_error]", {
      group: "goldbot",
      referenceId,
      message: error.message,
      stack: error.stack,
    });
  }, [error]);

  return (
    <main className="grid min-h-[60vh] place-items-center px-6 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-white p-8 shadow-[0_16px_36px_rgba(26,26,26,0.08)]">
        <p className="text-xs uppercase tracking-[0.11em] text-ink-2">GoldBot Operations</p>
        <h1 className="mt-3 font-serif text-3xl leading-tight">GoldBot dashboard error</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          This dashboard view failed to load. Retry to request fresh data.
        </p>

        {missingKeys.length > 0 ? (
          <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
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
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-[#1a1a1a] px-4 text-sm font-medium text-white hover:opacity-90"
        >
          Retry
        </button>
      </div>
    </main>
  );
}
