import type { Metadata } from "next";
import { requireUserId } from "@/lib/auth";
import { ensureOrgAndLocation, listStaffQueue } from "@/lib/goldbot";
import { GoldBotPageShell } from "@/components/goldbot/page-shell";
import { SectionCard } from "@/components/goldbot/section-card";
import { StaffQueueTabs } from "@/components/goldbot/staff-queue-tabs";

export const metadata: Metadata = {
  title: "Staff Queue",
};

export default async function StaffQueuePage() {
  const userId = await requireUserId();
  const context = await ensureOrgAndLocation(userId);
  const queueItems = await listStaffQueue(context);

  return (
    <GoldBotPageShell
      title="Staff Queue"
      subtitle="Governed review queue for escalated conversations and dead worker jobs."
      headerClassName="items-start gap-6 rounded-2xl border border-border/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01))] px-5 py-5 md:px-6"
      maxWidth="7xl"
    >
      <SectionCard
        title="Needs Staff Attention"
        description={`${context.locationName} · ${context.timezone}`}
        contentClassName="space-y-4"
      >
        <StaffQueueTabs items={queueItems} />
      </SectionCard>
    </GoldBotPageShell>
  );
}
