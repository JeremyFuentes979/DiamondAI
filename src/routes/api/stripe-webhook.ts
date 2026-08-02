import { createAPIFileRoute } from "@tanstack/react-start/api";
import { handleStripeWebhook } from "~/lib/stripe-webhook";

export const APIRoute = createAPIFileRoute("/api/stripe-webhook")({
  POST: async ({ request }) => {
    return handleStripeWebhook(request);
  },
});
