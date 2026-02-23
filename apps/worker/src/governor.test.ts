import assert from "node:assert/strict";
import test from "node:test";
import { governActions } from "@pipelineiq/engine";
import type { ConversationContext, ProposedAction } from "@pipelineiq/engine";

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

test("kill switch blocks outbound sends", () => {
  const context = buildContext({ globalKillSwitch: true });
  const now = new Date("2026-02-23T15:00:00.000Z");

  const result = governActions(context, [sendMessageAction()], now);

  assert.equal(result.decisions[0]?.allowed, false);
  assert.equal(result.decisions[0]?.reasons.includes("kill_switch_enabled"), true);
});

test("per-hour and per-day limits block outbound sends", () => {
  const context = buildContext({
    outboundLastHour: 2,
    outboundLastDay: 8,
  });

  const now = new Date("2026-02-23T15:00:00.000Z");
  const result = governActions(context, [sendMessageAction()], now);

  assert.equal(result.decisions[0]?.allowed, false);
  assert.equal(result.decisions[0]?.reasons.includes("per_hour_limit_exceeded"), true);
  assert.equal(result.decisions[0]?.reasons.includes("per_day_limit_exceeded"), true);
});

test("outside business hours blocks send", () => {
  const context = buildContext();
  const now = new Date("2026-02-23T02:00:00.000Z");

  const result = governActions(context, [sendMessageAction()], now);

  assert.equal(result.decisions[0]?.allowed, false);
  assert.equal(result.decisions[0]?.reasons.includes("outside_business_hours"), true);
});

test("inside business hours allows send", () => {
  const context = buildContext();
  const now = new Date("2026-02-23T15:00:00.000Z");

  const result = governActions(context, [sendMessageAction(" hi   there ")], now);

  assert.equal(result.decisions[0]?.allowed, true);

  const normalized = result.decisions[0]?.normalizedAction;
  assert.equal(normalized?.kind, "send_message");
  if (normalized?.kind === "send_message") {
    assert.equal(normalized.body, "hi there");
  }
});

test("appointment booking outside next three business days is blocked", () => {
  const context = buildContext({ state: "awaiting_time_choice" });
  const now = new Date("2026-02-23T15:00:00.000Z");
  const farFuture = new Date("2026-03-20T15:00:00.000Z");

  const result = governActions(
    context,
    [
      {
        kind: "book_appointment",
        startsAt: farFuture.toISOString(),
        endsAt: new Date(farFuture.getTime() + 60 * 60 * 1000).toISOString(),
        idempotencyKey: "appt-1",
      },
    ],
    now,
  );

  assert.equal(result.decisions[0]?.allowed, false);
  assert.equal(
    result.decisions[0]?.reasons.includes("appointment_outside_next_three_business_days"),
    true,
  );
});

test("schedule_job runAt is normalized to now when in the past", () => {
  const context = buildContext();
  const now = new Date("2026-02-23T15:00:00.000Z");

  const result = governActions(
    context,
    [
      {
        kind: "schedule_job",
        jobType: "follow_up",
        runAt: "2026-01-01T00:00:00.000Z",
        dedupeKey: "followup-1",
        payload: { foo: "bar" },
      },
    ],
    now,
  );

  assert.equal(result.decisions[0]?.allowed, true);
  const normalized = result.decisions[0]?.normalizedAction;
  assert.equal(normalized?.kind, "schedule_job");

  if (normalized?.kind === "schedule_job") {
    assert.equal(normalized.runAt, now.toISOString());
  }
});
