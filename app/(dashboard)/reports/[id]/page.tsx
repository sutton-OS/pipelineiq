import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardClient, type DashboardClientProps, type RepStatus } from "@/components/dashboard-client";
import { ExportPDFButton } from "@/components/export-pdf-button";
import { requireUserId } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import type { Rep, RepMetrics, Report, Team } from "@/types/database";

export const metadata: Metadata = {
  title: "Report",
};

const avatarPalette = [
  { bg: "#e8f0fe", text: "#1a56db" },
  { bg: "#fce8e6", text: "#c5221f" },
  { bg: "#fef8e7", text: "#b06000" },
  { bg: "#e6f4ea", text: "#137333" },
  { bg: "#f3e8fd", text: "#7c3aed" },
] as const;

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const integerFormatter = new Intl.NumberFormat("en-US");

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function percentFrom(numerator: number, denominator: number, decimals = 0) {
  if (denominator <= 0) return 0;
  return roundTo((numerator / denominator) * 100, decimals);
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatInteger(value: number) {
  return integerFormatter.format(value);
}

function formatPercent(value: number, decimals = 0) {
  const fixed = value.toFixed(decimals).replace(/\.0+$/, "");
  return `${fixed}%`;
}

function formatDays(value: number | null) {
  if (value === null) return "\u2014";
  return `${value.toFixed(1).replace(/\.0$/, "")}d`;
}

function initialsFromName(name: string) {
  const pieces = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (pieces.length === 0) return "??";
  if (pieces.length === 1) return pieces[0].slice(0, 2).toUpperCase();
  return `${pieces[0][0] ?? ""}${pieces[1][0] ?? ""}`.toUpperCase();
}

function formatPeriodLabel(report: Report) {
  const start = new Date(report.period_start);
  const end = new Date(report.period_end);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return report.name;

  const dateFmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${dateFmt.format(start)} - ${dateFmt.format(end)}`;
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();
  const supabase = createServerClient();

  const { data: reportRow, error: reportError } = await supabase
    .from("reports")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (reportError || !reportRow) {
    redirect("/dashboard/reports");
  }

  const report = reportRow as Report;

  const { data: teamRow, error: teamError } = await supabase
    .from("teams")
    .select("*")
    .eq("id", report.team_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (teamError || !teamRow) {
    redirect("/dashboard/reports");
  }

  const team = teamRow as Team;

  const { data: allReportRows, error: allReportsError } = await supabase
    .from("reports")
    .select("id")
    .eq("user_id", userId)
    .eq("team_id", team.id)
    .order("period_end", { ascending: false })
    .order("created_at", { ascending: false });

  if (allReportsError) throw new Error(allReportsError.message);

  const orderedReports = (allReportRows ?? []) as Array<{ id: string }>;
  const currentReportIndex = orderedReports.findIndex((row) => row.id === report.id);
  const previousReportId = currentReportIndex >= 0 ? orderedReports[currentReportIndex + 1]?.id : undefined;

  const previousMetricsQuery = previousReportId
    ? supabase
        .from("rep_metrics")
        .select("*")
        .eq("user_id", userId)
        .eq("report_id", previousReportId)
    : Promise.resolve({ data: [] as RepMetrics[], error: null });

  const [{ data: repsData, error: repsError }, { data: metricsData, error: metricsError }, previousMetricsResult] =
    await Promise.all([
      supabase
        .from("reps")
        .select("*")
        .eq("user_id", userId)
        .eq("team_id", team.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("rep_metrics")
        .select("*")
        .eq("user_id", userId)
        .eq("report_id", report.id),
      previousMetricsQuery,
    ]);

  if (repsError) throw new Error(repsError.message);
  if (metricsError) throw new Error(metricsError.message);
  if (previousMetricsResult.error) throw new Error(previousMetricsResult.error.message);

  const reps = (repsData as Rep[] | null) ?? [];
  const currentMetrics = (metricsData as RepMetrics[] | null) ?? [];
  const previousMetrics = (previousMetricsResult.data as RepMetrics[] | null) ?? [];
  const metricsByRepId = new Map(currentMetrics.map((metric) => [metric.rep_id, metric]));

  let teamRevenue = 0;
  let totalLeads = 0;
  let totalContacted = 0;
  let totalQualified = 0;
  let totalDemos = 0;
  let totalClosed = 0;
  let totalCalls = 0;
  let totalEmails = 0;

  const avgDealValues: number[] = [];
  const avgDaysValues: number[] = [];

  for (const metric of currentMetrics) {
    const revenue = Number(metric.revenue);
    const leads = Number(metric.leads);
    const contacts = Number(metric.contacts);
    const qualified = Number(metric.qualified);
    const demos = Number(metric.demos);
    const closed = Number(metric.deals_closed);
    const calls = Number(metric.calls);
    const emails = Number(metric.emails);
    const avgDealSize = Number(metric.avg_deal_size);
    const avgDaysToClose = Number(metric.avg_days_to_close);

    teamRevenue += revenue;
    totalLeads += leads;
    totalContacted += contacts;
    totalQualified += qualified;
    totalDemos += demos;
    totalClosed += closed;
    totalCalls += calls;
    totalEmails += emails;
    avgDealValues.push(avgDealSize);
    avgDaysValues.push(avgDaysToClose);
  }

  const teamGoal = Number(team.goal_monthly);
  const goalPercent = teamGoal > 0 ? Math.round((teamRevenue / teamGoal) * 100) : 0;
  const isPaceBehind = goalPercent < 78;
  const avgDealSize = roundTo(average(avgDealValues), 0);
  const conversionRate = percentFrom(totalQualified, totalLeads, 1);
  const avgDaysToClose = roundTo(average(avgDaysValues), 1);
  const totalActivity = totalCalls + totalEmails + totalDemos;
  const remainingToGoal = Math.max(teamGoal - teamRevenue, 0);
  const goalBarPercent = clampPercent(goalPercent);

  const previousAvgDealSize =
    previousMetrics.length > 0
      ? average(previousMetrics.map((metric) => Number(metric.avg_deal_size)))
      : null;

  const avgDealDeltaPercent =
    previousAvgDealSize && previousAvgDealSize > 0
      ? Math.round(((avgDealSize - previousAvgDealSize) / previousAvgDealSize) * 100)
      : null;

  const avgDealDeltaDisplay =
    avgDealDeltaPercent === null
      ? null
      : `${avgDealDeltaPercent > 0 ? "+" : ""}${avgDealDeltaPercent}% vs previous`;

  const avgDealDeltaTone =
    avgDealDeltaPercent === null ? "neutral" : avgDealDeltaPercent >= 0 ? "positive" : "negative";

  const repRows = reps
    .map((rep, repIndex) => {
      const metric = metricsByRepId.get(rep.id);
      const revenue = Number(metric?.revenue ?? 0);
      const quota = Number(metric?.quota ?? 0);
      const dealsClosed = Number(metric?.deals_closed ?? 0);
      const leads = Number(metric?.leads ?? 0);
      const qualified = Number(metric?.qualified ?? 0);
      const repDaysRaw = metric ? Number(metric.avg_days_to_close) : null;
      const repDays = repDaysRaw !== null && Number.isFinite(repDaysRaw) ? repDaysRaw : null;
      const repConversion = percentFrom(qualified, leads, 0);
      const quotaPercent = quota > 0 ? Math.round((revenue / quota) * 100) : 0;
      const quotaBarPercent = clampPercent(quotaPercent);
      const status: RepStatus =
        quotaPercent >= 100 ? "On Track" : quotaPercent >= 75 ? "At Risk" : "Behind";
      const palette = avatarPalette[repIndex % avatarPalette.length];

      return {
        repId: rep.id,
        rank: 0,
        name: rep.name,
        role: rep.role ?? "Sales Rep",
        initials: initialsFromName(rep.name),
        avatarBg: palette.bg,
        avatarText: palette.text,
        revenue,
        revenueDisplay: formatCurrency(revenue),
        quotaPercent,
        quotaPercentDisplay: formatPercent(quotaPercent, 0),
        quotaBarPercent,
        status,
        dealsClosed,
        conversionRate: repConversion,
        conversionRateDisplay: formatPercent(repConversion, 0),
        avgDaysToClose: repDays,
        avgDaysToCloseDisplay: formatDays(repDays),
      };
    })
    .sort((a, b) => {
      if (b.revenue !== a.revenue) return b.revenue - a.revenue;
      return a.name.localeCompare(b.name);
    })
    .map((rep, index) => ({ ...rep, rank: index + 1 }));

  const funnelStages = [
    { label: "Leads", value: totalLeads },
    { label: "Contacted", value: totalContacted },
    { label: "Qualified", value: totalQualified },
    { label: "Demo", value: totalDemos },
    { label: "Closed", value: totalClosed },
  ].map((stage) => {
    const percent = stage.label === "Leads" ? (totalLeads > 0 ? 100 : 0) : percentFrom(stage.value, totalLeads, 0);
    return {
      label: stage.label,
      value: stage.value,
      valueDisplay: formatInteger(stage.value),
      percent,
      percentDisplay: formatPercent(percent, 0),
      barPercent: clampPercent(percent),
    };
  });

  const timeToCloseRows = repRows
    .map((rep) => {
      let tone: "green" | "amber" | "red" | "neutral" = "neutral";
      if (rep.avgDaysToClose !== null) {
        if (rep.avgDaysToClose <= 28) tone = "green";
        else if (rep.avgDaysToClose <= 45) tone = "amber";
        else tone = "red";
      }

      return {
        repId: rep.repId,
        name: rep.name,
        days: rep.avgDaysToClose,
        daysDisplay: rep.avgDaysToCloseDisplay,
        tone,
      };
    })
    .sort((a, b) => {
      if (a.days === null && b.days === null) return a.name.localeCompare(b.name);
      if (a.days === null) return 1;
      if (b.days === null) return -1;
      return a.days - b.days;
    });

  const periodLabel = formatPeriodLabel(report);

  const dashboardProps: DashboardClientProps = {
    teamName: team.name,
    reportName: report.name,
    periodLabel,
    teamRevenue,
    teamRevenueDisplay: formatCurrency(teamRevenue),
    teamGoal,
    teamGoalDisplay: formatCurrency(teamGoal),
    goalPercent,
    goalPercentDisplay: formatPercent(goalPercent, 0),
    goalBarPercent,
    remainingToGoal,
    remainingToGoalDisplay: formatCurrency(remainingToGoal),
    isPaceBehind,
    avgDealSize,
    avgDealSizeDisplay: formatCurrency(avgDealSize),
    avgDealDeltaDisplay,
    avgDealDeltaTone,
    conversionRate,
    conversionRateDisplay: formatPercent(conversionRate, 1),
    avgDaysToClose,
    avgDaysToCloseDisplay: `${avgDaysToClose.toFixed(1).replace(/\.0$/, "")} days`,
    totalActivity,
    totalActivityDisplay: formatInteger(totalActivity),
    totalLeads,
    totalContacted,
    totalQualified,
    totalDemos,
    totalClosed,
    repRows,
    funnelStages,
    timeToCloseRows,
    activityBreakdown: {
      calls: totalCalls,
      callsDisplay: formatInteger(totalCalls),
      emails: totalEmails,
      emailsDisplay: formatInteger(totalEmails),
      demos: totalDemos,
      demosDisplay: formatInteger(totalDemos),
      totalTouches: totalActivity,
      totalTouchesDisplay: formatInteger(totalActivity),
    },
  };

  const exportRows = reps.map((rep) => {
    const metric = metricsByRepId.get(rep.id);
    const revenue = Number(metric?.revenue ?? 0);
    const quota = Number(metric?.quota ?? 0);
    const quotaPercent = quota > 0 ? Math.round((revenue / quota) * 100) : 0;

    return {
      name: rep.name,
      role: rep.role,
      revenue,
      quota,
      quotaPercent,
      dealsClosed: Number(metric?.deals_closed ?? 0),
      avgDaysToClose: Number(metric?.avg_days_to_close ?? 0),
      calls: Number(metric?.calls ?? 0),
      emails: Number(metric?.emails ?? 0),
      demos: Number(metric?.demos ?? 0),
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportPDFButton
          reportName={report.name}
          period={periodLabel}
          teamRevenue={teamRevenue}
          teamGoal={teamGoal}
          goalPercent={goalPercent}
          reps={exportRows}
        />
      </div>
      <DashboardClient {...dashboardProps} />
    </div>
  );
}
