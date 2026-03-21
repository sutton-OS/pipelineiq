"use client";

import { useState } from "react";
import { RepRoster } from "@/components/RepRoster";
import { ReportUploader } from "@/components/ReportUploader";

type ViewMode = "personal" | "team";

export default function HomePage() {
  const [viewMode, setViewMode] = useState<ViewMode>("personal");

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[960px]">
        {/* Top bar */}
        <div className="mb-8 flex items-end justify-between border-b pb-5" style={{ borderColor: "var(--border)" }}>
          <div>
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "28px",
                letterSpacing: "-0.5px",
                lineHeight: 1.1,
                color: "var(--ink)",
              }}
            >
              PipelineIQ
            </h1>
            <p
              className="mt-1"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--ink-3)",
              }}
            >
              Personal Reports
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex items-center gap-0.5">
            {(["personal", "team"] as ViewMode[]).map((mode) => {
              const active = viewMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className="rounded-md px-4 py-2 transition-all"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "13px",
                    fontWeight: 500,
                    background: active ? "var(--ink)" : "transparent",
                    color: active ? "var(--paper)" : "var(--ink-3)",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = "var(--paper-3)";
                      e.currentTarget.style.color = "var(--ink)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--ink-3)";
                    }
                  }}
                >
                  {mode === "personal" ? "Personal Report" : "Team Report"}
                </button>
              );
            })}
          </div>
        </div>

        {/* Report content */}
        {viewMode === "personal" && <ReportUploader />}
        {viewMode === "team" && <RepRoster />}
      </div>
    </main>
  );
}
