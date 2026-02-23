import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type GoldBotTimelineProps = ComponentProps<"ol">;

type GoldBotTimelineTone = "default" | "success" | "warning" | "danger";

type GoldBotTimelineItemProps = {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  tone?: GoldBotTimelineTone;
  className?: string;
};

const toneClasses: Record<GoldBotTimelineTone, string> = {
  default: "border-border/70 bg-paper",
  success: "border-emerald-300/50 bg-emerald-500/20",
  warning: "border-amber-300/50 bg-amber-500/20",
  danger: "border-red-300/50 bg-red-500/20",
};

export function GoldBotTimeline({ className, ...props }: GoldBotTimelineProps) {
  return <ol className={cn("space-y-4", className)} {...props} />;
}

export function GoldBotTimelineItem({
  title,
  description,
  meta,
  tone = "default",
  className,
}: GoldBotTimelineItemProps) {
  return (
    <li className={cn("relative pl-6", className)}>
      <span className="absolute left-0 top-1 flex h-3.5 w-3.5 items-center justify-center">
        <span className={cn("h-2.5 w-2.5 rounded-full border", toneClasses[tone])} />
      </span>
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{title}</p>
          {meta ? <span className="text-xs text-ink-2">{meta}</span> : null}
        </div>
        {description ? <p className="text-sm text-ink-2">{description}</p> : null}
      </div>
    </li>
  );
}
