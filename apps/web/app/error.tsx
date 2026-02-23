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
    <main className="grid min-h-screen place-items-center bg-[#f9f5eb] px-6 text-[#1a1a1a]">
      <div className="w-full max-w-lg rounded-2xl border border-[#d8d5ce] bg-white p-8 shadow-[0_16px_36px_rgba(26,26,26,0.08)]">
        <p className="text-xs uppercase tracking-[0.11em] text-[#666]">PipelineIQ</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight">Something went wrong</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#4a4a4a]">
          We hit an unexpected error while rendering this view. Retry to reload the page.
        </p>
        {missingKeys.length > 0 ? (
          <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
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
