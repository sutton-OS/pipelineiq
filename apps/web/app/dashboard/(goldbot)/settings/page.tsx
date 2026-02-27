import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { getUserSubscription } from "@/lib/subscription";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BillingControls } from "./billing-controls";
import { SettingsFeedback } from "./settings-feedback";

export const metadata: Metadata = {
  title: "Settings",
};

async function saveTeamSettings(formData: FormData) {
  "use server";

  const userId = await requireUserId();
  const supabase = createServerClient();

  const teamName = String(formData.get("teamName") ?? "").trim();
  const monthlyGoalInput = Number(formData.get("monthlyGoal") ?? 0);
  const monthlyGoal = Number.isFinite(monthlyGoalInput)
    ? Math.max(0, monthlyGoalInput)
    : 0;

  if (!teamName) {
    return;
  }

  const { data: existingTeam } = await supabase
    .from("teams")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingTeam?.id) {
    await supabase
      .from("teams")
      .update({ name: teamName, goal_monthly: monthlyGoal })
      .eq("id", existingTeam.id)
      .eq("user_id", userId);
  } else {
    await supabase.from("teams").insert({
      user_id: userId,
      name: teamName,
      goal_monthly: monthlyGoal,
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
}

export default async function SettingsPage() {
  const userId = await requireUserId();
  const supabase = createServerClient();

  const [{ isPaid, isPro }, { data: team }] = await Promise.all([
    getUserSubscription(userId),
    supabase
      .from("teams")
      .select("id, name, goal_monthly")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const teamName = team?.name ?? "My Team";
  const monthlyGoal = Number(team?.goal_monthly ?? 0);
  const currentPlanLabel = isPro ? "Pro" : "Free";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-4xl font-serif">Settings</h1>
        <p className="text-sm text-ink-2">Manage billing and team preferences.</p>
      </header>

      <SettingsFeedback />

      <section className="space-y-4">
        <h2 className="text-2xl font-serif">Plan</h2>

        <Card className="border-border bg-white/70">
          <CardHeader>
            <CardTitle>Current Plan: {currentPlanLabel}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-paper p-4">
                <h3 className="font-medium text-ink">Free</h3>
                <p className="mt-2 text-sm text-ink-2">
                  3 reports, CSV upload, PDF export
                </p>
              </div>

              <div className="rounded-lg border border-border bg-paper p-4">
                <h3 className="font-medium text-ink">Pro</h3>
                <p className="mt-2 text-sm text-ink-2">
                  Unlimited reports, automation controls, audit exports, priority support
                </p>
              </div>
            </div>

            <BillingControls isPaid={isPaid} />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-serif">Team</h2>

        <Card className="border-border bg-white/70">
          <CardContent className="pt-6">
            <form action={saveTeamSettings} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="teamName">Team Name</Label>
                <Input
                  id="teamName"
                  name="teamName"
                  type="text"
                  defaultValue={teamName}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="monthlyGoal">Monthly Goal (USD)</Label>
                <Input
                  id="monthlyGoal"
                  name="monthlyGoal"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={monthlyGoal}
                />
              </div>

              <Button type="submit">Save Team Settings</Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-serif">Automation</h2>

        <Card className="border-border bg-white/70">
          <CardContent className="flex items-center justify-between gap-3 pt-6">
            <div>
              <p className="font-medium text-ink">GoldBot Automation Controls</p>
              <p className="text-sm text-ink-2">
                Configure kill-switches, business hours, templates, and throttle caps.
              </p>
            </div>
            <Button asChild>
              <Link href="/dashboard/settings/automation">Open Automation Settings</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-serif">Environment</h2>

        <Card className="border-border bg-white/70">
          <CardContent className="flex items-center justify-between gap-3 pt-6">
            <div>
              <p className="font-medium text-ink">Environment Status</p>
              <p className="text-sm text-ink-2">
                View required key presence for dashboard services.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/dashboard/settings/env">Open Environment Status</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
