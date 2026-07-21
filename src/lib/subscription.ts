import { createServerFn } from "@tanstack/react-start";
import { getCurrentUser } from "~/auth";
import { sql } from "~/db";

export const FREE_TIER_LIMIT = 3;

export const STRIPE_PAYMENT_LINKS: Record<string, string> = {
  pro_monthly: "https://buy.stripe.com/00wcN56pB9235T54HzfnO0b",
  pro_annual: "https://buy.stripe.com/bJe4gz9BN5PR4P15LDfnO0c",
  team: "https://buy.stripe.com/00wcN515h5PR95hde5fnO0d",
};

export type SubscriptionTier = "free" | "pro" | "team";
export type SubscriptionStatus = "active" | "canceled" | "past_due";

export interface Subscription {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  stripe_session_id: string | null;
  status: SubscriptionStatus;
  analyses_used_this_month: number;
  created_at: string;
  updated_at: string;
}

export const getUserSubscription = createServerFn({ method: "GET" }).handler(
  async (): Promise<Subscription | null> => {
    const user = await getCurrentUser();
    if (!user) return null;
    try {
      const db = sql();
      const rows = await db`
        SELECT id, user_id, tier, stripe_session_id, status, 
               analyses_used_this_month, created_at, updated_at
        FROM subscriptions WHERE user_id = ${user.id} LIMIT 1`;
      if (rows.length === 0) return null;
      const s = rows[0];
      return {
        id: s.id, user_id: s.user_id, tier: s.tier,
        stripe_session_id: s.stripe_session_id, status: s.status,
        analyses_used_this_month: s.analyses_used_this_month,
        created_at: String(s.created_at), updated_at: String(s.updated_at),
      };
    } catch { return null; }
  }
);

export const createCheckoutSession = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as { tier?: string };
    if (!d.tier || !["pro_monthly", "pro_annual", "team"].includes(d.tier))
      throw new Error("Invalid subscription tier.");
    return { tier: d.tier as "pro_monthly" | "pro_annual" | "team" };
  })
  .handler(async ({ data }) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("You must be logged in to subscribe.");
    return { url: STRIPE_PAYMENT_LINKS[data.tier] };
  });

export const upgradeSubscription = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as { tier?: string };
    if (!d.tier || !["pro", "team"].includes(d.tier))
      throw new Error("Invalid tier.");
    return { tier: d.tier as "pro" | "team" };
  })
  .handler(async ({ data }) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("You must be logged in.");
    const db = sql();
    await db`
      INSERT INTO subscriptions (user_id, tier, status, analyses_used_this_month)
      VALUES (${user.id}, ${data.tier}, 'active', 0)
      ON CONFLICT (user_id)
      DO UPDATE SET tier = ${data.tier}, status = 'active', updated_at = now()`;
    return { success: true, tier: data.tier };
  });

export const checkUploadLimit = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ allowed: boolean; tier: SubscriptionTier; used: number; limit: number }> => {
    const user = await getCurrentUser();
    if (!user) return { allowed: false, tier: "free", used: 0, limit: FREE_TIER_LIMIT };
    try {
      const db = sql();
      const rows = await db`
        SELECT tier, analyses_used_this_month FROM subscriptions WHERE user_id = ${user.id}`;
      const tier: SubscriptionTier = rows.length > 0 ? rows[0].tier : "free";
      const used = rows.length > 0 ? rows[0].analyses_used_this_month : 0;
      if (tier === "pro" || tier === "team")
        return { allowed: true, tier, used, limit: Infinity };
      return { allowed: used < FREE_TIER_LIMIT, tier, used, limit: FREE_TIER_LIMIT };
    } catch {
      return { allowed: false, tier: "free", used: 0, limit: FREE_TIER_LIMIT };
    }
  }
);

export const incrementAnalysisCount = createServerFn({ method: "POST" }).handler(async () => {
  const user = await getCurrentUser();
  if (!user) return;
  try {
    const db = sql();
    await db`
      INSERT INTO subscriptions (user_id, tier, status, analyses_used_this_month)
      VALUES (${user.id}, 'free', 'active', 1)
      ON CONFLICT (user_id)
      DO UPDATE SET analyses_used_this_month = subscriptions.analyses_used_this_month + 1,
                    updated_at = now()`;
  } catch {}
});
