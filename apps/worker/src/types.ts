import type { BusinessHours } from "./businessHours";

export type AutonomyMode = "suggest_only" | "safe_auto";
export type BookingProvider = "none" | "google_calendar" | "calendly";

export const JOB_TYPES = [
  "lead_created",
  "inbound_received",
  "follow_up",
  "reminder",
  "send_outbound",
] as const;

export type JobType = (typeof JOB_TYPES)[number];

export type ConversationState =
  | "awaiting_yes"
  | "awaiting_time_choice"
  | "booked"
  | "needs_staff_attention"
  | "closed";

export type JobPayloadLeadCreated = {
  orgId: string;
  locationId: string;
  leadId: string;
  conversationId: string;
  source?: string;
};

export type JobPayloadInboundReceived = {
  orgId: string;
  locationId: string;
  leadId: string;
  conversationId: string;
  messageId: string;
};

export type JobPayloadFollowUp = {
  orgId: string;
  locationId: string;
  leadId: string;
  conversationId: string;
};

export type JobPayloadReminder = {
  orgId: string;
  locationId: string;
  leadId: string;
  conversationId: string;
  appointmentId: string;
};

export type JobPayloadSendOutbound = {
  orgId: string;
  locationId: string;
  messageId: string;
};

export type JobPayload =
  | JobPayloadLeadCreated
  | JobPayloadInboundReceived
  | JobPayloadFollowUp
  | JobPayloadReminder
  | JobPayloadSendOutbound;

export type TriggerEvent =
  | { type: "lead_created" }
  | {
      type: "inbound_received";
      messageId: string;
      body: string;
      receivedAt: string;
    }
  | { type: "follow_up" }
  | { type: "reminder"; appointmentId: string };

export type LocationConfig = {
  timezone: string;
  autonomyMode: AutonomyMode;
  bookingProvider: BookingProvider;
  bookingSettings: Record<string, unknown>;
  businessHours: BusinessHours;
  throttleCaps: {
    perHour: number;
    perDay: number;
    invalidResponseLimit: number;
  };
  templates: {
    intro: string;
    followUp: string;
    slotPrompt: string;
    bookedConfirmation: string;
    reminder: string;
    invalid: string;
    invalidSlot: string;
  };
};

export type ConversationContext = {
  orgId: string;
  locationId: string;
  leadId: string;
  conversationId: string;
  leadFullName: string;
  leadFirstName: string;
  leadPhone: string;
  normalizedPhone: string;
  consentStatus: "unknown" | "consented" | "revoked";
  optedOut: boolean;
  locationConfig: LocationConfig;
  state: ConversationState;
  invalidResponseCount: number;
  needsStaffAttention: boolean;
  flagsJson: Record<string, unknown>;
  staleAfterAt: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  outboundLastHour: number;
  outboundLastDay: number;
  globalKillSwitch: boolean;
  locationKillSwitch: boolean;
};

export type ProposedAction =
  | {
      kind: "send_message";
      body: string;
      idempotencyKey: string;
      metadata?: Record<string, unknown>;
    }
  | {
      kind: "schedule_job";
      jobType: JobType;
      runAt: string;
      dedupeKey?: string;
      payload: Record<string, unknown>;
    }
  | {
      kind: "book_appointment";
      startsAt: string;
      endsAt: string;
      idempotencyKey: string;
      notes?: string;
      metadata?: Record<string, unknown>;
    }
  | {
      kind: "set_opt_out";
      reason: string;
    }
  | {
      kind: "conversation_patch";
      state?: ConversationState;
      invalidResponseCount?: number;
      needsStaffAttention?: boolean;
      staleAfterAt?: string | null;
      lastInboundAt?: string | null;
      lastOutboundAt?: string | null;
      flagsJsonMerge?: Record<string, unknown>;
    };

export type StateMachineResult = {
  actions: ProposedAction[];
  reasons: string[];
};

export type GovernorDecision = {
  action: ProposedAction;
  allowed: boolean;
  reasons: string[];
  normalizedAction: ProposedAction;
};

export type GovernorResult = {
  policyVersion: string;
  decisions: GovernorDecision[];
};

export type ActionResult = {
  action: ProposedAction;
  applied: boolean;
  skipped: boolean;
  details: Record<string, unknown>;
};

export type ActionGatewayInput = {
  jobId: string;
  context: ConversationContext;
  policyVersion: string;
  decisions: GovernorDecision[];
};
