import { getTierFromPriceId, normalizePlanTier, type PlanTier } from "@/lib/stripe-billing";
import { createServerClient } from "@/lib/supabase";

type UserSubscription = {
  id: string;
  user_id: string;
  status: string;
  plan_tier?: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id?: string | null;
  active_until: string | null;
  current_period_end?: string | null;
  trial_ends_at?: string | null;
  cancel_at_period_end?: boolean | null;
  created_at: string;
  updated_at: string;
};

const ENTITLED_STATUSES = new Set(["active", "trialing", "past_due"]);

function getEntitlementExpiry(subscription: UserSubscription | null): Date | null {
  if (!subscription) {
    return null;
  }

  const expiry =
    subscription.current_period_end ??
    subscription.active_until ??
    subscription.trial_ends_at ??
    null;

  return expiry ? new Date(expiry) : null;
}

function inferPlanTier(subscription: UserSubscription | null): PlanTier {
  if (!subscription) {
    return "free";
  }

  if (subscription.plan_tier) {
    return normalizePlanTier(subscription.plan_tier);
  }

  const derivedFromPrice = getTierFromPriceId(subscription.stripe_price_id ?? null);
  if (derivedFromPrice) {
    return derivedFromPrice;
  }

  if (subscription.status === "active" && subscription.stripe_subscription_id) {
    // Backward compatibility with older rows that only tracked a single Pro plan.
    return "pro";
  }

  return "free";
}

export async function getUserSubscription(userId: string) {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("user_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const subscription = (data as UserSubscription | null) ?? null;
  const now = new Date();
  const entitlementExpiry = getEntitlementExpiry(subscription);
  const hasValidWindow = !entitlementExpiry || entitlementExpiry > now;
  const planTier = inferPlanTier(subscription);
  const isPaid =
    !!subscription &&
    planTier !== "free" &&
    ENTITLED_STATUSES.has(subscription.status) &&
    hasValidWindow;

  return {
    isPaid,
    isPro: isPaid,
    planTier,
    isEnterprise: isPaid && planTier === "enterprise",
    subscription,
  };
}

export async function checkReportLimit(
  userId: string,
): Promise<{ canCreate: boolean; reason?: string }> {
  const { isPaid } = await getUserSubscription(userId);
  if (isPaid) {
    return { canCreate: true };
  }

  const supabase = createServerClient();
  const { count } = await supabase
    .from("reports")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if ((count ?? 0) >= 3) {
    return {
      canCreate: false,
      reason:
        "Free plan is limited to 3 reports. Upgrade to a paid plan for unlimited reports.",
    };
  }

  return { canCreate: true };
}
