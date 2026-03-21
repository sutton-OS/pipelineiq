import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-3)",
        }}
      >
        404
      </p>
      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "36px",
          letterSpacing: "-0.5px",
          color: "var(--ink)",
        }}
      >
        Page not found
      </h1>
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "14px",
          color: "var(--ink-2)",
          maxWidth: "360px",
          lineHeight: 1.6,
        }}
      >
        The route you requested doesn&apos;t exist. Head back to your reports.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex h-10 items-center rounded-md px-5"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
          fontWeight: 500,
          background: "var(--ink)",
          color: "var(--paper)",
        }}
      >
        Back to reports
      </Link>
    </main>
  );
}
