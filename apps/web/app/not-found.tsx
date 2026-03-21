import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-xs uppercase tracking-[0.12em] text-[var(--ink-3)]">404</p>
      <h1 className="text-4xl font-serif text-[var(--ink)]">Page not found</h1>
      <p className="max-w-md text-sm text-[var(--ink-2)]">
        The route you requested does not exist. Return to the homepage.
      </p>
      <div className="flex items-center gap-2">
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-md border border-[var(--border)] px-4 text-sm text-[var(--ink)] hover:bg-[var(--paper-3)]"
        >
          Home
        </Link>
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-md bg-[var(--ink)] px-4 text-sm font-medium text-white hover:opacity-90"
        >
          Reports
        </Link>
      </div>
    </main>
  );
}
