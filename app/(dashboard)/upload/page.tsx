import type { Metadata } from "next";
import { UploadFlow } from "@/components/upload-flow"

export const metadata: Metadata = {
  title: "Upload Data",
};

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Upload Sales Data</h1>
        <p className="text-sm text-[var(--ink-3)]">
          Import your team&apos;s performance data from a CSV export.
        </p>
      </div>

      <UploadFlow />
    </div>
  )
}
