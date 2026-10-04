import { db } from "../data/db";
import { user } from "../data/schema";
import { eq } from "drizzle-orm";

// ─── Subscription Helpers ────────────────────────────────────────────────────

export type SubscriptionStatus = "none" | "active" | "past_due" | "canceled";

/**
 * Check if a user has an active subscription.
 */
export async function isSubscriber(userId: string): Promise<boolean> {
  const [result] = await db
    .select({ subscriptionStatus: user.subscriptionStatus })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return result?.subscriptionStatus === "active";
}

/**
 * Get full subscription info for a user.
 */
export async function getSubscriptionInfo(userId: string) {
  const [result] = await db
    .select({
      subscriptionStatus: user.subscriptionStatus,
      subscriptionId: user.subscriptionId,
      stripeCustomerId: user.stripeCustomerId,
      subscribedAt: user.subscribedAt,
      subscriptionStreakMonths: user.subscriptionStreakMonths,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return result ?? null;
}

/**
 * Guard that throws if user is not a subscriber.
 * Use in server actions / API routes that require premium access.
 */
export async function requireSubscriber(userId: string): Promise<void> {
  const subscribed = await isSubscriber(userId);
  if (!subscribed) {
    throw new Error("This feature requires a Cinderling Premium subscription.");
  }
}
