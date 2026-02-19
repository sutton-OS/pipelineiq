export default function RootLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-paper-2/60 p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 h-14 w-14 rounded-full border-2 border-paper-3 border-t-accent animate-spin" />
        <p className="font-serif text-2xl text-ink">Preparing your report</p>
        <p className="mt-2 text-sm text-ink-2">
          Aligning data on fresh paper and warming up the press.
        </p>
      </div>
    </main>
  );
}
