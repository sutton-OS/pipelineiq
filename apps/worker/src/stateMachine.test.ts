import assert from "node:assert/strict";
import test from "node:test";
import { evaluateStateMachine } from "./stateMachine";
import type { ConversationContext } from "./types";

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
    staleAfterAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
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
        intro: "Hi {{first_name}}, reply YES.",
        followUp: "Follow up",
        slotPrompt: "Choose: {{slot_1}}, {{slot_2}}, {{slot_3}}",
        bookedConfirmation: "Booked {{slot}}",
        reminder: "Reminder {{slot}}",
        invalid: "Reply YES",
        invalidSlot: "Reply 1,2,3",
      },
    },
    ...overrides,
  };
}

test("lead_created proposes intro message and follow-up scheduling", () => {
  const context = buildContext();
  const now = new Date("2026-02-23T15:00:00.000Z");

  const result = evaluateStateMachine(context, { type: "lead_created" }, now);

  assert.equal(result.actions.some((action) => action.kind === "send_message"), true);
  assert.equal(result.actions.some((action) => action.kind === "schedule_job"), true);
  assert.equal(
    result.actions.some(
      (action) =>
        action.kind === "conversation_patch" &&
        action.state === "awaiting_yes" &&
        action.invalidResponseCount === 0,
    ),
    true,
  );
});

test("awaiting_yes + YES transitions to awaiting_time_choice with slot prompt", () => {
  const context = buildContext({ state: "awaiting_yes" });
  const now = new Date("2026-02-23T15:00:00.000Z");

  const result = evaluateStateMachine(
    context,
    {
      type: "inbound_received",
      messageId: "msg-1",
      body: "YES",
      receivedAt: now.toISOString(),
    },
    now,
  );

  assert.equal(
    result.actions.some(
      (action) => action.kind === "conversation_patch" && action.state === "awaiting_time_choice",
    ),
    true,
  );

  assert.equal(
    result.actions.some(
      (action) => action.kind === "send_message" && action.body.toLowerCase().includes("choose"),
    ),
    true,
  );
});

test("awaiting_time_choice + option books appointment", () => {
  const offeredSlots = [
    {
      startsAt: "2026-02-24T14:00:00.000Z",
      endsAt: "2026-02-24T15:00:00.000Z",
    },
    {
      startsAt: "2026-02-25T14:00:00.000Z",
      endsAt: "2026-02-25T15:00:00.000Z",
    },
    {
      startsAt: "2026-02-26T14:00:00.000Z",
      endsAt: "2026-02-26T15:00:00.000Z",
    },
  ];

  const context = buildContext({
    state: "awaiting_time_choice",
    flagsJson: { offeredSlots },
  });

  const now = new Date("2026-02-23T16:00:00.000Z");

  const result = evaluateStateMachine(
    context,
    {
      type: "inbound_received",
      messageId: "msg-2",
      body: "2",
      receivedAt: now.toISOString(),
    },
    now,
  );

  const hasBookingAction = result.actions.some((action) => {
    return action.kind === "book_appointment" && action.startsAt === offeredSlots[1].startsAt;
  });

  assert.equal(hasBookingAction, true);
  assert.equal(
    result.actions.some((action) => action.kind === "conversation_patch" && action.state === "booked"),
    true,
  );
});

test("repeated invalid replies escalate to needs_staff_attention", () => {
  const context = buildContext({
    state: "awaiting_yes",
    invalidResponseCount: 2,
    locationConfig: {
      ...buildContext().locationConfig,
      throttleCaps: {
        perHour: 2,
        perDay: 6,
        invalidResponseLimit: 3,
      },
    },
  });

  const now = new Date("2026-02-23T16:10:00.000Z");

  const result = evaluateStateMachine(
    context,
    {
      type: "inbound_received",
      messageId: "msg-3",
      body: "what?",
      receivedAt: now.toISOString(),
    },
    now,
  );

  assert.equal(
    result.actions.some(
      (action) =>
        action.kind === "conversation_patch" &&
        action.state === "needs_staff_attention" &&
        action.needsStaffAttention === true,
    ),
    true,
  );
});

test("stale reply resets conversation before processing input", () => {
  const now = new Date("2026-02-23T16:30:00.000Z");

  const context = buildContext({
    state: "awaiting_time_choice",
    staleAfterAt: new Date(now.getTime() - 1000).toISOString(),
  });

  const result = evaluateStateMachine(
    context,
    {
      type: "inbound_received",
      messageId: "msg-4",
      body: "2",
      receivedAt: now.toISOString(),
    },
    now,
  );

  assert.equal(result.reasons.includes("stale_reply_reset"), true);
  assert.equal(
    result.actions.some((action) => action.kind === "conversation_patch" && action.state === "awaiting_yes"),
    true,
  );
});
