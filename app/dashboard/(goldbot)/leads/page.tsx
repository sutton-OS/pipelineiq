import type { Metadata } from "next";
import Link from "next/link";
import { requireUserId } from "@/lib/auth";
import { ensureOrgAndLocation, listLeadsForLocation } from "@/lib/goldbot";
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
  title: "Leads",
};

function formatDate(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function stateBadgeVariant(state: string): "default" | "secondary" | "outline" {
  if (state === "booked") return "default";
  if (state === "needs_staff_attention") return "secondary";
  return "outline";
}

export default async function LeadsPage() {
  const userId = await requireUserId();
  const context = await ensureOrgAndLocation(userId);
  const leads = await listLeadsForLocation(context);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl font-serif">Leads</h1>
          <p className="text-sm text-ink-2">
            {context.locationName} ({context.timezone})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href="/dashboard/intake">New Lead Intake</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/inbound-sim">Inbound SMS Simulator</Link>
          </Button>
        </div>
      </header>

      <Card className="border-border bg-white/70">
        <CardHeader>
          <CardTitle>Lead List</CardTitle>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <p className="text-sm text-ink-2">No leads yet. Start with manual intake.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Consent</TableHead>
                  <TableHead>Last Inbound</TableHead>
                  <TableHead>Last Outbound</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.fullName}</TableCell>
                    <TableCell>{lead.phone}</TableCell>
                    <TableCell>
                      <Badge variant={stateBadgeVariant(lead.state)}>{lead.state}</Badge>
                      {lead.needsStaffAttention ? (
                        <Badge className="ml-2" variant="secondary">
                          Staff
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {lead.optedOut ? "opted_out" : lead.consentStatus}
                    </TableCell>
                    <TableCell>{formatDate(lead.lastInboundAt)}</TableCell>
                    <TableCell>{formatDate(lead.lastOutboundAt)}</TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/leads/${lead.id}`}>View</Link>
                      </Button>
                    </TableCell>
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
