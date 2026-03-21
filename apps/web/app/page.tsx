"use client";

import { useState } from "react";
import { RepRoster } from "@/components/RepRoster";
import { ReportUploader } from "@/components/ReportUploader";

type ViewMode = "personal" | "team";

const viewTabs: Array<{ key: ViewMode; label: string }> = [
  { key: "personal", label: "Personal Report" },
  { key: "team", label: "Team Report" },
];

export default function HomePage() {
  const [viewMode, setViewMode] = useState<ViewMode>("personal");

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col items-center gap-4 pt-2 text-center">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-ink-3">PipelineIQ</p>
            <h1 className="text-balance text-4xl font-semibold tracking-[-0.04em] text-ink sm:text-5xl">
              Commission and team reports in one view.
            </h1>
            <p className="mx-auto max-w-2xl text-sm leading-6 text-ink-2 sm:text-base">
              Switch between the personal commission report and the team report without an auth
              gate or extra navigation.
            </p>
          </div>

          <div className="inline-flex rounded-full border border-border bg-white/85 p-1 shadow-[0_12px_40px_rgba(17,24,39,0.08)] backdrop-blur">
            {viewTabs.map((tab) => {
              const active = viewMode === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setViewMode(tab.key)}
                  className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                    active
                      ? "bg-ink text-white shadow-sm"
                      : "text-ink-2 hover:bg-paper-3/70 hover:text-ink"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </header>

        <section className="flex-1">
          <div className={viewMode === "personal" ? "block" : "hidden"}>
            <div className="mx-auto w-full rounded-[32px] border border-border/70 bg-white/80 p-4 shadow-[0_24px_80px_rgba(17,24,39,0.08)] backdrop-blur sm:p-6">
              <ReportUploader />
            </div>
          </div>

          <div className={viewMode === "team" ? "block" : "hidden"}>
            <div className="mx-auto w-full rounded-[32px] border border-border/70 bg-white/80 p-4 shadow-[0_24px_80px_rgba(17,24,39,0.08)] backdrop-blur sm:p-6">
              <RepRoster />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
