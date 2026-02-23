import Link from 'next/link';
import type { Metadata } from "next";
import { requireUserId } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import type { Report } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DeleteReportButton } from './delete-report-button';

export const metadata: Metadata = {
  title: "Library",
};

type ReportListItem = Pick<
  Report,
  'id' | 'name' | 'period_type' | 'period_start' | 'period_end' | 'created_at'
> & {
  repCount: number;
  totalRevenue: number;
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function parseDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatPeriod(start: string, end: string) {
  const startDate = parseDateOnly(start);
  const endDate = parseDateOnly(end);
  const sameYear = startDate.getUTCFullYear() === endDate.getUTCFullYear();

  const startFormat = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  });

  const endFormat = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return `${startFormat.format(startDate)} \u2013 ${endFormat.format(endDate)}`;
}

export default async function ReportsPage() {
  const userId = await requireUserId();
  const supabase = createServerClient();

  const { data: reportsData, error: reportsError } = await supabase
    .from('reports')
    .select('id, name, period_type, period_start, period_end, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (reportsError) {
    throw new Error('Failed to load reports.');
  }

  const reports = (reportsData ?? []) as ReportListItem[];
  const reportIds = reports.map((report) => report.id);

  const metricsByReport = new Map<string, { repIds: Set<string>; totalRevenue: number }>();

  for (const report of reports) {
    metricsByReport.set(report.id, { repIds: new Set<string>(), totalRevenue: 0 });
  }

  if (reportIds.length > 0) {
    const { data: metricsData, error: metricsError } = await supabase
      .from('rep_metrics')
      .select('report_id, rep_id, revenue')
      .eq('user_id', userId)
      .in('report_id', reportIds);

    if (metricsError) {
      throw new Error('Failed to load report metrics.');
    }

    for (const metric of metricsData ?? []) {
      const entry = metricsByReport.get(metric.report_id);
      if (!entry) continue;

      entry.repIds.add(metric.rep_id);
      entry.totalRevenue += Number(metric.revenue ?? 0);
    }
  }

  const reportsWithSummary = reports.map((report) => {
    const summary = metricsByReport.get(report.id);

    return {
      ...report,
      repCount: summary?.repIds.size ?? 0,
      totalRevenue: summary?.totalRevenue ?? 0,
    };
  });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-4xl font-serif">Reports</h1>
        <p className="text-sm text-ink-2">Historical snapshots of team performance.</p>
      </header>

      {reportsWithSummary.length === 0 ? (
        <Card className="border-border bg-white/70">
          <CardContent className="flex flex-col items-start gap-4 p-6">
            <h2 className="text-2xl font-serif">No reports yet</h2>
            <p className="text-sm text-ink-2">
              Upload a CSV to generate your first dashboard report.
            </p>
            <Button asChild>
              <Link href="/dashboard/upload">Go to Upload</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reportsWithSummary.map((report) => (
            <Card key={report.id} className="border-border bg-white/70">
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-3xl font-serif leading-none">{report.name}</h2>
                      <Badge
                        className="border border-border bg-paper-2 text-ink"
                        variant="outline"
                      >
                        {report.period_type === 'monthly' ? 'Monthly' : 'Weekly'}
                      </Badge>
                    </div>

                    <p className="text-sm text-ink-2">
                      Period: <span className="font-medium text-ink">{formatPeriod(report.period_start, report.period_end)}</span>
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-ink-2">
                      <span>
                        Reps: <span className="font-medium text-ink">{report.repCount}</span>
                      </span>
                      <span>
                        Revenue:{' '}
                        <span className="font-medium text-green">
                          {currencyFormatter.format(report.totalRevenue)}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button asChild>
                      <Link href={`/dashboard/reports/${report.id}`}>View Report</Link>
                    </Button>
                    <DeleteReportButton reportId={report.id} reportName={report.name} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
