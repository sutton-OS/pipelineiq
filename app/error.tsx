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
    <main className="grid min-h-screen place-items-center bg-paper px-6">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-paper p-8 shadow-sm">
        <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full border border-accent-light bg-accent-light text-2xl text-accent">
          !
        </div>
        <h1 className="font-serif text-3xl text-ink">Ink spill detected</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          Something broke while rendering this page. Try again and we&apos;ll
          rerun the report flow.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-md border border-ink bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink-2"
        >
          Retry
        </button>
      </div>
    </main>
  );
}
