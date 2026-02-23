import type { Metadata } from "next";
import Link from "next/link";
import { requireUserId } from "@/lib/auth";
import { ensureOrgAndLocation, listAuditEntries } from "@/lib/goldbot";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  title: "Audit Log",
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

export default async function AuditPage() {
  const userId = await requireUserId();
  const context = await ensureOrgAndLocation(userId);
  const entries = await listAuditEntries(context);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl font-serif">Audit Log</h1>
          <p className="text-sm text-ink-2">
            Policy decisions and action attempts from the ActionGateway.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/api/audit/export?limit=5000">Download CSV Export</Link>
        </Button>
      </header>

      <Card className="border-border bg-white/70">
        <CardHeader>
          <CardTitle>Recent Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-ink-2">No audit entries yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Policy</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{formatDate(entry.createdAt)}</TableCell>
                    <TableCell>{entry.actionType}</TableCell>
                    <TableCell>
                      <Badge variant={entry.success ? "default" : "secondary"}>
                        {entry.success ? "success" : "blocked/failed"}
                      </Badge>
                    </TableCell>
                    <TableCell>{entry.leadName ?? "-"}</TableCell>
                    <TableCell>{entry.policyVersion}</TableCell>
                    <TableCell className="max-w-sm whitespace-normal">
                      {entry.errorMessage ?? "-"}
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
