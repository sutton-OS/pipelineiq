"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StripePricingGridProps = {
  isPro: boolean;
  isAuthenticated: boolean;
  className?: string;
};

type StripeResponsePayload = {
  changed?: boolean;
  error?: string;
  message?: string;
  url?: string;
};

export function StripePricingGrid({
  isPro,
  isAuthenticated,
  className,
}: StripePricingGridProps) {
  const router = useRouter();
  const [activeAction, setActiveAction] = useState<"checkout" | "portal" | null>(null);

  async function startCheckout() {
    if (!isAuthenticated) {
      window.location.assign("/dashboard");
      return;
    }

    setActiveAction("checkout");
    try {
      const response = await fetch("/api/checkout", { method: "POST" });
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
        error instanceof Error ? error.message : "Unable to start billing flow.";
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
      <Card className="border-border bg-white/80">
        <CardHeader className="space-y-2 pb-3">
          <p className="text-xs uppercase tracking-[0.08em] text-ink-2">Pro</p>
          <CardTitle className="text-3xl font-serif">
            $49
            <span className="ml-1 text-sm font-sans font-normal text-ink-2">/month</span>
          </CardTitle>
          <p className="text-sm text-ink-2">
            Full PipelineIQ reporting and automation controls.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <ul className="space-y-2 text-sm text-ink-2">
            <li>• Unlimited reports</li>
            <li>• CSV + PDF export</li>
            <li>• GoldBot automation controls</li>
            <li>• Audit exports</li>
            <li>• Priority support</li>
          </ul>
          <Button
            type="button"
            className="w-full"
            disabled={!!activeAction}
            onClick={startCheckout}
          >
            {activeAction === "checkout" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isPro ? "Keep Pro" : "Upgrade to Pro"}
          </Button>
        </CardContent>
      </Card>

      {isAuthenticated && isPro ? (
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
