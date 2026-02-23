"use client";

import { useMemo, useState } from "react";
import type { AuditListItem } from "@/lib/goldbot";
import { EmptyState } from "@/components/goldbot/empty-state";
import { TableToolbar } from "@/components/goldbot/table-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AuditLogTableProps = {
  entries: AuditListItem[];
};

type ResultFilter = "all" | "success" | "failure";

const TABLE_HEAD_CLASS =
  "h-9 px-3 text-[11px] font-medium uppercase tracking-[0.1em] text-ink-2";
const TABLE_ROW_CLASS = "border-border/50 hover:bg-paper/35";
const TABLE_CELL_CLASS = "px-3 py-2.5 align-top text-sm text-ink";

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

function toJsonString(value: Record<string, unknown> | null): string {
  if (!value) {
    return "{}";
  }

  return JSON.stringify(value, null, 2);
}

export function AuditLogTable({ entries }: AuditLogTableProps) {
  const [searchValue, setSearchValue] = useState("");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [selectedEntry, setSelectedEntry] = useState<AuditListItem | null>(null);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = searchValue.trim().toLowerCase();

    return entries.filter((entry) => {
      const resultMatches =
        resultFilter === "all" ||
        (resultFilter === "success" ? entry.success : !entry.success);

      if (!resultMatches) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const leadName = entry.leadName?.toLowerCase() ?? "";
      return leadName.includes(normalizedQuery);
    });
  }, [entries, resultFilter, searchValue]);

  const counts = useMemo(
    () => ({
      all: entries.length,
      success: entries.filter((entry) => entry.success).length,
      failure: entries.filter((entry) => !entry.success).length,
    }),
    [entries],
  );

  return (
    <section className="space-y-4">
      <TableToolbar
        searchValue={searchValue}
        onSearchValueChange={setSearchValue}
        searchPlaceholder="Search lead name"
        chips={[
          { label: "All", value: "all", count: counts.all },
          { label: "Success", value: "success", count: counts.success },
          { label: "Failure", value: "failure", count: counts.failure },
        ]}
        activeChip={resultFilter}
        onChipChange={(value) => {
          if (value === "all" || value === "success" || value === "failure") {
            setResultFilter(value);
          }
        }}
      />

      {filteredEntries.length === 0 ? (
        <EmptyState
          title="No matching audit entries"
          description="Try a different lead name or result filter."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-paper/20">
          <Table>
            <TableHeader>
              <TableRow className={TABLE_ROW_CLASS}>
                <TableHead className={TABLE_HEAD_CLASS}>Time</TableHead>
                <TableHead className={TABLE_HEAD_CLASS}>Action Type</TableHead>
                <TableHead className={TABLE_HEAD_CLASS}>Success</TableHead>
                <TableHead className={TABLE_HEAD_CLASS}>Lead Name</TableHead>
                <TableHead className={TABLE_HEAD_CLASS}>Error</TableHead>
                <TableHead className={TABLE_HEAD_CLASS}>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map((entry) => (
                <TableRow key={entry.id} className={TABLE_ROW_CLASS}>
                  <TableCell className={`${TABLE_CELL_CLASS} text-ink-2`}>
                    {formatDate(entry.createdAt)}
                  </TableCell>
                  <TableCell className={`${TABLE_CELL_CLASS} font-medium`}>
                    {entry.actionType}
                  </TableCell>
                  <TableCell className={TABLE_CELL_CLASS}>
                    <Badge
                      variant="outline"
                      className={
                        entry.success
                          ? "border-emerald-300/45 bg-emerald-500/15 px-2.5 py-1 text-[11px] text-emerald-100"
                          : "border-red-300/45 bg-red-500/15 px-2.5 py-1 text-[11px] text-red-100"
                      }
                    >
                      {entry.success ? "Success" : "Failure"}
                    </Badge>
                  </TableCell>
                  <TableCell className={TABLE_CELL_CLASS}>{entry.leadName ?? "-"}</TableCell>
                  <TableCell className={`${TABLE_CELL_CLASS} max-w-lg whitespace-normal text-ink-2`}>
                    {entry.errorMessage ?? "-"}
                  </TableCell>
                  <TableCell className={TABLE_CELL_CLASS}>
                    <Button size="sm" variant="outline" onClick={() => setSelectedEntry(entry)}>
                      View JSON
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={selectedEntry !== null} onOpenChange={(open) => (!open ? setSelectedEntry(null) : null)}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto border-border/70 bg-paper-2/95 sm:max-w-xl"
        >
          {selectedEntry ? (
            <>
              <SheetHeader className="border-b border-border/60 p-5 text-left">
                <SheetTitle className="text-base">{selectedEntry.actionType}</SheetTitle>
                <SheetDescription className="text-xs text-ink-2">
                  {formatDate(selectedEntry.createdAt)} · {selectedEntry.leadName ?? "Unknown lead"}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 p-5">
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.1em] text-ink-2">
                    Decision JSON
                  </p>
                  <pre className="overflow-x-auto rounded-lg border border-border/70 bg-black/40 p-3 text-xs leading-relaxed text-ink">
                    {toJsonString(selectedEntry.decisionJson)}
                  </pre>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.1em] text-ink-2">
                    Result JSON
                  </p>
                  <pre className="overflow-x-auto rounded-lg border border-border/70 bg-black/40 p-3 text-xs leading-relaxed text-ink">
                    {toJsonString(selectedEntry.resultJson)}
                  </pre>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}
