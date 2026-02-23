import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type GoldBotSectionCardProps = {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: GoldBotSectionCardProps) {
  const hasHeader = Boolean(title || description || action);

  return (
    <Card
      className={cn(
        "border-border/70 bg-paper-2/40 py-0 shadow-[0_1px_0_rgba(255,255,255,0.03),0_12px_34px_rgba(0,0,0,0.2)]",
        className,
      )}
    >
      {hasHeader ? (
        <CardHeader className="gap-3 border-b border-border/60 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              {title ? <CardTitle className="text-lg font-medium">{title}</CardTitle> : null}
              {description ? <p className="text-sm text-ink-2">{description}</p> : null}
            </div>
            {action ? <div className="flex items-center gap-2">{action}</div> : null}
          </div>
        </CardHeader>
      ) : null}
      <CardContent className={cn("px-5 py-4", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
