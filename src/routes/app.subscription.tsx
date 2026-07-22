import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getCurrentUser } from "~/auth";
import { sql } from "~/db";
import {
  FREE_TIER_LIMIT,
  STRIPE_PAYMENT_LINKS,
  STRIPE_CUSTOMER_PORTAL_URL,
} from "~/lib/subscription";

export const Route = createFileRoute("/app/subscription")({
  component: SubscriptionPage,
});

// --- Types ---

type SubscriptionTier = "free" | "pro" | "team";

interface SubData {
  tier: SubscriptionTier;
  status: string;
  analysesUsed: number;
  analysesLimit: number;
  currentMonth: string;
}

// --- Server Functions ---

const getSubscriptionData = createServerFn({ method: "GET" }).handler(
  async (): Promise<SubData> => {
    const user = await getCurrentUser();
    if (!user) {
      return {
        tier: "free",
        status: "inactive",
        analysesUsed: 0,
        analysesLimit: FREE_TIER_LIMIT,
        currentMonth: new Date().toISOString().slice(0, 7),
      };
    }

    try {
      const db = sql();
      const month = new Date().toISOString().slice(0, 7); // "2026-07"

      const rows = await db`
        SELECT tier, status, analyses_used_this_month, current_month
        FROM subscriptions WHERE user_id = ${user.id} LIMIT 1`;

      if (rows.length === 0) {
        return {
          tier: "free",
          status: "active",
          analysesUsed: 0,
          analysesLimit: FREE_TIER_LIMIT,
          currentMonth: month,
        };
      }

      const s = rows[0];
      const tier: SubscriptionTier = s.tier || "free";
      const dbMonth = s.current_month;
      const used = dbMonth === month ? Number(s.analyses_used_this_month || 0) : 0;

      const limit = tier === "free" ? FREE_TIER_LIMIT : Infinity;

      return {
        tier,
        status: s.status || "active",
        analysesUsed: used,
        analysesLimit: limit,
        currentMonth: month,
      };
    } catch {
      return {
        tier: "free",
        status: "active",
        analysesUsed: 0,
        analysesLimit: FREE_TIER_LIMIT,
        currentMonth: month,
      };
    }
  },
);

// --- Page Component ---

function SubscriptionPage() {
  const [sub, setSub] = useState<SubData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSubscriptionData()
      .then(setSub)
      .catch(() =>
        setSub({
          tier: "free",
          status: "active",
          analysesUsed: 0,
          analysesLimit: FREE_TIER_LIMIT,
          currentMonth: new Date().toISOString().slice(0, 7),
        }),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  if (!sub) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-center text-slate-400">
          Something went wrong loading your subscription. Please try again.
        </p>
      </main>
    );
  }

  const tierLabel =
    sub.tier === "pro"
      ? "Pro"
      : sub.tier === "team"
        ? "Team / Coach"
        : "Free";

  const tierGradient =
    sub.tier === "pro" || sub.tier === "team"
      ? "from-amber-500 to-orange-500"
      : "from-slate-600 to-slate-500";

  const usagePercent =
    sub.tier === "free"
      ? Math.min(100, Math.round((sub.analysesUsed / sub.analysesLimit) * 100))
      : 0;

  const usageLabel =
    sub.tier === "free"
      ? `${sub.analysesUsed} / ${sub.analysesLimit}`
      : `${sub.analysesUsed} (unlimited)`;

  const monthLabel = new Date(sub.currentMonth + "-01").toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" },
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/app"
          className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 transition-colors hover:text-white"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">
          Subscription
        </h1>
        <p className="mt-2 text-slate-400">
          Manage your plan and view your usage.
        </p>
      </div>

      {/* Current Plan Card */}
      <div className="mb-8 rounded-2xl border border-white/5 bg-slate-900/60 p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${tierGradient} text-lg`}
              >
                {sub.tier === "pro" ? "⚡" : sub.tier === "team" ? "🏟️" : "🎯"}
              </span>
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {tierLabel} Plan
                </h2>
                <p className="text-sm text-slate-400">
                  Status:{" "}
                  <span
                    className={
                      sub.status === "active"
                        ? "text-emerald-400"
                        : sub.status === "past_due"
                          ? "text-red-400"
                          : "text-amber-400"
                    }
                  >
                    {sub.status === "active"
                      ? "Active"
                      : sub.status === "past_due"
                        ? "Past Due"
                        : sub.status === "canceled"
                          ? "Canceled"
                          : sub.status}
                  </span>
                </p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-extrabold text-white">
              {sub.tier === "free"
                ? "$0"
                : sub.tier === "pro"
                  ? "$12"
                  : "$39"}
            </p>
            <p className="text-sm text-slate-400">
              {sub.tier === "free" ? "/mo" : "/mo"}
            </p>
          </div>
        </div>
      </div>

      {/* Usage Card */}
      <div className="mb-8 rounded-2xl border border-white/5 bg-slate-900/60 p-6 sm:p-8">
        <h3 className="mb-4 text-lg font-semibold text-white">
          Usage — {monthLabel}
        </h3>
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="text-slate-400">Analyses used</span>
          <span className="font-medium text-white">{usageLabel}</span>
        </div>
        {sub.tier === "free" && (
          <>
            <div className="mb-2 h-3 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full transition-all ${
                  usagePercent >= 100
                    ? "bg-red-500"
                    : usagePercent >= 66
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              {usagePercent >= 100
                ? "You've reached your monthly limit. Upgrade for unlimited analyses."
                : `${FREE_TIER_LIMIT - sub.analysesUsed} of ${FREE_TIER_LIMIT} free analyses remaining this month.`}
            </p>
          </>
        )}
        {sub.tier !== "free" && (
          <p className="text-xs text-slate-500">
            Paid plans include unlimited analyses.
          </p>
        )}
      </div>

      {/* Action Section */}
      <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-6 sm:p-8">
        <h3 className="mb-4 text-lg font-semibold text-white">
          {sub.tier === "free" ? "Upgrade Your Plan" : "Manage Subscription"}
        </h3>

        {sub.tier === "free" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Pro Monthly */}
            <a
              href={STRIPE_PAYMENT_LINKS.pro_monthly}
              target="_blank"
              rel="noopener"
              className="flex flex-col rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 transition-all hover:border-amber-500/50 hover:bg-amber-500/10"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold text-white">Pro</span>
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-300">
                  Recommended
                </span>
              </div>
              <p className="mb-3 text-sm text-slate-400">
                Unlimited analyses, deep breakdowns, progress tracking.
              </p>
              <div className="mb-3">
                <span className="text-2xl font-bold text-white">$12</span>
                <span className="text-slate-400">/mo</span>
              </div>
              <span className="mt-auto inline-block rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-center text-sm font-semibold text-white transition-all hover:brightness-110">
                Start Free Trial
              </span>
            </a>

            {/* Team */}
            <a
              href={STRIPE_PAYMENT_LINKS.team}
              target="_blank"
              rel="noopener"
              className="flex flex-col rounded-xl border border-white/10 bg-slate-800/40 p-5 transition-all hover:border-white/20 hover:bg-slate-800/60"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold text-white">
                  Team / Coach
                </span>
              </div>
              <p className="mb-3 text-sm text-slate-400">
                Everything in Pro, manage up to 20 players, team reports.
              </p>
              <div className="mb-3">
                <span className="text-2xl font-bold text-white">$39</span>
                <span className="text-slate-400">/mo</span>
              </div>
              <span className="mt-auto inline-block rounded-full bg-white/10 px-4 py-2 text-center text-sm font-semibold text-white transition-all hover:bg-white/20">
                Start Free Trial
              </span>
            </a>

            {/* Pro Annual */}
            <a
              href={STRIPE_PAYMENT_LINKS.pro_annual}
              target="_blank"
              rel="noopener"
              className="col-span-full flex flex-col rounded-xl border border-white/10 bg-slate-800/40 p-5 transition-all hover:border-white/20 hover:bg-slate-800/60"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold text-white">Pro Annual</span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
                  Save 31%
                </span>
              </div>
              <p className="mb-3 text-sm text-slate-400">
                All Pro features, billed yearly. Best value.
              </p>
              <div className="mb-3">
                <span className="text-2xl font-bold text-white">$99</span>
                <span className="text-slate-400">/yr</span>
              </div>
              <span className="mt-auto inline-block rounded-full bg-white/10 px-4 py-2 text-center text-sm font-semibold text-white transition-all hover:bg-white/20">
                Start Free Trial
              </span>
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              You're on the <strong className="text-white">{tierLabel}</strong>{" "}
              plan. To manage your billing, update payment methods, or cancel,
              visit the Stripe customer portal.
            </p>
            <a
              href={STRIPE_CUSTOMER_PORTAL_URL}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/20 transition-all hover:brightness-110"
            >
              Manage Subscription
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                />
              </svg>
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
