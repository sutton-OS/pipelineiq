"use client";

import { useEffect } from "react";

type ReportsErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

function getMissingKeys(message: string): string[] {
  const envMatch = message.match(/\[env_missing\]\s+scope=[^\s]+\s+missing=(.+)$/);
  if (!envMatch) return [];
  return envMatch[1]
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ReportsError({ error, reset }: ReportsErrorProps) {
  const missingKeys = getMissingKeys(error.message ?? "");

  useEffect(() => {
    const referenceId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.error("[dashboard_error]", {
      group: "reports",
      referenceId,
      message: error.message,
      stack: error.stack,
    });
  }, [error]);

  return (
    <main className="grid min-h-[60vh] place-items-center px-6 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-white p-8 shadow-[0_16px_36px_rgba(26,26,26,0.08)]">
        <p className="text-xs uppercase tracking-[0.11em] text-ink-2">Reports</p>
        <h1 className="mt-3 font-serif text-3xl leading-tight">Reports view error</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          We couldn&apos;t load this report page. Retry to rebuild the report view.
        </p>

        {missingKeys.length > 0 ? (
          <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Missing environment keys: <strong>{missingKeys.join(", ")}</strong>. Add these in
            Vercel and redeploy.
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
