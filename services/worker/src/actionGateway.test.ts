import assert from "node:assert/strict";
import test, { after } from "node:test";
import { applyActionGateway } from "./actionGateway";
import { pool } from "./db";
import {
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_THROTTLE_CAPS,
  DEFAULT_TEMPLATES,
  ensureSchema,
} from "./schema";
import type { ActionGatewayInput, ConversationContext, GovernorDecision } from "./types";

function canRunIntegrationTests(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.WORKER_DATABASE_URL);
}

after(async () => {
  await pool.end();
});

test("action gateway enforces idempotent outbound writes", async (t) => {
  if (!canRunIntegrationTests()) {
    t.skip("DATABASE_URL/WORKER_DATABASE_URL not configured");
    return;
  }

  try {
    await pool.query("SELECT 1");
  } catch {
    t.skip("Postgres is not reachable in local test environment");
    return;
  }

  await ensureSchema();

  const orgInsert = await pool.query<{ id: string }>(
    `
      INSERT INTO orgs (owner_user_id, name, slug)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [
      `test-user-${Date.now()}`,
      `Test Org ${Date.now()}`,
      `test-org-${Date.now()}`,
    ],
  );

  const orgId = orgInsert.rows[0]?.id;
  assert.ok(orgId);

  try {
    const locationInsert = await pool.query<{ id: string }>(
      `
        INSERT INTO locations (
          org_id,
          name,
          timezone,
          business_hours_json,
          templates_json,
          throttle_caps_json
        )
        VALUES ($1, 'Test Location', 'America/New_York', $2::jsonb, $3::jsonb, $4::jsonb)
        RETURNING id
      `,
      [
        orgId,
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
        businessHours: JSON.parse(JSON.stringify(DEFAULT_BUSINESS_HOURS)) as ConversationContext["locationConfig"]["businessHours"],
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

    const decision: GovernorDecision = {
      allowed: true,
      reasons: [],
      action: {
        kind: "send_message",
        body: "Hello test lead",
        idempotencyKey: "test-idempotency-key",
      },
      normalizedAction: {
        kind: "send_message",
        body: "Hello test lead",
        idempotencyKey: "test-idempotency-key",
      },
    };

    const payload: ActionGatewayInput = {
      jobId: "1",
      context,
      policyVersion: "test-policy",
      decisions: [decision],
    };

    const firstRun = await applyActionGateway(payload);
    const secondRun = await applyActionGateway({ ...payload, jobId: "2" });

    const firstMessageId = String(firstRun[0]?.details.messageId ?? "");
    const secondMessageId = String(secondRun[0]?.details.messageId ?? "");

    assert.ok(firstMessageId);
    assert.equal(secondMessageId, firstMessageId);

    const messageCount = await pool.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM messages
        WHERE org_id = $1
          AND idempotency_key = $2
      `,
      [orgId, "test-idempotency-key"],
    );

    assert.equal(Number(messageCount.rows[0]?.count ?? "0"), 1);

    const sendJobCount = await pool.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM jobs
        WHERE org_id = $1
          AND type = 'send_outbound'
      `,
      [orgId],
    );

    assert.equal(Number(sendJobCount.rows[0]?.count ?? "0"), 1);
  } finally {
    await pool.query(`DELETE FROM orgs WHERE id = $1`, [orgId]);
  }
});
