"use server";

import { headers } from "next/headers";
import { auth } from "~/lib/auth.server";
import { isAdmin } from "~/lib/admin";
import { getStripe, getPremiumPriceId } from "../../../../lib/stripe";
import { db } from "../../../../data/db";
import { user } from "../../../../data/schema";
import { eq } from "drizzle-orm";

/**
 * Create a Stripe Checkout Session for the Cinderling Premium subscription.
 * Admins are routed through the test Stripe account so they can exercise the
 * full payment flow without touching live billing.
 * Returns the checkout URL to redirect the user to.
 */
export async function createCheckoutSession(): Promise<{
  url: string | null;
  error?: string;
}> {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session?.user) {
    return { url: null, error: "Not authenticated" };
  }

  const useTestMode = isAdmin(session);

  try {
    const stripe = getStripe(useTestMode);
    const priceId = await getPremiumPriceId(useTestMode);

    // Check if user already has a Stripe customer ID
    const [existing] = await db
      .select({
        stripeCustomerId: user.stripeCustomerId,
        subscriptionStatus: user.subscriptionStatus,
      })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    // Don't create a new checkout if already subscribed
    if (existing?.subscriptionStatus === "active") {
      return { url: null, error: "Already subscribed" };
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${getBaseUrl()}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getBaseUrl()}/subscribe/cancel`,
      client_reference_id: session.user.id,
      customer_email: existing?.stripeCustomerId
        ? undefined
        : session.user.email,
      customer: existing?.stripeCustomerId ?? undefined,
      subscription_data: {
        metadata: {
          userId: session.user.id,
        },
      },
    });

    return { url: checkoutSession.url };
  } catch (err) {
    console.error("Checkout session creation failed:", err);
    return {
      url: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  // VERCEL_PROJECT_PRODUCTION_URL is hostname-only (no scheme)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "https://vellymon.game";
}
