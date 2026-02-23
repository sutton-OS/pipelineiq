import type { Metadata } from "next";
import Link from "next/link";
import { requireUserId } from "@/lib/auth";
import { ensureOrgAndLocation, listStaffQueue } from "@/lib/goldbot";
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
  title: "Needs Staff Attention",
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

export default async function StaffQueuePage() {
  const userId = await requireUserId();
  const context = await ensureOrgAndLocation(userId);
  const queueItems = await listStaffQueue(context);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-4xl font-serif">Needs Staff Attention</h1>
        <p className="text-sm text-ink-2">
          Dead jobs and escalated conversations requiring manual follow-up.
        </p>
      </header>

      <Card className="border-border bg-white/70">
        <CardHeader>
          <CardTitle>Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {queueItems.length === 0 ? (
            <p className="text-sm text-ink-2">No blocked or escalated items.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queueItems.map((item) => (
                  <TableRow key={`${item.type}:${item.id}`}>
                    <TableCell>
                      <Badge variant={item.type === "dead_job" ? "secondary" : "outline"}>
                        {item.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.leadName}</TableCell>
                    <TableCell>{item.state}</TableCell>
                    <TableCell className="max-w-sm whitespace-normal">{item.reason}</TableCell>
                    <TableCell>{formatDate(item.createdAt)}</TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/leads/${item.leadId}`}>Open Lead</Link>
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
