import { NextResponse } from "next/server";
import Stripe from "stripe";
import { requireUserId } from "@/lib/auth";
import { getUserSubscription } from "@/lib/subscription";

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

    const stripe = new Stripe(secretKey, { apiVersion: "2026-01-28.clover" });

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
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "Unauthorized"
        ? "Unauthorized"
        : "Failed to create portal session";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
