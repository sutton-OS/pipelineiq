export default function RootLoading() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-sm rounded-[28px] border border-border/70 bg-white/80 p-8 text-center shadow-[0_24px_80px_rgba(17,24,39,0.08)] backdrop-blur">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-border border-t-accent" />
        <h1 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-ink">Loading reports</h1>
        <p className="mt-2 text-sm text-ink-2">Preparing the personal dashboard.</p>
      </div>
    </main>
  );
}
