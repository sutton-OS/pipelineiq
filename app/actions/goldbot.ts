"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import {
  createInboundMessageAndEnqueue,
  createLeadAndEnqueue,
  DEFAULT_GOLDBOT_BUSINESS_HOURS,
  DEFAULT_GOLDBOT_THROTTLE_CAPS,
  DEFAULT_GOLDBOT_TEMPLATES,
  updateLocationSettings,
  upsertKillSwitch,
} from "@/lib/goldbot";

type ActionResult = {
  ok: boolean;
  message: string;
};

function parseJsonField(
  formData: FormData,
  key: string,
  fallback: Record<string, unknown>,
): Record<string, unknown> {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return fallback;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return fallback;
  }
}

function toConsentStatus(value: string): "unknown" | "consented" | "revoked" {
  if (value === "consented" || value === "revoked") {
    return value;
  }
  return "unknown";
}

function parseBoolean(value: FormDataEntryValue | null): boolean {
  return String(value ?? "").toLowerCase() === "true";
}

export async function createLeadIntakeAction(formData: FormData): Promise<ActionResult> {
  try {
    const userId = await requireUserId();

    const fullName = String(formData.get("fullName") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const consentStatus = toConsentStatus(String(formData.get("consentStatus") ?? "unknown"));

    if (!fullName || !phone) {
      return { ok: false, message: "Name and phone are required." };
    }

    const result = await createLeadAndEnqueue({
      userId,
      fullName,
      phone,
      consentStatus,
      source: "manual",
    });

    revalidatePath("/dashboard/leads");
    revalidatePath(`/dashboard/leads/${result.leadId}`);
    revalidatePath("/dashboard/staff-queue");

    if (result.deduped) {
      return {
        ok: true,
        message: "Lead already exists for this phone number. No duplicate created.",
      };
    }

    return {
      ok: true,
      message: "Lead created and lead_created job enqueued.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create lead.";
    return { ok: false, message };
  }
}

export async function simulateInboundSmsAction(formData: FormData): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const fromPhone = String(formData.get("fromPhone") ?? "").trim();
    const body = String(formData.get("body") ?? "").trim();

    if (!fromPhone || !body) {
      return { ok: false, message: "From phone and message body are required." };
    }

    const result = await createInboundMessageAndEnqueue({
      userId,
      fromPhone,
      body,
      source: "simulator",
    });

    revalidatePath("/dashboard/leads");
    revalidatePath(`/dashboard/leads/${result.leadId}`);
    revalidatePath("/dashboard/staff-queue");

    return {
      ok: true,
      message: "Inbound message saved and inbound_received job enqueued.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to simulate inbound message.";
    return { ok: false, message };
  }
}

export async function updateKillSwitchAction(formData: FormData): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const scopeRaw = String(formData.get("scope") ?? "location").toLowerCase();
    const scope = scopeRaw === "org" ? "org" : "location";
    const enabled = parseBoolean(formData.get("enabled"));
    const reason = String(formData.get("reason") ?? "").trim();

    await upsertKillSwitch({
      userId,
      scope,
      enabled,
      reason,
    });

    revalidatePath("/dashboard/settings/automation");
    revalidatePath("/dashboard/staff-queue");

    return {
      ok: true,
      message: `${scope === "org" ? "Org" : "Location"} kill switch ${enabled ? "enabled" : "disabled"}.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update kill switch.";
    return { ok: false, message };
  }
}

export async function updateAutomationSettingsAction(formData: FormData): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const timezone = String(formData.get("timezone") ?? "America/New_York").trim();

    const businessHoursJson = parseJsonField(
      formData,
      "businessHoursJson",
      DEFAULT_GOLDBOT_BUSINESS_HOURS,
    );

    const templatesJson = parseJsonField(
      formData,
      "templatesJson",
      DEFAULT_GOLDBOT_TEMPLATES,
    );

    const throttleCapsJson = parseJsonField(
      formData,
      "throttleCapsJson",
      DEFAULT_GOLDBOT_THROTTLE_CAPS,
    );

    await updateLocationSettings({
      userId,
      timezone,
      businessHoursJson,
      templatesJson,
      throttleCapsJson,
    });

    revalidatePath("/dashboard/settings/automation");

    return {
      ok: true,
      message: "Location settings updated.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update settings.";
    return { ok: false, message };
  }
}
