import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  updateAutomationSettingsAction,
  updateKillSwitchAction,
} from "@/app/actions/goldbot";
import { requireUserId } from "@/lib/auth";
import {
  DEFAULT_GOLDBOT_BUSINESS_HOURS,
  DEFAULT_GOLDBOT_THROTTLE_CAPS,
  DEFAULT_GOLDBOT_TEMPLATES,
  ensureOrgAndLocation,
  getLocationSettings,
} from "@/lib/goldbot";
import { AutomationSettingsForm } from "@/components/goldbot/automation-settings-form";
import { GoldBotPageShell } from "@/components/goldbot/page-shell";
import { SectionCard } from "@/components/goldbot/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Automation",
};

async function submitKillSwitch(formData: FormData) {
  "use server";

  const result = await updateKillSwitchAction(formData);
  if (!result.ok) {
    redirect(`/dashboard/settings/automation?error=${encodeURIComponent(result.message)}`);
  }

  redirect(`/dashboard/settings/automation?success=${encodeURIComponent(result.message)}`);
}

async function submitAutomationSettings(formData: FormData) {
  "use server";

  const result = await updateAutomationSettingsAction(formData);
  if (!result.ok) {
    redirect(`/dashboard/settings/automation?error=${encodeURIComponent(result.message)}`);
  }

  redirect(`/dashboard/settings/automation?success=${encodeURIComponent(result.message)}`);
}

export default async function AutomationSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await requireUserId();
  const context = await ensureOrgAndLocation(userId);
  const settings = await getLocationSettings(context);
  const canManageAutomation = settings.role === "owner";
  const hasActiveKillSwitch = settings.globalKillEnabled || settings.locationKillEnabled;

  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : null;
  const success = typeof params.success === "string" ? params.success : null;

  return (
    <GoldBotPageShell
      title="Trust Center"
      subtitle="Safety controls and automation policy for governed operation."
      headerClassName="items-start gap-6 rounded-2xl border border-border/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01))] px-5 py-5 md:px-6"
      maxWidth="7xl"
      actions={
        hasActiveKillSwitch ? (
          <Badge
            variant="outline"
            className="border-red-300/55 bg-red-500/20 px-2.5 py-1 text-[11px] text-red-100"
          >
            Emergency stop active
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="border-border/70 bg-paper/50 px-2.5 py-1 text-[11px] text-ink-2"
          >
            Automation ready
          </Badge>
        )
      }
    >
      {error ? (
        <p className="rounded-md border border-red-300/60 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="rounded-md border border-emerald-300/60 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          {success}
        </p>
      ) : null}

      <SectionCard
        title="Kill Switch"
        description="Hard stop controls that immediately halt autonomous actions at org and location scope."
        className={
          hasActiveKillSwitch
            ? "border-red-300/65 bg-[linear-gradient(135deg,rgba(239,68,68,0.14),rgba(239,68,68,0.04))]"
            : undefined
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-lg border border-border/70 bg-paper/25 p-4">
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-ink">Global Kill Switch</h3>
              <p className="text-xs text-ink-2">Affects all locations in this organization.</p>
            </div>
            <p className="text-sm text-ink-2">
              Current: <strong>{settings.globalKillEnabled ? "Enabled" : "Disabled"}</strong>
            </p>
            {canManageAutomation ? (
              <form action={submitKillSwitch}>
                <input type="hidden" name="scope" value="org" />
                <input type="hidden" name="reason" value="set from dashboard" />
                <input
                  type="hidden"
                  name="enabled"
                  value={settings.globalKillEnabled ? "false" : "true"}
                />
                <Button
                  type="submit"
                  variant={settings.globalKillEnabled ? "outline" : "destructive"}
                >
                  {settings.globalKillEnabled ? "Disable Global Kill" : "Enable Global Kill"}
                </Button>
              </form>
            ) : null}
          </div>

          <div className="space-y-3 rounded-lg border border-border/70 bg-paper/25 p-4">
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-ink">Location Kill Switch</h3>
              <p className="text-xs text-ink-2">Only affects this location.</p>
            </div>
            <p className="text-sm text-ink-2">
              Current: <strong>{settings.locationKillEnabled ? "Enabled" : "Disabled"}</strong>
            </p>
            {canManageAutomation ? (
              <form action={submitKillSwitch}>
                <input type="hidden" name="scope" value="location" />
                <input type="hidden" name="reason" value="set from dashboard" />
                <input
                  type="hidden"
                  name="enabled"
                  value={settings.locationKillEnabled ? "false" : "true"}
                />
                <Button
                  type="submit"
                  variant={settings.locationKillEnabled ? "outline" : "destructive"}
                >
                  {settings.locationKillEnabled ? "Disable Location Kill" : "Enable Location Kill"}
                </Button>
              </form>
            ) : null}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Automation Controls"
        description="Choose autonomy posture and booking integration. Changes apply to new decisions immediately after save."
      >
        {!canManageAutomation ? (
          <p className="mb-4 rounded-md border border-amber-300/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            Staff members have read-only access. Owner role is required to change automation controls.
          </p>
        ) : null}

        <AutomationSettingsForm
          canManageAutomation={canManageAutomation}
          timezone={settings.timezone || "America/New_York"}
          autonomyMode={settings.autonomyMode}
          bookingProvider={settings.bookingProvider}
          submitAction={submitAutomationSettings}
          jsonFields={[
            {
              id: "bookingSettingsJson",
              label: "Booking Settings JSON",
              rows: 6,
              initialValue: JSON.stringify(settings.bookingSettingsJson || {}, null, 2),
            },
            {
              id: "businessHoursJson",
              label: "Business Hours JSON",
              rows: 8,
              initialValue: JSON.stringify(
                settings.businessHoursJson || DEFAULT_GOLDBOT_BUSINESS_HOURS,
                null,
                2,
              ),
              helper: "Working-hours policy in local timezone.",
            },
            {
              id: "templatesJson",
              label: "Templates JSON",
              rows: 10,
              initialValue: JSON.stringify(settings.templatesJson || DEFAULT_GOLDBOT_TEMPLATES, null, 2),
            },
            {
              id: "throttleCapsJson",
              label: "Throttle Caps JSON",
              rows: 5,
              initialValue: JSON.stringify(
                settings.throttleCapsJson || DEFAULT_GOLDBOT_THROTTLE_CAPS,
                null,
                2,
              ),
            },
          ]}
        />
      </SectionCard>
    </GoldBotPageShell>
  );
}
