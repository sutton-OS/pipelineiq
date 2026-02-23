import type { Metadata } from "next";
import { REPORTS_DASHBOARD_ENV_KEYS, requireEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: {
    default: "Reports",
    template: "Reports — %s",
  },
};

export default async function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  requireEnv([...REPORTS_DASHBOARD_ENV_KEYS], "dashboard.reports");
  return children;
}
