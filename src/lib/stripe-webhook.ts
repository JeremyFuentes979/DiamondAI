import { sql } from "../db.ts";
import Stripe from "stripe";

function tierFromAmount(amount: number): string | null {
  if (amount === 2499) return "pro";
  if (amount === 19900) return "team";
  if (amount === 49900) return "academy";
  return null;
}

export async function handleStripeWebhook(request: Request): Promise<Response> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return new Response(
      JSON.stringify({ error: "Webhook secret not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response(
      JSON.stringify({ error: "Missing stripe-signature header" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
  let event: Stripe.Event;
  try {
    const body = Buffer.from(await request.arrayBuffer());
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(
      JSON.stringify({ error: "Invalid signature" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const email = session.customer_details?.email;
    const amount = session.amount_total;

    if (!email) {
      console.error("No email in checkout session");
      return new Response(
        JSON.stringify({ error: "No customer email in session" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (amount === null) {
      console.error("No amount_total in checkout session");
      return new Response(
        JSON.stringify({ error: "No amount in session" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const tier = tierFromAmount(amount);
    if (!tier) {
      console.error(`Unknown amount_total: ${amount} (expected 2499, 19900, or 49900)`);
      return new Response(
        JSON.stringify({ error: `Unknown tier for amount ${amount}` }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    try {
      const db = sql();
      const users = await db`SELECT id FROM users WHERE email = ${email.toLowerCase()}`;
      if (users.length === 0) {
        console.error(`No user found for email: ${email}`);
        return new Response(
          JSON.stringify({ error: "User not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        );
      }
      const userId = users[0].id as string;

      await db`
        INSERT INTO subscriptions (user_id, tier, status, analyses_used_this_month)
        VALUES (${userId}, ${tier}, 'active', 0)
        ON CONFLICT (user_id)
        DO UPDATE SET tier = ${tier}, status = 'active', updated_at = now()`;

      console.log(`Stripe webhook: upgraded ${email} (${userId}) to ${tier}`);
    } catch (err) {
      console.error("Failed to upgrade subscription:", err);
      return new Response(
        JSON.stringify({ error: "Database error" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  return new Response(
    JSON.stringify({ received: true }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
