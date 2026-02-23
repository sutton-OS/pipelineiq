import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { ensureOrgAndLocation, getLeadDetail } from "@/lib/goldbot";
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
  title: "Lead Detail",
};

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl font-serif">{lead.fullName}</h1>
          <p className="text-sm text-ink-2">{lead.phone}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/leads">Back to Leads</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/inbound-sim">Simulate Reply</Link>
          </Button>
        </div>
      </header>

      <Card className="border-border bg-white/70">
        <CardHeader>
          <CardTitle>Conversation Status</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-3">
          <div>
            <p className="text-ink-2">State</p>
            <Badge variant="outline">{lead.state}</Badge>
          </div>
          <div>
            <p className="text-ink-2">Consent</p>
            <p className="font-medium">{lead.optedOut ? "opted_out" : lead.consentStatus}</p>
          </div>
          <div>
            <p className="text-ink-2">Invalid Replies</p>
            <p className="font-medium">{lead.invalidResponseCount}</p>
          </div>
          <div>
            <p className="text-ink-2">Needs Staff Attention</p>
            <p className="font-medium">{lead.needsStaffAttention ? "Yes" : "No"}</p>
          </div>
          <div>
            <p className="text-ink-2">Last Inbound</p>
            <p className="font-medium">{lead.lastInboundAt ? formatDate(lead.lastInboundAt) : "-"}</p>
          </div>
          <div>
            <p className="text-ink-2">Last Outbound</p>
            <p className="font-medium">{lead.lastOutboundAt ? formatDate(lead.lastOutboundAt) : "-"}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-white/70">
        <CardHeader>
          <CardTitle>Messages</CardTitle>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <p className="text-sm text-ink-2">No messages yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Body</TableHead>
                  <TableHead>Provider ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.map((message) => (
                  <TableRow key={message.id}>
                    <TableCell>{formatDate(message.createdAt)}</TableCell>
                    <TableCell>{message.direction}</TableCell>
                    <TableCell>{message.status}</TableCell>
                    <TableCell className="max-w-xl whitespace-normal">{message.body}</TableCell>
                    <TableCell>{message.providerMessageId ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-white/70">
        <CardHeader>
          <CardTitle>Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <p className="text-sm text-ink-2">No appointments booked.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map((appointment) => (
                  <TableRow key={appointment.id}>
                    <TableCell>{formatDate(appointment.startsAt)}</TableCell>
                    <TableCell>{formatDate(appointment.endsAt)}</TableCell>
                    <TableCell>{appointment.status}</TableCell>
                    <TableCell>{appointment.notes ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
