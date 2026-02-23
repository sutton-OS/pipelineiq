import type { Metadata } from "next";
import Link from "next/link";
import { requireUserId } from "@/lib/auth";
import {
  ensureOrgAndLocation,
  getDashboardSummary,
  listLeadsForLocation,
} from "@/lib/goldbot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = {
  title: "Dashboard",
};

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="border-border bg-white/70">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-ink-2">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-serif">{value}</p>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const userId = await requireUserId();
  const context = await ensureOrgAndLocation(userId);

  const [summary, leads] = await Promise.all([
    getDashboardSummary(context),
    listLeadsForLocation(context),
  ]);

  const recentLeads = leads.slice(0, 8);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl font-serif">GoldBot Operations</h1>
          <p className="text-sm text-ink-2">
            {context.locationName} ({context.timezone})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href="/dashboard/intake">New Lead Intake</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/staff-queue">Needs Staff Attention</Link>
          </Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Leads" value={summary.totalLeads} />
        <MetricCard label="Booked" value={summary.bookedConversations} />
        <MetricCard label="Awaiting YES" value={summary.awaitingYes} />
        <MetricCard label="Awaiting Time Choice" value={summary.awaitingTimeChoice} />
        <MetricCard label="Staff Attention" value={summary.staffAttention} />
        <MetricCard label="Dead Jobs" value={summary.deadJobs} />
        <MetricCard label="Outbound (24h)" value={summary.outboundLast24h} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border bg-white/70">
          <CardHeader>
            <CardTitle>Recent Leads</CardTitle>
          </CardHeader>
          <CardContent>
            {recentLeads.length === 0 ? (
              <p className="text-sm text-ink-2">No leads yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Consent</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>{lead.fullName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{lead.state}</Badge>
                      </TableCell>
                      <TableCell>{lead.optedOut ? "opted_out" : lead.consentStatus}</TableCell>
                      <TableCell>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/dashboard/leads/${lead.id}`}>Open</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-white/70">
          <CardHeader>
            <CardTitle>Recent Messages</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.recentMessages.length === 0 ? (
              <p className="text-sm text-ink-2">No message activity.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Dir</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Body</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.recentMessages.map((message) => (
                    <TableRow key={message.id}>
                      <TableCell>{formatDate(message.createdAt)}</TableCell>
                      <TableCell>{message.leadName}</TableCell>
                      <TableCell>{message.direction}</TableCell>
                      <TableCell>{message.status}</TableCell>
                      <TableCell className="max-w-xs whitespace-normal">{message.body}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
