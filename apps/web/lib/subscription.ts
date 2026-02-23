import { createServerClient } from "@/lib/supabase";

type UserSubscription = {
  id: string;
  user_id: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  active_until: string | null;
  created_at: string;
  updated_at: string;
};

export async function getUserSubscription(userId: string) {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("user_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const subscription = (data as UserSubscription | null) ?? null;

  const isPro =
    subscription?.status === "active" &&
    !!subscription.active_until &&
    new Date(subscription.active_until) > new Date();

  return { isPro: isPro ?? false, subscription };
}

export async function checkReportLimit(
  userId: string
): Promise<{ canCreate: boolean; reason?: string }> {
  const { isPro } = await getUserSubscription(userId);
  if (isPro) return { canCreate: true };

  const supabase = createServerClient();
  const { count } = await supabase
    .from("reports")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if ((count ?? 0) >= 3) {
    return {
      canCreate: false,
      reason:
        "Free plan is limited to 3 reports. Upgrade to Pro for unlimited reports.",
    };
  }

  return { canCreate: true };
}
