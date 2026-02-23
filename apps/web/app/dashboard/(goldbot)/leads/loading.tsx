import { GoldBotPageShell } from "@/components/goldbot/page-shell";
import { SectionCard } from "@/components/goldbot/section-card";

export default function LeadsLoading() {
  return (
    <GoldBotPageShell
      title="Leads"
      subtitle="Your intake pipeline and conversation state."
      headerClassName="items-start gap-6 rounded-2xl border border-border/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01))] px-5 py-5 md:px-6"
      actions={<div className="h-9 w-32 animate-pulse rounded-md bg-paper/50" />}
    >
      <SectionCard title="Lead List" description="Loading leads..." contentClassName="space-y-4">
        <div className="h-9 w-full animate-pulse rounded-md bg-paper/50" />
        <div className="overflow-hidden rounded-xl border border-border/60 bg-paper/20">
          <div className="h-10 w-full animate-pulse border-b border-border/60 bg-paper/40" />
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-14 w-full animate-pulse border-b border-border/50 bg-paper/10 last:border-b-0"
            />
          ))}
        </div>
      </SectionCard>
    </GoldBotPageShell>
  );
}
