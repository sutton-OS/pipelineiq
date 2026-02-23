import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type GoldBotMetricTileProps = {
  label: string;
  value: number | string;
  hint?: string;
  className?: string;
};

export function MetricTile({ label, value, hint, className }: GoldBotMetricTileProps) {
  return (
    <Card
      className={cn(
        "border-border/70 bg-paper-2/40 py-4 shadow-[0_1px_0_rgba(255,255,255,0.03),0_10px_30px_rgba(0,0,0,0.22)]",
        className,
      )}
    >
      <CardHeader className="px-4 pb-1">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-ink-2">{label}</p>
      </CardHeader>
      <CardContent className="px-4">
        <p className="font-serif text-3xl leading-none">{value}</p>
        {hint ? <p className="mt-2 text-xs text-ink-2">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
