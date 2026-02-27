import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { requireUserId } from "@/lib/auth";
import {
  compareBillingTiers,
  createStripeClient,
  getPriceIdForTier,
  getStripeSubscriptionPriceId,
  getTierFromPriceId,
  getTrialDays,
  parseBillingTier,
  type BillingTier,
} from "@/lib/stripe-billing";
import { getUserSubscription } from "@/lib/subscription";
import { logServerError } from "@/lib/server-error";

type CheckoutPayload = {
  tier?: unknown;
};

async function getCheckoutTier(request: Request): Promise<{
  tier: BillingTier;
  invalid: boolean;
}> {
  let payload: CheckoutPayload | null = null;
  try {
    payload = (await request.json()) as CheckoutPayload;
  } catch {
    return { tier: "pro", invalid: false };
  }

  if (!payload || !("tier" in payload)) {
    return { tier: "pro", invalid: false };
  }

  const parsedTier = parseBillingTier(payload.tier);
  if (!parsedTier) {
    return { tier: "pro", invalid: true };
  }

  return { tier: parsedTier, invalid: false };
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const { tier, invalid } = await getCheckoutTier(request);
    if (invalid) {
      return NextResponse.json(
        { error: "Invalid plan tier. Choose Basic, Pro, or Enterprise." },
        { status: 400 },
      );
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const priceId = getPriceIdForTier(tier);

    if (!secretKey || !appUrl || !priceId) {
      return NextResponse.json(
        { error: "Stripe is not configured." },
        { status: 500 },
      );
    }

    const stripe = createStripeClient(secretKey);
    const { subscription } = await getUserSubscription(userId);

    const existingSubscriptionId = subscription?.stripe_subscription_id;
    if (existingSubscriptionId) {
      const currentSubscription = await stripe.subscriptions.retrieve(existingSubscriptionId);
      const currentItem = currentSubscription.items.data[0];
      if (!currentItem) {
        return NextResponse.json(
          { error: "Current subscription is missing billing items." },
          { status: 400 },
        );
      }

      const currentPriceId = getStripeSubscriptionPriceId(currentSubscription);
      if (currentPriceId === priceId) {
        return NextResponse.json({
          changed: false,
          tier,
          message: "You are already on that plan.",
        });
      }

      const currentTier = getTierFromPriceId(currentPriceId);
      const changeDirection =
        currentTier === null ? 0 : compareBillingTiers(currentTier, tier);
      const updatedSubscription = await stripe.subscriptions.update(existingSubscriptionId, {
        items: [{ id: currentItem.id, price: priceId }],
        proration_behavior: "always_invoice",
        cancel_at_period_end: false,
        metadata: {
          userId,
          tier,
        },
      });

      return NextResponse.json({
        changed: true,
        tier,
        subscriptionId: updatedSubscription.id,
        message:
          changeDirection > 0
            ? "Plan upgraded successfully."
            : "Plan downgraded successfully.",
      });
    }

    const trialDays = subscription?.stripe_customer_id ? 0 : getTrialDays();
    let customerEmail: string | undefined;
    try {
      const clerkUser = await currentUser();
      customerEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? undefined;
    } catch {
      customerEmail = undefined;
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      metadata: { userId, tier },
      client_reference_id: userId,
      success_url: `${appUrl}/dashboard/settings?success=true&tier=${tier}`,
      cancel_url: `${appUrl}/pricing?canceled=true&tier=${tier}`,
      ...(subscription?.stripe_customer_id
        ? { customer: subscription.stripe_customer_id }
        : {
            customer_creation: "always" as const,
            ...(customerEmail ? { customer_email: customerEmail } : {}),
          }),
      subscription_data: {
        metadata: { userId, tier },
        ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const referenceId = logServerError("app/api/checkout", error);
    const message =
      error instanceof Error && error.message === "Unauthorized"
        ? "Unauthorized"
        : "Failed to create session";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message, referenceId }, { status });
  }
}
