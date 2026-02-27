import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import test, { describe, mock } from "node:test";
import {
  assertUnder,
  importFresh,
  measureMs,
  repoPath,
  restoreAll,
} from "../helpers/test-runtime";

const PAGE_BENCHMARK_MS = 3000;
const NOT_FOUND_ERROR = "NEXT_NOT_FOUND";

const PAGE_FILES = [
  "apps/web/app/(dashboard)/manager/[repId]/page.tsx",
  "apps/web/app/(dashboard)/manager/page.tsx",
  "apps/web/app/(dashboard)/manager/teams/[teamName]/page.tsx",
  "apps/web/app/dashboard/(goldbot)/audit/page.tsx",
  "apps/web/app/dashboard/(goldbot)/inbound-sim/page.tsx",
  "apps/web/app/dashboard/(goldbot)/intake/page.tsx",
  "apps/web/app/dashboard/(goldbot)/leads/[id]/page.tsx",
  "apps/web/app/dashboard/(goldbot)/leads/page.tsx",
  "apps/web/app/dashboard/(goldbot)/page.tsx",
  "apps/web/app/dashboard/(goldbot)/settings/automation/page.tsx",
  "apps/web/app/dashboard/(goldbot)/settings/env/page.tsx",
  "apps/web/app/dashboard/(goldbot)/settings/page.tsx",
  "apps/web/app/dashboard/(goldbot)/staff-queue/page.tsx",
  "apps/web/app/dashboard/(reports)/reports/[id]/page.tsx",
  "apps/web/app/dashboard/(reports)/reports/page.tsx",
  "apps/web/app/dashboard/(reports)/upload/page.tsx",
  "apps/web/app/page.tsx",
  "apps/web/app/pricing/page.tsx",
  "apps/web/app/privacy/page.tsx",
  "apps/web/app/terms/page.tsx",
];

const DASHBOARD_CONTEXT = {
  orgId: "org_1",
  locationId: "loc_1",
  locationName: "Downtown",
  timezone: "America/New_York",
  role: "owner",
  clerkOrgId: "org_1",
  autonomyMode: "safe_auto",
  bookingProvider: "none",
  orgKillEnabled: false,
  locationKillEnabled: false,
};

function listPageFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const output: string[] = [];

  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      output.push(...listPageFiles(absolute));
      continue;
    }

    if (entry.isFile() && entry.name === "page.tsx") {
      output.push(path.relative(process.cwd(), absolute).replace(/\\/g, "/"));
    }
  }

  return output.sort();
}

type PageMockOptions = {
  authRole?: "owner" | "staff";
  useParamsValue?: Record<string, string>;
  missingLead?: boolean;
  ensureOrgError?: Error;
  logServerErrorSpy?: ReturnType<typeof mock.fn>;
};

function createSupabaseFixture() {
  const teams = [
    {
      id: "team_1",
      user_id: "user_1",
      name: "Pipeline Team",
      goal_monthly: 12000,
      created_at: "2026-02-01T00:00:00.000Z",
    },
  ];

  const reports = [
    {
      id: "report_current",
      user_id: "user_1",
      team_id: "team_1",
      name: "February 2026",
      period_type: "monthly",
      period_start: "2026-02-01",
      period_end: "2026-02-28",
      created_at: "2026-02-28T10:00:00.000Z",
    },
    {
      id: "report_prev",
      user_id: "user_1",
      team_id: "team_1",
      name: "January 2026",
      period_type: "monthly",
      period_start: "2026-01-01",
      period_end: "2026-01-31",
      created_at: "2026-01-31T10:00:00.000Z",
    },
  ];

  const reps = [
    {
      id: "rep_1",
      user_id: "user_1",
      team_id: "team_1",
      name: "Alex Morgan",
      role: "Sales Rep",
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ];

  const repMetrics = [
    {
      id: "metric_current",
      user_id: "user_1",
      report_id: "report_current",
      rep_id: "rep_1",
      revenue: 9000,
      quota: 10000,
      deals_closed: 8,
      leads: 24,
      contacts: 20,
      qualified: 14,
      demos: 10,
      calls: 35,
      emails: 22,
      avg_deal_size: 1125,
      avg_days_to_close: 18,
    },
    {
      id: "metric_prev",
      user_id: "user_1",
      report_id: "report_prev",
      rep_id: "rep_1",
      revenue: 7000,
      quota: 10000,
      deals_closed: 6,
      leads: 22,
      contacts: 18,
      qualified: 12,
      demos: 9,
      calls: 30,
      emails: 20,
      avg_deal_size: 1000,
      avg_days_to_close: 22,
    },
  ];

  class QueryBuilder {
    private readonly table: string;
    private readonly eqFilters: Record<string, unknown> = {};
    private readonly inFilters: Record<string, Set<unknown>> = {};
    private limitValue: number | null = null;

    constructor(table: string) {
      this.table = table;
    }

    select(): this {
      return this;
    }

    eq(key: string, value: unknown): this {
      this.eqFilters[key] = value;
      return this;
    }

    in(key: string, values: unknown[]): this {
      this.inFilters[key] = new Set(values);
      return this;
    }

    order(): this {
      return this;
    }

    limit(value: number): this {
      this.limitValue = value;
      return this;
    }

    update(): { eq: () => Promise<{ data: null; error: null }> } {
      return {
        eq: async () => ({ data: null, error: null }),
      };
    }

    insert(): Promise<{ data: null; error: null }> {
      return Promise.resolve({ data: null, error: null });
    }

    upsert(): Promise<{ data: null; error: null }> {
      return Promise.resolve({ data: null, error: null });
    }

    async maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: null }> {
      const rows = this.run();
      return { data: rows[0] ?? null, error: null };
    }

    async single(): Promise<{ data: Record<string, unknown> | null; error: null }> {
      const rows = this.run();
      return { data: rows[0] ?? null, error: null };
    }

    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?:
        | ((value: { data: Array<Record<string, unknown>>; error: null }) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): Promise<TResult1 | TResult2> {
      return Promise.resolve({ data: this.run(), error: null }).then(onfulfilled, onrejected);
    }

    private run(): Array<Record<string, unknown>> {
      let rows: Array<Record<string, unknown>>;
      switch (this.table) {
        case "teams":
          rows = [...teams];
          break;
        case "reports":
          rows = [...reports];
          break;
        case "rep_metrics":
          rows = [...repMetrics];
          break;
        case "reps":
          rows = [...reps];
          break;
        default:
          rows = [];
      }

      rows = rows.filter((row) =>
        Object.entries(this.eqFilters).every(([key, value]) => row[key] === value),
      );
      rows = rows.filter((row) =>
        Object.entries(this.inFilters).every(([key, values]) => values.has(row[key])),
      );

      if (this.limitValue !== null) {
        rows = rows.slice(0, this.limitValue);
      }

      return rows;
    }
  }

  return {
    from(table: string) {
      return new QueryBuilder(table);
    },
  };
}

function installPageMocks(options: PageMockOptions = {}) {
  const logServerErrorSpy = options.logServerErrorSpy ?? mock.fn(() => "ref-page-error");

  return [
    mock.module("server-only", { defaultExport: {} }),
    mock.module("next/link", {
      defaultExport: ({ href, children }: { href: string; children: React.ReactNode }) =>
        React.createElement("a", { href }, children),
    }),
    mock.module("next/font/google", {
      namedExports: {
        Syne: () => ({ variable: "--font-landing-sans", className: "font-syne" }),
      },
    }),
    mock.module("next/navigation", {
      namedExports: {
        useParams: () => options.useParamsValue ?? {},
        useSearchParams: () => new URLSearchParams(),
        useRouter: () => ({ refresh: () => undefined }),
        redirect: (to: string) => {
          throw new Error(`NEXT_REDIRECT:${to}`);
        },
        notFound: () => {
          throw new Error(NOT_FOUND_ERROR);
        },
      },
    }),
    mock.module("@/lib/auth", {
      namedExports: {
        requireUserId: async () => "user_1",
        requireAuthContext: async () => ({
          userId: "user_1",
          clerkOrgId: "org_1",
          clerkOrgRole: options.authRole ?? "owner",
          role: options.authRole ?? "owner",
          devFallback: false,
        }),
      },
    }),
    mock.module("@/lib/env", {
      namedExports: {
        GOLDBOT_DASHBOARD_ENV_KEYS: ["CLERK_SECRET_KEY", "STRIPE_SECRET_KEY"],
        REPORTS_DASHBOARD_ENV_KEYS: ["SUPABASE_URL"],
        getEnvStatus: (keys: string[]) => ({ missing: [], present: keys }),
      },
    }),
    mock.module("@/lib/subscription", {
      namedExports: {
        getUserSubscription: async () => ({
          isPaid: true,
          isPro: true,
          planTier: "pro",
          subscription: { stripe_customer_id: "cus_123" },
        }),
      },
    }),
    mock.module("@/lib/server-error", {
      namedExports: { logServerError: logServerErrorSpy },
    }),
    mock.module("@/lib/goldbot", {
      namedExports: {
        DEFAULT_GOLDBOT_BUSINESS_HOURS: {
          mon: [{ start: "09:00", end: "17:00" }],
          tue: [{ start: "09:00", end: "17:00" }],
          wed: [{ start: "09:00", end: "17:00" }],
          thu: [{ start: "09:00", end: "17:00" }],
          fri: [{ start: "09:00", end: "17:00" }],
          sat: [],
          sun: [],
        },
        DEFAULT_GOLDBOT_THROTTLE_CAPS: { per_hour: 2, per_day: 6, invalid_response_limit: 3 },
        DEFAULT_GOLDBOT_TEMPLATES: {
          intro: "Hello",
          follow_up: "Follow up",
          slot_prompt: "Slots",
          booked_confirmation: "Booked",
          reminder: "Reminder",
          invalid: "Invalid",
          invalid_slot: "Invalid slot",
        },
        ensureOrgAndLocation: async () => {
          if (options.ensureOrgError) throw options.ensureOrgError;
          return DASHBOARD_CONTEXT;
        },
        getDashboardSummary: async () => ({
          totalLeads: 3,
          bookedConversations: 1,
          awaitingYes: 1,
          awaitingTimeChoice: 1,
          staffAttention: 0,
          deadJobs: 0,
          queuedJobs: 1,
          runningJobs: 0,
          outboundLast24h: 4,
          optOutEventsLast7d: 0,
          recentMessages: [
            {
              id: "msg_1",
              leadName: "Taylor",
              direction: "inbound",
              status: "received",
              body: "YES",
              createdAt: "2026-02-20T12:00:00.000Z",
            },
          ],
          recentSendFailures: [],
          recentOptOutEvents: [],
          outboundHeatmap: [{ dow: 1, hour: 9, count: 2 }],
        }),
        listLeadsForLocation: async () => [
          {
            id: "lead_1",
            fullName: "Taylor Smith",
            phone: "+15555550101",
            consentStatus: "consented",
            optedOut: false,
            state: "awaiting_yes",
            needsStaffAttention: false,
            createdAt: "2026-02-20T11:00:00.000Z",
            lastInboundAt: "2026-02-20T12:00:00.000Z",
            lastOutboundAt: "2026-02-20T12:05:00.000Z",
          },
        ],
        listAuditEntries: async () => [],
        listStaffQueue: async () => [],
        getLocationSettings: async () => ({
          role: options.authRole ?? "owner",
          globalKillEnabled: false,
          locationKillEnabled: false,
          timezone: "America/New_York",
          autonomyMode: "safe_auto",
          bookingProvider: "none",
          bookingSettingsJson: {},
          businessHoursJson: null,
          templatesJson: null,
          throttleCapsJson: null,
        }),
        getLeadDetail: async () => ({
          lead: options.missingLead
            ? null
            : {
                id: "lead_1",
                fullName: "Taylor Smith",
                firstName: "Taylor",
                phone: "+15555550101",
                normalizedPhone: "+15555550101",
                consentStatus: "consented",
                optedOut: false,
                source: "manual_intake",
                state: "awaiting_yes",
                needsStaffAttention: false,
                invalidResponseCount: 0,
                staleAfterAt: null,
                flagsJson: {},
                createdAt: "2026-02-20T11:00:00.000Z",
                lastInboundAt: "2026-02-20T12:00:00.000Z",
                lastOutboundAt: "2026-02-20T12:05:00.000Z",
              },
          messages: [],
          appointments: [],
        }),
      },
    }),
    mock.module("@/lib/supabase", {
      namedExports: {
        createServerClient: () => createSupabaseFixture(),
      },
    }),
    mock.module("@/lib/rep-sync", {
      namedExports: {
        fetchAndParseSheet: async () => ({ payPeriods: [] }),
        parseStoredRepData: () => ({ payPeriods: [] }),
        getRepStats: () => ({
          totalCommission: 900,
          totalUnits: 10,
          fpSold: 4,
          fpRate: 40,
          missedFpCommission: 60,
          periods: [],
        }),
      },
    }),
    mock.module("@/lib/reps-store", {
      namedExports: {
        repsStore: {
          getAll: () => [
            {
              id: "rep_1",
              name: "Alex Morgan",
              team: "Pipeline Team",
              sheetUrl: "https://example.com/sheet.csv",
              data: "{}",
              lastSynced: "2026-02-20T10:00:00.000Z",
            },
          ],
          update: () => undefined,
        },
      },
    }),
    mock.module("@/app/actions/goldbot", {
      namedExports: {
        createLeadIntakeAction: async () => ({ ok: true, message: "created" }),
        simulateInboundSmsAction: async () => ({ ok: true, message: "queued" }),
        updateAutomationSettingsAction: async () => ({ ok: true, message: "saved" }),
        updateKillSwitchAction: async () => ({ ok: true, message: "updated" }),
      },
    }),
    mock.module("@/app/actions/reports", {
      namedExports: {
        deleteReport: async () => ({ ok: true }),
      },
    }),
    mock.module("@/components/ReportUploader", {
      namedExports: {
        ReportUploader: () => React.createElement("div", null, "ReportUploader"),
      },
    }),
    mock.module("@/components/RepRoster", {
      namedExports: {
        RepRoster: () => React.createElement("div", null, "RepRoster"),
      },
    }),
    mock.module("@/components/upload-flow", {
      namedExports: {
        UploadFlow: () => React.createElement("div", null, "UploadFlow"),
      },
    }),
    mock.module("@/components/ui/button", {
      namedExports: {
        Button: ({
          children,
          asChild,
          ...props
        }: {
          children: React.ReactNode;
          asChild?: boolean;
          [key: string]: unknown;
        }) =>
          React.createElement(asChild ? "span" : "button", props, children),
      },
    }),
    mock.module("@/components/dashboard-client", {
      namedExports: {
        DashboardClient: () => React.createElement("div", null, "DashboardClient"),
      },
    }),
    mock.module("@/components/export-pdf-button", {
      namedExports: {
        ExportPDFButton: () => React.createElement("button", null, "Export PDF"),
      },
    }),
  ];
}

function pageArgsFor(pageFile: string): Record<string, unknown> | undefined {
  if (pageFile.endsWith("/dashboard/(goldbot)/inbound-sim/page.tsx")) {
    return { searchParams: Promise.resolve({}) };
  }
  if (pageFile.endsWith("/dashboard/(goldbot)/intake/page.tsx")) {
    return { searchParams: Promise.resolve({}) };
  }
  if (pageFile.endsWith("/dashboard/(goldbot)/settings/automation/page.tsx")) {
    return { searchParams: Promise.resolve({}) };
  }
  if (pageFile.endsWith("/dashboard/(goldbot)/leads/[id]/page.tsx")) {
    return { params: Promise.resolve({ id: "lead_1" }) };
  }
  if (pageFile.endsWith("/dashboard/(reports)/reports/[id]/page.tsx")) {
    return { params: Promise.resolve({ id: "report_current" }) };
  }
  return undefined;
}

function useParamsFor(pageFile: string): Record<string, string> | undefined {
  if (pageFile.endsWith("/(dashboard)/manager/[repId]/page.tsx")) {
    return { repId: "rep_1" };
  }
  if (pageFile.endsWith("/(dashboard)/manager/teams/[teamName]/page.tsx")) {
    return { teamName: encodeURIComponent("Pipeline Team") };
  }
  return undefined;
}

function isClientPage(absolutePath: string): boolean {
  const source = fs.readFileSync(absolutePath, "utf8");
  return /^\s*["']use client["'];/.test(source);
}

describe("Web page coverage", () => {
  test("covers every App Router page.tsx", () => {
    const discovered = listPageFiles(repoPath("apps/web/app"));
    assert.deepEqual(discovered, PAGE_FILES);
  });
});

describe("Web page integration and benchmarks", () => {
  for (const pageFile of PAGE_FILES) {
    test(`integration + benchmark: ${pageFile}`, async () => {
      const mocks = installPageMocks({ useParamsValue: useParamsFor(pageFile) });
      try {
        const absolutePath = repoPath(pageFile);
        const module = await importFresh<{ default: (args?: unknown) => unknown }>(absolutePath);
        assert.equal(typeof module.default, "function");

        const args = pageArgsFor(pageFile);
        if (isClientPage(absolutePath)) {
          const { ms, value } = await measureMs(() =>
            Promise.resolve(renderToString(React.createElement(module.default as never, args))),
          );
          assert.ok(value.length > 0);
          assertUnder(ms, PAGE_BENCHMARK_MS, `${pageFile} exceeded render latency target`);
        } else {
          const { ms, value } = await measureMs(async () => module.default(args));
          assert.ok(value);
          assertUnder(ms, PAGE_BENCHMARK_MS, `${pageFile} exceeded load latency target`);
        }
      } finally {
        restoreAll(mocks);
      }
    });
  }
});

describe("404 flows and error logging", () => {
  test("unknown routes use the explicit not-found page", async () => {
    const mocks = installPageMocks();
    try {
      const module = await importFresh<{ default: () => React.ReactElement }>(
        repoPath("apps/web/app/not-found.tsx"),
      );
      const html = renderToString(React.createElement(module.default));
      assert.match(html, /Page not found/i);
      assert.match(html, /404/);
    } finally {
      restoreAll(mocks);
    }
  });
});
