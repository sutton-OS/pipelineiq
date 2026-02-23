import type { Metadata } from "next";
import { GOLDBOT_DASHBOARD_ENV_KEYS, requireEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: {
    default: "GoldBot",
    template: "GoldBot — %s",
  },
};

export default async function GoldBotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  requireEnv([...GOLDBOT_DASHBOARD_ENV_KEYS], "dashboard.goldbot");
  return children;
}
