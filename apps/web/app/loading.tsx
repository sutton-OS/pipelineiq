export default function RootLoading() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="text-center">
        <div
          className="mx-auto h-8 w-8 animate-spin rounded-full"
          style={{
            border: "2px solid var(--border)",
            borderTopColor: "var(--accent)",
          }}
        />
        <h1
          className="mt-5"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "24px",
            letterSpacing: "-0.3px",
            color: "var(--ink)",
          }}
        >
          Preparing your report
        </h1>
        <p
          className="mt-2"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ink-3)",
          }}
        >
          One moment
        </p>
      </div>
    </main>
  );
}
