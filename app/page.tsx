import { ReportUploader } from "@/components/ReportUploader";

export default function HomePage() {
  return (
    <main
      className="min-h-screen px-5 pb-16 pt-12 sm:px-8"
      style={{ background: "var(--paper)", color: "var(--ink)" }}
    >
      <div className="mx-auto w-full max-w-4xl space-y-10">
        <p className="text-xs uppercase tracking-[0.12em]" style={{ color: "var(--ink-2)" }}>
          PipelineIQ Core
        </p>
        <h1 className="max-w-4xl font-serif text-5xl leading-[0.95] sm:text-6xl">
          Upload your CSV, get your report.
        </h1>
        <p className="max-w-3xl text-lg leading-relaxed" style={{ color: "var(--ink-2)" }}>
          Drop in your sales data and generate a polished report in seconds.
        </p>
        <ReportUploader />
      </div>
    </main>
  );
}
