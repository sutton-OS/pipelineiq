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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = {
  title: "Automation Settings",
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

  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : null;
  const success = typeof params.success === "string" ? params.success : null;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-4xl font-serif">Kill Switch & Automation Settings</h1>
        <p className="text-sm text-ink-2">
          Immediate stop controls plus business hours, templates, and throttles.
        </p>
      </header>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border bg-white/70">
          <CardHeader>
            <CardTitle>Global Kill Switch</CardTitle>
          </CardHeader>
          <CardContent>
            {canManageAutomation ? (
              <form action={submitKillSwitch} className="space-y-3">
                <input type="hidden" name="scope" value="org" />
                <input type="hidden" name="reason" value="set from dashboard" />
                <input
                  type="hidden"
                  name="enabled"
                  value={settings.globalKillEnabled ? "false" : "true"}
                />
                <p className="text-sm text-ink-2">
                  Current: <strong>{settings.globalKillEnabled ? "Enabled" : "Disabled"}</strong>
                </p>
                <Button type="submit" variant={settings.globalKillEnabled ? "outline" : "destructive"}>
                  {settings.globalKillEnabled ? "Disable Global Kill" : "Enable Global Kill"}
                </Button>
              </form>
            ) : (
              <p className="text-sm text-ink-2">
                Current: <strong>{settings.globalKillEnabled ? "Enabled" : "Disabled"}</strong>
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-white/70">
          <CardHeader>
            <CardTitle>Location Kill Switch</CardTitle>
          </CardHeader>
          <CardContent>
            {canManageAutomation ? (
              <form action={submitKillSwitch} className="space-y-3">
                <input type="hidden" name="scope" value="location" />
                <input type="hidden" name="reason" value="set from dashboard" />
                <input
                  type="hidden"
                  name="enabled"
                  value={settings.locationKillEnabled ? "false" : "true"}
                />
                <p className="text-sm text-ink-2">
                  Current: <strong>{settings.locationKillEnabled ? "Enabled" : "Disabled"}</strong>
                </p>
                <Button
                  type="submit"
                  variant={settings.locationKillEnabled ? "outline" : "destructive"}
                >
                  {settings.locationKillEnabled ? "Disable Location Kill" : "Enable Location Kill"}
                </Button>
              </form>
            ) : (
              <p className="text-sm text-ink-2">
                Current: <strong>{settings.locationKillEnabled ? "Enabled" : "Disabled"}</strong>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-white/70">
        <CardHeader>
          <CardTitle>Location Automation Config</CardTitle>
        </CardHeader>
        <CardContent>
          {!canManageAutomation ? (
            <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Staff members have read-only access. Owner role is required to change automation controls.
            </p>
          ) : null}

          <form action={submitAutomationSettings} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                name="timezone"
                defaultValue={settings.timezone || "America/New_York"}
                required
                disabled={!canManageAutomation}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="autonomyMode">Autonomy Mode</Label>
              <select
                id="autonomyMode"
                name="autonomyMode"
                defaultValue={settings.autonomyMode}
                disabled={!canManageAutomation}
                className="border-input bg-background focus-visible:ring-ring/50 flex h-9 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              >
                <option value="suggest_only">suggest_only (staff approval required)</option>
                <option value="safe_auto">safe_auto (governed auto actions)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bookingProvider">Booking Provider</Label>
              <select
                id="bookingProvider"
                name="bookingProvider"
                defaultValue={settings.bookingProvider}
                disabled={!canManageAutomation}
                className="border-input bg-background focus-visible:ring-ring/50 flex h-9 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              >
                <option value="none">none (simulation fallback)</option>
                <option value="google_calendar">google_calendar</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bookingSettingsJson">Booking Settings JSON</Label>
              <textarea
                id="bookingSettingsJson"
                name="bookingSettingsJson"
                rows={6}
                disabled={!canManageAutomation}
                className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring/50 flex w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                defaultValue={JSON.stringify(settings.bookingSettingsJson || {}, null, 2)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessHoursJson">Business Hours JSON</Label>
              <textarea
                id="businessHoursJson"
                name="businessHoursJson"
                rows={8}
                disabled={!canManageAutomation}
                className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring/50 flex w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                defaultValue={JSON.stringify(
                  settings.businessHoursJson || DEFAULT_GOLDBOT_BUSINESS_HOURS,
                  null,
                  2,
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="templatesJson">Templates JSON</Label>
              <textarea
                id="templatesJson"
                name="templatesJson"
                rows={10}
                disabled={!canManageAutomation}
                className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring/50 flex w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                defaultValue={JSON.stringify(
                  settings.templatesJson || DEFAULT_GOLDBOT_TEMPLATES,
                  null,
                  2,
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="throttleCapsJson">Throttle Caps JSON</Label>
              <textarea
                id="throttleCapsJson"
                name="throttleCapsJson"
                rows={5}
                disabled={!canManageAutomation}
                className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring/50 flex w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                defaultValue={JSON.stringify(
                  settings.throttleCapsJson || DEFAULT_GOLDBOT_THROTTLE_CAPS,
                  null,
                  2,
                )}
              />
            </div>

            <Button type="submit" disabled={!canManageAutomation}>
              Save Automation Settings
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
