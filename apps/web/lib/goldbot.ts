import { pgPool } from "@/lib/pg";
import { requireAuthContext, type AppRole } from "@/lib/auth";
import { logServerError } from "@/lib/server-error";

export const DEFAULT_GOLDBOT_BUSINESS_HOURS = {
  mon: [{ start: "09:00", end: "17:00" }],
  tue: [{ start: "09:00", end: "17:00" }],
  wed: [{ start: "09:00", end: "17:00" }],
  thu: [{ start: "09:00", end: "17:00" }],
  fri: [{ start: "09:00", end: "17:00" }],
  sat: [],
  sun: [],
};

export const DEFAULT_GOLDBOT_TEMPLATES = {
  intro:
    "Hi {{first_name}}, thanks for reaching out. Reply YES if you'd like to book your free trial.",
  follow_up:
    "Checking in on your trial request. Reply YES and I can help book a time.",
  slot_prompt:
    "Great. Reply with 1, 2, or 3 to pick a time: {{slot_1}}, {{slot_2}}, {{slot_3}}.",
  booked_confirmation:
    "Booked. We have you down for {{slot}}. Reply STOP to opt out.",
  reminder: "Reminder: your appointment is at {{slot}}. Reply if you need help.",
  invalid:
    "Sorry, I didn't catch that. Reply YES to continue or STOP to opt out.",
  invalid_slot:
    "Please reply with 1, 2, or 3 to pick a time. Reply STOP to opt out.",
};

export const DEFAULT_GOLDBOT_THROTTLE_CAPS = {
  per_hour: 2,
  per_day: 6,
  invalid_response_limit: 3,
};

export const DEFAULT_GOLDBOT_AUTONOMY_MODE = "safe_auto" as const;
export const DEFAULT_GOLDBOT_BOOKING_PROVIDER = "none" as const;
export const DEFAULT_GOLDBOT_BOOKING_SETTINGS = {} as const;

export type LocationAutonomyMode = "suggest_only" | "safe_auto";
export type LocationBookingProvider = "none" | "google_calendar" | "calendly";

export type OrgLocationContext = {
  orgId: string;
  locationId: string;
  locationName: string;
  timezone: string;
  role: AppRole;
  clerkOrgId: string | null;
  autonomyMode: LocationAutonomyMode;
  bookingProvider: LocationBookingProvider;
};

export type LeadListItem = {
  id: string;
  fullName: string;
  phone: string;
  consentStatus: string;
  optedOut: boolean;
  state: string;
  needsStaffAttention: boolean;
  createdAt: string;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
};

export type LeadDetail = {
  id: string;
  fullName: string;
  firstName: string | null;
  phone: string;
  normalizedPhone: string;
  consentStatus: string;
  optedOut: boolean;
  source: string;
  state: string;
  needsStaffAttention: boolean;
  invalidResponseCount: number;
  staleAfterAt: string | null;
  flagsJson: Record<string, unknown>;
  createdAt: string;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
};

export type MessageListItem = {
  id: string;
  direction: "inbound" | "outbound";
  status: string;
  body: string;
  createdAt: string;
  providerMessageId: string | null;
  idempotencyKey: string | null;
};

export type AppointmentListItem = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  provider: string | null;
  notes: string | null;
  createdAt: string;
};

export type StaffQueueItem = {
  type: "dead_job" | "staff_attention";
  id: string;
  leadId: string;
  leadName: string;
  state: string;
  reason: string;
  createdAt: string;
};

export type AuditListItem = {
  id: string;
  actionType: string;
  policyVersion: string;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
  leadName: string | null;
  decisionJson: Record<string, unknown> | null;
  resultJson: Record<string, unknown> | null;
};

export type AuditExportRow = {
  id: string;
  actionType: string;
  policyVersion: string;
  success: boolean;
  createdAt: string;
  decisionJson: Record<string, unknown> | null;
  resultJson: Record<string, unknown> | null;
  errorMessage: string | null;
  leadId: string | null;
  conversationId: string | null;
};

export type DashboardSummary = {
  totalLeads: number;
  bookedConversations: number;
  awaitingYes: number;
  awaitingTimeChoice: number;
  staffAttention: number;
  deadJobs: number;
  queuedJobs: number;
  runningJobs: number;
  outboundLast24h: number;
  optOutEventsLast7d: number;
  recentMessages: Array<{
    id: string;
    leadName: string;
    direction: "inbound" | "outbound";
    status: string;
    body: string;
    createdAt: string;
  }>;
  recentSendFailures: Array<{
    id: string;
    leadName: string;
    errorMessage: string | null;
    createdAt: string;
  }>;
  recentOptOutEvents: Array<{
    leadId: string;
    leadName: string;
    optedOutAt: string;
  }>;
  outboundHeatmap: Array<{
    dow: number;
    hour: number;
    count: number;
  }>;
};

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function normalizePhone(rawPhone: string): string | null {
  const digits = rawPhone.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  if (digits.length > 11) {
    return `+${digits}`;
  }

  return null;
}

function firstNameFromFullName(fullName: string): string {
  const [firstName] = fullName.trim().split(/\s+/);
  return firstName || "there";
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function toAutonomyMode(value: unknown): LocationAutonomyMode {
  return value === "suggest_only" ? "suggest_only" : "safe_auto";
}

function toBookingProvider(value: unknown): LocationBookingProvider {
  if (value === "google_calendar" || value === "calendly" || value === "none") {
    return value;
  }
  return "none";
}

function requireOwner(context: OrgLocationContext): void {
  if (context.role !== "owner") {
    throw new Error("Forbidden: owner role required");
  }
}

async function resolveRequestScope(userId: string): Promise<{
  clerkOrgId: string | null;
  role: AppRole;
}> {
  try {
    const authContext = await requireAuthContext();
    if (authContext.userId !== userId) {
      return { clerkOrgId: null, role: "owner" };
    }

    return {
      clerkOrgId: authContext.clerkOrgId,
      role: authContext.role,
    };
  } catch {
    return { clerkOrgId: null, role: "owner" };
  }
}

export async function ensureOrgAndLocation(userId: string): Promise<OrgLocationContext> {
  const client = await pgPool.connect();
  const requestScope = await resolveRequestScope(userId);

  try {
    await client.query("BEGIN");

    let orgRow:
      | {
          id: string;
          name: string;
          owner_user_id: string;
        }
      | undefined;

    if (requestScope.clerkOrgId) {
      const orgByClerkId = await client.query<{
        id: string;
        name: string;
        owner_user_id: string;
      }>(
        `
          SELECT id, name, owner_user_id
          FROM orgs
          WHERE clerk_org_id = $1
          LIMIT 1
        `,
        [requestScope.clerkOrgId],
      );

      orgRow = orgByClerkId.rows[0];
    }

    if (!orgRow) {
      const orgByMembership = await client.query<{
        id: string;
        name: string;
        owner_user_id: string;
      }>(
        `
          SELECT o.id, o.name, o.owner_user_id
          FROM orgs o
          LEFT JOIN org_memberships m
            ON m.org_id = o.id
            AND m.user_id = $1
            AND m.status = 'active'
          WHERE o.owner_user_id = $1
            OR m.user_id = $1
          ORDER BY
            CASE
              WHEN o.owner_user_id = $1 THEN 0
              WHEN m.role = 'owner' THEN 1
              ELSE 2
            END,
            o.created_at ASC
          LIMIT 1
        `,
        [userId],
      );

      orgRow = orgByMembership.rows[0];
    }

    if (!orgRow) {
      const defaultOrgName = "PipelineIQ Org";
      const ownerUserIdForInsert =
        requestScope.clerkOrgId && requestScope.role !== "owner"
          ? `clerk-org-owner:${requestScope.clerkOrgId}`
          : userId;
      const insertedOrg = await client.query<{
        id: string;
        name: string;
        owner_user_id: string;
      }>(
        `
          INSERT INTO orgs (owner_user_id, clerk_org_id, name, slug)
          VALUES ($1, $2, $3, $4)
          RETURNING id, name, owner_user_id
        `,
        [
          ownerUserIdForInsert,
          requestScope.clerkOrgId,
          defaultOrgName,
          slugify(`${requestScope.clerkOrgId ?? userId}-${defaultOrgName}`),
        ],
      );
      orgRow = insertedOrg.rows[0];
    }

    if (!orgRow) {
      throw new Error("Unable to resolve org");
    }

    const orgId = orgRow.id;
    const ownerUserId = orgRow.owner_user_id;

    if (requestScope.clerkOrgId) {
      await client.query(
        `
          UPDATE orgs
          SET
            clerk_org_id = COALESCE(clerk_org_id, $2),
            updated_at = now()
          WHERE id = $1
        `,
        [orgId, requestScope.clerkOrgId],
      );
    }

    await client.query(
      `
        INSERT INTO org_memberships (org_id, user_id, role, status)
        VALUES ($1, $2, 'owner', 'active')
        ON CONFLICT (org_id, user_id)
        DO UPDATE SET
          role = 'owner',
          status = 'active',
          updated_at = now()
      `,
      [orgId, ownerUserId],
    );

    const requestedRole: AppRole =
      ownerUserId === userId ? "owner" : requestScope.clerkOrgId ? requestScope.role : "staff";

    await client.query(
      `
        INSERT INTO org_memberships (org_id, user_id, role, status)
        VALUES ($1, $2, $3, 'active')
        ON CONFLICT (org_id, user_id)
        DO UPDATE SET
          role = CASE
            WHEN org_memberships.role = 'owner' THEN 'owner'
            ELSE EXCLUDED.role
          END,
          status = 'active',
          updated_at = now()
      `,
      [orgId, userId, requestedRole],
    );

    const membershipResult = await client.query<{ role: AppRole; status: string }>(
      `
        SELECT role, status
        FROM org_memberships
        WHERE org_id = $1
          AND user_id = $2
        LIMIT 1
      `,
      [orgId, userId],
    );

    const membership = membershipResult.rows[0];
    if (!membership || membership.status !== "active") {
      throw new Error("Forbidden: not an active member of this organization");
    }

    const role: AppRole = membership.role === "owner" ? "owner" : "staff";

    const existingLocationResult = await client.query<{
      id: string;
      name: string;
      timezone: string;
      autonomy_mode: string;
      booking_provider: string;
    }>(
      `
        SELECT id, name, timezone, autonomy_mode, booking_provider
        FROM locations
        WHERE org_id = $1
        ORDER BY created_at ASC
        LIMIT 1
      `,
      [orgId],
    );

    let location = existingLocationResult.rows[0];

    if (!location) {
      const insertedLocationResult = await client.query<{
        id: string;
        name: string;
        timezone: string;
        autonomy_mode: string;
        booking_provider: string;
      }>(
        `
          INSERT INTO locations (
            org_id,
            name,
            timezone,
            autonomy_mode,
            booking_provider,
            booking_settings_json,
            business_hours_json,
            templates_json,
            throttle_caps_json
          )
          VALUES (
            $1,
            'Main Location',
            'America/New_York',
            $2,
            $3,
            $4::jsonb,
            $5::jsonb,
            $6::jsonb,
            $7::jsonb
          )
          RETURNING id, name, timezone, autonomy_mode, booking_provider
        `,
        [
          orgId,
          DEFAULT_GOLDBOT_AUTONOMY_MODE,
          DEFAULT_GOLDBOT_BOOKING_PROVIDER,
          JSON.stringify(DEFAULT_GOLDBOT_BOOKING_SETTINGS),
          JSON.stringify(DEFAULT_GOLDBOT_BUSINESS_HOURS),
          JSON.stringify(DEFAULT_GOLDBOT_TEMPLATES),
          JSON.stringify(DEFAULT_GOLDBOT_THROTTLE_CAPS),
        ],
      );

      location = insertedLocationResult.rows[0];
    }

    if (!location) {
      throw new Error("Unable to resolve location");
    }

    await client.query(
      `
        INSERT INTO kill_switch (org_id, location_id, enabled, reason, updated_by)
        SELECT $1, NULL, false, NULL, 'system'
        WHERE NOT EXISTS (
          SELECT 1
          FROM kill_switch
          WHERE org_id = $1
            AND location_id IS NULL
        )
      `,
      [orgId],
    );

    await client.query("COMMIT");

    return {
      orgId,
      locationId: location.id,
      locationName: location.name,
      timezone: location.timezone,
      role,
      clerkOrgId: requestScope.clerkOrgId,
      autonomyMode: toAutonomyMode(location.autonomy_mode),
      bookingProvider: toBookingProvider(location.booking_provider),
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      logServerError("lib/goldbot.ensureOrgAndLocation.rollback", rollbackError, { userId });
    }

    logServerError("lib/goldbot.ensureOrgAndLocation", error, {
      userId,
      clerkOrgId: requestScope.clerkOrgId,
    });
    throw error;
  } finally {
    client.release();
  }
}

export async function listLeadsForLocation(context: OrgLocationContext): Promise<LeadListItem[]> {
  const result = await pgPool.query<{
    id: string;
    full_name: string;
    phone: string;
    consent_status: string;
    opted_out: boolean;
    state: string;
    needs_staff_attention: boolean;
    created_at: string;
    last_inbound_at: string | null;
    last_outbound_at: string | null;
  }>(
    `
      SELECT
        l.id,
        l.full_name,
        l.phone,
        l.consent_status,
        l.opted_out,
        COALESCE(c.state, 'awaiting_yes') AS state,
        COALESCE(c.needs_staff_attention, false) AS needs_staff_attention,
        l.created_at,
        l.last_inbound_at,
        l.last_outbound_at
      FROM leads l
      LEFT JOIN conversations c ON c.lead_id = l.id AND c.org_id = l.org_id
      WHERE l.org_id = $1
        AND l.location_id = $2
      ORDER BY l.created_at DESC
    `,
    [context.orgId, context.locationId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    consentStatus: row.consent_status,
    optedOut: row.opted_out,
    state: row.state,
    needsStaffAttention: row.needs_staff_attention,
    createdAt: row.created_at,
    lastInboundAt: row.last_inbound_at,
    lastOutboundAt: row.last_outbound_at,
  }));
}

export async function getLeadDetail(
  context: OrgLocationContext,
  leadId: string,
): Promise<{
  lead: LeadDetail | null;
  messages: MessageListItem[];
  appointments: AppointmentListItem[];
}> {
  const leadResult = await pgPool.query<{
    id: string;
    full_name: string;
    first_name: string | null;
    phone: string;
    normalized_phone: string;
    consent_status: string;
    opted_out: boolean;
    source: string;
    created_at: string;
    last_inbound_at: string | null;
    last_outbound_at: string | null;
    state: string;
    needs_staff_attention: boolean;
    invalid_response_count: number;
    stale_after_at: string | null;
    flags_json: unknown;
    conversation_id: string | null;
  }>(
    `
      SELECT
        l.id,
        l.full_name,
        l.first_name,
        l.phone,
        l.normalized_phone,
        l.consent_status,
        l.opted_out,
        l.source,
        l.created_at,
        l.last_inbound_at,
        l.last_outbound_at,
        COALESCE(c.state, 'awaiting_yes') AS state,
        COALESCE(c.needs_staff_attention, false) AS needs_staff_attention,
        COALESCE(c.invalid_response_count, 0) AS invalid_response_count,
        c.stale_after_at,
        COALESCE(c.flags_json, '{}'::jsonb) AS flags_json,
        c.id AS conversation_id
      FROM leads l
      LEFT JOIN conversations c ON c.lead_id = l.id AND c.org_id = l.org_id
      WHERE l.org_id = $1
        AND l.location_id = $2
        AND l.id = $3
      LIMIT 1
    `,
    [context.orgId, context.locationId, leadId],
  );

  const leadRow = leadResult.rows[0];

  if (!leadRow) {
    return { lead: null, messages: [], appointments: [] };
  }

  const conversationId = leadRow.conversation_id;

  const [messagesResult, appointmentsResult] = await Promise.all([
    conversationId
      ? pgPool.query<{
          id: string;
          direction: "inbound" | "outbound";
          status: string;
          body: string;
          created_at: string;
          provider_message_id: string | null;
          idempotency_key: string | null;
        }>(
          `
            SELECT
              id,
              direction,
              status,
              body,
              created_at,
              provider_message_id,
              idempotency_key
            FROM messages
            WHERE org_id = $1
              AND conversation_id = $2
            ORDER BY created_at DESC
            LIMIT 200
          `,
          [context.orgId, conversationId],
        )
      : Promise.resolve({ rows: [] as never[] }),
    conversationId
      ? pgPool.query<{
          id: string;
          starts_at: string;
          ends_at: string;
          status: string;
          provider: string | null;
          notes: string | null;
          created_at: string;
        }>(
          `
            SELECT
              id,
              starts_at,
              ends_at,
              status,
              provider,
              notes,
              created_at
            FROM appointments
            WHERE org_id = $1
              AND conversation_id = $2
            ORDER BY starts_at DESC
          `,
          [context.orgId, conversationId],
        )
      : Promise.resolve({ rows: [] as never[] }),
  ]);

  const lead: LeadDetail = {
    id: leadRow.id,
    fullName: leadRow.full_name,
    firstName: leadRow.first_name,
    phone: leadRow.phone,
    normalizedPhone: leadRow.normalized_phone,
    consentStatus: leadRow.consent_status,
    optedOut: leadRow.opted_out,
    source: leadRow.source,
    state: leadRow.state,
    needsStaffAttention: leadRow.needs_staff_attention,
    invalidResponseCount: leadRow.invalid_response_count,
    staleAfterAt: leadRow.stale_after_at,
    flagsJson: asObject(leadRow.flags_json),
    createdAt: leadRow.created_at,
    lastInboundAt: leadRow.last_inbound_at,
    lastOutboundAt: leadRow.last_outbound_at,
  };

  return {
    lead,
    messages: messagesResult.rows.map((row) => ({
      id: row.id,
      direction: row.direction,
      status: row.status,
      body: row.body,
      createdAt: row.created_at,
      providerMessageId: row.provider_message_id,
      idempotencyKey: row.idempotency_key,
    })),
    appointments: appointmentsResult.rows.map((row) => ({
      id: row.id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.status,
      provider: row.provider,
      notes: row.notes,
      createdAt: row.created_at,
    })),
  };
}

export async function enqueueJobForOrg(params: {
  orgId: string;
  locationId: string;
  type: string;
  payload: Record<string, unknown>;
  dedupeKey?: string;
  runAt?: string;
}): Promise<{ queued: boolean; jobId: string | null }> {
  const result = await pgPool.query<{ id: string }>(
    `
      INSERT INTO jobs (
        org_id,
        location_id,
        type,
        dedupe_key,
        run_at,
        payload_json
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        COALESCE($5::timestamptz, now()),
        $6::jsonb
      )
      ON CONFLICT (org_id, dedupe_key)
      DO NOTHING
      RETURNING id
    `,
    [
      params.orgId,
      params.locationId,
      params.type,
      params.dedupeKey ?? null,
      params.runAt ?? null,
      JSON.stringify(params.payload),
    ],
  );

  return {
    queued: Boolean(result.rows[0]?.id),
    jobId: result.rows[0]?.id ?? null,
  };
}

export async function createLeadAndEnqueue(input: {
  userId: string;
  fullName: string;
  phone: string;
  consentStatus: "unknown" | "consented" | "revoked";
  source?: string;
}): Promise<{
  deduped: boolean;
  leadId: string;
  conversationId: string;
  queuedJobId: string | null;
}> {
  const context = await ensureOrgAndLocation(input.userId);
  const normalizedPhone = normalizePhone(input.phone);

  if (!normalizedPhone) {
    throw new Error("Invalid phone number");
  }

  const existingLeadResult = await pgPool.query<{ id: string }>(
    `
      SELECT id
      FROM leads
      WHERE org_id = $1
        AND location_id = $2
        AND normalized_phone = $3
      LIMIT 1
    `,
    [context.orgId, context.locationId, normalizedPhone],
  );

  if (existingLeadResult.rows[0]?.id) {
    const existingLeadId = existingLeadResult.rows[0].id;

    const existingConversationResult = await pgPool.query<{ id: string }>(
      `
        SELECT id
        FROM conversations
        WHERE org_id = $1
          AND lead_id = $2
        LIMIT 1
      `,
      [context.orgId, existingLeadId],
    );

    const existingConversationId = existingConversationResult.rows[0]?.id;
    if (!existingConversationId) {
      throw new Error("Conversation missing for deduped lead");
    }

    return {
      deduped: true,
      leadId: existingLeadId,
      conversationId: existingConversationId,
      queuedJobId: null,
    };
  }

  const leadInsertResult = await pgPool.query<{ id: string }>(
    `
      INSERT INTO leads (
        org_id,
        location_id,
        full_name,
        first_name,
        phone,
        normalized_phone,
        consent_status,
        source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `,
    [
      context.orgId,
      context.locationId,
      input.fullName,
      firstNameFromFullName(input.fullName),
      input.phone,
      normalizedPhone,
      input.consentStatus,
      input.source ?? "manual",
    ],
  );

  const leadId = leadInsertResult.rows[0]?.id;

  if (!leadId) {
    throw new Error("Failed to create lead");
  }

  const conversationResult = await pgPool.query<{ id: string }>(
    `
      INSERT INTO conversations (
        org_id,
        location_id,
        lead_id,
        state,
        stale_after_at
      )
      VALUES ($1, $2, $3, 'awaiting_yes', now() + interval '48 hours')
      RETURNING id
    `,
    [context.orgId, context.locationId, leadId],
  );

  const conversationId = conversationResult.rows[0]?.id;

  if (!conversationId) {
    throw new Error("Failed to create conversation");
  }

  const enqueueResult = await enqueueJobForOrg({
    orgId: context.orgId,
    locationId: context.locationId,
    type: "lead_created",
    dedupeKey: `lead_created:${conversationId}`,
    payload: {
      orgId: context.orgId,
      locationId: context.locationId,
      leadId,
      conversationId,
      source: input.source ?? "manual",
    },
  });

  return {
    deduped: false,
    leadId,
    conversationId,
    queuedJobId: enqueueResult.jobId,
  };
}

export async function createInboundMessageAndEnqueue(input: {
  userId: string;
  fromPhone: string;
  body: string;
  source?: "simulator" | "webhook";
}): Promise<{ messageId: string; queuedJobId: string | null; leadId: string }> {
  const context = await ensureOrgAndLocation(input.userId);
  const normalizedPhone = normalizePhone(input.fromPhone);

  if (!normalizedPhone) {
    throw new Error("Invalid inbound phone number");
  }

  const leadResult = await pgPool.query<{ id: string }>(
    `
      SELECT id
      FROM leads
      WHERE org_id = $1
        AND location_id = $2
        AND normalized_phone = $3
      LIMIT 1
    `,
    [context.orgId, context.locationId, normalizedPhone],
  );

  const leadId = leadResult.rows[0]?.id;
  if (!leadId) {
    throw new Error("No lead found for inbound number");
  }

  const conversationResult = await pgPool.query<{ id: string }>(
    `
      SELECT id
      FROM conversations
      WHERE org_id = $1
        AND lead_id = $2
      LIMIT 1
    `,
    [context.orgId, leadId],
  );

  const conversationId = conversationResult.rows[0]?.id;
  if (!conversationId) {
    throw new Error("No conversation found for lead");
  }

  const messageInsertResult = await pgPool.query<{ id: string }>(
    `
      INSERT INTO messages (
        org_id,
        location_id,
        conversation_id,
        lead_id,
        direction,
        channel,
        body,
        status,
        metadata_json
      )
      VALUES ($1, $2, $3, $4, 'inbound', 'sms', $5, 'received', $6::jsonb)
      RETURNING id
    `,
    [
      context.orgId,
      context.locationId,
      conversationId,
      leadId,
      input.body,
      JSON.stringify({
        source: input.source ?? "simulator",
        normalizedFrom: normalizedPhone,
      }),
    ],
  );

  const messageId = messageInsertResult.rows[0]?.id;
  if (!messageId) {
    throw new Error("Failed to create inbound message");
  }

  await pgPool.query(
    `
      UPDATE leads
      SET
        last_inbound_at = now(),
        updated_at = now()
      WHERE id = $1
    `,
    [leadId],
  );

  await pgPool.query(
    `
      UPDATE conversations
      SET
        last_inbound_at = now(),
        updated_at = now()
      WHERE id = $1
    `,
    [conversationId],
  );

  const enqueueResult = await enqueueJobForOrg({
    orgId: context.orgId,
    locationId: context.locationId,
    type: "inbound_received",
    dedupeKey: `inbound_received:${messageId}`,
    payload: {
      orgId: context.orgId,
      locationId: context.locationId,
      leadId,
      conversationId,
      messageId,
    },
  });

  return {
    messageId,
    queuedJobId: enqueueResult.jobId,
    leadId,
  };
}

export async function createInboundMessageFromWebhook(input: {
  fromPhone: string;
  body: string;
  providerMessageId?: string;
  rawPayload?: Record<string, unknown>;
}): Promise<{
  messageId: string;
  queuedJobId: string | null;
  leadId: string;
  orgId: string;
  locationId: string;
}> {
  const normalizedPhone = normalizePhone(input.fromPhone);
  if (!normalizedPhone) {
    throw new Error("Invalid inbound phone number");
  }

  const leadLookupResult = await pgPool.query<{
    id: string;
    org_id: string;
    location_id: string;
  }>(
    `
      SELECT id, org_id, location_id
      FROM leads
      WHERE normalized_phone = $1
      ORDER BY created_at DESC
      LIMIT 2
    `,
    [normalizedPhone],
  );

  if (leadLookupResult.rows.length === 0) {
    throw new Error("No lead found for inbound phone");
  }

  if (leadLookupResult.rows.length > 1) {
    throw new Error("Ambiguous inbound phone; multiple leads matched");
  }

  const lead = leadLookupResult.rows[0];
  const conversationResult = await pgPool.query<{ id: string }>(
    `
      SELECT id
      FROM conversations
      WHERE org_id = $1
        AND lead_id = $2
      LIMIT 1
    `,
    [lead.org_id, lead.id],
  );

  const conversationId = conversationResult.rows[0]?.id;
  if (!conversationId) {
    throw new Error("No conversation found for inbound lead");
  }

  const messageInsertResult = await pgPool.query<{ id: string }>(
    `
      INSERT INTO messages (
        org_id,
        location_id,
        conversation_id,
        lead_id,
        direction,
        channel,
        body,
        status,
        provider_message_id,
        metadata_json
      )
      VALUES ($1, $2, $3, $4, 'inbound', 'sms', $5, 'received', $6, $7::jsonb)
      RETURNING id
    `,
    [
      lead.org_id,
      lead.location_id,
      conversationId,
      lead.id,
      input.body,
      input.providerMessageId ?? null,
      JSON.stringify({
        source: "twilio_webhook",
        normalizedFrom: normalizedPhone,
        rawPayload: input.rawPayload ?? {},
      }),
    ],
  );

  const messageId = messageInsertResult.rows[0]?.id;
  if (!messageId) {
    throw new Error("Failed to persist inbound webhook message");
  }

  await pgPool.query(
    `
      UPDATE leads
      SET
        last_inbound_at = now(),
        updated_at = now()
      WHERE id = $1
    `,
    [lead.id],
  );

  await pgPool.query(
    `
      UPDATE conversations
      SET
        last_inbound_at = now(),
        updated_at = now()
      WHERE id = $1
    `,
    [conversationId],
  );

  const enqueueResult = await enqueueJobForOrg({
    orgId: lead.org_id,
    locationId: lead.location_id,
    type: "inbound_received",
    dedupeKey: `inbound_received:${messageId}`,
    payload: {
      orgId: lead.org_id,
      locationId: lead.location_id,
      leadId: lead.id,
      conversationId,
      messageId,
    },
  });

  return {
    messageId,
    queuedJobId: enqueueResult.jobId,
    leadId: lead.id,
    orgId: lead.org_id,
    locationId: lead.location_id,
  };
}

export async function getLocationSettings(context: OrgLocationContext): Promise<{
  locationName: string;
  timezone: string;
  role: AppRole;
  autonomyMode: LocationAutonomyMode;
  bookingProvider: LocationBookingProvider;
  bookingSettingsJson: Record<string, unknown>;
  businessHoursJson: Record<string, unknown>;
  templatesJson: Record<string, unknown>;
  throttleCapsJson: Record<string, unknown>;
  globalKillEnabled: boolean;
  locationKillEnabled: boolean;
}> {
  const [locationResult, killSwitchResult] = await Promise.all([
    pgPool.query<{
      name: string;
      timezone: string;
      autonomy_mode: string;
      booking_provider: string;
      booking_settings_json: unknown;
      business_hours_json: unknown;
      templates_json: unknown;
      throttle_caps_json: unknown;
    }>(
      `
        SELECT
          name,
          timezone,
          autonomy_mode,
          booking_provider,
          booking_settings_json,
          business_hours_json,
          templates_json,
          throttle_caps_json
        FROM locations
        WHERE org_id = $1
          AND id = $2
        LIMIT 1
      `,
      [context.orgId, context.locationId],
    ),
    pgPool.query<{
      global_enabled: boolean;
      location_enabled: boolean;
    }>(
      `
        SELECT
          COALESCE((
            SELECT enabled
            FROM kill_switch
            WHERE org_id = $1
              AND location_id IS NULL
            ORDER BY updated_at DESC
            LIMIT 1
          ), false) AS global_enabled,
          COALESCE((
            SELECT enabled
            FROM kill_switch
            WHERE org_id = $1
              AND location_id = $2
            ORDER BY updated_at DESC
            LIMIT 1
          ), false) AS location_enabled
      `,
      [context.orgId, context.locationId],
    ),
  ]);

  const location = locationResult.rows[0];
  if (!location) {
    throw new Error("Location not found");
  }

  const kill = killSwitchResult.rows[0];

  return {
    locationName: location.name,
    timezone: location.timezone,
    role: context.role,
    autonomyMode: toAutonomyMode(location.autonomy_mode),
    bookingProvider: toBookingProvider(location.booking_provider),
    bookingSettingsJson: asObject(location.booking_settings_json),
    businessHoursJson: asObject(location.business_hours_json),
    templatesJson: asObject(location.templates_json),
    throttleCapsJson: asObject(location.throttle_caps_json),
    globalKillEnabled: Boolean(kill?.global_enabled),
    locationKillEnabled: Boolean(kill?.location_enabled),
  };
}

export async function upsertKillSwitch(input: {
  userId: string;
  scope: "org" | "location";
  enabled: boolean;
  reason?: string;
}): Promise<void> {
  const context = await ensureOrgAndLocation(input.userId);
  requireOwner(context);
  const locationId = input.scope === "location" ? context.locationId : null;

  await pgPool.query(
    `
      WITH updated AS (
        UPDATE kill_switch
        SET
          enabled = $3,
          reason = $4,
          updated_by = $5,
          updated_at = now()
        WHERE org_id = $1
          AND (
            ($2::uuid IS NULL AND location_id IS NULL)
            OR location_id = $2::uuid
          )
        RETURNING id
      )
      INSERT INTO kill_switch (org_id, location_id, enabled, reason, updated_by)
      SELECT $1, $2::uuid, $3, $4, $5
      WHERE NOT EXISTS (SELECT 1 FROM updated)
    `,
    [context.orgId, locationId, input.enabled, input.reason ?? null, input.userId],
  );
}

export async function updateLocationSettings(input: {
  userId: string;
  timezone: string;
  autonomyMode: LocationAutonomyMode;
  bookingProvider: LocationBookingProvider;
  bookingSettingsJson: Record<string, unknown>;
  businessHoursJson: Record<string, unknown>;
  templatesJson: Record<string, unknown>;
  throttleCapsJson: Record<string, unknown>;
}): Promise<void> {
  const context = await ensureOrgAndLocation(input.userId);
  requireOwner(context);

  await pgPool.query(
    `
      UPDATE locations
      SET
        timezone = $3,
        autonomy_mode = $4,
        booking_provider = $5,
        booking_settings_json = $6::jsonb,
        business_hours_json = $7::jsonb,
        templates_json = $8::jsonb,
        throttle_caps_json = $9::jsonb,
        updated_at = now()
      WHERE org_id = $1
        AND id = $2
    `,
    [
      context.orgId,
      context.locationId,
      input.timezone,
      input.autonomyMode,
      input.bookingProvider,
      JSON.stringify(input.bookingSettingsJson),
      JSON.stringify(input.businessHoursJson),
      JSON.stringify(input.templatesJson),
      JSON.stringify(input.throttleCapsJson),
    ],
  );
}

export async function listStaffQueue(context: OrgLocationContext): Promise<StaffQueueItem[]> {
  const [deadJobs, staffConversations] = await Promise.all([
    pgPool.query<{
      id: string;
      lead_id: string;
      full_name: string;
      state: string;
      last_error: string | null;
      created_at: string;
    }>(
      `
        SELECT
          j.id::text,
          c.lead_id,
          l.full_name,
          c.state,
          j.last_error,
          j.created_at
        FROM jobs j
        JOIN conversations c ON c.id = (j.payload_json->>'conversationId')::uuid
        JOIN leads l ON l.id = c.lead_id
        WHERE j.org_id = $1
          AND j.location_id = $2
          AND j.status = 'dead'
        ORDER BY j.created_at DESC
        LIMIT 100
      `,
      [context.orgId, context.locationId],
    ),
    pgPool.query<{
      id: string;
      lead_id: string;
      full_name: string;
      state: string;
      created_at: string;
      escalation_reason: string | null;
    }>(
      `
        SELECT
          c.id,
          c.lead_id,
          l.full_name,
          c.state,
          c.updated_at AS created_at,
          c.flags_json->>'escalationReason' AS escalation_reason
        FROM conversations c
        JOIN leads l ON l.id = c.lead_id
        WHERE c.org_id = $1
          AND c.location_id = $2
          AND c.needs_staff_attention = true
        ORDER BY c.updated_at DESC
        LIMIT 100
      `,
      [context.orgId, context.locationId],
    ),
  ]);

  const deadJobItems: StaffQueueItem[] = deadJobs.rows.map((row) => ({
    type: "dead_job",
    id: row.id,
    leadId: row.lead_id,
    leadName: row.full_name,
    state: row.state,
    reason: row.last_error ?? "dead_letter",
    createdAt: row.created_at,
  }));

  const staffAttentionItems: StaffQueueItem[] = staffConversations.rows.map((row) => ({
    type: "staff_attention",
    id: row.id,
    leadId: row.lead_id,
    leadName: row.full_name,
    state: row.state,
    reason: row.escalation_reason ?? "needs_staff_attention",
    createdAt: row.created_at,
  }));

  return [...staffAttentionItems, ...deadJobItems].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );
}

export async function listAuditEntries(context: OrgLocationContext): Promise<AuditListItem[]> {
  const result = await pgPool.query<{
    id: string;
    action_type: string;
    policy_version: string;
    success: boolean;
    error_message: string | null;
    created_at: string;
    full_name: string | null;
    decision_json: unknown;
    result_json: unknown;
  }>(
    `
      SELECT
        a.id::text,
        a.action_type,
        a.policy_version,
        a.success,
        a.error_message,
        a.created_at,
        l.full_name,
        a.decision_json,
        a.result_json
      FROM audit_log a
      LEFT JOIN leads l ON l.id = a.lead_id
      WHERE a.org_id = $1
        AND (a.location_id = $2 OR a.location_id IS NULL)
      ORDER BY a.created_at DESC
      LIMIT 200
    `,
    [context.orgId, context.locationId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    actionType: row.action_type,
    policyVersion: row.policy_version,
    success: row.success,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    leadName: row.full_name,
    decisionJson: asObject(row.decision_json),
    resultJson: asObject(row.result_json),
  }));
}

export async function listAuditEntriesForExport(
  context: OrgLocationContext,
  limit = 5000,
): Promise<AuditExportRow[]> {
  const safeLimit = Math.max(1, Math.min(10000, Math.trunc(limit)));
  const result = await pgPool.query<{
    id: string;
    action_type: string;
    policy_version: string;
    success: boolean;
    created_at: string;
    decision_json: unknown;
    result_json: unknown;
    error_message: string | null;
    lead_id: string | null;
    conversation_id: string | null;
  }>(
    `
      SELECT
        a.id::text,
        a.action_type,
        a.policy_version,
        a.success,
        a.created_at,
        a.decision_json,
        a.result_json,
        a.error_message,
        a.lead_id::text AS lead_id,
        a.conversation_id::text AS conversation_id
      FROM audit_log a
      WHERE a.org_id = $1
        AND (a.location_id = $2 OR a.location_id IS NULL)
      ORDER BY a.created_at DESC
      LIMIT $3
    `,
    [context.orgId, context.locationId, safeLimit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    actionType: row.action_type,
    policyVersion: row.policy_version,
    success: row.success,
    createdAt: row.created_at,
    decisionJson: asObject(row.decision_json),
    resultJson: asObject(row.result_json),
    errorMessage: row.error_message,
    leadId: row.lead_id,
    conversationId: row.conversation_id,
  }));
}

export async function getDashboardSummary(context: OrgLocationContext): Promise<DashboardSummary> {
  try {
    const [
      countsResult,
      jobCountsResult,
      outboundResult,
      optOutCountResult,
      recentMessagesResult,
      sendFailuresResult,
      optOutEventsResult,
      heatmapResult,
    ] = await Promise.all([
    pgPool.query<{
      total_leads: string;
      booked_conversations: string;
      awaiting_yes: string;
      awaiting_time_choice: string;
      staff_attention: string;
    }>(
      `
        SELECT
          COUNT(DISTINCT l.id)::text AS total_leads,
          COUNT(*) FILTER (WHERE c.state = 'booked')::text AS booked_conversations,
          COUNT(*) FILTER (WHERE c.state = 'awaiting_yes')::text AS awaiting_yes,
          COUNT(*) FILTER (WHERE c.state = 'awaiting_time_choice')::text AS awaiting_time_choice,
          COUNT(*) FILTER (WHERE c.needs_staff_attention = true)::text AS staff_attention
        FROM leads l
        LEFT JOIN conversations c ON c.lead_id = l.id AND c.org_id = l.org_id
        WHERE l.org_id = $1
          AND l.location_id = $2
      `,
      [context.orgId, context.locationId],
    ),
    pgPool.query<{
      queued_jobs: string;
      running_jobs: string;
      dead_jobs: string;
    }>(
      `
        SELECT
          COUNT(*) FILTER (WHERE status = 'queued')::text AS queued_jobs,
          COUNT(*) FILTER (WHERE status = 'running')::text AS running_jobs,
          COUNT(*) FILTER (WHERE status = 'dead')::text AS dead_jobs
        FROM jobs
        WHERE org_id = $1
          AND location_id = $2
      `,
      [context.orgId, context.locationId],
    ),
    pgPool.query<{ outbound_last_24h: string }>(
      `
        SELECT COUNT(*)::text AS outbound_last_24h
        FROM messages
        WHERE org_id = $1
          AND location_id = $2
          AND direction = 'outbound'
          AND created_at >= now() - interval '24 hours'
      `,
      [context.orgId, context.locationId],
    ),
    pgPool.query<{ opt_out_events_last_7d: string }>(
      `
        SELECT COUNT(*)::text AS opt_out_events_last_7d
        FROM leads
        WHERE org_id = $1
          AND location_id = $2
          AND opted_out = true
          AND opted_out_at >= now() - interval '7 days'
      `,
      [context.orgId, context.locationId],
    ),
    pgPool.query<{
      id: string;
      lead_name: string;
      direction: "inbound" | "outbound";
      status: string;
      body: string;
      created_at: string;
    }>(
      `
        SELECT
          m.id,
          l.full_name AS lead_name,
          m.direction,
          m.status,
          m.body,
          m.created_at
        FROM messages m
        JOIN leads l ON l.id = m.lead_id
        WHERE m.org_id = $1
          AND m.location_id = $2
        ORDER BY m.created_at DESC
        LIMIT 20
      `,
      [context.orgId, context.locationId],
    ),
    pgPool.query<{
      id: string;
      lead_name: string;
      error_message: string | null;
      created_at: string;
    }>(
      `
        SELECT
          m.id,
          l.full_name AS lead_name,
          m.error_message,
          m.created_at
        FROM messages m
        JOIN leads l ON l.id = m.lead_id
        WHERE m.org_id = $1
          AND m.location_id = $2
          AND m.direction = 'outbound'
          AND m.status = 'failed'
        ORDER BY m.created_at DESC
        LIMIT 12
      `,
      [context.orgId, context.locationId],
    ),
    pgPool.query<{
      lead_id: string;
      lead_name: string;
      opted_out_at: string;
    }>(
      `
        SELECT
          l.id AS lead_id,
          l.full_name AS lead_name,
          l.opted_out_at
        FROM leads l
        WHERE l.org_id = $1
          AND l.location_id = $2
          AND l.opted_out = true
          AND l.opted_out_at IS NOT NULL
        ORDER BY l.opted_out_at DESC
        LIMIT 12
      `,
      [context.orgId, context.locationId],
    ),
    pgPool.query<{
      dow: string;
      hour: string;
      count: string;
    }>(
      `
        SELECT
          EXTRACT(DOW FROM created_at)::int::text AS dow,
          EXTRACT(HOUR FROM created_at)::int::text AS hour,
          COUNT(*)::text AS count
        FROM messages
        WHERE org_id = $1
          AND location_id = $2
          AND direction = 'outbound'
          AND created_at >= now() - interval '7 days'
        GROUP BY 1, 2
        ORDER BY 1, 2
      `,
      [context.orgId, context.locationId],
    ),
    ]);

    const counts = countsResult.rows[0];
    const jobs = jobCountsResult.rows[0];
    const outbound = outboundResult.rows[0];
    const optOutCount = optOutCountResult.rows[0];

    return {
      totalLeads: Number(counts?.total_leads ?? "0"),
      bookedConversations: Number(counts?.booked_conversations ?? "0"),
      awaitingYes: Number(counts?.awaiting_yes ?? "0"),
      awaitingTimeChoice: Number(counts?.awaiting_time_choice ?? "0"),
      staffAttention: Number(counts?.staff_attention ?? "0"),
      deadJobs: Number(jobs?.dead_jobs ?? "0"),
      queuedJobs: Number(jobs?.queued_jobs ?? "0"),
      runningJobs: Number(jobs?.running_jobs ?? "0"),
      outboundLast24h: Number(outbound?.outbound_last_24h ?? "0"),
      optOutEventsLast7d: Number(optOutCount?.opt_out_events_last_7d ?? "0"),
      recentMessages: recentMessagesResult.rows.map((row) => ({
        id: row.id,
        leadName: row.lead_name,
        direction: row.direction,
        status: row.status,
        body: row.body,
        createdAt: row.created_at,
      })),
      recentSendFailures: sendFailuresResult.rows.map((row) => ({
        id: row.id,
        leadName: row.lead_name,
        errorMessage: row.error_message,
        createdAt: row.created_at,
      })),
      recentOptOutEvents: optOutEventsResult.rows.map((row) => ({
        leadId: row.lead_id,
        leadName: row.lead_name,
        optedOutAt: row.opted_out_at,
      })),
      outboundHeatmap: heatmapResult.rows.map((row) => ({
        dow: Number(row.dow),
        hour: Number(row.hour),
        count: Number(row.count),
      })),
    };
  } catch (error) {
    logServerError("lib/goldbot.getDashboardSummary", error, {
      orgId: context.orgId,
      locationId: context.locationId,
    });
    throw error;
  }
}
