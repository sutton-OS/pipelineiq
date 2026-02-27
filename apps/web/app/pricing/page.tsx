import type { Metadata } from "next";
import Link from "next/link";
import { StripePricingGrid } from "@/components/pricing/stripe-pricing-grid";
import { Card, CardContent } from "@/components/ui/card";
import { requireUserId } from "@/lib/auth";
import { getTrialDays } from "@/lib/stripe-billing";
import { getUserSubscription } from "@/lib/subscription";

export const metadata: Metadata = {
  title: "Pricing",
};

export default async function PricingPage() {
  let userId: string | null = null;
  try {
    userId = await requireUserId();
  } catch {
    userId = null;
  }

  const trialDays = getTrialDays();
  let currentTier: "free" | "basic" | "pro" | "enterprise" = "free";
  if (userId) {
    const { planTier } = await getUserSubscription(userId);
    currentTier = planTier;
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-10 md:py-14">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.08em] text-ink-2">Stripe Billing</p>
        <h1 className="text-5xl font-serif leading-tight">Pricing & Subscription Plans</h1>
        <p className="max-w-3xl text-sm text-ink-2 md:text-base">
          Choose the plan that fits your team, start a free trial, and switch plans at any time.
          Stripe handles invoicing and receipts automatically after successful payments.
        </p>
      </header>

      {trialDays > 0 ? (
        <Card className="border-border bg-white/70">
          <CardContent className="py-4 text-sm text-ink-2">
            All new subscriptions include a <strong>{trialDays}-day free trial</strong>.
          </CardContent>
        </Card>
      ) : null}

      <StripePricingGrid
        currentTier={currentTier}
        isAuthenticated={!!userId}
        trialDays={trialDays}
      />

      <div className="text-sm text-ink-2">
        Need custom procurement or annual terms?{" "}
        <Link href="/dashboard/settings" className="font-medium text-ink underline underline-offset-2">
          Contact us from settings
        </Link>
        .
      </div>
    </div>
  );
}
