import { EmptyState } from "@/components/goldbot/empty-state";
import { StatusBadge } from "@/components/goldbot/status-badge";
import { cn } from "@/lib/utils";

type ConversationTimelineMessage = {
  id: string;
  direction: "inbound" | "outbound";
  status: string;
  body: string;
  createdAt: string;
};

type ConversationTimelineProps = {
  messages: ConversationTimelineMessage[];
  className?: string;
};

function toTimestamp(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toDayKey(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

function formatDayLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function formatMessageTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export function ConversationTimeline({ messages, className }: ConversationTimelineProps) {
  if (messages.length === 0) {
    return (
      <EmptyState
        title="No messages yet"
        description="Inbound and outbound SMS history will appear here as this lead replies."
        className="min-h-52"
      />
    );
  }

  const orderedMessages = [...messages].sort((a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt));

  return (
    <ol className={cn("space-y-3", className)}>
      {orderedMessages.map((message, index) => {
        const previousMessage = orderedMessages[index - 1];
        const dayKey = toDayKey(message.createdAt);
        const showDaySeparator = !previousMessage || toDayKey(previousMessage.createdAt) !== dayKey;
        const isInbound = message.direction === "inbound";

        return (
          <li key={message.id} className="space-y-3">
            {showDaySeparator ? (
              <div className="relative py-1 text-center">
                <span className="relative z-10 rounded-full border border-border/70 bg-paper/90 px-3 py-1 text-[11px] uppercase tracking-[0.08em] text-ink-3">
                  {formatDayLabel(message.createdAt)}
                </span>
                <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border/40" />
              </div>
            ) : null}

            <div className={cn("flex", isInbound ? "justify-start" : "justify-end")}>
              <article
                className={cn(
                  "max-w-[88%] space-y-2 rounded-2xl border px-4 py-3 sm:max-w-[38rem]",
                  isInbound
                    ? "border-border/60 bg-paper/70"
                    : "border-border/70 bg-white/90 shadow-[0_10px_22px_rgba(0,0,0,0.14)]",
                )}
              >
                <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink">
                  {message.body}
                </p>

                <div
                  className={cn(
                    "flex items-center justify-between gap-3 border-t border-border/40 pt-2",
                    isInbound ? "text-left" : "text-right",
                  )}
                >
                  <StatusBadge kind="message" value={message.status} className="text-[10px]" />
                  <time className="text-xs text-ink-2">{formatMessageTime(message.createdAt)}</time>
                </div>
              </article>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
