"use client";

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

function tonePill(tone: TimeToCloseRow["tone"]) {
  if (tone === "green") return { bg: "#e2f0e8", text: "#1a6e3c" };
  if (tone === "amber") return { bg: "#fdf4d8", text: "#b07d00" };
  if (tone === "red") return { bg: "#fce8e6", text: "#c5221f" };
  return { bg: "var(--paper-2)", text: "var(--ink-2)" };
}

function deltaToneColor(tone: DeltaTone) {
  if (tone === "positive") return "var(--green)";
  if (tone === "negative") return "#c5221f";
  return "var(--ink-3)";
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

  return (
    <div className="space-y-6 md:space-y-8">
      <section
        className="rounded-3xl px-6 py-7 shadow-[0_18px_44px_rgba(15,15,15,0.2)] md:px-8 md:py-8"
        style={{ background: "var(--ink)", color: "white" }}
      >
        <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:items-center">
          <div>
            <p className="text-[12px] uppercase tracking-[0.12em] text-white/65">Team Revenue · This Month</p>
            <p className="mt-3 font-serif text-5xl leading-[0.95] md:text-6xl">{teamRevenueDisplay}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="text-white/75">Target {teamGoalDisplay}</span>
              <span
                className="rounded-full px-3 py-1 text-[12px] font-medium"
                style={
                  isPaceBehind
                    ? { background: "#fce8e6", color: "#c5221f" }
                    : { background: "#e2f0e8", color: "#1a6e3c" }
                }
              >
                {isPaceBehind ? "Behind pace" : "On track"}
              </span>
            </div>
            <p className="mt-3 text-xs text-white/55">
              {teamName} · {reportName} · {periodLabel}
            </p>
          </div>

          <div>
            <div className="h-3 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${goalBarPercent}%`,
                  background: "linear-gradient(90deg, #f5e8e2, #c8491a)",
                }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-sm text-white/80">
              <span>{goalPercentDisplay} to goal</span>
              <span>Need {remainingToGoalDisplay} more</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--paper)" }}>
          <p className="text-xs uppercase tracking-[0.1em] text-ink-3">Avg Deal Size</p>
          <p className="mt-2 font-mono text-2xl text-ink">{avgDealSizeDisplay}</p>
          <p className="mt-2 text-xs" style={{ color: deltaToneColor(avgDealDeltaTone) }}>
            {avgDealDeltaDisplay ?? "\u2014"}
          </p>
        </div>

        <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--paper)" }}>
          <p className="text-xs uppercase tracking-[0.1em] text-ink-3">Conversion Rate</p>
          <p className="mt-2 font-mono text-2xl text-ink">{conversionRateDisplay}</p>
          <p className="mt-2 text-xs text-ink-3">Qualified / Leads</p>
        </div>

        <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--paper)" }}>
          <p className="text-xs uppercase tracking-[0.1em] text-ink-3">Avg Time to Close</p>
          <p className="mt-2 font-mono text-2xl text-ink">{avgDaysToCloseDisplay}</p>
          <p className="mt-2 text-xs text-ink-3">Across active reps</p>
        </div>

        <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--paper)" }}>
          <p className="text-xs uppercase tracking-[0.1em] text-ink-3">Total Activity</p>
          <p className="mt-2 font-mono text-2xl text-ink">{totalActivityDisplay}</p>
          <p className="mt-2 text-xs text-ink-3">Calls + Emails + Demos</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)", background: "var(--paper)" }}>
        <div className="border-b px-5 py-4 md:px-6" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-base font-medium text-ink">Rep Leaderboard</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.08em] text-ink-3 transition-colors hover:bg-paper-2">
                <th className="px-4 py-3 md:px-6">#</th>
                <th className="px-4 py-3">Rep</th>
                <th className="px-4 py-3">Revenue</th>
                <th className="px-4 py-3">Quota</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Closed</th>
                <th className="px-4 py-3">Conv.</th>
                <th className="px-4 py-3">Avg Days</th>
              </tr>
            </thead>
            <tbody>
              {repRows.map((rep) => {
                const statusColors = statusPill(rep.status);

                return (
                  <tr
                    key={rep.repId}
                    className="border-t text-ink transition-colors hover:bg-paper-2"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="px-4 py-3 font-mono text-ink-3 md:px-6">{rep.rank}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold"
                          style={{ background: rep.avatarBg, color: rep.avatarText }}
                        >
                          {rep.initials}
                        </span>
                        <span>
                          <span className="block font-medium text-ink">{rep.name}</span>
                          <span className="block text-xs text-ink-3">{rep.role}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono">{rep.revenueDisplay}</td>
                    <td className="px-4 py-3">
                      <div className="min-w-[160px]">
                        <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--paper-2)" }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${rep.quotaBarPercent}%`,
                              background: "linear-gradient(90deg, #f5e8e2, #c8491a)",
                            }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-ink-3">{rep.quotaPercentDisplay}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
                        style={{ background: statusColors.bg, color: statusColors.text }}
                      >
                        {rep.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">{rep.dealsClosed}</td>
                    <td className="px-4 py-3 font-mono">{rep.conversionRateDisplay}</td>
                    <td className="px-4 py-3 font-mono">{rep.avgDaysToCloseDisplay}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border p-5 md:p-6" style={{ borderColor: "var(--border)", background: "var(--paper)" }}>
          <h3 className="text-base font-medium text-ink">Pipeline Funnel</h3>
          <div className="mt-4 space-y-3">
            {funnelStages.map((stage) => (
              <div key={stage.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-ink-2">{stage.label}</span>
                  <span className="font-mono text-ink">
                    {stage.valueDisplay} ({stage.percentDisplay})
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--paper-2)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${stage.barPercent}%`,
                      background: "linear-gradient(90deg, #e0ddd6, #0f0f0f)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="flex min-h-[260px] flex-col justify-between rounded-2xl border p-5 md:p-6"
          style={{ borderColor: "var(--border)", background: "var(--paper)" }}
        >
          <h3 className="text-base font-medium text-ink">Deal Size Distribution</h3>
          <div className="flex flex-1 items-center justify-center">
            <p className="max-w-[260px] text-center text-sm text-ink-3">Add deal size data to your CSV</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border p-5 md:p-6" style={{ borderColor: "var(--border)", background: "var(--paper)" }}>
          <h3 className="text-base font-medium text-ink">Time to Close</h3>
          <div className="mt-4 space-y-2">
            {timeToCloseRows.map((rep) => {
              const colors = tonePill(rep.tone);
              return (
                <div
                  key={rep.repId}
                  className="flex items-center justify-between rounded-xl border px-3 py-2.5"
                  style={{ borderColor: "var(--border)", background: "var(--paper)" }}
                >
                  <span className="text-sm text-ink">{rep.name}</span>
                  <span
                    className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{ background: colors.bg, color: colors.text }}
                  >
                    {rep.daysDisplay}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border p-5 md:p-6" style={{ borderColor: "var(--border)", background: "var(--paper)" }}>
          <h3 className="text-base font-medium text-ink">Activity Breakdown</h3>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-xl border px-4 py-3" style={{ borderColor: "var(--border)" }}>
              <span className="text-sm text-ink-2">Calls</span>
              <span className="font-mono text-ink">{activityBreakdown.callsDisplay}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border px-4 py-3" style={{ borderColor: "var(--border)" }}>
              <span className="text-sm text-ink-2">Emails</span>
              <span className="font-mono text-ink">{activityBreakdown.emailsDisplay}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border px-4 py-3" style={{ borderColor: "var(--border)" }}>
              <span className="text-sm text-ink-2">Demos</span>
              <span className="font-mono text-ink">{activityBreakdown.demosDisplay}</span>
            </div>
            <div
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background: "var(--paper-2)" }}
            >
              <span className="text-sm font-medium text-ink">Total Touches</span>
              <span className="font-mono text-ink">{activityBreakdown.totalTouchesDisplay}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
