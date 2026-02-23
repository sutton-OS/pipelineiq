import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const maxWidthClasses = {
  "7xl": "max-w-7xl",
  "5xl": "max-w-5xl",
} as const;

type GoldBotPageShellProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  maxWidth?: keyof typeof maxWidthClasses;
};

export function GoldBotPageShell({
  title,
  subtitle,
  actions,
  children,
  className,
  headerClassName,
  maxWidth = "7xl",
}: GoldBotPageShellProps) {
  return (
    <div className={cn("mx-auto w-full space-y-6", maxWidthClasses[maxWidth], className)}>
      <header
        className={cn(
          "flex flex-col gap-4 md:flex-row md:items-end md:justify-between",
          headerClassName,
        )}
      >
        <div className="space-y-1">
          <h1 className="text-4xl font-serif tracking-tight">{title}</h1>
          {subtitle ? <div className="text-sm text-ink-2">{subtitle}</div> : null}
        </div>

        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>

      {children}
    </div>
  );
}
