import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  createStripeClient,
  getStripeSubscriptionPriceId,
  getTierFromPriceId,
  toIsoFromUnix,
} from "@/lib/stripe-billing";
import { createServerClient } from "@/lib/supabase";
import { logServerError } from "@/lib/server-error";

function getCheckoutSubscriptionId(session: Stripe.Checkout.Session): string | null {
  if (typeof session.subscription === "string") {
    return session.subscription;
  }
  return session.subscription?.id ?? null;
}

function getCheckoutCustomerId(session: Stripe.Checkout.Session): string | null {
  if (typeof session.customer === "string") {
    return session.customer;
  }
  return session.customer?.id ?? null;
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const invoiceWithSubscription = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  };

  if (typeof invoiceWithSubscription.subscription === "string") {
    return invoiceWithSubscription.subscription;
  }

  if (invoiceWithSubscription.subscription?.id) {
    return invoiceWithSubscription.subscription.id;
  }

  const parentSubscription =
    invoice.parent?.subscription_details?.subscription ?? null;
  if (typeof parentSubscription === "string") {
    return parentSubscription;
  }

  return parentSubscription?.id ?? null;
}

function getInvoicePeriodEnd(invoice: Stripe.Invoice): string | null {
  const periodEnd = invoice.lines.data[0]?.period?.end;
  return toIsoFromUnix(periodEnd ?? null);
}

function getInvoicePriceId(invoice: Stripe.Invoice): string | null {
  const firstLine = invoice.lines.data[0] as Stripe.InvoiceLineItem & {
    price?: { id?: string } | null;
    pricing?: {
      price_details?: {
        price?: string | { id?: string } | null;
      } | null;
    } | null;
  };

  if (typeof firstLine.price?.id === "string") {
    return firstLine.price.id;
  }

  const nestedPrice = firstLine.pricing?.price_details?.price;
  if (typeof nestedPrice === "string") {
    return nestedPrice;
  }

  if (nestedPrice && typeof nestedPrice === "object" && typeof nestedPrice.id === "string") {
    return nestedPrice.id;
  }

  return null;
}

function buildSubscriptionStateUpdate(subscription: Stripe.Subscription) {
  const periodSource = subscription as Stripe.Subscription & {
    current_period_start?: number | null;
    current_period_end?: number | null;
    items: Stripe.ApiList<Stripe.SubscriptionItem> & {
      data: Array<
        Stripe.SubscriptionItem & {
          current_period_start?: number | null;
          current_period_end?: number | null;
        }
      >;
    };
  };

  const firstItem = periodSource.items.data[0];
  const currentPeriodStart =
    periodSource.current_period_start ?? firstItem?.current_period_start ?? null;
  const currentPeriodEnd =
    periodSource.current_period_end ?? firstItem?.current_period_end ?? null;
  const stripePriceId = getStripeSubscriptionPriceId(subscription);
  const planTier = getTierFromPriceId(stripePriceId) ?? "pro";

  return {
    status: subscription.status,
    plan_tier: planTier,
    stripe_price_id: stripePriceId,
    active_until: toIsoFromUnix(currentPeriodEnd),
    current_period_start: toIsoFromUnix(currentPeriodStart),
    current_period_end: toIsoFromUnix(currentPeriodEnd),
    trial_ends_at: toIsoFromUnix(subscription.trial_end),
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: toIsoFromUnix(subscription.canceled_at),
    updated_at: new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return new Response("Stripe not configured", { status: 500 });
  }

  const stripe = createStripeClient(stripeKey);

  // CRITICAL: arrayBuffer() is required. Do NOT change to .text() or .json()
  const body = await request.arrayBuffer();
  const rawBody = Buffer.from(body);
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServerClient();
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId ?? session.client_reference_id ?? null;
        const subscriptionId = getCheckoutSubscriptionId(session);
        const customerId = getCheckoutCustomerId(session);

        if (userId && subscriptionId && customerId) {
          const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
          await supabase.from("user_subscriptions").upsert(
            {
              user_id: userId,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              last_payment_status:
                stripeSubscription.status === "trialing" ? "trialing" : "paid",
              ...buildSubscriptionStateUpdate(stripeSubscription),
            },
            { onConflict: "user_id" },
          );
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const update = buildSubscriptionStateUpdate(subscription);
        await supabase
          .from("user_subscriptions")
          .update({
            ...update,
            status:
              event.type === "customer.subscription.deleted"
                ? "canceled"
                : update.status,
          })
          .eq("stripe_subscription_id", subscription.id);
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = getInvoiceSubscriptionId(invoice);
        if (!subscriptionId) {
          break;
        }

        const invoicePeriodEnd = getInvoicePeriodEnd(invoice);
        const invoicePriceId = getInvoicePriceId(invoice);
        const invoiceTier = getTierFromPriceId(invoicePriceId);

        await supabase
          .from("user_subscriptions")
          .update({
            status: event.type === "invoice.paid" ? "active" : "past_due",
            ...(invoicePeriodEnd
              ? {
                  active_until: invoicePeriodEnd,
                  current_period_end: invoicePeriodEnd,
                }
              : {}),
            ...(invoicePriceId ? { stripe_price_id: invoicePriceId } : {}),
            ...(invoiceTier ? { plan_tier: invoiceTier } : {}),
            last_invoice_id: invoice.id,
            last_invoice_url: invoice.hosted_invoice_url ?? null,
            last_invoice_pdf: invoice.invoice_pdf ?? null,
            last_payment_status: event.type === "invoice.paid" ? "paid" : "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscriptionId);
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const referenceId = logServerError("app/api/webhook/stripe", error, {
      eventType: event.type,
    });
    return NextResponse.json(
      { error: "Webhook processing failed", referenceId },
      { status: 500 },
    );
  }
}
