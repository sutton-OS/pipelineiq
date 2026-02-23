import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type KbdProps = ComponentProps<"kbd">;

export function Kbd({ className, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border/70 bg-paper px-1.5 text-[10px] font-medium text-ink-2",
        className,
      )}
      {...props}
    />
  );
}
