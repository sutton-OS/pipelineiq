"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type BillingTier = "basic" | "pro" | "enterprise";
type PlanTier = BillingTier | "free";

type StripePricingGridProps = {
  currentTier: PlanTier;
  isAuthenticated: boolean;
  trialDays: number;
  className?: string;
};

type StripeResponsePayload = {
  changed?: boolean;
  error?: string;
  message?: string;
  url?: string;
};

type TierDefinition = {
  id: BillingTier;
  name: string;
  price: string;
  description: string;
  features: string[];
  highlighted?: boolean;
};

const TIER_RANK: Record<BillingTier, number> = {
  basic: 1,
  pro: 2,
  enterprise: 3,
};

const TIER_DEFINITIONS: TierDefinition[] = [
  {
    id: "basic",
    name: "Basic",
    price: "$19",
    description: "Core sales reporting with unlimited report generation.",
    features: [
      "Unlimited reports",
      "CSV + PDF export",
      "Standard support",
      "3-day data retention backups",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$49",
    description: "Advanced automations and team performance workflows.",
    features: [
      "Everything in Basic",
      "GoldBot automation controls",
      "Audit exports",
      "Priority support",
    ],
    highlighted: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "$149",
    description: "Enterprise governance, onboarding, and support.",
    features: [
      "Everything in Pro",
      "Dedicated onboarding",
      "SLA-backed support",
      "Quarterly billing reviews",
    ],
  },
];

function getActionLabel(currentTier: PlanTier, targetTier: BillingTier, trialDays: number): string {
  if (currentTier === targetTier) {
    return "Current Plan";
  }

  if (currentTier === "free") {
    return trialDays > 0 ? `Start ${trialDays}-day trial` : "Choose Plan";
  }

  const currentRank = TIER_RANK[currentTier];
  const targetRank = TIER_RANK[targetTier];
  return targetRank > currentRank ? "Upgrade" : "Downgrade";
}

export function StripePricingGrid({
  currentTier,
  isAuthenticated,
  trialDays,
  className,
}: StripePricingGridProps) {
  const router = useRouter();
  const [activeAction, setActiveAction] = useState<"portal" | BillingTier | null>(null);

  async function startPlanAction(tier: BillingTier) {
    if (!isAuthenticated) {
      window.location.assign("/dashboard");
      return;
    }

    setActiveAction(tier);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const payload = (await response.json()) as StripeResponsePayload;

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to start billing flow.");
      }

      if (payload.url) {
        window.location.assign(payload.url);
        return;
      }

      toast.success(payload.message ?? "Subscription updated.");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to update your subscription.";
      toast.error(message);
    } finally {
      setActiveAction(null);
    }
  }

  async function openPortal() {
    setActiveAction("portal");
    try {
      const response = await fetch("/api/portal", { method: "POST" });
      const payload = (await response.json()) as StripeResponsePayload;
      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Unable to open billing portal.");
      }

      window.location.assign(payload.url);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to open billing portal.";
      toast.error(message);
      setActiveAction(null);
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid gap-4 md:grid-cols-3">
        {TIER_DEFINITIONS.map((tier) => {
          const isCurrent = currentTier === tier.id;
          const isBusy = activeAction === tier.id;
          return (
            <Card
              key={tier.id}
              className={cn(
                "border-border bg-white/80",
                tier.highlighted ? "ring-2 ring-[var(--accent)]/35" : "",
              )}
            >
              <CardHeader className="space-y-2 pb-3">
                <p className="text-xs uppercase tracking-[0.08em] text-ink-2">{tier.name}</p>
                <CardTitle className="text-3xl font-serif">
                  {tier.price}
                  <span className="ml-1 text-sm font-sans font-normal text-ink-2">/month</span>
                </CardTitle>
                <p className="text-sm text-ink-2">{tier.description}</p>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <ul className="space-y-2 text-sm text-ink-2">
                  {tier.features.map((feature) => (
                    <li key={feature}>• {feature}</li>
                  ))}
                </ul>
                <Button
                  type="button"
                  className="w-full"
                  variant={tier.highlighted ? "default" : "outline"}
                  disabled={isCurrent || !!activeAction}
                  onClick={() => startPlanAction(tier.id)}
                >
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {getActionLabel(currentTier, tier.id, trialDays)}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {isAuthenticated && currentTier !== "free" ? (
        <div className="flex justify-end">
          <Button type="button" variant="outline" disabled={!!activeAction} onClick={openPortal}>
            {activeAction === "portal" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Manage Billing Portal
          </Button>
        </div>
      ) : null}
    </div>
  );
}
