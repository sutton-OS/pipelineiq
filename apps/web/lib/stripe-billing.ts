import "server-only";
import Stripe from "stripe";

type StripeConstructor = new (
  apiKey: string,
  config?: Stripe.StripeConfig,
) => Stripe;

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

export function getProPriceId(source: Record<string, string | undefined> = process.env): string | null {
  return nonEmpty(source.STRIPE_PRO_PRICE_ID);
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
