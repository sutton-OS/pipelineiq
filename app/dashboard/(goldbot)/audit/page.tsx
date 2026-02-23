import type { Metadata } from "next";
import Link from "next/link";
import { requireUserId } from "@/lib/auth";
import { ensureOrgAndLocation, listAuditEntries } from "@/lib/goldbot";
import { AuditLogTable } from "@/components/goldbot/audit-log-table";
import { GoldBotPageShell } from "@/components/goldbot/page-shell";
import { SectionCard } from "@/components/goldbot/section-card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Audit",
};

export default async function AuditPage() {
  const userId = await requireUserId();
  const context = await ensureOrgAndLocation(userId);
  const entries = await listAuditEntries(context);

  return (
    <GoldBotPageShell
      title="Audit Log"
      subtitle="Policy decisions and action attempts from the ActionGateway."
      headerClassName="items-start gap-6 rounded-2xl border border-border/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01))] px-5 py-5 md:px-6"
      actions={
        <Button asChild variant="outline">
          <Link href="/api/audit/export?limit=5000">Download CSV Export</Link>
        </Button>
      }
      maxWidth="7xl"
    >
      <SectionCard
        title="Recent Entries"
        description={`${context.locationName} · ${context.timezone}`}
        contentClassName="space-y-4"
      >
        <AuditLogTable entries={entries} />
      </SectionCard>
    </GoldBotPageShell>
  );
}
