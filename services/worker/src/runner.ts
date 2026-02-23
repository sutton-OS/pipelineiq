import os from "node:os";
import {
  coerceBusinessHours,
  type BusinessHours,
} from "./businessHours";
import { applyActionGateway } from "./actionGateway";
import { governActions } from "./governor";
import { sendSmsViaTwilio } from "./providers/twilio";
import { pool } from "./db";
import { evaluateStateMachine } from "./stateMachine";
import {
  DEFAULT_THROTTLE_CAPS,
  DEFAULT_TEMPLATES,
} from "./schema";
import type {
  ConversationContext,
  ConversationState,
  JobPayload,
  JobPayloadFollowUp,
  JobPayloadInboundReceived,
  JobPayloadLeadCreated,
  JobPayloadReminder,
  JobPayloadSendOutbound,
  JobType,
  TriggerEvent,
} from "./types";

type JobRow = {
  id: string;
  type: JobType;
  payload_json: unknown;
  attempts: number;
  max_attempts: number;
};

type ContextRow = {
  org_id: string;
  location_id: string;
  lead_id: string;
  conversation_id: string;
  lead_full_name: string;
  lead_first_name: string | null;
  lead_phone: string;
  normalized_phone: string;
  consent_status: "unknown" | "consented" | "revoked";
  opted_out: boolean;
  conversation_state: ConversationState;
  invalid_response_count: number;
  needs_staff_attention: boolean;
  stale_after_at: string | null;
  conversation_last_inbound_at: string | null;
  conversation_last_outbound_at: string | null;
  flags_json: unknown;
  timezone: string;
  business_hours_json: unknown;
  throttle_caps_json: unknown;
  templates_json: unknown;
  global_kill_switch: boolean;
  location_kill_switch: boolean;
  outbound_last_hour: string;
  outbound_last_day: string;
};

type InboundMessageRow = {
  id: string;
  body: string;
  created_at: string;
};

const POLL_INTERVAL_MS = 1000;
const CLAIM_LIMIT = 10;
const WORKER_ID = `${os.hostname()}/${process.pid}`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, key: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`invalid_job_payload_${key}`);
  }
  return value;
}

function parseJobPayload(type: JobType, payload: unknown): JobPayload {
  const record = asRecord(payload);

  switch (type) {
    case "lead_created":
      return {
        orgId: asString(record.orgId, "orgId"),
        locationId: asString(record.locationId, "locationId"),
        leadId: asString(record.leadId, "leadId"),
        conversationId: asString(record.conversationId, "conversationId"),
        source: typeof record.source === "string" ? record.source : undefined,
      } as JobPayloadLeadCreated;
    case "inbound_received":
      return {
        orgId: asString(record.orgId, "orgId"),
        locationId: asString(record.locationId, "locationId"),
        leadId: asString(record.leadId, "leadId"),
        conversationId: asString(record.conversationId, "conversationId"),
        messageId: asString(record.messageId, "messageId"),
      } as JobPayloadInboundReceived;
    case "follow_up":
      return {
        orgId: asString(record.orgId, "orgId"),
        locationId: asString(record.locationId, "locationId"),
        leadId: asString(record.leadId, "leadId"),
        conversationId: asString(record.conversationId, "conversationId"),
      } as JobPayloadFollowUp;
    case "reminder":
      return {
        orgId: asString(record.orgId, "orgId"),
        locationId: asString(record.locationId, "locationId"),
        leadId: asString(record.leadId, "leadId"),
        conversationId: asString(record.conversationId, "conversationId"),
        appointmentId: asString(record.appointmentId, "appointmentId"),
      } as JobPayloadReminder;
    case "send_outbound":
      return {
        orgId: asString(record.orgId, "orgId"),
        locationId: asString(record.locationId, "locationId"),
        messageId: asString(record.messageId, "messageId"),
      } as JobPayloadSendOutbound;
    default:
      throw new Error(`unsupported_job_type_${String(type)}`);
  }
}

async function claimDueJobs(limit: number): Promise<JobRow[]> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await client.query<JobRow>(
      `
        WITH due_jobs AS (
          SELECT id
          FROM jobs
          WHERE status = 'queued' AND run_at <= now()
          ORDER BY run_at, id
          FOR UPDATE SKIP LOCKED
          LIMIT $1
        )
        UPDATE jobs
        SET
          status = 'running',
          locked_at = now(),
          locked_by = $2,
          attempts = jobs.attempts + 1,
          updated_at = now()
        FROM due_jobs
        WHERE jobs.id = due_jobs.id
        RETURNING jobs.id, jobs.type, jobs.payload_json, jobs.attempts, jobs.max_attempts
      `,
      [limit, WORKER_ID],
    );
    await client.query("COMMIT");
    return result.rows;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function markDone(jobId: string): Promise<void> {
  await pool.query(
    `
      UPDATE jobs
      SET
        status = 'done',
        locked_at = NULL,
        locked_by = NULL,
        last_error = NULL,
        finished_at = now(),
        updated_at = now()
      WHERE id = $1
    `,
    [jobId],
  );
}

async function markFailure(
  jobId: string,
  attempts: number,
  maxAttempts: number,
  errorMessage: string,
): Promise<void> {
  const shouldDeadLetter = attempts >= maxAttempts;
  const backoffSeconds = Math.min(1800, 2 ** Math.max(1, attempts));

  if (shouldDeadLetter) {
    await pool.query(
      `
        UPDATE jobs
        SET
          status = 'dead',
          locked_at = NULL,
          locked_by = NULL,
          last_error = $2,
          finished_at = now(),
          updated_at = now()
        WHERE id = $1
      `,
      [jobId, errorMessage],
    );
    return;
  }

  await pool.query(
    `
      UPDATE jobs
      SET
        status = 'queued',
        run_at = now() + make_interval(secs => $3),
        locked_at = NULL,
        locked_by = NULL,
        last_error = $2,
        updated_at = now()
      WHERE id = $1
    `,
    [jobId, errorMessage, backoffSeconds],
  );
}

function parseThrottleCaps(value: unknown): {
  perHour: number;
  perDay: number;
  invalidResponseLimit: number;
} {
  const raw = asRecord(value);
  const perHour = Number(raw.per_hour ?? DEFAULT_THROTTLE_CAPS.per_hour);
  const perDay = Number(raw.per_day ?? DEFAULT_THROTTLE_CAPS.per_day);
  const invalidResponseLimit = Number(
    raw.invalid_response_limit ?? DEFAULT_THROTTLE_CAPS.invalid_response_limit,
  );

  return {
    perHour: Number.isFinite(perHour) ? Math.max(1, Math.trunc(perHour)) : DEFAULT_THROTTLE_CAPS.per_hour,
    perDay: Number.isFinite(perDay) ? Math.max(1, Math.trunc(perDay)) : DEFAULT_THROTTLE_CAPS.per_day,
    invalidResponseLimit: Number.isFinite(invalidResponseLimit)
      ? Math.max(1, Math.trunc(invalidResponseLimit))
      : DEFAULT_THROTTLE_CAPS.invalid_response_limit,
  };
}

function parseTemplates(value: unknown): {
  intro: string;
  followUp: string;
  slotPrompt: string;
  bookedConfirmation: string;
  reminder: string;
  invalid: string;
  invalidSlot: string;
} {
  const raw = asRecord(value);

  return {
    intro: typeof raw.intro === "string" ? raw.intro : DEFAULT_TEMPLATES.intro,
    followUp:
      typeof raw.follow_up === "string"
        ? raw.follow_up
        : typeof raw.followUp === "string"
          ? raw.followUp
          : DEFAULT_TEMPLATES.follow_up,
    slotPrompt:
      typeof raw.slot_prompt === "string"
        ? raw.slot_prompt
        : typeof raw.slotPrompt === "string"
          ? raw.slotPrompt
          : DEFAULT_TEMPLATES.slot_prompt,
    bookedConfirmation:
      typeof raw.booked_confirmation === "string"
        ? raw.booked_confirmation
        : typeof raw.bookedConfirmation === "string"
          ? raw.bookedConfirmation
          : DEFAULT_TEMPLATES.booked_confirmation,
    reminder: typeof raw.reminder === "string" ? raw.reminder : DEFAULT_TEMPLATES.reminder,
    invalid: typeof raw.invalid === "string" ? raw.invalid : DEFAULT_TEMPLATES.invalid,
    invalidSlot:
      typeof raw.invalid_slot === "string"
        ? raw.invalid_slot
        : typeof raw.invalidSlot === "string"
          ? raw.invalidSlot
          : DEFAULT_TEMPLATES.invalid_slot,
  };
}

function mapContextRow(row: ContextRow): ConversationContext {
  const businessHours: BusinessHours = coerceBusinessHours(row.business_hours_json);

  return {
    orgId: row.org_id,
    locationId: row.location_id,
    leadId: row.lead_id,
    conversationId: row.conversation_id,
    leadFullName: row.lead_full_name,
    leadFirstName: row.lead_first_name ?? row.lead_full_name.split(/\s+/)[0] ?? "there",
    leadPhone: row.lead_phone,
    normalizedPhone: row.normalized_phone,
    consentStatus: row.consent_status,
    optedOut: row.opted_out,
    state: row.conversation_state,
    invalidResponseCount: row.invalid_response_count,
    needsStaffAttention: row.needs_staff_attention,
    flagsJson: asRecord(row.flags_json),
    staleAfterAt: row.stale_after_at,
    lastInboundAt: row.conversation_last_inbound_at,
    lastOutboundAt: row.conversation_last_outbound_at,
    locationConfig: {
      timezone: row.timezone,
      businessHours,
      throttleCaps: parseThrottleCaps(row.throttle_caps_json),
      templates: parseTemplates(row.templates_json),
    },
    outboundLastHour: Number(row.outbound_last_hour ?? "0"),
    outboundLastDay: Number(row.outbound_last_day ?? "0"),
    globalKillSwitch: row.global_kill_switch,
    locationKillSwitch: row.location_kill_switch,
  };
}

async function loadConversationContext(conversationId: string): Promise<ConversationContext | null> {
  const result = await pool.query<ContextRow>(
    `
      SELECT
        loc.org_id,
        loc.id AS location_id,
        l.id AS lead_id,
        c.id AS conversation_id,
        l.full_name AS lead_full_name,
        l.first_name AS lead_first_name,
        l.phone AS lead_phone,
        l.normalized_phone,
        l.consent_status,
        l.opted_out,
        c.state AS conversation_state,
        c.invalid_response_count,
        c.needs_staff_attention,
        c.stale_after_at,
        c.last_inbound_at AS conversation_last_inbound_at,
        c.last_outbound_at AS conversation_last_outbound_at,
        c.flags_json,
        loc.timezone,
        loc.business_hours_json,
        loc.throttle_caps_json,
        loc.templates_json,
        COALESCE(ks_org.enabled, false) AS global_kill_switch,
        COALESCE(ks_loc.enabled, false) AS location_kill_switch,
        COALESCE(msg.outbound_last_hour, 0)::text AS outbound_last_hour,
        COALESCE(msg.outbound_last_day, 0)::text AS outbound_last_day
      FROM conversations c
      JOIN leads l ON l.id = c.lead_id
      JOIN locations loc ON loc.id = c.location_id
      LEFT JOIN LATERAL (
        SELECT enabled
        FROM kill_switch
        WHERE org_id = loc.org_id AND location_id IS NULL
        ORDER BY updated_at DESC
        LIMIT 1
      ) ks_org ON TRUE
      LEFT JOIN LATERAL (
        SELECT enabled
        FROM kill_switch
        WHERE org_id = loc.org_id AND location_id = loc.id
        ORDER BY updated_at DESC
        LIMIT 1
      ) ks_loc ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (
            WHERE direction = 'outbound'
              AND created_at >= now() - interval '1 hour'
          ) AS outbound_last_hour,
          COUNT(*) FILTER (
            WHERE direction = 'outbound'
              AND created_at >= now() - interval '1 day'
          ) AS outbound_last_day
        FROM messages
        WHERE lead_id = l.id
      ) msg ON TRUE
      WHERE c.id = $1
      LIMIT 1
    `,
    [conversationId],
  );

  const row = result.rows[0];
  return row ? mapContextRow(row) : null;
}

async function loadInboundMessage(messageId: string): Promise<InboundMessageRow | null> {
  const result = await pool.query<InboundMessageRow>(
    `
      SELECT id, body, created_at
      FROM messages
      WHERE id = $1
        AND direction = 'inbound'
      LIMIT 1
    `,
    [messageId],
  );

  return result.rows[0] ?? null;
}

async function runStateMachineFlow(
  job: JobRow,
  context: ConversationContext,
  event: TriggerEvent,
): Promise<void> {
  const stateResult = evaluateStateMachine(context, event, new Date());
  const governorResult = governActions(context, stateResult.actions, new Date());

  await applyActionGateway({
    jobId: job.id,
    context,
    policyVersion: governorResult.policyVersion,
    decisions: governorResult.decisions,
  });
}

async function processSendOutbound(payload: JobPayloadSendOutbound): Promise<void> {
  const messageRowResult = await pool.query<{
    id: string;
    org_id: string;
    location_id: string;
    lead_id: string;
    conversation_id: string;
    body: string;
    status: string;
    idempotency_key: string | null;
    provider_message_id: string | null;
    normalized_phone: string;
  }>(
    `
      SELECT
        m.id,
        m.org_id,
        m.location_id,
        m.lead_id,
        m.conversation_id,
        m.body,
        m.status,
        m.idempotency_key,
        m.provider_message_id,
        l.normalized_phone
      FROM messages m
      JOIN leads l ON l.id = m.lead_id
      WHERE m.id = $1
      LIMIT 1
    `,
    [payload.messageId],
  );

  const message = messageRowResult.rows[0];
  if (!message) {
    throw new Error(`message_not_found:${payload.messageId}`);
  }

  if (["sent", "delivered", "blocked"].includes(message.status)) {
    return;
  }

  const killSwitchResult = await pool.query<{
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
    [message.org_id, message.location_id],
  );

  const killSwitch = killSwitchResult.rows[0];
  const killEnabled = Boolean(killSwitch?.global_enabled || killSwitch?.location_enabled);

  if (killEnabled) {
    await pool.query(
      `
        UPDATE messages
        SET
          status = 'blocked',
          error_message = 'kill_switch_enabled',
          metadata_json = COALESCE(metadata_json, '{}'::jsonb) || $2::jsonb
        WHERE id = $1
      `,
      [
        message.id,
        JSON.stringify({
          blockedAt: new Date().toISOString(),
          blockedReason: "kill_switch_enabled",
        }),
      ],
    );
    return;
  }

  await pool.query(
    `
      UPDATE messages
      SET status = 'queued'
      WHERE id = $1
    `,
    [message.id],
  );

  const sendResult = await sendSmsViaTwilio({
    to: message.normalized_phone,
    body: message.body,
    idempotencyKey: message.idempotency_key ?? `msg:${message.id}`,
  });

  await pool.query(
    `
      UPDATE messages
      SET
        status = 'sent',
        provider_message_id = $2,
        sent_at = now(),
        error_message = NULL,
        metadata_json = COALESCE(metadata_json, '{}'::jsonb) || $3::jsonb
      WHERE id = $1
    `,
    [
      message.id,
      sendResult.providerMessageId,
      JSON.stringify({
        providerStatus: sendResult.providerStatus,
        simulatedProvider: sendResult.simulated,
        sentByWorkerAt: new Date().toISOString(),
      }),
    ],
  );
}

async function processJob(job: JobRow): Promise<void> {
  switch (job.type) {
    case "lead_created": {
      const payload = parseJobPayload(job.type, job.payload_json) as JobPayloadLeadCreated;
      const context = await loadConversationContext(payload.conversationId);
      if (!context) {
        throw new Error(`conversation_not_found:${payload.conversationId}`);
      }
      await runStateMachineFlow(job, context, { type: "lead_created" });
      return;
    }

    case "inbound_received": {
      const payload = parseJobPayload(job.type, job.payload_json) as JobPayloadInboundReceived;
      const context = await loadConversationContext(payload.conversationId);
      if (!context) {
        throw new Error(`conversation_not_found:${payload.conversationId}`);
      }

      const message = await loadInboundMessage(payload.messageId);
      if (!message) {
        throw new Error(`inbound_message_not_found:${payload.messageId}`);
      }

      await runStateMachineFlow(job, context, {
        type: "inbound_received",
        messageId: message.id,
        body: message.body,
        receivedAt: message.created_at,
      });
      return;
    }

    case "follow_up": {
      const payload = parseJobPayload(job.type, job.payload_json) as JobPayloadFollowUp;
      const context = await loadConversationContext(payload.conversationId);
      if (!context) {
        throw new Error(`conversation_not_found:${payload.conversationId}`);
      }
      await runStateMachineFlow(job, context, { type: "follow_up" });
      return;
    }

    case "reminder": {
      const payload = parseJobPayload(job.type, job.payload_json) as JobPayloadReminder;
      const context = await loadConversationContext(payload.conversationId);
      if (!context) {
        throw new Error(`conversation_not_found:${payload.conversationId}`);
      }
      await runStateMachineFlow(job, context, {
        type: "reminder",
        appointmentId: payload.appointmentId,
      });
      return;
    }

    case "send_outbound": {
      const payload = parseJobPayload(job.type, job.payload_json) as JobPayloadSendOutbound;
      await processSendOutbound(payload);
      return;
    }

    default:
      throw new Error(`Unsupported job type: ${job.type}`);
  }
}

async function handleClaimedJob(job: JobRow): Promise<void> {
  try {
    await processJob(job);
    await markDone(job.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markFailure(job.id, job.attempts, job.max_attempts, message);
  }
}

export async function runLoop(): Promise<never> {
  for (;;) {
    try {
      const jobs = await claimDueJobs(CLAIM_LIMIT);
      for (const job of jobs) {
        await handleClaimedJob(job);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[worker] runLoop error: ${message}`);
    }

    await sleep(POLL_INTERVAL_MS);
  }
}
