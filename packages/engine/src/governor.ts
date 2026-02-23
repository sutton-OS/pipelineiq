import {
  isWithinBusinessHours,
  nextBusinessDaySlots,
} from "./businessHours";
import type {
  ConversationContext,
  GovernorDecision,
  GovernorResult,
  ProposedAction,
} from "./types";

export const POLICY_VERSION = "goldbot-governor-v1";

function normalizeMessageBody(body: string): string {
  return body.replace(/\s+/g, " ").trim();
}

function normalizeAction(action: ProposedAction, now: Date): ProposedAction {
  switch (action.kind) {
    case "send_message": {
      return {
        ...action,
        body: normalizeMessageBody(action.body),
      };
    }
    case "schedule_job": {
      const parsedRunAt = new Date(action.runAt);
      const runAt = Number.isNaN(parsedRunAt.getTime()) || parsedRunAt < now ? now : parsedRunAt;
      return {
        ...action,
        runAt: runAt.toISOString(),
        dedupeKey: action.dedupeKey?.trim() || undefined,
      };
    }
    case "book_appointment": {
      return {
        ...action,
        startsAt: new Date(action.startsAt).toISOString(),
        endsAt: new Date(action.endsAt).toISOString(),
      };
    }
    case "set_opt_out":
      return {
        ...action,
        reason: action.reason.trim() || "opt_out",
      };
    case "conversation_patch":
      return action;
    default:
      return action;
  }
}

function isKillSwitchEnabled(context: ConversationContext): boolean {
  return context.globalKillSwitch || context.locationKillSwitch;
}

function evaluateSendMessage(
  context: ConversationContext,
  action: Extract<ProposedAction, { kind: "send_message" }>,
  now: Date,
): string[] {
  const reasons: string[] = [];

  if (context.locationConfig.autonomyMode === "suggest_only") {
    reasons.push("autonomy_mode_suggest_only");
  }

  if (isKillSwitchEnabled(context)) {
    reasons.push("kill_switch_enabled");
  }

  if (context.optedOut || context.consentStatus === "revoked") {
    reasons.push("lead_opted_out");
  }

  if (context.consentStatus !== "consented") {
    reasons.push("missing_consent");
  }

  if (!action.body.trim()) {
    reasons.push("message_body_empty");
  }

  if (context.outboundLastHour >= context.locationConfig.throttleCaps.perHour) {
    reasons.push("per_hour_limit_exceeded");
  }

  if (context.outboundLastDay >= context.locationConfig.throttleCaps.perDay) {
    reasons.push("per_day_limit_exceeded");
  }

  const withinBusinessHours = isWithinBusinessHours(
    now,
    context.locationConfig.businessHours,
    context.locationConfig.timezone,
  );

  if (!withinBusinessHours) {
    reasons.push("outside_business_hours");
  }

  return reasons;
}

function evaluateBookAppointment(
  context: ConversationContext,
  action: Extract<ProposedAction, { kind: "book_appointment" }>,
  now: Date,
): string[] {
  const reasons: string[] = [];

  if (context.locationConfig.autonomyMode === "suggest_only") {
    reasons.push("autonomy_mode_suggest_only");
  }

  if (isKillSwitchEnabled(context)) {
    reasons.push("kill_switch_enabled");
  }

  if (context.optedOut || context.consentStatus !== "consented") {
    reasons.push("cannot_book_without_consent");
  }

  const startsAt = new Date(action.startsAt);
  const endsAt = new Date(action.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || startsAt >= endsAt) {
    reasons.push("invalid_appointment_window");
  }

  const allowedSlots = nextBusinessDaySlots(
    now,
    context.locationConfig.businessHours,
    context.locationConfig.timezone,
    3,
    60,
  );

  const startsAtIso = startsAt.toISOString();
  const isWithinNextThreeBusinessDays = allowedSlots.some(
    (slot) => slot.startsAt === startsAtIso,
  );

  if (!isWithinNextThreeBusinessDays) {
    reasons.push("appointment_outside_next_three_business_days");
  }

  return reasons;
}

function evaluateAction(
  context: ConversationContext,
  normalizedAction: ProposedAction,
  now: Date,
): string[] {
  switch (normalizedAction.kind) {
    case "send_message":
      return evaluateSendMessage(context, normalizedAction, now);
    case "book_appointment":
      return evaluateBookAppointment(context, normalizedAction, now);
    case "schedule_job": {
      if (context.locationConfig.autonomyMode === "suggest_only") {
        return ["autonomy_mode_suggest_only"];
      }
      const runAt = new Date(normalizedAction.runAt);
      if (Number.isNaN(runAt.getTime())) {
        return ["invalid_run_at"];
      }
      return [];
    }
    case "conversation_patch": {
      if (
        context.locationConfig.autonomyMode === "suggest_only" &&
        normalizedAction.state === "booked"
      ) {
        return ["autonomy_mode_suggest_only"];
      }
      return [];
    }
    case "set_opt_out":
      return [];
    default:
      return ["unknown_action"];
  }
}

export function governActions(
  context: ConversationContext,
  actions: ProposedAction[],
  nowInput: Date = new Date(),
): GovernorResult {
  const now = new Date(nowInput);

  const decisions: GovernorDecision[] = actions.map((action) => {
    const normalizedAction = normalizeAction(action, now);
    const reasons = evaluateAction(context, normalizedAction, now);

    return {
      action,
      normalizedAction,
      allowed: reasons.length === 0,
      reasons,
    };
  });

  return {
    policyVersion: POLICY_VERSION,
    decisions,
  };
}
