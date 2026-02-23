export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 md:space-y-6">
      <div className="h-8 w-48 animate-pulse rounded-md bg-paper-2" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-36 animate-pulse rounded-2xl border border-border bg-paper p-5"
          >
            <div className="h-3 w-20 rounded bg-paper-2" />
            <div className="mt-4 h-8 w-28 rounded bg-paper-2" />
            <div className="mt-4 h-3 w-24 rounded bg-paper-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
