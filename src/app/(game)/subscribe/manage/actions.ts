"use server";

import { headers } from "next/headers";
import { auth } from "~/lib/auth.server";
import { isAdmin } from "~/lib/admin";
import { getBaseUrl } from "~/lib/app-url";
import { getStripe } from "../../../../../lib/stripe";
import { db } from "../../../../../data/db";
import { user } from "../../../../../data/schema";
import { eq } from "drizzle-orm";

/**
 * Create a Stripe Customer Portal session so the user can manage their
 * subscription (cancel, update payment method, view invoices).
 * Admins use the test Stripe account, matching how their subscription
 * was originally created.
 */
export async function createPortalSession(): Promise<{
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
    const [existing] = await db
      .select({ stripeCustomerId: user.stripeCustomerId })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (!existing?.stripeCustomerId) {
      return { url: null, error: "No subscription found" };
    }

    const stripe = getStripe(useTestMode);
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: existing.stripeCustomerId,
      return_url: `${getBaseUrl()}/player`,
    });

    return { url: portalSession.url };
  } catch (err) {
    console.error("Portal session creation failed:", err);
    return {
      url: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}


