import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type GoldBotEmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, className }: GoldBotEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-paper/35 px-6 py-10 text-center",
        className,
      )}
    >
      <h3 className="text-base font-medium">{title}</h3>
      {description ? <p className="mt-1 max-w-md text-sm text-ink-2">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
