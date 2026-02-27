import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAuthContext } from "@/lib/auth";
import {
  GOLDBOT_DASHBOARD_ENV_KEYS,
  REPORTS_DASHBOARD_ENV_KEYS,
  getEnvStatus,
} from "@/lib/env";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Environment Status",
};

function StatusPill({ present }: { present: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        present
          ? "border border-emerald-300 bg-emerald-50 text-emerald-800"
          : "border border-red-300 bg-red-50 text-red-800"
      }`}
    >
      {present ? "PRESENT" : "MISSING"}
    </span>
  );
}

function KeyList({ keys, presentSet }: { keys: readonly string[]; presentSet: Set<string> }) {
  return (
    <div className="space-y-2">
      {keys.map((key) => {
        const present = presentSet.has(key);
        return (
          <div
            key={key}
            className="flex items-center justify-between gap-4 rounded-md border border-border/70 bg-paper px-3 py-2"
          >
            <code className="text-xs text-ink">{key}</code>
            <StatusPill present={present} />
          </div>
        );
      })}
    </div>
  );
}

export default async function EnvironmentStatusPage() {
  const authContext = await requireAuthContext();
  if (authContext.role !== "owner") {
    notFound();
  }

  const allKeys = [...new Set([...GOLDBOT_DASHBOARD_ENV_KEYS, ...REPORTS_DASHBOARD_ENV_KEYS])];
  const { missing, present } = getEnvStatus(allKeys);
  const presentSet = new Set(present);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-4xl font-serif">Environment Status</h1>
        <p className="text-sm text-ink-2">
          Add missing keys in Vercel -&gt; Project -&gt; Settings -&gt; Environment Variables
          (Production), then redeploy.
        </p>
      </header>

      <Card className="border-border bg-white/70">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Present: <strong>{present.length}</strong>
          </p>
          <p>
            Missing: <strong>{missing.length}</strong>
          </p>
          {missing.length > 0 ? (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
              Missing keys: {missing.join(", ")}
            </p>
          ) : (
            <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-900">
              All required dashboard environment keys are present.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-white/70">
        <CardHeader>
          <CardTitle>Workflow Required Keys</CardTitle>
        </CardHeader>
        <CardContent>
          <KeyList keys={GOLDBOT_DASHBOARD_ENV_KEYS} presentSet={presentSet} />
        </CardContent>
      </Card>

      <Card className="border-border bg-white/70">
        <CardHeader>
          <CardTitle>Reports Required Keys</CardTitle>
        </CardHeader>
        <CardContent>
          <KeyList keys={REPORTS_DASHBOARD_ENV_KEYS} presentSet={presentSet} />
        </CardContent>
      </Card>
    </div>
  );
}
