"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { StaffQueueItem } from "@/lib/goldbot";
import { EmptyState } from "@/components/goldbot/empty-state";
import { StatusBadge } from "@/components/goldbot/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type StaffQueueTabsProps = {
  items: StaffQueueItem[];
};

type StaffQueueTab = "needs_attention" | "dead_jobs";

const TAB_LABELS: Record<StaffQueueTab, string> = {
  needs_attention: "Needs Attention",
  dead_jobs: "Dead Jobs",
};

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

function QueueTable({ items }: { items: StaffQueueItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-paper/20">
      <Table>
        <TableHeader>
          <TableRow className={TABLE_ROW_CLASS}>
            <TableHead className={TABLE_HEAD_CLASS}>Lead</TableHead>
            <TableHead className={TABLE_HEAD_CLASS}>State</TableHead>
            <TableHead className={TABLE_HEAD_CLASS}>Reason</TableHead>
            <TableHead className={TABLE_HEAD_CLASS}>Timestamp</TableHead>
            <TableHead className={TABLE_HEAD_CLASS}>Open Lead</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={`${item.type}:${item.id}`} className={TABLE_ROW_CLASS}>
              <TableCell className={`${TABLE_CELL_CLASS} font-medium`}>{item.leadName}</TableCell>
              <TableCell className={TABLE_CELL_CLASS}>
                <StatusBadge kind="conversation" value={item.state} />
              </TableCell>
              <TableCell className={`${TABLE_CELL_CLASS} max-w-lg whitespace-normal text-ink-2`}>
                {item.reason}
              </TableCell>
              <TableCell className={`${TABLE_CELL_CLASS} text-ink-2`}>
                {formatDate(item.createdAt)}
              </TableCell>
              <TableCell className={TABLE_CELL_CLASS}>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/leads/${item.leadId}`}>Open lead</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function StaffQueueTabs({ items }: StaffQueueTabsProps) {
  const [activeTab, setActiveTab] = useState<StaffQueueTab>("needs_attention");

  const { needsAttentionItems, deadJobItems } = useMemo(() => {
    const needsAttention = items.filter((item) => item.type === "staff_attention");
    const deadJobs = items.filter((item) => item.type === "dead_job");

    return {
      needsAttentionItems: needsAttention,
      deadJobItems: deadJobs,
    };
  }, [items]);

  const tabCounts = {
    needs_attention: needsAttentionItems.length,
    dead_jobs: deadJobItems.length,
  };

  const activeItems = activeTab === "needs_attention" ? needsAttentionItems : deadJobItems;

  return (
    <section className="space-y-4">
      <div
        className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-paper/30 p-1"
        role="tablist"
        aria-label="Staff queue sections"
      >
        {(Object.keys(TAB_LABELS) as StaffQueueTab[]).map((tab) => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`staff-queue-panel-${tab}`}
              id={`staff-queue-tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                isActive
                  ? "bg-paper-2 text-ink shadow-sm"
                  : "text-ink-2 hover:bg-paper/60 hover:text-ink",
              )}
            >
              {TAB_LABELS[tab]}
              <span className="ml-2 text-xs text-ink-3">{tabCounts[tab]}</span>
            </button>
          );
        })}
      </div>

      <div
        id={`staff-queue-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`staff-queue-tab-${activeTab}`}
        className="space-y-3"
      >
        {activeItems.length === 0 ? (
          <EmptyState
            title={
              activeTab === "needs_attention"
                ? "No conversations need staff attention"
                : "No dead worker jobs"
            }
            description={
              activeTab === "needs_attention"
                ? "Escalated conversations will appear here when manual follow-up is needed."
                : "Failed worker jobs will appear here if retries are exhausted."
            }
          />
        ) : (
          <QueueTable items={activeItems} />
        )}
      </div>
    </section>
  );
}
