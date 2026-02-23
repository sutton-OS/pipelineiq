"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type AutomationJsonField = {
  id: "bookingSettingsJson" | "businessHoursJson" | "templatesJson" | "throttleCapsJson";
  label: string;
  rows: number;
  initialValue: string;
  helper?: string;
};

type AutomationSettingsFormProps = {
  canManageAutomation: boolean;
  timezone: string;
  autonomyMode: "suggest_only" | "safe_auto";
  bookingProvider: "none" | "google_calendar" | "calendly";
  jsonFields: AutomationJsonField[];
  submitAction: (formData: FormData) => void | Promise<void>;
};

type JsonState = {
  value: string;
  error: string | null;
};

function validateJson(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return "JSON is required.";
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return "Must be a JSON object.";
    }
    return null;
  } catch {
    return "Invalid JSON.";
  }
}

function initialJsonState(fields: AutomationJsonField[]): Record<string, JsonState> {
  return Object.fromEntries(
    fields.map((field) => [
      field.id,
      {
        value: field.initialValue,
        error: validateJson(field.initialValue),
      },
    ]),
  );
}

export function AutomationSettingsForm({
  canManageAutomation,
  timezone,
  autonomyMode,
  bookingProvider,
  jsonFields,
  submitAction,
}: AutomationSettingsFormProps) {
  const [jsonValues, setJsonValues] = useState<Record<string, JsonState>>(() =>
    initialJsonState(jsonFields),
  );

  const hasJsonErrors = useMemo(
    () => Object.values(jsonValues).some((field) => Boolean(field.error)),
    [jsonValues],
  );

  const updateJsonValue = (id: string, nextValue: string) => {
    setJsonValues((current) => ({
      ...current,
      [id]: {
        value: nextValue,
        error: validateJson(nextValue),
      },
    }));
  };

  const formatJsonValue = (id: string) => {
    const currentField = jsonValues[id];
    if (!currentField) {
      return;
    }

    try {
      const parsed = JSON.parse(currentField.value);
      const pretty = JSON.stringify(parsed, null, 2);
      updateJsonValue(id, pretty);
    } catch {
      updateJsonValue(id, currentField.value);
    }
  };

  return (
    <form action={submitAction} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Input
            id="timezone"
            name="timezone"
            defaultValue={timezone || "America/New_York"}
            required
            disabled={!canManageAutomation}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="autonomyMode">Autonomy Mode</Label>
          <select
            id="autonomyMode"
            name="autonomyMode"
            defaultValue={autonomyMode}
            disabled={!canManageAutomation}
            className="border-input bg-background focus-visible:ring-ring/50 flex h-9 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
          >
            <option value="suggest_only">suggest_only (staff approval required)</option>
            <option value="safe_auto">safe_auto (governed auto actions)</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bookingProvider">Booking Provider</Label>
        <select
          id="bookingProvider"
          name="bookingProvider"
          defaultValue={bookingProvider}
          disabled={!canManageAutomation}
          className="border-input bg-background focus-visible:ring-ring/50 flex h-9 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
        >
          <option value="none">none (simulation fallback)</option>
          <option value="google_calendar">google_calendar</option>
        </select>
      </div>

      {jsonFields.map((field) => {
        const state = jsonValues[field.id];

        return (
          <div key={field.id} className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor={field.id}>{field.label}</Label>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={!canManageAutomation}
                onClick={() => formatJsonValue(field.id)}
              >
                Format
              </Button>
            </div>

            {field.helper ? <p className="text-xs text-ink-2">{field.helper}</p> : null}

            <textarea
              id={field.id}
              name={field.id}
              rows={field.rows}
              disabled={!canManageAutomation}
              className={cn(
                "border-input bg-background font-mono placeholder:text-muted-foreground focus-visible:ring-ring/50 flex w-full rounded-md border px-3 py-2 text-xs leading-relaxed shadow-xs outline-none focus-visible:ring-[3px]",
                state?.error ? "border-red-300/80 focus-visible:ring-red-500/30" : "",
              )}
              value={state?.value ?? ""}
              onChange={(event) => updateJsonValue(field.id, event.target.value)}
            />

            {state?.error ? <p className="text-xs text-red-300">{state.error}</p> : null}
          </div>
        );
      })}

      <Button type="submit" disabled={!canManageAutomation || hasJsonErrors}>
        Save Automation Settings
      </Button>
    </form>
  );
}
