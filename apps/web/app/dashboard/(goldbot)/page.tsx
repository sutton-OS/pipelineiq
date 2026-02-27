import type { Metadata } from "next";
import Link from "next/link";
import { requireUserId } from "@/lib/auth";
import {
  ensureOrgAndLocation,
  getDashboardSummary,
  listLeadsForLocation,
} from "@/lib/goldbot";
import { logServerError } from "@/lib/server-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/goldbot/empty-state";
import { MetricTile } from "@/components/goldbot/metric-tile";
import { GoldBotPageShell } from "@/components/goldbot/page-shell";
import { SectionCard } from "@/components/goldbot/section-card";
import { StatusBadge } from "@/components/goldbot/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = {
  title: "Follow-up",
};

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TABLE_HEAD_CLASS = "h-9 px-3 text-[11px] font-medium uppercase tracking-[0.1em] text-ink-2";
const TABLE_ROW_CLASS = "border-border/50 hover:bg-paper/35";
const TABLE_CELL_CLASS = "px-3 py-2.5 align-top text-sm text-ink";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function heatColor(count: number, maxCount: number): string {
  if (count <= 0 || maxCount <= 0) {
    return "rgba(22, 22, 22, 0.05)";
  }

  const ratio = count / maxCount;
  const alpha = 0.12 + ratio * 0.65;
  return `rgba(22, 22, 22, ${Math.min(0.9, alpha)})`;
}

function formatLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function resolveKillSwitchState(
  context: unknown,
): { label: string; enabled: boolean } | null {
  if (!context || typeof context !== "object") {
    return null;
  }

  const candidate = context as Record<string, unknown>;
  const hasGlobal = typeof candidate.orgKillEnabled === "boolean";
  const hasLocation = typeof candidate.locationKillEnabled === "boolean";

  if (!hasGlobal && !hasLocation) {
    return null;
  }

  const globalEnabled = hasGlobal ? Boolean(candidate.orgKillEnabled) : false;
  const locationEnabled = hasLocation ? Boolean(candidate.locationKillEnabled) : false;
  const parts = [
    hasGlobal ? `Global ${globalEnabled ? "On" : "Off"}` : null,
    hasLocation ? `Location ${locationEnabled ? "On" : "Off"}` : null,
  ].filter(Boolean);

  return {
    label: `Kill Switch: ${parts.join(" · ")}`,
    enabled: globalEnabled || locationEnabled,
  };
}

export default async function DashboardPage() {
  try {
    const userId = await requireUserId();
    const context = await ensureOrgAndLocation(userId);

    const [summary, leads] = await Promise.all([
      getDashboardSummary(context),
      listLeadsForLocation(context),
    ]);

    const recentLeads = leads.slice(0, 8);
    const heatByKey = new Map<string, number>(
      summary.outboundHeatmap.map((cell) => [`${cell.dow}-${cell.hour}`, cell.count]),
    );
    const maxHeatValue = summary.outboundHeatmap.reduce(
      (max, cell) => Math.max(max, cell.count),
      0,
    );
    const killSwitchState = resolveKillSwitchState(context);
    const subtitleItems = [
      context.locationName,
      `TZ ${context.timezone}`,
      `Automation ${formatLabel(context.autonomyMode)}`,
      `Booking ${formatLabel(context.bookingProvider)}`,
    ];

    return (
    <GoldBotPageShell
      title="Follow-up"
      subtitle={
        <div className="flex flex-wrap items-center gap-2">
          {subtitleItems.map((item) => (
            <span
              key={item}
              className="rounded-full border border-border/70 bg-paper/50 px-2.5 py-1 text-xs text-ink-2"
            >
              {item}
            </span>
          ))}
        </div>
      }
      headerClassName="items-start gap-6 rounded-2xl border border-border/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01))] px-5 py-5 md:px-6"
      actions={
        <div className="flex flex-col items-start gap-2 md:items-end">
          {killSwitchState ? (
            <Badge
              variant="outline"
              className={
                killSwitchState.enabled
                  ? "border-red-300/45 bg-red-500/15 px-2.5 py-1 text-[11px] text-red-100"
                  : "border-border/70 bg-paper/50 px-2.5 py-1 text-[11px] text-ink-2"
              }
            >
              {killSwitchState.label}
            </Badge>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link href="/dashboard/intake">New Intake</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/staff-queue">Staff Queue</Link>
            </Button>
          </div>
        </div>
      }
      maxWidth="7xl"
    >
      <section>
        <SectionCard
          title="Operational Snapshot"
          description="Live counts from the worker queue and audit log."
          contentClassName="space-y-6"
        >
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-ink-2">Pipeline</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricTile label="Total Leads" value={summary.totalLeads} />
              <MetricTile label="Awaiting YES" value={summary.awaitingYes} />
              <MetricTile label="Awaiting Time Choice" value={summary.awaitingTimeChoice} />
              <MetricTile label="Booked" value={summary.bookedConversations} />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-ink-2">
              Safety &amp; Ops
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <MetricTile label="Staff Attention" value={summary.staffAttention} />
              <MetricTile label="Queued Jobs" value={summary.queuedJobs} />
              <MetricTile label="Running Jobs" value={summary.runningJobs} />
              <MetricTile label="Dead Jobs" value={summary.deadJobs} />
              <MetricTile label="Outbound (24h)" value={summary.outboundLast24h} />
              <MetricTile label="Opt-outs (7d)" value={summary.optOutEventsLast7d} />
            </div>
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Recent Leads"
          description="Latest conversations for this location."
          contentClassName="space-y-3"
        >
          {recentLeads.length === 0 ? (
            <EmptyState
              title="No recent leads"
              description="Create a lead to start the pipeline."
              action={
                <Button asChild size="sm">
                  <Link href="/dashboard/intake">New Lead Intake</Link>
                </Button>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/60 bg-paper/20">
              <Table>
                <TableHeader>
                  <TableRow className={TABLE_ROW_CLASS}>
                    <TableHead className={TABLE_HEAD_CLASS}>Name</TableHead>
                    <TableHead className={TABLE_HEAD_CLASS}>State</TableHead>
                    <TableHead className={TABLE_HEAD_CLASS}>Consent</TableHead>
                    <TableHead className={TABLE_HEAD_CLASS}>Last Inbound/Outbound</TableHead>
                    <TableHead className={TABLE_HEAD_CLASS}>Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentLeads.map((lead) => (
                    <TableRow key={lead.id} className={TABLE_ROW_CLASS}>
                      <TableCell className={`${TABLE_CELL_CLASS} font-medium`}>{lead.fullName}</TableCell>
                      <TableCell className={TABLE_CELL_CLASS}>
                        <StatusBadge kind="conversation" value={lead.state} />
                      </TableCell>
                      <TableCell className={TABLE_CELL_CLASS}>
                        <Badge
                          variant="outline"
                          className="border-border/70 bg-paper/40 px-2.5 py-1 text-[11px] text-ink-2"
                        >
                          {lead.optedOut ? "opted_out" : lead.consentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className={TABLE_CELL_CLASS}>
                        <div className="space-y-1 text-xs text-ink-2">
                          <p>
                            In: <span className="text-ink">{formatDate(lead.lastInboundAt)}</span>
                          </p>
                          <p>
                            Out:{" "}
                            <span className="text-ink">{formatDate(lead.lastOutboundAt)}</span>
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className={TABLE_CELL_CLASS}>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/dashboard/leads/${lead.id}`}>Open</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Recent Messages"
          description="Most recent inbound and outbound activity."
          contentClassName="space-y-3"
        >
          {summary.recentMessages.length === 0 ? (
            <EmptyState
              title="No recent messages"
              description="Inbound and outbound activity will appear here."
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/intake">New Lead Intake</Link>
                </Button>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/60 bg-paper/20">
              <Table>
                <TableHeader>
                  <TableRow className={TABLE_ROW_CLASS}>
                    <TableHead className={TABLE_HEAD_CLASS}>Lead</TableHead>
                    <TableHead className={TABLE_HEAD_CLASS}>Dir</TableHead>
                    <TableHead className={TABLE_HEAD_CLASS}>Status</TableHead>
                    <TableHead className={TABLE_HEAD_CLASS}>Body</TableHead>
                    <TableHead className={TABLE_HEAD_CLASS}>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.recentMessages.map((message) => (
                    <TableRow key={message.id} className={TABLE_ROW_CLASS}>
                      <TableCell className={`${TABLE_CELL_CLASS} font-medium`}>
                        {message.leadName}
                      </TableCell>
                      <TableCell className={`${TABLE_CELL_CLASS} text-xs uppercase text-ink-2`}>
                        {message.direction === "inbound" ? "IN" : "OUT"}
                      </TableCell>
                      <TableCell className={TABLE_CELL_CLASS}>
                        <StatusBadge kind="message" value={message.status} />
                      </TableCell>
                      <TableCell
                        className={`${TABLE_CELL_CLASS} max-w-[16rem] truncate text-ink-2`}
                        title={message.body}
                      >
                        {message.body}
                      </TableCell>
                      <TableCell className={`${TABLE_CELL_CLASS} text-ink-2`}>
                        {formatDate(message.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </SectionCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Recent Send Failures" contentClassName="space-y-3">
          {summary.recentSendFailures.length === 0 ? (
            <EmptyState
              title="No recent failures"
              description="Delivery failures will be surfaced here."
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/audit">Open Audit</Link>
                </Button>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/60 bg-paper/20">
              <Table>
                <TableHeader>
                  <TableRow className={TABLE_ROW_CLASS}>
                    <TableHead className={TABLE_HEAD_CLASS}>Lead</TableHead>
                    <TableHead className={TABLE_HEAD_CLASS}>Status</TableHead>
                    <TableHead className={TABLE_HEAD_CLASS}>Error</TableHead>
                    <TableHead className={TABLE_HEAD_CLASS}>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.recentSendFailures.map((failure) => (
                    <TableRow key={failure.id} className={TABLE_ROW_CLASS}>
                      <TableCell className={`${TABLE_CELL_CLASS} font-medium`}>
                        {failure.leadName}
                      </TableCell>
                      <TableCell className={TABLE_CELL_CLASS}>
                        <StatusBadge kind="message" value="failed" />
                      </TableCell>
                      <TableCell
                        className={`${TABLE_CELL_CLASS} max-w-[16rem] truncate text-ink-2`}
                        title={failure.errorMessage ?? "send_failed"}
                      >
                        {failure.errorMessage ?? "send_failed"}
                      </TableCell>
                      <TableCell className={`${TABLE_CELL_CLASS} text-ink-2`}>
                        {formatDate(failure.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Recent Opt-out Events" contentClassName="space-y-3">
          {summary.recentOptOutEvents.length === 0 ? (
            <EmptyState
              title="No recent opt-outs"
              description="Opt-out activity will appear here."
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/leads">View Leads</Link>
                </Button>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/60 bg-paper/20">
              <Table>
                <TableHeader>
                  <TableRow className={TABLE_ROW_CLASS}>
                    <TableHead className={TABLE_HEAD_CLASS}>Lead</TableHead>
                    <TableHead className={TABLE_HEAD_CLASS}>Status</TableHead>
                    <TableHead className={TABLE_HEAD_CLASS}>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.recentOptOutEvents.map((event) => (
                    <TableRow key={`${event.leadId}:${event.optedOutAt}`} className={TABLE_ROW_CLASS}>
                      <TableCell className={`${TABLE_CELL_CLASS} font-medium`}>{event.leadName}</TableCell>
                      <TableCell className={TABLE_CELL_CLASS}>
                        <Badge
                          variant="outline"
                          className="border-border/70 bg-paper/40 px-2.5 py-1 text-[11px] text-ink-2"
                        >
                          Opted Out
                        </Badge>
                      </TableCell>
                      <TableCell className={`${TABLE_CELL_CLASS} text-ink-2`}>
                        {formatDate(event.optedOutAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </SectionCard>
      </section>

      <section>
        <SectionCard
          title="Outbound Volume Heatmap (Last 7 Days)"
          description="Hover each cell for outbound message volume by weekday and hour."
        >
          <div className="relative overflow-x-auto">
            <div className="min-w-[900px] space-y-1">
              <div
                className="grid items-center gap-1"
                style={{ gridTemplateColumns: "56px repeat(24, minmax(0, 1fr))" }}
              >
                <span className="sticky left-0 z-10 rounded-sm bg-paper-2/95 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-ink-2">
                  DOW
                </span>
                {Array.from({ length: 24 }).map((_, hour) => (
                  <span key={`hour-${hour}`} className="text-center text-[10px] text-ink-3">
                    {hour}
                  </span>
                ))}
              </div>
              {DOW_LABELS.map((label, dow) => (
                <div
                  key={label}
                  className="grid items-center gap-1"
                  style={{ gridTemplateColumns: "56px repeat(24, minmax(0, 1fr))" }}
                >
                  <span className="sticky left-0 z-10 rounded-sm bg-paper-2/95 px-2 py-1 text-xs font-medium text-ink-2">
                    {label}
                  </span>
                  {Array.from({ length: 24 }).map((_, hour) => {
                    const count = heatByKey.get(`${dow}-${hour}`) ?? 0;

                    return (
                      <div
                        key={`${label}-${hour}`}
                        title={`${label} ${hour}:00 — ${count} outbound`}
                        className="h-5 rounded-sm border border-border/60"
                        style={{ backgroundColor: heatColor(count, maxHeatValue) }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-end gap-2 text-xs text-ink-2">
            <span>Low</span>
            <span aria-hidden>→</span>
            <span>High</span>
          </div>
        </SectionCard>
      </section>
    </GoldBotPageShell>
    );
  } catch (error) {
    logServerError("app/dashboard/(goldbot)/page", error);
    throw error;
  }
}
