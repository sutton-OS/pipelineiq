"use client";

import { useState } from "react";
import { RepRoster } from "@/components/RepRoster";
import { ReportUploader } from "@/components/ReportUploader";

type ViewMode = "personal" | "team";

export default function HomePage() {
  const [viewMode, setViewMode] = useState<ViewMode>("personal");

  return (
    <main className="min-h-screen px-10 py-12 sm:px-10 lg:px-10">
      <div className="mx-auto w-full max-w-[1100px]">
        {/* Top bar — matches RepRoster page-header */}
        <div className="mb-9 flex items-start justify-between">
          <div>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "var(--ink-3)",
                marginBottom: "8px",
              }}
            >
              PipelineIQ
            </p>
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "44px",
                letterSpacing: "-1.5px",
                lineHeight: 1,
                color: "var(--ink)",
              }}
            >
              {viewMode === "personal" ? "Personal Report" : "Team Dashboard"}
            </h1>
          </div>

          {/* Tab switcher — matches RepRoster's tab style */}
          <div
            className="flex items-center gap-0.5 rounded-lg border p-1"
            style={{
              background: "var(--surface-2)",
              borderColor: "var(--border)",
              marginTop: "8px",
            }}
          >
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
                    fontWeight: 600,
                    background: active ? "var(--ink)" : "transparent",
                    color: active ? "var(--paper)" : "var(--ink-3)",
                    cursor: "pointer",
                    border: "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.color = "var(--ink-2)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.color = "var(--ink-3)";
                  }}
                >
                  {mode === "personal" ? "Personal" : "Team"}
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
