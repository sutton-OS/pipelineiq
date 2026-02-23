import assert from "node:assert/strict";
import test from "node:test";
import { applyActionGateway } from "../actionGateway";
import { pool } from "../db";
import {
  DEFAULT_AUTONOMY_MODE,
  DEFAULT_BOOKING_PROVIDER,
  DEFAULT_BOOKING_SETTINGS,
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_THROTTLE_CAPS,
  DEFAULT_TEMPLATES,
  ensureSchema,
} from "../schema";
import type { ConversationContext, GovernorDecision } from "@pipelineiq/engine";

function canRunIntegrationTests(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.WORKER_DATABASE_URL);
}

async function ensureDbAvailable(): Promise<boolean> {
  if (!canRunIntegrationTests()) {
    return false;
  }

  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

async function createFixture() {
  const seed = Date.now().toString();

  const orgInsert = await pool.query<{ id: string }>(
    `
      INSERT INTO orgs (owner_user_id, name, slug)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [`test-user-${seed}`, `Test Org ${seed}`, `test-org-${seed}`],
  );
  const orgId = orgInsert.rows[0]?.id;
  assert.ok(orgId);

  await pool.query(
    `
      INSERT INTO org_memberships (org_id, user_id, role, status)
      VALUES ($1, $2, 'owner', 'active')
      ON CONFLICT (org_id, user_id)
      DO NOTHING
    `,
    [orgId, `test-user-${seed}`],
  );

  const locationInsert = await pool.query<{ id: string }>(
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
        'Test Location',
        'America/New_York',
        $2,
        $3,
        $4::jsonb,
        $5::jsonb,
        $6::jsonb,
        $7::jsonb
      )
      RETURNING id
    `,
    [
      orgId,
      DEFAULT_AUTONOMY_MODE,
      DEFAULT_BOOKING_PROVIDER,
      JSON.stringify(DEFAULT_BOOKING_SETTINGS),
      JSON.stringify(DEFAULT_BUSINESS_HOURS),
      JSON.stringify(DEFAULT_TEMPLATES),
      JSON.stringify(DEFAULT_THROTTLE_CAPS),
    ],
  );
  const locationId = locationInsert.rows[0]?.id;
  assert.ok(locationId);

  const leadInsert = await pool.query<{ id: string }>(
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
      VALUES ($1, $2, 'Test Lead', 'Test', '+15555550123', '+15555550123', 'consented', 'test')
      RETURNING id
    `,
    [orgId, locationId],
  );
  const leadId = leadInsert.rows[0]?.id;
  assert.ok(leadId);

  const conversationInsert = await pool.query<{ id: string }>(
    `
      INSERT INTO conversations (org_id, location_id, lead_id, state)
      VALUES ($1, $2, $3, 'awaiting_yes')
      RETURNING id
    `,
    [orgId, locationId, leadId],
  );
  const conversationId = conversationInsert.rows[0]?.id;
  assert.ok(conversationId);

  const context: ConversationContext = {
    orgId,
    locationId,
    leadId,
    conversationId,
    leadFullName: "Test Lead",
    leadFirstName: "Test",
    leadPhone: "+15555550123",
    normalizedPhone: "+15555550123",
    consentStatus: "consented",
    optedOut: false,
    state: "awaiting_yes",
    invalidResponseCount: 0,
    needsStaffAttention: false,
    flagsJson: {},
    staleAfterAt: null,
    lastInboundAt: null,
    lastOutboundAt: null,
    outboundLastHour: 0,
    outboundLastDay: 0,
    globalKillSwitch: false,
    locationKillSwitch: false,
    locationConfig: {
      timezone: "America/New_York",
      autonomyMode: "safe_auto",
      bookingProvider: "none",
      bookingSettings: {},
      businessHours: JSON.parse(
        JSON.stringify(DEFAULT_BUSINESS_HOURS),
      ) as ConversationContext["locationConfig"]["businessHours"],
      throttleCaps: {
        perHour: 2,
        perDay: 6,
        invalidResponseLimit: 3,
      },
      templates: {
        intro: DEFAULT_TEMPLATES.intro,
        followUp: DEFAULT_TEMPLATES.follow_up,
        slotPrompt: DEFAULT_TEMPLATES.slot_prompt,
        bookedConfirmation: DEFAULT_TEMPLATES.booked_confirmation,
        reminder: DEFAULT_TEMPLATES.reminder,
        invalid: DEFAULT_TEMPLATES.invalid,
        invalidSlot: DEFAULT_TEMPLATES.invalid_slot,
      },
    },
  };

  return {
    orgId,
    locationId,
    leadId,
    conversationId,
    context,
  };
}

async function deleteFixture(orgId: string): Promise<void> {
  await pool.query(`DELETE FROM orgs WHERE id = $1`, [orgId]);
}

test("blocked decisions are audited without mutating messages", async (t) => {
  if (!(await ensureDbAvailable())) {
    t.skip("DATABASE_URL/WORKER_DATABASE_URL not configured or Postgres unavailable");
    return;
  }

  await ensureSchema();
  const fixture = await createFixture();

  try {
    const blockedDecision: GovernorDecision = {
      allowed: false,
      reasons: ["kill_switch_enabled"],
      action: {
        kind: "send_message",
        body: "Hello blocked lead",
        idempotencyKey: "blocked-key",
      },
      normalizedAction: {
        kind: "send_message",
        body: "Hello blocked lead",
        idempotencyKey: "blocked-key",
      },
    };

    const result = await applyActionGateway({
      jobId: "101",
      context: fixture.context,
      policyVersion: "test-policy",
      decisions: [blockedDecision],
    });

    assert.equal(result[0]?.applied, false);
    assert.equal(result[0]?.skipped, true);

    const messageCount = await pool.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM messages
        WHERE org_id = $1
          AND idempotency_key = 'blocked-key'
      `,
      [fixture.orgId],
    );
    assert.equal(Number(messageCount.rows[0]?.count ?? "0"), 0);

    const auditCount = await pool.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM audit_log
        WHERE org_id = $1
          AND action_type = 'send_message'
          AND success = false
      `,
      [fixture.orgId],
    );
    assert.equal(Number(auditCount.rows[0]?.count ?? "0") >= 1, true);
  } finally {
    await deleteFixture(fixture.orgId);
  }
});

test("repeated send and booking actions are idempotent", async (t) => {
  if (!(await ensureDbAvailable())) {
    t.skip("DATABASE_URL/WORKER_DATABASE_URL not configured or Postgres unavailable");
    return;
  }

  await ensureSchema();
  const fixture = await createFixture();

  try {
    const sendDecision: GovernorDecision = {
      allowed: true,
      reasons: [],
      action: {
        kind: "send_message",
        body: "Hello test lead",
        idempotencyKey: "send-idempotency-key",
      },
      normalizedAction: {
        kind: "send_message",
        body: "Hello test lead",
        idempotencyKey: "send-idempotency-key",
      },
    };

    await applyActionGateway({
      jobId: "201",
      context: fixture.context,
      policyVersion: "test-policy",
      decisions: [sendDecision],
    });
    await applyActionGateway({
      jobId: "202",
      context: fixture.context,
      policyVersion: "test-policy",
      decisions: [sendDecision],
    });

    const sendMessageCount = await pool.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM messages
        WHERE org_id = $1
          AND idempotency_key = 'send-idempotency-key'
      `,
      [fixture.orgId],
    );
    assert.equal(Number(sendMessageCount.rows[0]?.count ?? "0"), 1);

    const now = new Date("2026-02-24T14:00:00.000Z");
    const bookingDecision: GovernorDecision = {
      allowed: true,
      reasons: [],
      action: {
        kind: "book_appointment",
        startsAt: now.toISOString(),
        endsAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        idempotencyKey: "booking-idempotency-key",
      },
      normalizedAction: {
        kind: "book_appointment",
        startsAt: now.toISOString(),
        endsAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        idempotencyKey: "booking-idempotency-key",
      },
    };

    await applyActionGateway({
      jobId: "203",
      context: fixture.context,
      policyVersion: "test-policy",
      decisions: [bookingDecision],
    });
    await applyActionGateway({
      jobId: "204",
      context: fixture.context,
      policyVersion: "test-policy",
      decisions: [bookingDecision],
    });

    const appointmentCount = await pool.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM appointments
        WHERE org_id = $1
          AND idempotency_key = 'booking-idempotency-key'
      `,
      [fixture.orgId],
    );
    assert.equal(Number(appointmentCount.rows[0]?.count ?? "0"), 1);

    const reminderCount = await pool.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM jobs
        WHERE org_id = $1
          AND type = 'reminder'
      `,
      [fixture.orgId],
    );
    assert.equal(Number(reminderCount.rows[0]?.count ?? "0"), 1);
  } finally {
    await deleteFixture(fixture.orgId);
  }
});

test("set_opt_out updates lead consent and opt-out flags", async (t) => {
  if (!(await ensureDbAvailable())) {
    t.skip("DATABASE_URL/WORKER_DATABASE_URL not configured or Postgres unavailable");
    return;
  }

  await ensureSchema();
  const fixture = await createFixture();

  try {
    const decision: GovernorDecision = {
      allowed: true,
      reasons: [],
      action: {
        kind: "set_opt_out",
        reason: "lead_reply_stop",
      },
      normalizedAction: {
        kind: "set_opt_out",
        reason: "lead_reply_stop",
      },
    };

    const result = await applyActionGateway({
      jobId: "301",
      context: fixture.context,
      policyVersion: "test-policy",
      decisions: [decision],
    });
    assert.equal(result[0]?.applied, true);

    const lead = await pool.query<{
      consent_status: string;
      opted_out: boolean;
      opted_out_at: string | null;
    }>(
      `
        SELECT consent_status, opted_out, opted_out_at
        FROM leads
        WHERE id = $1
      `,
      [fixture.leadId],
    );

    assert.equal(lead.rows[0]?.consent_status, "revoked");
    assert.equal(lead.rows[0]?.opted_out, true);
    assert.equal(Boolean(lead.rows[0]?.opted_out_at), true);
  } finally {
    await deleteFixture(fixture.orgId);
  }
});
