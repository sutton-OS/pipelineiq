import { ReportUploader } from "@/components/ReportUploader";

export default function HomePage() {
  return (
    <main
      className="min-h-screen px-5 pb-16 pt-12 sm:px-8"
      style={{ background: "#16181d", color: "#ffffff" }}
    >
      <div className="mx-auto w-full max-w-4xl space-y-10" style={{ background: "#16181d" }}>
        <p
          className="text-xs uppercase tracking-[0.12em]"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          PIPELINEIQ CORE
        </p>
        <h1 className="max-w-4xl font-serif text-5xl leading-[0.95] text-white sm:text-6xl">
          Upload your CSV, get your report.
        </h1>
        <p
          className="max-w-3xl text-lg leading-relaxed"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          Drop in your sales data and generate a polished report in seconds.
        </p>
        <div className="home-uploader-overrides">
          <ReportUploader />
        </div>
      </div>
      <style jsx global>{`
        .home-uploader-overrides > section {
          background: #16181d !important;
          color: #ffffff;
        }

        .home-uploader-overrides > section > div > div:first-child {
          background: #16181d;
          border-color: #2e3340;
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.25);
        }

        .home-uploader-overrides > section > div > div:first-child > div:first-child > p {
          color: rgba(255, 255, 255, 0.4);
        }

        .home-uploader-overrides > section [role="button"][tabindex="0"] {
          background: #1e2028 !important;
          border-color: #2e3340 !important;
        }

        .home-uploader-overrides > section [role="button"][tabindex="0"]:hover {
          background: #1e2028 !important;
        }

        .home-uploader-overrides > section [role="button"][tabindex="0"] svg,
        .home-uploader-overrides > section [role="button"][tabindex="0"] p {
          color: rgba(255, 255, 255, 0.75) !important;
        }

        .home-uploader-overrides > section [role="button"][tabindex="0"] span {
          background: #25282f;
          color: rgba(255, 255, 255, 0.6);
        }

        .home-uploader-overrides > section > div > div:first-child > div[role="button"] + div {
          background: #25282f;
          border-color: #2e3340;
          color: rgba(255, 255, 255, 0.6);
        }

        .home-uploader-overrides > section > div > div:first-child > div[role="button"] + div svg {
          color: rgba(255, 255, 255, 0.6);
        }
      `}</style>
    </main>
  );
}
