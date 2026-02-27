import "server-only";
import Stripe from "stripe";

export const BILLING_TIERS = ["basic", "pro", "enterprise"] as const;
export type BillingTier = (typeof BILLING_TIERS)[number];
export type PlanTier = BillingTier | "free";

const BILLING_TIER_ORDER: Record<BillingTier, number> = {
  basic: 1,
  pro: 2,
  enterprise: 3,
};

type StripeConstructor = new (
  apiKey: string,
  config?: Stripe.StripeConfig,
) => Stripe;

type EnvSource = Record<string, string | undefined>;

function nonEmpty(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function createStripeClient(secretKey: string): Stripe {
  const override = (
    globalThis as typeof globalThis & {
      __PIPELINEIQ_TEST_STRIPE__?: StripeConstructor;
    }
  ).__PIPELINEIQ_TEST_STRIPE__;
  const StripeClient = override ?? Stripe;
  return new StripeClient(secretKey, { apiVersion: "2026-01-28.clover" });
}

export function parseBillingTier(rawTier: unknown): BillingTier | null {
  if (typeof rawTier !== "string") {
    return null;
  }

  const normalizedTier = rawTier.trim().toLowerCase();
  return BILLING_TIERS.includes(normalizedTier as BillingTier)
    ? (normalizedTier as BillingTier)
    : null;
}

export function normalizePlanTier(rawTier: unknown): PlanTier {
  if (rawTier === "free") {
    return "free";
  }

  return parseBillingTier(rawTier) ?? "free";
}

export function compareBillingTiers(current: BillingTier, next: BillingTier): number {
  return BILLING_TIER_ORDER[next] - BILLING_TIER_ORDER[current];
}

export function getStripePriceMap(
  source: EnvSource = process.env,
): Record<BillingTier, string | null> {
  return {
    basic: nonEmpty(source.STRIPE_BASIC_PRICE_ID),
    pro: nonEmpty(source.STRIPE_PRO_PRICE_ID),
    enterprise: nonEmpty(source.STRIPE_ENTERPRISE_PRICE_ID),
  };
}

export function getPriceIdForTier(
  tier: BillingTier,
  source: EnvSource = process.env,
): string | null {
  return getStripePriceMap(source)[tier];
}

export function getTierFromPriceId(
  priceId: string | null | undefined,
  source: EnvSource = process.env,
): BillingTier | null {
  if (!priceId) {
    return null;
  }

  const prices = getStripePriceMap(source);
  for (const tier of BILLING_TIERS) {
    if (prices[tier] === priceId) {
      return tier;
    }
  }

  return null;
}

export function getStripeSubscriptionPriceId(subscription: Stripe.Subscription): string | null {
  return subscription.items.data[0]?.price?.id ?? null;
}

export function toIsoFromUnix(timestamp: number | null | undefined): string | null {
  if (typeof timestamp !== "number") {
    return null;
  }

  return new Date(timestamp * 1000).toISOString();
}

export function getTrialDays(source: EnvSource = process.env): number {
  const rawTrialDays = source.STRIPE_TRIAL_DAYS;
  if (!rawTrialDays) {
    return 14;
  }

  const parsedTrialDays = Number.parseInt(rawTrialDays, 10);
  if (!Number.isFinite(parsedTrialDays)) {
    return 14;
  }

  if (parsedTrialDays < 0) {
    return 0;
  }

  if (parsedTrialDays > 30) {
    return 30;
  }

  return parsedTrialDays;
}
