import { ReportUploader } from "@/components/ReportUploader";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f9f5eb] px-5 pb-16 pt-12 text-[#1a1a1a] sm:px-8">
      <div className="mx-auto w-full max-w-4xl space-y-10">
        <p className="text-xs uppercase tracking-[0.12em] text-[#5f5f5f]">
          PipelineIQ Core
        </p>
        <h1 className="max-w-4xl font-serif text-5xl leading-[0.95] sm:text-6xl">
          Upload your CSV, get your report.
        </h1>
        <p className="max-w-3xl text-lg leading-relaxed text-[#393939]">
          Drop in your sales data and generate a polished report in seconds.
        </p>
        <ReportUploader />
      </div>
    </main>
  );
}
