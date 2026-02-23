import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { requireUserId } from "@/lib/auth";
import { ensureOrgAndLocation, getLeadDetail } from "@/lib/goldbot";
import { ConversationTimeline } from "@/components/goldbot/conversation-timeline";
import { CopyPhoneButton } from "@/components/goldbot/copy-phone-button";
import { SectionCard } from "@/components/goldbot/section-card";
import { StatusBadge } from "@/components/goldbot/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Lead Detail",
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function formatLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function extractStaffAttentionReason(flagsJson: Record<string, unknown>): string | null {
  const candidateKeys = ["escalationReason", "reason", "staffAttentionReason"];

  for (const key of candidateKeys) {
    const value = flagsJson[key];
    if (typeof value === "string" && value.trim()) {
      return formatLabel(value.trim());
    }
  }

  return null;
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[8.5rem,1fr] sm:items-center sm:gap-2">
      <dt className="text-xs uppercase tracking-[0.08em] text-ink-3">{label}</dt>
      <dd className="text-sm text-ink">{value}</dd>
    </div>
  );
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();
  const context = await ensureOrgAndLocation(userId);
  const { lead, messages, appointments } = await getLeadDetail(context, id);

  if (!lead) {
    notFound();
  }

  const staffAttentionReason = extractStaffAttentionReason(lead.flagsJson);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl font-serif tracking-tight">{lead.fullName}</h1>
          <p className="text-sm text-ink-2">{lead.phone}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/leads">Back to Leads</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/inbound-sim">Simulate Inbound</Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <aside className="order-1 space-y-4 lg:order-2 lg:col-span-1">
          <SectionCard title="Lead Summary" contentClassName="space-y-4">
            <dl className="space-y-3">
              <InfoRow label="Name" value={lead.fullName} />
              <InfoRow label="Phone" value={lead.phone} />
              <InfoRow label="Normalized" value={lead.normalizedPhone || "—"} />
              <InfoRow
                label="Consent"
                value={
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-border/70 bg-paper/50 text-ink-2">
                      {lead.consentStatus}
                    </Badge>
                    {lead.optedOut ? (
                      <Badge
                        variant="outline"
                        className="border-red-300/45 bg-red-500/15 text-red-100"
                      >
                        Opted-out
                      </Badge>
                    ) : null}
                  </div>
                }
              />
              <InfoRow label="Source" value={formatLabel(lead.source)} />
              <InfoRow label="Created" value={formatDateTime(lead.createdAt)} />
              <InfoRow label="Last inbound" value={formatDateTime(lead.lastInboundAt)} />
              <InfoRow label="Last outbound" value={formatDateTime(lead.lastOutboundAt)} />
              <InfoRow
                label="Staff flag"
                value={
                  <div className="space-y-1">
                    <span>{lead.needsStaffAttention ? "Needs staff attention" : "Clear"}</span>
                    {lead.needsStaffAttention && staffAttentionReason ? (
                      <p className="text-xs text-ink-2">Reason: {staffAttentionReason}</p>
                    ) : null}
                  </div>
                }
              />
            </dl>
          </SectionCard>

          <SectionCard title="State" contentClassName="space-y-3">
            <InfoRow label="Current" value={<StatusBadge kind="conversation" value={lead.state} />} />
            <InfoRow label="Invalid replies" value={lead.invalidResponseCount} />
            <InfoRow label="Stale after" value={formatDateTime(lead.staleAfterAt)} />
          </SectionCard>

          <SectionCard title="Controls" contentClassName="space-y-2">
            <Button asChild className="w-full justify-center">
              <Link href="/dashboard/inbound-sim">Simulate inbound</Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-center">
              <Link href="/dashboard/leads">Back to leads</Link>
            </Button>
            <CopyPhoneButton phone={lead.normalizedPhone || lead.phone} className="w-full justify-center" />
          </SectionCard>
        </aside>

        <main className="order-2 space-y-4 lg:order-1 lg:col-span-2">
          <SectionCard
            title="Conversation Timeline"
            description="Inbound and outbound history with delivery status."
            contentClassName="space-y-3"
          >
            <ConversationTimeline messages={messages} />
          </SectionCard>

          <SectionCard title="Appointments" contentClassName="space-y-3">
            {appointments.length === 0 ? (
              <p className="text-sm text-ink-2">No appointments yet.</p>
            ) : (
              <ul className="space-y-2">
                {appointments.map((appointment) => (
                  <li
                    key={appointment.id}
                    className="space-y-2 rounded-xl border border-border/60 bg-paper/35 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-ink">
                          {formatDateTime(appointment.startsAt)} to {formatDateTime(appointment.endsAt)}
                        </p>
                        {appointment.provider ? (
                          <p className="text-xs text-ink-2">Provider: {formatLabel(appointment.provider)}</p>
                        ) : null}
                      </div>

                      <Badge variant="outline" className="border-border/70 bg-paper/50 text-ink-2">
                        {formatLabel(appointment.status)}
                      </Badge>
                    </div>

                    {appointment.notes ? (
                      <p className="text-sm whitespace-pre-wrap break-words text-ink-2">{appointment.notes}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </main>
      </div>
    </div>
  );
}
