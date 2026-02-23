export default function RootLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f9f5eb] px-6 text-[#1a1a1a]">
      <div className="w-full max-w-md rounded-2xl border border-[#d8d5ce] bg-white p-8 text-center shadow-[0_16px_36px_rgba(26,26,26,0.08)]">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-[#e0ddd6] border-t-[#1a6e3c]" />
        <h1 className="mt-5 font-serif text-3xl">Preparing your report</h1>
        <p className="mt-2 text-sm text-[#4a4a4a]">
          Warming up the paper, ink, and numbers.
        </p>
      </div>
    </main>
  );
}
