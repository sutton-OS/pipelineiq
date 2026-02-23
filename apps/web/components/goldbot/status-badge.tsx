import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type GoldBotConversationState =
  | "awaiting_yes"
  | "awaiting_time_choice"
  | "booked"
  | "needs_staff_attention"
  | "closed";

export type GoldBotMessageStatus =
  | "pending"
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "received"
  | "blocked";

type GoldBotStatusKind = "conversation" | "message";

type GoldBotStatusBadgeProps = {
  kind: GoldBotStatusKind;
  value: GoldBotConversationState | GoldBotMessageStatus | string;
  className?: string;
};

const conversationStatusStyles: Record<
  GoldBotConversationState,
  { label: string; className: string }
> = {
  awaiting_yes: {
    label: "Awaiting YES",
    className: "border-amber-300/45 bg-amber-500/15 text-amber-100",
  },
  awaiting_time_choice: {
    label: "Awaiting Time Choice",
    className: "border-sky-300/45 bg-sky-500/15 text-sky-100",
  },
  booked: {
    label: "Booked",
    className: "border-emerald-300/45 bg-emerald-500/15 text-emerald-100",
  },
  needs_staff_attention: {
    label: "Needs Staff Attention",
    className: "border-red-300/45 bg-red-500/15 text-red-100",
  },
  closed: {
    label: "Closed",
    className: "border-border/70 bg-paper/70 text-ink-2",
  },
};

const messageStatusStyles: Record<GoldBotMessageStatus, { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className: "border-amber-300/45 bg-amber-500/15 text-amber-100",
  },
  queued: {
    label: "Queued",
    className: "border-amber-300/45 bg-amber-500/15 text-amber-100",
  },
  sent: {
    label: "Sent",
    className: "border-emerald-300/45 bg-emerald-500/15 text-emerald-100",
  },
  delivered: {
    label: "Delivered",
    className: "border-emerald-300/45 bg-emerald-500/15 text-emerald-100",
  },
  failed: {
    label: "Failed",
    className: "border-red-300/45 bg-red-500/15 text-red-100",
  },
  received: {
    label: "Received",
    className: "border-sky-300/45 bg-sky-500/15 text-sky-100",
  },
  blocked: {
    label: "Blocked",
    className: "border-red-300/45 bg-red-500/15 text-red-100",
  },
};

function formatStatusLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function resolveStatusStyles(kind: GoldBotStatusKind, value: string) {
  if (kind === "conversation" && value in conversationStatusStyles) {
    return conversationStatusStyles[value as GoldBotConversationState];
  }

  if (kind === "message" && value in messageStatusStyles) {
    return messageStatusStyles[value as GoldBotMessageStatus];
  }

  return {
    label: formatStatusLabel(value),
    className: "border-border/70 bg-paper/70 text-ink-2",
  };
}

export function StatusBadge({ kind, value, className }: GoldBotStatusBadgeProps) {
  const normalizedValue = String(value).toLowerCase();
  const styles = resolveStatusStyles(kind, normalizedValue);

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-[0.02em]",
        styles.className,
        className,
      )}
    >
      {styles.label}
    </Badge>
  );
}
