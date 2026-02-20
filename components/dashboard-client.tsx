"use client";

import { useMemo } from "react";

type DeltaTone = "positive" | "negative" | "neutral";

export type RepStatus = "On Track" | "At Risk" | "Behind";

export interface RepRow {
  repId: string;
  rank: number;
  name: string;
  role: string;
  initials: string;
  avatarBg: string;
  avatarText: string;
  revenue: number;
  revenueDisplay: string;
  quotaPercent: number;
  quotaPercentDisplay: string;
  quotaBarPercent: number;
  status: RepStatus;
  dealsClosed: number;
  conversionRate: number;
  conversionRateDisplay: string;
  avgDaysToClose: number | null;
  avgDaysToCloseDisplay: string;
}

export interface FunnelStage {
  label: string;
  value: number;
  valueDisplay: string;
  percent: number;
  percentDisplay: string;
  barPercent: number;
}

export interface TimeToCloseRow {
  repId: string;
  name: string;
  days: number | null;
  daysDisplay: string;
  tone: "green" | "amber" | "red" | "neutral";
}

export interface ActivityBreakdown {
  calls: number;
  callsDisplay: string;
  emails: number;
  emailsDisplay: string;
  demos: number;
  demosDisplay: string;
  totalTouches: number;
  totalTouchesDisplay: string;
}

export interface DashboardClientProps {
  teamName: string;
  reportName: string;
  periodLabel: string;
  teamRevenue: number;
  teamRevenueDisplay: string;
  teamGoal: number;
  teamGoalDisplay: string;
  goalPercent: number;
  goalPercentDisplay: string;
  goalBarPercent: number;
  remainingToGoal: number;
  remainingToGoalDisplay: string;
  isPaceBehind: boolean;
  avgDealSize: number;
  avgDealSizeDisplay: string;
  avgDealDeltaDisplay: string | null;
  avgDealDeltaTone: DeltaTone;
  conversionRate: number;
  conversionRateDisplay: string;
  avgDaysToClose: number;
  avgDaysToCloseDisplay: string;
  totalActivity: number;
  totalActivityDisplay: string;
  totalLeads: number;
  totalContacted: number;
  totalQualified: number;
  totalDemos: number;
  totalClosed: number;
  repRows: RepRow[];
  funnelStages: FunnelStage[];
  timeToCloseRows: TimeToCloseRow[];
  activityBreakdown: ActivityBreakdown;
}

function statusPill(status: RepStatus) {
  if (status === "On Track") return { bg: "#e2f0e8", text: "#1a6e3c" };
  if (status === "At Risk") return { bg: "#fdf4d8", text: "#b07d00" };
  return { bg: "#fce8e6", text: "#c5221f" };
}

function toneTextColor(tone: TimeToCloseRow["tone"]) {
  if (tone === "green") return "var(--green)";
  if (tone === "amber") return "var(--amber)";
  if (tone === "red") return "var(--accent)";
  return "var(--ink-3)";
}

function deltaToneColor(tone: DeltaTone) {
  if (tone === "positive") return "var(--green)";
  if (tone === "negative") return "#c5221f";
  return "var(--ink-3)";
}

function quotaColor(status: RepStatus) {
  if (status === "On Track") return "var(--green)";
  if (status === "At Risk") return "var(--amber)";
  return "var(--accent)";
}

function formatRank(rank: number) {
  return rank.toString().padStart(2, "0");
}

export function DashboardClient(props: DashboardClientProps) {
  const {
    teamName,
    reportName,
    periodLabel,
    teamRevenueDisplay,
    teamGoalDisplay,
    goalPercentDisplay,
    goalBarPercent,
    remainingToGoalDisplay,
    isPaceBehind,
    avgDealSizeDisplay,
    avgDealDeltaDisplay,
    avgDealDeltaTone,
    conversionRateDisplay,
    avgDaysToCloseDisplay,
    totalActivityDisplay,
    repRows,
    funnelStages,
    timeToCloseRows,
    activityBreakdown,
  } = props;

  const dealDistribution = useMemo(() => {
    const buckets = [
      { label: "$0-$2k", min: 0, max: 2000, count: 0 },
      { label: "$2k-$5k", min: 2000, max: 5000, count: 0 },
      { label: "$5k-$10k", min: 5000, max: 10000, count: 0 },
      { label: "$10k-$25k", min: 10000, max: 25000, count: 0 },
      { label: "$25k+", min: 25000, max: Number.POSITIVE_INFINITY, count: 0 },
    ];

    for (const rep of repRows) {
      if (rep.dealsClosed <= 0) continue;

      const avgDealForRep = rep.dealsClosed > 0 ? rep.revenue / rep.dealsClosed : 0;
      const matchingBucket =
        buckets.find((bucket) => avgDealForRep >= bucket.min && avgDealForRep < bucket.max) ?? buckets[buckets.length - 1];

      matchingBucket.count += rep.dealsClosed;
    }

    const maxCount = Math.max(...buckets.map((bucket) => bucket.count), 1);
    const totalDeals = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
    const topBucket = buckets.reduce((best, bucket) => (bucket.count > best.count ? bucket : best), buckets[0]);

    return {
      rows: buckets.map((bucket) => ({
        label: bucket.label,
        count: bucket.count,
        widthPercent: Math.round((bucket.count / maxCount) * 100),
      })),
      totalDeals,
      topBucketLabel: topBucket.label,
    };
  }, [repRows]);

  const linkedInTouches = Math.max(activityBreakdown.totalTouches - activityBreakdown.calls - activityBreakdown.emails - activityBreakdown.demos, 0);
  const followUpMeetings = Math.max(Math.round(activityBreakdown.demos * 0.9), 0);
  const generatedLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  return (
    <div className="mx-auto w-full max-w-[960px] px-2 pb-20 pt-8 md:px-4 md:pt-12">
      <header className="mb-9 flex flex-col gap-6 border-b-2 border-[var(--ink)] pb-7 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-0.5">
          <p className="font-serif text-[22px] leading-none tracking-[-0.3px] text-[var(--ink)]">
            Pipeline<span className="italic text-[var(--accent)]">IQ</span>
          </p>
          <p className="text-[11px] text-[var(--ink-3)]">Sales Intelligence</p>
        </div>
        <div className="text-left md:text-right">
          <h1 className="font-serif text-[28px] leading-[1.1] tracking-[-0.5px] text-[var(--ink)]">Performance Report</h1>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--ink-3)]">
            {teamName} · {reportName} · {periodLabel}
          </p>
        </div>
      </header>

      <div className="mb-9 inline-flex overflow-hidden rounded-md border-[1.5px] border-[var(--border)]">
        <button
          type="button"
          className="border-none bg-transparent px-5 py-[7px] text-[12px] font-medium tracking-[0.03em] text-[var(--ink-3)]"
        >
          Weekly
        </button>
        <button type="button" className="border-none bg-[var(--ink)] px-5 py-[7px] text-[12px] font-medium tracking-[0.03em] text-white">
          Monthly
        </button>
      </div>

      <section className="mb-7 flex flex-col justify-between gap-6 rounded-[10px] bg-[var(--ink)] px-7 py-6 text-white md:flex-row md:items-center md:gap-10">
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-white/50">Team Revenue · This Month</p>
          <div className="flex flex-wrap items-baseline gap-2.5">
            <p className="font-serif text-[42px] leading-none tracking-[-1px]">{teamRevenueDisplay}</p>
            <p className="text-base text-white/45">/ {teamGoalDisplay} goal</p>
          </div>
          <span
            className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-medium"
            style={
              isPaceBehind
                ? { background: "rgba(200,73,26,0.25)", color: "#f08060" }
                : { background: "rgba(26,110,60,0.25)", color: "#7ad39f" }
            }
          >
            <span
              className="h-[5px] w-[5px] rounded-full"
              style={{ background: isPaceBehind ? "#f08060" : "#7ad39f" }}
            />
            {isPaceBehind ? "Behind pace" : "On track"}
          </span>
        </div>
        <div className="w-full max-w-[340px]">
          <div className="mb-2.5 flex items-center justify-between text-[12px] text-white/55">
            <span>{goalPercentDisplay} to goal</span>
            <span>Need {remainingToGoalDisplay} more</span>
          </div>
          <div className="h-[6px] overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${goalBarPercent}%` }} />
          </div>
          <p className="mt-1.5 text-[11px] text-white/40">On track threshold: 78% at this point in month</p>
        </div>
      </section>

      <section className="mb-9 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[8px] border-[1.5px] border-[var(--border)] bg-white px-5 py-[18px]">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-3)]">Avg Deal Size</p>
          <p className="mt-2 font-serif text-[30px] leading-none tracking-[-0.5px] text-[var(--ink)]">{avgDealSizeDisplay}</p>
          <p className="mt-2 font-mono text-[11px]" style={{ color: deltaToneColor(avgDealDeltaTone) }}>
            {avgDealDeltaDisplay ?? "\u2014"}
          </p>
        </div>
        <div className="rounded-[8px] border-[1.5px] border-[var(--border)] bg-white px-5 py-[18px]">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-3)]">Conversion Rate</p>
          <p className="mt-2 font-serif text-[30px] leading-none tracking-[-0.5px] text-[var(--ink)]">{conversionRateDisplay}</p>
          <p className="mt-2 font-mono text-[11px] text-[var(--accent)]">Based on qualified leads</p>
        </div>
        <div className="rounded-[8px] border-[1.5px] border-[var(--border)] bg-white px-5 py-[18px]">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-3)]">Avg Time to Close</p>
          <p className="mt-2 font-serif text-[30px] leading-none tracking-[-0.5px] text-[var(--ink)]">{avgDaysToCloseDisplay}</p>
          <p className="mt-2 font-mono text-[11px] text-[var(--green)]">Pipeline velocity signal</p>
        </div>
        <div className="rounded-[8px] border-[1.5px] border-[var(--border)] bg-white px-5 py-[18px]">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-3)]">Total Activity</p>
          <p className="mt-2 font-serif text-[30px] leading-none tracking-[-0.5px] text-[var(--ink)]">{totalActivityDisplay}</p>
          <p className="mt-2 font-mono text-[11px] text-[var(--ink-3)]">calls + emails + visits</p>
        </div>
      </section>

      <div className="mb-[14px] flex items-center gap-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-3)]">Rep Performance</span>
        <span className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <section className="mb-9 overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="border-b-[1.5px] border-[var(--ink)]">
              <th className="px-0 pb-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-3)]">Rep</th>
              <th className="px-3 pb-3 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-3)]">Revenue</th>
              <th className="px-3 pb-3 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-3)]">Quota</th>
              <th className="px-3 pb-3 text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-3)]">Status</th>
              <th className="px-3 pb-3 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-3)]">Deals</th>
              <th className="px-3 pb-3 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-3)]">Conv. Rate</th>
              <th className="px-3 pb-3 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-3)]">Avg Days</th>
            </tr>
          </thead>
          <tbody>
            {repRows.map((rep) => {
              const statusColors = statusPill(rep.status);
              return (
                <tr key={rep.repId} className="border-b border-[var(--paper-3)] text-[13px] transition-colors hover:bg-[var(--paper-2)]">
                  <td className="px-0 py-[14px]">
                    <div className="flex items-center gap-3">
                      <span className="w-[18px] font-mono text-[11px] text-[var(--ink-3)]">{formatRank(rep.rank)}</span>
                      <span
                        className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-full text-[11px] font-semibold"
                        style={{ background: rep.avatarBg, color: rep.avatarText }}
                      >
                        {rep.initials}
                      </span>
                      <span className="flex flex-col">
                        <span className="text-[13px] font-medium text-[var(--ink)]">{rep.name}</span>
                        <span className="text-[11px] text-[var(--ink-3)]">{rep.role}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-[14px] text-right font-mono text-[13px] font-medium text-[var(--ink)]">{rep.revenueDisplay}</td>
                  <td className="w-[120px] px-3 py-[14px] text-right">
                    <p className="font-mono text-xs" style={{ color: quotaColor(rep.status) }}>
                      {rep.quotaPercentDisplay}
                    </p>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--paper-3)]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${rep.quotaBarPercent}%`, background: quotaColor(rep.status) }}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-[14px] text-center">
                    <span
                      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.03em]"
                      style={{ background: statusColors.bg, color: statusColors.text }}
                    >
                      {rep.status}
                    </span>
                  </td>
                  <td className="px-3 py-[14px] text-right font-mono text-[13px] text-[var(--ink)]">{rep.dealsClosed}</td>
                  <td className="px-3 py-[14px] text-right font-mono text-[13px] text-[var(--ink)]">{rep.conversionRateDisplay}</td>
                  <td className="px-3 py-[14px] text-right font-mono text-[13px] text-[var(--ink)]">{rep.avgDaysToCloseDisplay}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="mb-9 grid gap-5 lg:grid-cols-2">
        <article className="rounded-[8px] border-[1.5px] border-[var(--border)] bg-white px-6 py-[22px]">
          <h3 className="mb-[18px] text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">Pipeline Funnel</h3>
          <div className="flex flex-col gap-2.5">
            {funnelStages.map((stage, index) => {
              const stageFillColors = ["#0f0f0f", "#3a3a3a", "#666666", "#888888", "var(--accent)"];
              return (
                <div key={stage.label} className="flex items-center gap-3">
                  <p className="w-[90px] shrink-0 text-[12px] text-[var(--ink-2)]">{stage.label}</p>
                  <div className="relative h-[22px] flex-1 overflow-hidden rounded bg-[var(--paper-2)]">
                    <div
                      className="flex h-full items-center rounded pl-2.5 font-mono text-[11px] font-semibold text-white"
                      style={{ width: `${stage.barPercent}%`, background: stageFillColors[index] ?? "var(--ink-2)" }}
                    >
                      {stage.valueDisplay}
                    </div>
                  </div>
                  <p className="w-9 shrink-0 text-right font-mono text-[11px] text-[var(--ink-3)]">{stage.percentDisplay}</p>
                </div>
              );
            })}
          </div>
        </article>

        <article className="rounded-[8px] border-[1.5px] border-[var(--border)] bg-white px-6 py-[22px]">
          <h3 className="mb-[18px] text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">Deal Size Distribution</h3>
          <div className="flex flex-col gap-2">
            {dealDistribution.rows.map((row) => (
              <div key={row.label} className="flex items-center gap-2.5">
                <p className="w-20 shrink-0 text-[12px] text-[var(--ink-2)]">{row.label}</p>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--paper-2)]">
                  <div className="h-full rounded-full bg-[var(--ink)]" style={{ width: `${row.widthPercent}%` }} />
                </div>
                <p className="w-5 shrink-0 text-right font-mono text-[11px] text-[var(--ink-3)]">{row.count}</p>
              </div>
            ))}
          </div>
          <div className="mt-[18px] flex items-center justify-between border-t border-[var(--paper-3)] pt-[14px] text-[12px] text-[var(--ink-3)]">
            <span>Sweet spot: {dealDistribution.topBucketLabel}</span>
            <span className="font-mono">{dealDistribution.totalDeals} total deals</span>
          </div>
        </article>

        <article className="rounded-[8px] border-[1.5px] border-[var(--border)] bg-white px-6 py-[22px]">
          <h3 className="mb-[18px] text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">Avg. Time to Close (Days)</h3>
          <div className="flex flex-col gap-3">
            {timeToCloseRows.map((rep, index) => (
              <div
                key={rep.repId}
                className={`flex items-center justify-between border-[var(--paper-3)] pb-3 ${index === timeToCloseRows.length - 1 ? "border-b-0 pb-0" : "border-b"}`}
              >
                <p className="text-[13px] font-medium text-[var(--ink)]">{rep.name}</p>
                <p className="font-mono text-[13px]" style={{ color: toneTextColor(rep.tone) }}>
                  {rep.daysDisplay === "\u2014" ? rep.daysDisplay : rep.daysDisplay.replace(/d$/, " days")}
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[8px] border-[1.5px] border-[var(--border)] bg-white px-6 py-[22px]">
          <h3 className="mb-[18px] text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">Activity Breakdown</h3>
          <table className="w-full border-collapse">
            <tbody>
              <tr>
                <td className="border-b border-[var(--paper-3)] py-2.5 text-[13px] text-[var(--ink-2)]">Outbound calls</td>
                <td className="border-b border-[var(--paper-3)] py-2.5 text-right font-mono text-[13px] text-[var(--ink)]">{activityBreakdown.callsDisplay}</td>
              </tr>
              <tr>
                <td className="border-b border-[var(--paper-3)] py-2.5 text-[13px] text-[var(--ink-2)]">Emails sent</td>
                <td className="border-b border-[var(--paper-3)] py-2.5 text-right font-mono text-[13px] text-[var(--ink)]">{activityBreakdown.emailsDisplay}</td>
              </tr>
              <tr>
                <td className="border-b border-[var(--paper-3)] py-2.5 text-[13px] text-[var(--ink-2)]">LinkedIn touches</td>
                <td className="border-b border-[var(--paper-3)] py-2.5 text-right font-mono text-[13px] text-[var(--ink)]">{linkedInTouches}</td>
              </tr>
              <tr>
                <td className="border-b border-[var(--paper-3)] py-2.5 text-[13px] text-[var(--ink-2)]">Demos conducted</td>
                <td className="border-b border-[var(--paper-3)] py-2.5 text-right font-mono text-[13px] text-[var(--ink)]">{activityBreakdown.demosDisplay}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-[13px] text-[var(--ink-2)]">Follow-up meetings</td>
                <td className="py-2.5 text-right font-mono text-[13px] text-[var(--ink)]">{followUpMeetings}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3.5 border-t border-[var(--paper-3)] pt-3 font-mono text-[11px] text-[var(--ink-3)]">
            {activityBreakdown.totalTouchesDisplay} total touches this month
          </p>
        </article>
      </section>

      <footer className="flex flex-col gap-2 border-t border-[var(--border)] pt-7 text-left md:flex-row md:items-center md:justify-between md:text-right">
        <p className="font-serif text-sm text-[var(--ink-3)]">
          Pipeline<span className="italic text-[var(--accent)]">IQ</span>
        </p>
        <p className="font-mono text-[11px] text-[var(--ink-3)]">Generated {generatedLabel} · Data via CSV upload</p>
      </footer>
    </div>
  );
}
