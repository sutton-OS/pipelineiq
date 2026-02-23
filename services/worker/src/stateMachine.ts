import {
  formatSlotForSms,
  nextBusinessDaySlots,
  type AppointmentSlot,
} from "./businessHours";
import {
  isAffirmativeMessage,
  isNegativeMessage,
  isOptOutMessage,
} from "./phone";
import { createActionKey, renderTemplate } from "./templates";
import type {
  ConversationContext,
  ProposedAction,
  StateMachineResult,
  TriggerEvent,
} from "./types";

const DEFAULT_STALE_HOURS = 48;

function addHours(now: Date, hours: number): string {
  return new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
}

function parseOfferedSlots(flagsJson: Record<string, unknown>): AppointmentSlot[] {
  const offered = flagsJson.offeredSlots;
  if (!Array.isArray(offered)) return [];

  return offered
    .map((value): AppointmentSlot | null => {
      if (!value || typeof value !== "object") return null;
      const candidate = value as Partial<AppointmentSlot>;
      if (typeof candidate.startsAt !== "string" || typeof candidate.endsAt !== "string") {
        return null;
      }
      return { startsAt: candidate.startsAt, endsAt: candidate.endsAt };
    })
    .filter((value): value is AppointmentSlot => value !== null);
}

function readChoiceIndex(body: string): number | null {
  const normalized = body.trim();
  const exactDigit = normalized.match(/^([1-3])$/);
  if (exactDigit) {
    return Number(exactDigit[1]) - 1;
  }

  const containsDigit = normalized.match(/\b([1-3])\b/);
  if (containsDigit) {
    return Number(containsDigit[1]) - 1;
  }

  return null;
}

function buildSlotPrompt(
  context: ConversationContext,
  slots: AppointmentSlot[],
): { message: string; slotStrings: string[] } {
  const slotStrings = slots.map((slot) => formatSlotForSms(slot.startsAt, context.locationConfig.timezone));

  const [slot1 = "Unavailable", slot2 = "Unavailable", slot3 = "Unavailable"] = slotStrings;

  const message = renderTemplate(context.locationConfig.templates.slotPrompt, {
    slot_1: slot1,
    slot_2: slot2,
    slot_3: slot3,
  });

  return { message, slotStrings };
}

function withInboundTimestamp(
  existingActions: ProposedAction[],
  event: Extract<TriggerEvent, { type: "inbound_received" }>,
): ProposedAction[] {
  return [
    {
      kind: "conversation_patch",
      lastInboundAt: event.receivedAt,
      staleAfterAt: addHours(new Date(event.receivedAt), DEFAULT_STALE_HOURS),
    },
    ...existingActions,
  ];
}

function maybeStaleReset(
  context: ConversationContext,
  event: TriggerEvent,
  now: Date,
): StateMachineResult | null {
  if (event.type !== "inbound_received") return null;
  if (context.state === "booked" || context.state === "closed") return null;

  if (!context.staleAfterAt) return null;
  const staleAfter = new Date(context.staleAfterAt);
  if (Number.isNaN(staleAfter.getTime()) || staleAfter > now) {
    return null;
  }

  const introMessage = renderTemplate(context.locationConfig.templates.intro, {
    first_name: context.leadFirstName,
  });

  return {
    reasons: ["stale_reply_reset"],
    actions: withInboundTimestamp(
      [
        {
          kind: "conversation_patch",
          state: "awaiting_yes",
          invalidResponseCount: 0,
          needsStaffAttention: false,
          staleAfterAt: addHours(now, DEFAULT_STALE_HOURS),
          flagsJsonMerge: {
            offeredSlots: [],
            staleResetAt: now.toISOString(),
          },
        },
        {
          kind: "send_message",
          body: introMessage,
          idempotencyKey: createActionKey(
            "outbound",
            context.conversationId,
            "stale_reset",
            now.toISOString(),
          ),
          metadata: { template: "intro", reason: "stale_reply_reset" },
        },
      ],
      event,
    ),
  };
}

function handleLeadCreated(
  context: ConversationContext,
  now: Date,
): StateMachineResult {
  const introMessage = renderTemplate(context.locationConfig.templates.intro, {
    first_name: context.leadFirstName,
  });

  return {
    reasons: ["lead_created"],
    actions: [
      {
        kind: "send_message",
        body: introMessage,
        idempotencyKey: createActionKey("outbound", context.conversationId, "intro"),
        metadata: { template: "intro" },
      },
      {
        kind: "schedule_job",
        jobType: "follow_up",
        runAt: addHours(now, 2),
        dedupeKey: createActionKey("follow_up", context.conversationId, "2h"),
        payload: {
          orgId: context.orgId,
          locationId: context.locationId,
          leadId: context.leadId,
          conversationId: context.conversationId,
        },
      },
      {
        kind: "conversation_patch",
        state: "awaiting_yes",
        invalidResponseCount: 0,
        staleAfterAt: addHours(now, DEFAULT_STALE_HOURS),
        lastOutboundAt: now.toISOString(),
      },
    ],
  };
}

function handleInboundAwaitingYes(
  context: ConversationContext,
  event: Extract<TriggerEvent, { type: "inbound_received" }>,
  now: Date,
): StateMachineResult {
  const normalizedBody = event.body.trim();

  if (isOptOutMessage(normalizedBody)) {
    return {
      reasons: ["opt_out"],
      actions: withInboundTimestamp(
        [
          { kind: "set_opt_out", reason: "lead_reply_stop" },
          {
            kind: "conversation_patch",
            state: "closed",
            needsStaffAttention: false,
            invalidResponseCount: 0,
            flagsJsonMerge: {
              closedReason: "opt_out",
            },
          },
        ],
        event,
      ),
    };
  }

  if (isAffirmativeMessage(normalizedBody)) {
    const slots = nextBusinessDaySlots(
      now,
      context.locationConfig.businessHours,
      context.locationConfig.timezone,
      3,
      60,
    );

    if (slots.length < 3) {
      return {
        reasons: ["insufficient_slots"],
        actions: withInboundTimestamp(
          [
            {
              kind: "conversation_patch",
              state: "needs_staff_attention",
              needsStaffAttention: true,
              invalidResponseCount: 0,
              flagsJsonMerge: {
                escalationReason: "unable_to_generate_three_business_day_slots",
              },
            },
          ],
          event,
        ),
      };
    }

    const prompt = buildSlotPrompt(context, slots);

    return {
      reasons: ["affirmative_reply"],
      actions: withInboundTimestamp(
        [
          {
            kind: "send_message",
            body: prompt.message,
            idempotencyKey: createActionKey("outbound", context.conversationId, "slot_prompt"),
            metadata: {
              template: "slot_prompt",
              slot_1: prompt.slotStrings[0],
              slot_2: prompt.slotStrings[1],
              slot_3: prompt.slotStrings[2],
            },
          },
          {
            kind: "conversation_patch",
            state: "awaiting_time_choice",
            invalidResponseCount: 0,
            staleAfterAt: addHours(now, DEFAULT_STALE_HOURS),
            lastOutboundAt: now.toISOString(),
            flagsJsonMerge: {
              offeredSlots: slots,
              slotPromptedAt: now.toISOString(),
            },
          },
        ],
        event,
      ),
    };
  }

  if (isNegativeMessage(normalizedBody)) {
    return {
      reasons: ["lead_declined"],
      actions: withInboundTimestamp(
        [
          {
            kind: "conversation_patch",
            state: "needs_staff_attention",
            needsStaffAttention: true,
            flagsJsonMerge: {
              escalationReason: "lead_declined",
            },
          },
        ],
        event,
      ),
    };
  }

  const invalidCount = context.invalidResponseCount + 1;
  const invalidLimit = context.locationConfig.throttleCaps.invalidResponseLimit;
  const shouldEscalate = invalidCount >= invalidLimit;

  return {
    reasons: ["invalid_yes_reply"],
    actions: withInboundTimestamp(
      [
        {
          kind: "conversation_patch",
          state: shouldEscalate ? "needs_staff_attention" : "awaiting_yes",
          invalidResponseCount: invalidCount,
          needsStaffAttention: shouldEscalate,
          flagsJsonMerge: shouldEscalate
            ? { escalationReason: "repeated_invalid_yes_reply", escalationAt: now.toISOString() }
            : {},
        },
        {
          kind: "send_message",
          body: context.locationConfig.templates.invalid,
          idempotencyKey: createActionKey(
            "outbound",
            context.conversationId,
            "invalid_yes",
            invalidCount,
          ),
          metadata: {
            template: "invalid",
            invalidCount,
          },
        },
      ],
      event,
    ),
  };
}

function handleInboundAwaitingTimeChoice(
  context: ConversationContext,
  event: Extract<TriggerEvent, { type: "inbound_received" }>,
  now: Date,
): StateMachineResult {
  const normalizedBody = event.body.trim();

  if (isOptOutMessage(normalizedBody)) {
    return {
      reasons: ["opt_out"],
      actions: withInboundTimestamp(
        [
          { kind: "set_opt_out", reason: "lead_reply_stop" },
          {
            kind: "conversation_patch",
            state: "closed",
            needsStaffAttention: false,
            invalidResponseCount: 0,
            flagsJsonMerge: {
              closedReason: "opt_out",
            },
          },
        ],
        event,
      ),
    };
  }

  const offeredSlots = parseOfferedSlots(context.flagsJson);
  const fallbackSlots = nextBusinessDaySlots(
    now,
    context.locationConfig.businessHours,
    context.locationConfig.timezone,
    3,
    60,
  );
  const activeSlots = offeredSlots.length >= 3 ? offeredSlots : fallbackSlots;

  const chosenIndex = readChoiceIndex(normalizedBody);
  if (chosenIndex !== null && chosenIndex >= 0 && chosenIndex < activeSlots.length) {
    const chosenSlot = activeSlots[chosenIndex];
    const slotLabel = formatSlotForSms(chosenSlot.startsAt, context.locationConfig.timezone);

    return {
      reasons: ["slot_selected"],
      actions: withInboundTimestamp(
        [
          {
            kind: "book_appointment",
            startsAt: chosenSlot.startsAt,
            endsAt: chosenSlot.endsAt,
            idempotencyKey: createActionKey(
              "appointment",
              context.conversationId,
              chosenSlot.startsAt,
            ),
            notes: `Lead selected option ${chosenIndex + 1}`,
            metadata: {
              selectedOption: chosenIndex + 1,
              selectedAt: now.toISOString(),
            },
          },
          {
            kind: "send_message",
            body: renderTemplate(context.locationConfig.templates.bookedConfirmation, {
              slot: slotLabel,
            }),
            idempotencyKey: createActionKey(
              "outbound",
              context.conversationId,
              "booked_confirmation",
              chosenSlot.startsAt,
            ),
            metadata: {
              template: "booked_confirmation",
              slot: slotLabel,
            },
          },
          {
            kind: "conversation_patch",
            state: "booked",
            invalidResponseCount: 0,
            needsStaffAttention: false,
            staleAfterAt: null,
            lastOutboundAt: now.toISOString(),
            flagsJsonMerge: {
              bookedAt: now.toISOString(),
              bookedSlotStartsAt: chosenSlot.startsAt,
              bookedSlotEndsAt: chosenSlot.endsAt,
            },
          },
        ],
        event,
      ),
    };
  }

  const invalidCount = context.invalidResponseCount + 1;
  const invalidLimit = context.locationConfig.throttleCaps.invalidResponseLimit;
  const shouldEscalate = invalidCount >= invalidLimit;

  return {
    reasons: ["invalid_slot_reply"],
    actions: withInboundTimestamp(
      [
        {
          kind: "conversation_patch",
          state: shouldEscalate ? "needs_staff_attention" : "awaiting_time_choice",
          invalidResponseCount: invalidCount,
          needsStaffAttention: shouldEscalate,
          flagsJsonMerge: shouldEscalate
            ? {
                escalationReason: "repeated_invalid_slot_reply",
                escalationAt: now.toISOString(),
              }
            : {},
        },
        {
          kind: "send_message",
          body: context.locationConfig.templates.invalidSlot,
          idempotencyKey: createActionKey(
            "outbound",
            context.conversationId,
            "invalid_slot",
            invalidCount,
          ),
          metadata: {
            template: "invalid_slot",
            invalidCount,
          },
        },
      ],
      event,
    ),
  };
}

function handleFollowUp(context: ConversationContext, now: Date): StateMachineResult {
  if (context.state === "booked" || context.state === "closed") {
    return { reasons: ["follow_up_skipped_terminal_state"], actions: [] };
  }

  if (context.state === "awaiting_time_choice") {
    const offeredSlots = parseOfferedSlots(context.flagsJson);
    const slots =
      offeredSlots.length >= 3
        ? offeredSlots
        : nextBusinessDaySlots(
            now,
            context.locationConfig.businessHours,
            context.locationConfig.timezone,
            3,
            60,
          );

    if (slots.length < 3) {
      return {
        reasons: ["follow_up_unable_to_refresh_slots"],
        actions: [
          {
            kind: "conversation_patch",
            state: "needs_staff_attention",
            needsStaffAttention: true,
            flagsJsonMerge: {
              escalationReason: "follow_up_slot_refresh_failed",
            },
          },
        ],
      };
    }

    const prompt = buildSlotPrompt(context, slots);

    return {
      reasons: ["follow_up_slot_prompt"],
      actions: [
        {
          kind: "send_message",
          body: prompt.message,
          idempotencyKey: createActionKey("outbound", context.conversationId, "follow_up_slot_prompt"),
          metadata: {
            template: "slot_prompt",
            followUp: true,
          },
        },
        {
          kind: "conversation_patch",
          state: "awaiting_time_choice",
          staleAfterAt: addHours(now, DEFAULT_STALE_HOURS),
          lastOutboundAt: now.toISOString(),
          flagsJsonMerge: {
            offeredSlots: slots,
            followUpSlotPromptedAt: now.toISOString(),
          },
        },
      ],
    };
  }

  return {
    reasons: ["follow_up_nudge"],
    actions: [
      {
        kind: "send_message",
        body: context.locationConfig.templates.followUp,
        idempotencyKey: createActionKey("outbound", context.conversationId, "follow_up"),
        metadata: { template: "follow_up" },
      },
      {
        kind: "conversation_patch",
        state: "awaiting_yes",
        staleAfterAt: addHours(now, DEFAULT_STALE_HOURS),
        lastOutboundAt: now.toISOString(),
      },
      {
        kind: "schedule_job",
        jobType: "follow_up",
        runAt: addHours(now, 24),
        dedupeKey: createActionKey("follow_up", context.conversationId, new Date(now).toISOString().slice(0, 10)),
        payload: {
          orgId: context.orgId,
          locationId: context.locationId,
          leadId: context.leadId,
          conversationId: context.conversationId,
        },
      },
    ],
  };
}

function handleReminder(context: ConversationContext, now: Date): StateMachineResult {
  if (context.state !== "booked") {
    return { reasons: ["reminder_skipped_not_booked"], actions: [] };
  }

  const bookedSlot =
    typeof context.flagsJson.bookedSlotStartsAt === "string"
      ? context.flagsJson.bookedSlotStartsAt
      : null;

  const slotLabel = bookedSlot
    ? formatSlotForSms(bookedSlot, context.locationConfig.timezone)
    : "your scheduled time";

  return {
    reasons: ["reminder"],
    actions: [
      {
        kind: "send_message",
        body: renderTemplate(context.locationConfig.templates.reminder, {
          slot: slotLabel,
        }),
        idempotencyKey: createActionKey(
          "outbound",
          context.conversationId,
          "reminder",
          bookedSlot ?? now.toISOString(),
        ),
        metadata: {
          template: "reminder",
          slot: slotLabel,
        },
      },
      {
        kind: "conversation_patch",
        lastOutboundAt: now.toISOString(),
      },
    ],
  };
}

export function evaluateStateMachine(
  context: ConversationContext,
  event: TriggerEvent,
  nowInput: Date = new Date(),
): StateMachineResult {
  const now = new Date(nowInput);

  if (event.type === "lead_created") {
    return handleLeadCreated(context, now);
  }

  const staleReset = maybeStaleReset(context, event, now);
  if (staleReset) {
    return staleReset;
  }

  if (event.type === "inbound_received") {
    switch (context.state) {
      case "awaiting_yes":
        return handleInboundAwaitingYes(context, event, now);
      case "awaiting_time_choice":
        return handleInboundAwaitingTimeChoice(context, event, now);
      case "booked":
        return {
          reasons: ["booked_inbound_noop"],
          actions: withInboundTimestamp([], event),
        };
      case "needs_staff_attention":
      case "closed":
        return {
          reasons: ["terminal_state_inbound_noop"],
          actions: withInboundTimestamp([], event),
        };
      default:
        return {
          reasons: ["unknown_state"],
          actions: withInboundTimestamp([], event),
        };
    }
  }

  if (event.type === "follow_up") {
    return handleFollowUp(context, now);
  }

  if (event.type === "reminder") {
    return handleReminder(context, now);
  }

  return {
    reasons: ["unsupported_event"],
    actions: [],
  };
}
