import crypto from "node:crypto";
import type { BookingProvider } from "@pipelineiq/engine";

type BookAppointmentInput = {
  provider: BookingProvider;
  bookingSettings: Record<string, unknown>;
  orgId: string;
  locationId: string;
  conversationId: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
  timezone: string;
  startsAt: string;
  endsAt: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey: string;
};

export type BookAppointmentResult = {
  provider: BookingProvider;
  providerAppointmentId: string;
  status: string;
  simulated: boolean;
  providerPayload: Record<string, unknown>;
};

type GoogleCalendarConfig = {
  calendarId: string;
  serviceAccountEmail: string;
  serviceAccountPrivateKey: string;
  impersonatedUser: string | null;
  summaryTemplate: string;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function createDeterministicId(prefix: string, input: string): string {
  const digest = crypto
    .createHash("sha256")
    .update(input)
    .digest("hex")
    .slice(0, 28);

  return `${prefix}${digest}`;
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function readGoogleCalendarConfig(settings: Record<string, unknown>): GoogleCalendarConfig {
  const calendarId = asString(settings.google_calendar_id) ?? process.env.GOOGLE_CALENDAR_ID;
  const serviceAccountEmail =
    asString(settings.google_service_account_email) ?? process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const serviceAccountPrivateKey =
    asString(settings.google_service_account_private_key) ??
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const impersonatedUser =
    asString(settings.google_calendar_impersonated_user) ??
    process.env.GOOGLE_CALENDAR_IMPERSONATED_USER ??
    null;
  const summaryTemplate =
    asString(settings.google_calendar_summary_template) ??
    "PipelineIQ appointment - {{lead_name}}";

  if (!calendarId || !serviceAccountEmail || !serviceAccountPrivateKey) {
    throw new Error("google_calendar_config_missing");
  }

  return {
    calendarId,
    serviceAccountEmail,
    serviceAccountPrivateKey: serviceAccountPrivateKey.replace(/\\n/g, "\n"),
    impersonatedUser,
    summaryTemplate,
  };
}

function renderSummary(template: string, leadName: string): string {
  return template.replace(/{{\s*lead_name\s*}}/g, leadName).trim();
}

function createGoogleAssertion(config: GoogleCalendarConfig): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claimSet: Record<string, unknown> = {
    iss: config.serviceAccountEmail,
    scope: "https://www.googleapis.com/auth/calendar.events",
    aud: "https://oauth2.googleapis.com/token",
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };

  if (config.impersonatedUser) {
    claimSet.sub = config.impersonatedUser;
  }

  const unsigned = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(claimSet))}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(config.serviceAccountPrivateKey);

  return `${unsigned}.${signature.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`;
}

async function fetchGoogleAccessToken(config: GoogleCalendarConfig): Promise<string> {
  const assertion = createGoogleAssertion(config);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`[google_oauth_failed] status=${response.status} body=${text.slice(0, 300)}`);
  }

  const parsed = JSON.parse(text) as { access_token?: string };
  if (!parsed.access_token) {
    throw new Error("google_oauth_missing_access_token");
  }

  return parsed.access_token;
}

async function fetchGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<Record<string, unknown>> {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `[google_calendar_get_failed] status=${response.status} body=${text.slice(0, 300)}`,
    );
  }

  return JSON.parse(text) as Record<string, unknown>;
}

async function bookViaGoogleCalendar(
  input: BookAppointmentInput,
): Promise<BookAppointmentResult> {
  const config = readGoogleCalendarConfig(input.bookingSettings);
  const accessToken = await fetchGoogleAccessToken(config);
  const eventId = createDeterministicId("gbt", input.idempotencyKey);

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events?sendUpdates=none`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        id: eventId,
        summary: renderSummary(config.summaryTemplate, input.leadName),
        description: [
          `Lead: ${input.leadName}`,
          `Phone: ${input.leadPhone}`,
          `Org: ${input.orgId}`,
          `Location: ${input.locationId}`,
          `Conversation: ${input.conversationId}`,
          input.notes ? `Notes: ${input.notes}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        start: {
          dateTime: input.startsAt,
          timeZone: input.timezone,
        },
        end: {
          dateTime: input.endsAt,
          timeZone: input.timezone,
        },
        extendedProperties: {
          private: {
            idempotencyKey: input.idempotencyKey,
            orgId: input.orgId,
            locationId: input.locationId,
            leadId: input.leadId,
            conversationId: input.conversationId,
          },
        },
      }),
    },
  );

  if (response.status === 409) {
    const existing = await fetchGoogleEvent(accessToken, config.calendarId, eventId);
    return {
      provider: "google_calendar",
      providerAppointmentId: String(existing.id ?? eventId),
      status: String(existing.status ?? "confirmed"),
      simulated: false,
      providerPayload: existing,
    };
  }

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(
      `[google_calendar_insert_failed] status=${response.status} body=${responseText.slice(0, 400)}`,
    );
  }

  const parsed = JSON.parse(responseText) as {
    id?: string;
    status?: string;
    htmlLink?: string;
  };

  return {
    provider: "google_calendar",
    providerAppointmentId: parsed.id ?? eventId,
    status: parsed.status ?? "confirmed",
    simulated: false,
    providerPayload: {
      id: parsed.id ?? eventId,
      status: parsed.status ?? "confirmed",
      htmlLink: parsed.htmlLink ?? null,
    },
  };
}

function createSimulatedResult(input: BookAppointmentInput): BookAppointmentResult {
  const providerAppointmentId = createDeterministicId("sim_appt_", input.idempotencyKey);

  return {
    provider: input.provider,
    providerAppointmentId,
    status: "simulated",
    simulated: true,
    providerPayload: {
      simulated: true,
      provider: input.provider,
      idempotencyKey: input.idempotencyKey,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    },
  };
}

export async function bookAppointmentViaProvider(
  input: BookAppointmentInput,
): Promise<BookAppointmentResult> {
  switch (input.provider) {
    case "none":
      return createSimulatedResult(input);
    case "google_calendar":
      return bookViaGoogleCalendar(input);
    case "calendly":
      throw new Error("booking_provider_not_supported:calendly");
    default:
      throw new Error(`booking_provider_not_supported:${String(input.provider)}`);
  }
}
