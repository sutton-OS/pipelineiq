"use client";

import { useEffect } from "react";

type RootErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function RootError({ error, reset }: RootErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f9f5eb] px-6 text-[#1a1a1a]">
      <div className="w-full max-w-lg rounded-2xl border border-[#d8d5ce] bg-white p-8 shadow-[0_16px_36px_rgba(26,26,26,0.08)]">
        <p className="text-xs uppercase tracking-[0.11em] text-[#666]">PipelineIQ</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight">Something spilled on the page</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#4a4a4a]">
          We hit an unexpected error while rendering this view. Retry and we&apos;ll rebuild the report.
        </p>
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
