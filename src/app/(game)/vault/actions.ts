"use server";

import { headers } from "next/headers";
import { auth } from "~/lib/auth.server";
import { db } from "../../../../data/db";
import { season, seasonTrack, cosmetic } from "../../../../data/schema";
import { eq, and } from "drizzle-orm";
import { isSubscriber } from "../../../../lib/subscription";
import { spendCredits, getBalance } from "../../../../lib/currency";

export type VaultItem = {
  seasonId: string;
  seasonName: string;
  tier: number;
  reward: {
    type: string;
    description: string;
    amount?: number;
    cosmeticId?: string;
  };
  creditCost: number;
};

export type VaultPageData = {
  subscribed: boolean;
  balance: number;
  items: VaultItem[];
};

/** Credit cost for vault items by reward type */
const VAULT_COSTS: Record<string, number> = {
  cosmetic: 75,
  title: 30,
  credits: 0, // Credit rewards aren't purchasable — they were the reward
  cinderling: 150,
};

function getVaultCost(rewardType: string): number {
  return VAULT_COSTS[rewardType] ?? 50;
}

export async function getVaultPageData(): Promise<VaultPageData> {
  const headersList = await headers();
  const session = (await auth.api.getSession({ headers: headersList }))!;

  const [subscribed, balance] = await Promise.all([
    isSubscriber(session.user.id),
    getBalance(session.user.id),
  ]);

  // Get all archived seasons with their premium track items
  const archivedSeasons = await db
    .select()
    .from(season)
    .where(eq(season.status, "archived"));

  const items: VaultItem[] = [];

  for (const s of archivedSeasons) {
    const tracks = await db
      .select()
      .from(seasonTrack)
      .where(eq(seasonTrack.seasonId, s.id))
      .orderBy(seasonTrack.tier);

    for (const t of tracks) {
      if (!t.premiumReward) continue;
      const reward = t.premiumReward as VaultItem["reward"];

      // Skip credit-type rewards (not purchasable)
      if (reward.type === "credits") continue;

      items.push({
        seasonId: s.id,
        seasonName: s.name,
        tier: t.tier,
        reward,
        creditCost: getVaultCost(reward.type),
      });
    }
  }

  return { subscribed, balance, items };
}

export type PurchaseResult =
  | { success: true; message: string }
  | { success: false; error: string };

export async function purchaseVaultItemAction(
  seasonId: string,
  tier: number,
): Promise<PurchaseResult> {
  const headersList = await headers();
  const session = (await auth.api.getSession({ headers: headersList }))!;

  // Must be subscriber
  const subscribed = await isSubscriber(session.user.id);
  if (!subscribed) {
    return { success: false, error: "Premium subscription required" };
  }

  // Find the track tier
  const [trackTier] = await db
    .select()
    .from(seasonTrack)
    .where(
      and(
        eq(seasonTrack.seasonId, seasonId),
        eq(seasonTrack.tier, tier),
      ),
    )
    .limit(1);

  if (!trackTier?.premiumReward) {
    return { success: false, error: "Item not found" };
  }

  const reward = trackTier.premiumReward as VaultItem["reward"];
  const cost = getVaultCost(reward.type);

  if (cost <= 0) {
    return { success: false, error: "This item cannot be purchased" };
  }

  // Check balance and spend
  const balance = await getBalance(session.user.id);
  if (balance < cost) {
    return {
      success: false,
      error: `Not enough credits (need ${cost}, have ${balance})`,
    };
  }

  // Deduct credits
  await spendCredits(session.user.id, cost, "purchase", `Vault: ${reward.description}`);

  // If it's a cosmetic, create a cosmetic record for the user
  if (reward.type === "cosmetic" || reward.type === "title") {
    await db.insert(cosmetic).values({
      userId: session.user.id,
      type: reward.type === "title" ? "title" : "skin",
      name: reward.description,
      source: "seasonal",
      seasonId: seasonId,
      metadata: { vaultPurchase: true },
    });
  }

  return {
    success: true,
    message: `Purchased "${reward.description}" for ${cost} 💰`,
  };
}
