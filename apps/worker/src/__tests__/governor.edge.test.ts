import assert from "node:assert/strict";
import test from "node:test";
import { governActions } from "../governor";
import type { ConversationContext, ProposedAction } from "../types";

function buildContext(overrides: Partial<ConversationContext> = {}): ConversationContext {
  return {
    orgId: "org-test",
    locationId: "loc-test",
    leadId: "lead-test",
    conversationId: "conv-test",
    leadFullName: "Jane Doe",
    leadFirstName: "Jane",
    leadPhone: "+15555550101",
    normalizedPhone: "+15555550101",
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
      businessHours: {
        mon: [{ start: "09:00", end: "17:00" }],
        tue: [{ start: "09:00", end: "17:00" }],
        wed: [{ start: "09:00", end: "17:00" }],
        thu: [{ start: "09:00", end: "17:00" }],
        fri: [{ start: "09:00", end: "17:00" }],
        sat: [],
        sun: [],
      },
      throttleCaps: {
        perHour: 2,
        perDay: 6,
        invalidResponseLimit: 3,
      },
      templates: {
        intro: "intro",
        followUp: "follow up",
        slotPrompt: "slot prompt",
        bookedConfirmation: "booked",
        reminder: "reminder",
        invalid: "invalid",
        invalidSlot: "invalid slot",
      },
    },
    ...overrides,
  };
}

function sendMessageAction(body = "hello there"): ProposedAction {
  return {
    kind: "send_message",
    body,
    idempotencyKey: "msg:1",
  };
}

test("kill switch blocks outbound sends (global or location)", () => {
  const now = new Date("2026-02-23T15:00:00.000Z");
  const globalResult = governActions(
    buildContext({ globalKillSwitch: true }),
    [sendMessageAction()],
    now,
  );
  const locationResult = governActions(
    buildContext({ locationKillSwitch: true }),
    [sendMessageAction()],
    now,
  );

  assert.equal(globalResult.decisions[0]?.allowed, false);
  assert.equal(globalResult.decisions[0]?.reasons.includes("kill_switch_enabled"), true);
  assert.equal(locationResult.decisions[0]?.allowed, false);
  assert.equal(locationResult.decisions[0]?.reasons.includes("kill_switch_enabled"), true);
});

test("opt-out and revoked consent are enforced", () => {
  const now = new Date("2026-02-23T15:00:00.000Z");
  const optedOutResult = governActions(
    buildContext({ optedOut: true }),
    [sendMessageAction()],
    now,
  );
  const revokedResult = governActions(
    buildContext({ consentStatus: "revoked" }),
    [sendMessageAction()],
    now,
  );

  assert.equal(optedOutResult.decisions[0]?.allowed, false);
  assert.equal(optedOutResult.decisions[0]?.reasons.includes("lead_opted_out"), true);
  assert.equal(revokedResult.decisions[0]?.allowed, false);
  assert.equal(revokedResult.decisions[0]?.reasons.includes("lead_opted_out"), true);
});

test("per-lead throttling blocks excessive outbound sends", () => {
  const now = new Date("2026-02-23T15:00:00.000Z");
  const result = governActions(
    buildContext({ outboundLastHour: 3, outboundLastDay: 8 }),
    [sendMessageAction()],
    now,
  );

  assert.equal(result.decisions[0]?.allowed, false);
  assert.equal(result.decisions[0]?.reasons.includes("per_hour_limit_exceeded"), true);
  assert.equal(result.decisions[0]?.reasons.includes("per_day_limit_exceeded"), true);
});

test("outside business hours rejects outbound sends", () => {
  const result = governActions(
    buildContext(),
    [sendMessageAction()],
    new Date("2026-02-23T02:00:00.000Z"),
  );

  assert.equal(result.decisions[0]?.allowed, false);
  assert.equal(result.decisions[0]?.reasons.includes("outside_business_hours"), true);
});

test("suggest-only autonomy blocks side-effect actions", () => {
  const context = buildContext({
    locationConfig: {
      ...buildContext().locationConfig,
      autonomyMode: "suggest_only",
    },
  });
  const now = new Date("2026-02-23T15:00:00.000Z");

  const result = governActions(
    context,
    [
      {
        kind: "schedule_job",
        jobType: "follow_up",
        runAt: now.toISOString(),
        payload: { foo: "bar" },
      },
      sendMessageAction("hello"),
      {
        kind: "book_appointment",
        startsAt: "2026-02-24T15:00:00.000Z",
        endsAt: "2026-02-24T16:00:00.000Z",
        idempotencyKey: "appt:1",
      },
      {
        kind: "conversation_patch",
        state: "booked",
      },
    ],
    now,
  );

  for (const decision of result.decisions) {
    assert.equal(decision.allowed, false);
    assert.equal(decision.reasons.includes("autonomy_mode_suggest_only"), true);
  }
});
