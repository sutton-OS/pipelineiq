import type { Metadata } from "next";
import Link from "next/link";
import { requireUserId } from "@/lib/auth";
import { ensureOrgAndLocation, listLeadsForLocation } from "@/lib/goldbot";
import { Button } from "@/components/ui/button";
import { LeadsTable } from "@/components/goldbot/leads-table";
import { GoldBotPageShell } from "@/components/goldbot/page-shell";
import { SectionCard } from "@/components/goldbot/section-card";

export const metadata: Metadata = {
  title: "Leads",
};

export default async function LeadsPage() {
  const userId = await requireUserId();
  const context = await ensureOrgAndLocation(userId);
  const leads = await listLeadsForLocation(context);

  return (
    <GoldBotPageShell
      title="Leads"
      subtitle="Your intake pipeline and conversation state."
      headerClassName="items-start gap-6 rounded-2xl border border-border/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01))] px-5 py-5 md:px-6"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild>
            <Link href="/dashboard/intake">New Lead Intake</Link>
          </Button>
        </div>
      }
    >
      <SectionCard
        title="Lead List"
        description={`${context.locationName} · ${context.timezone}`}
        contentClassName="space-y-1"
      >
        <LeadsTable leads={leads} />
      </SectionCard>
    </GoldBotPageShell>
  );
}
