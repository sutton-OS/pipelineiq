"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ReportUploader } from "@/components/ReportUploader";
import { fetchAndParseSheet, parseStoredRepData } from "@/lib/rep-sync";
import { repsStore, type Rep } from "@/lib/reps-store";

function readRepId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default function ManagerRepReportPage() {
  const params = useParams<{ repId: string }>();
  const repId = readRepId(params.repId);
  const [reps, setReps] = useState<Rep[]>(() => repsStore.getAll());

  useEffect(() => {
    const onStorage = () => setReps(repsStore.getAll());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const rep = useMemo(() => reps.find((item) => item.id === repId) ?? null, [repId, reps]);

  if (!rep) {
    return (
      <section className="mx-auto max-w-5xl rounded-xl border border-[var(--border)] bg-[var(--paper-2)] p-6">
        <p className="text-sm uppercase tracking-[0.08em] text-[var(--ink-3)]">Manager View</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--ink)]">Rep not found</h1>
        <p className="mt-2 text-sm text-[var(--ink-2)]">
          This rep may have been removed. Return to the team dashboard to pick another report.
        </p>
        <Link
          href="/manager"
          className="mt-4 inline-flex rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--paper-3)]"
        >
          Back to Team Dashboard
        </Link>
      </section>
    );
  }

  const teamName = rep.team.trim() || "Unassigned";
  const parsedData = parseStoredRepData(rep.data);

  return (
    <ReportUploader
      initialParsedData={parsedData}
      initialFileName={`${rep.name}.csv`}
      initialLastSyncedAt={rep.lastSynced}
      repName={rep.name}
      showUploadControls={false}
      syncButtonLabel="Sync now"
      breadcrumb={
        <span>
          <Link href="/manager" className="hover:text-[var(--ink)]">
            ← Team Dashboard
          </Link>{" "}
          /{" "}
          <Link
            href={`/manager/teams/${encodeURIComponent(teamName)}`}
            className="hover:text-[var(--ink)]"
          >
            {teamName}
          </Link>{" "}
          / <span className="text-[var(--ink)]">{rep.name}</span>
        </span>
      }
      onSyncNow={async () => {
        const nextData = await fetchAndParseSheet(rep.sheetUrl);
        const nowIso = new Date().toISOString();
        repsStore.update(rep.id, {
          data: nextData,
          lastSynced: nowIso,
        });
        setReps(repsStore.getAll());

        return {
          parsedData: nextData,
          fileName: `${rep.name}.csv`,
          lastSyncedAt: nowIso,
        };
      }}
    />
  );
}
