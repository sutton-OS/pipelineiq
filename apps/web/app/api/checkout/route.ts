import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import {
  createStripeClient,
  getProPriceId,
  getStripeSubscriptionPriceId,
} from "@/lib/stripe-billing";
import { getUserSubscription } from "@/lib/subscription";
import { logServerError } from "@/lib/server-error";

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    void request;

    const secretKey = process.env.STRIPE_SECRET_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const priceId = getProPriceId();

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
          message: "You are already on Pro.",
        });
      }

      const updatedSubscription = await stripe.subscriptions.update(existingSubscriptionId, {
        items: [{ id: currentItem.id, price: priceId }],
        proration_behavior: "always_invoice",
        cancel_at_period_end: false,
        metadata: {
          userId,
          plan: "pro",
        },
      });

      return NextResponse.json({
        changed: true,
        subscriptionId: updatedSubscription.id,
        message: "Plan updated successfully.",
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      metadata: { userId, plan: "pro" },
      client_reference_id: userId,
      success_url: `${appUrl}/dashboard/settings?success=true`,
      cancel_url: `${appUrl}/pricing?canceled=true`,
      ...(subscription?.stripe_customer_id
        ? { customer: subscription.stripe_customer_id }
        : { customer_creation: "always" as const }),
      subscription_data: { metadata: { userId, plan: "pro" } },
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
