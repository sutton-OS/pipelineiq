import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { createStripeClient } from "@/lib/stripe-billing";
import { getUserSubscription } from "@/lib/subscription";
import { logServerError } from "@/lib/server-error";

export async function POST() {
  try {
    const userId = await requireUserId();
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!secretKey || !appUrl) {
      return NextResponse.json(
        { error: "Stripe is not configured." },
        { status: 500 }
      );
    }

    const stripe = createStripeClient(secretKey);

    const { subscription } = await getUserSubscription(userId);
    const customerId = subscription?.stripe_customer_id;

    if (!customerId) {
      return NextResponse.json(
        { error: "No billing customer found for this account." },
        { status: 400 }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/dashboard/settings`,
      ...(process.env.STRIPE_PORTAL_CONFIG_ID
        ? { configuration: process.env.STRIPE_PORTAL_CONFIG_ID }
        : {}),
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const referenceId = logServerError("app/api/portal", error);
    const message =
      error instanceof Error && error.message === "Unauthorized"
        ? "Unauthorized"
        : "Failed to create portal session";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message, referenceId }, { status });
  }
}
