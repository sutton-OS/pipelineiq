"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/goldbot/empty-state";
import { StatusBadge } from "@/components/goldbot/status-badge";
import { TableToolbar } from "@/components/goldbot/table-toolbar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type LeadFilterValue =
  | "awaiting_yes"
  | "awaiting_time_choice"
  | "booked"
  | "staff_attention"
  | "opted_out";

type LeadSortValue = "newest" | "oldest" | "state";

type LeadListRow = {
  id: string;
  fullName: string;
  phone: string;
  consentStatus: string;
  optedOut: boolean;
  state: string;
  needsStaffAttention: boolean;
  createdAt: string;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
};

type LastActivity = {
  direction: "inbound" | "outbound" | null;
  value: string | null;
};

const TABLE_HEAD_CLASS = "h-9 px-3 text-[11px] font-medium uppercase tracking-[0.1em] text-ink-2";
const TABLE_ROW_CLASS =
  "border-border/50 transition-colors hover:bg-paper/35 focus-within:bg-paper/35";
const TABLE_CELL_CLASS = "px-3 py-2.5 align-top text-sm text-ink";

const FILTER_CHIPS: Array<{ value: LeadFilterValue; label: string }> = [
  { value: "awaiting_yes", label: "Awaiting YES" },
  { value: "awaiting_time_choice", label: "Awaiting Time Choice" },
  { value: "booked", label: "Booked" },
  { value: "staff_attention", label: "Staff Attention" },
  { value: "opted_out", label: "Opted out" },
];

const SORT_OPTIONS: Array<{ value: LeadSortValue; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "state", label: "State" },
];

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

function toTimestamp(value: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(value);
  const timestamp = parsed.getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function getLastActivity(lead: LeadListRow): LastActivity {
  const inboundAt = toTimestamp(lead.lastInboundAt);
  const outboundAt = toTimestamp(lead.lastOutboundAt);

  if (inboundAt === null && outboundAt === null) {
    return { direction: null, value: null };
  }

  if (outboundAt === null || (inboundAt !== null && inboundAt >= outboundAt)) {
    return { direction: "inbound", value: lead.lastInboundAt };
  }

  return { direction: "outbound", value: lead.lastOutboundAt };
}

function matchesFilter(lead: LeadListRow, filter: LeadFilterValue): boolean {
  if (filter === "awaiting_yes") return lead.state === "awaiting_yes";
  if (filter === "awaiting_time_choice") return lead.state === "awaiting_time_choice";
  if (filter === "booked") return lead.state === "booked";
  if (filter === "staff_attention") return lead.needsStaffAttention;
  return lead.optedOut;
}

function sortLeads(leads: LeadListRow[], sortValue: LeadSortValue): LeadListRow[] {
  const sorted = [...leads];

  if (sortValue === "oldest") {
    sorted.sort((a, b) => (toTimestamp(a.createdAt) ?? 0) - (toTimestamp(b.createdAt) ?? 0));
    return sorted;
  }

  if (sortValue === "state") {
    sorted.sort((a, b) => {
      const byState = a.state.localeCompare(b.state);
      if (byState !== 0) return byState;
      return a.fullName.localeCompare(b.fullName);
    });
    return sorted;
  }

  sorted.sort((a, b) => (toTimestamp(b.createdAt) ?? 0) - (toTimestamp(a.createdAt) ?? 0));
  return sorted;
}

function isLeadFilterValue(value: string): value is LeadFilterValue {
  return FILTER_CHIPS.some((chip) => chip.value === value);
}

function isLeadSortValue(value: string): value is LeadSortValue {
  return SORT_OPTIONS.some((option) => option.value === value);
}

export function LeadsTable({ leads }: { leads: LeadListRow[] }) {
  const [searchValue, setSearchValue] = useState("");
  const [activeFilter, setActiveFilter] = useState<LeadFilterValue | undefined>(undefined);
  const [sortValue, setSortValue] = useState<LeadSortValue>("newest");

  const chipCounts = useMemo(
    () =>
      FILTER_CHIPS.map((chip) => ({
        ...chip,
        count: leads.filter((lead) => matchesFilter(lead, chip.value)).length,
      })),
    [leads],
  );

  const filteredLeads = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    const searched = normalizedSearch
      ? leads.filter((lead) => {
          const name = lead.fullName.toLowerCase();
          const phone = lead.phone.toLowerCase();
          return name.includes(normalizedSearch) || phone.includes(normalizedSearch);
        })
      : leads;

    const byFilter = activeFilter
      ? searched.filter((lead) => matchesFilter(lead, activeFilter))
      : searched;

    return sortLeads(byFilter, sortValue);
  }, [activeFilter, leads, searchValue, sortValue]);

  if (leads.length === 0) {
    return (
      <EmptyState
        title="No leads yet"
        description="Start your intake pipeline by creating your first lead."
        action={
          <Button asChild size="sm">
            <Link href="/dashboard/intake">New Lead Intake</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <TableToolbar
        searchValue={searchValue}
        onSearchValueChange={setSearchValue}
        searchPlaceholder="Search by name or phone"
        chips={chipCounts}
        activeChip={activeFilter}
        onChipChange={(chip) => {
          if (!isLeadFilterValue(chip)) return;
          setActiveFilter((currentFilter) => (currentFilter === chip ? undefined : chip));
        }}
        sortValue={sortValue}
        onSortValueChange={(nextSort) => {
          if (isLeadSortValue(nextSort)) {
            setSortValue(nextSort);
          }
        }}
        sortOptions={SORT_OPTIONS}
        sortAriaLabel="Sort leads"
      />

      {filteredLeads.length === 0 ? (
        <EmptyState
          title="No leads match this view"
          description="Try clearing search or toggling a different filter."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchValue("");
                setActiveFilter(undefined);
              }}
            >
              Reset filters
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-paper/20">
          <Table>
            <TableHeader>
              <TableRow className={TABLE_ROW_CLASS}>
                <TableHead className={TABLE_HEAD_CLASS}>Lead</TableHead>
                <TableHead className={TABLE_HEAD_CLASS}>State</TableHead>
                <TableHead className={TABLE_HEAD_CLASS}>Consent</TableHead>
                <TableHead className={TABLE_HEAD_CLASS}>Last Activity</TableHead>
                <TableHead className={TABLE_HEAD_CLASS}>Flags</TableHead>
                <TableHead className={TABLE_HEAD_CLASS}>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead) => {
                const lastActivity = getLastActivity(lead);

                return (
                  <TableRow key={lead.id} className={TABLE_ROW_CLASS}>
                    <TableCell className={TABLE_CELL_CLASS}>
                      <div className="space-y-0.5">
                        <p className="font-medium text-ink">{lead.fullName}</p>
                        <p className="text-xs text-ink-2">{lead.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell className={TABLE_CELL_CLASS}>
                      <StatusBadge kind="conversation" value={lead.state} />
                    </TableCell>
                    <TableCell className={TABLE_CELL_CLASS}>
                      <span className="text-sm text-ink-2">
                        {lead.optedOut ? "opted_out" : lead.consentStatus}
                      </span>
                    </TableCell>
                    <TableCell className={TABLE_CELL_CLASS}>
                      <div className="space-y-0.5">
                        <p className="text-sm text-ink">{formatDate(lastActivity.value)}</p>
                        <p className="text-xs uppercase tracking-[0.08em] text-ink-3">
                          {lastActivity.direction === "inbound"
                            ? "Inbound"
                            : lastActivity.direction === "outbound"
                              ? "Outbound"
                              : "No activity"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className={TABLE_CELL_CLASS}>
                      <div className="flex flex-wrap gap-1.5">
                        {lead.optedOut ? (
                          <span className="rounded-full border border-border/70 bg-paper/40 px-2 py-0.5 text-[11px] text-ink-2">
                            Opted-out
                          </span>
                        ) : null}
                        {lead.needsStaffAttention ? (
                          <span className="rounded-full border border-red-300/45 bg-red-500/15 px-2 py-0.5 text-[11px] text-red-100">
                            Staff attention
                          </span>
                        ) : null}
                        {!lead.optedOut && !lead.needsStaffAttention ? (
                          <span className="text-xs text-ink-3">—</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className={TABLE_CELL_CLASS}>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/leads/${lead.id}`}>Open</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
