"use server";

import { headers } from "next/headers";
import { auth } from "~/lib/auth.server";
import { requireAdmin } from "~/lib/admin";
import { db } from "../../../../../data/db";
import { season, seasonTrack } from "../../../../../data/schema";
import { eq } from "drizzle-orm";

export type RewardDef = {
  type: "credits" | "cosmetic" | "title" | "vellymon";
  description: string;
  amount?: number;
  cosmeticId?: string;
};

export type TierDef = {
  tier: number;
  freeReward: RewardDef | null;
  premiumReward: RewardDef | null;
};

export type CreateSeasonInput = {
  name: string;
  startDate: string; // ISO string
  endDate: string;
  newCinderlingId?: number;
  tiers: TierDef[];
};

/** Create a new season with its track tiers */
export async function createSeasonAction(
  input: CreateSeasonInput,
): Promise<{ success: boolean; seasonId?: string; error?: string }> {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  requireAdmin(session);

  if (!input.name || !input.startDate || !input.endDate) {
    return { success: false, error: "Name, start date, and end date are required" };
  }

  if (input.tiers.length === 0 || input.tiers.length > 25) {
    return { success: false, error: "Seasons must have 1-25 tiers" };
  }

  const [created] = await db
    .insert(season)
    .values({
      name: input.name,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      status: "upcoming",
      newCinderlingId: input.newCinderlingId ?? null,
    })
    .returning();

  // Insert all track tiers
  if (input.tiers.length > 0) {
    await db.insert(seasonTrack).values(
      input.tiers.map((t) => ({
        seasonId: created.id,
        tier: t.tier,
        freeReward: t.freeReward,
        premiumReward: t.premiumReward,
      })),
    );
  }

  return { success: true, seasonId: created.id };
}

/** Activate a season (set status to 'active', archive any currently active season) */
export async function activateSeasonAction(
  seasonId: string,
): Promise<{ success: boolean; error?: string }> {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  requireAdmin(session);

  // Archive any currently active season
  const active = await db
    .select()
    .from(season)
    .where(eq(season.status, "active"));

  for (const s of active) {
    await db
      .update(season)
      .set({ status: "archived" })
      .where(eq(season.id, s.id));
  }

  // Activate the target season
  await db
    .update(season)
    .set({ status: "active" })
    .where(eq(season.id, seasonId));

  return { success: true };
}

/** Archive a season */
export async function archiveSeasonAction(
  seasonId: string,
): Promise<{ success: boolean }> {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  requireAdmin(session);

  await db
    .update(season)
    .set({ status: "archived" })
    .where(eq(season.id, seasonId));

  return { success: true };
}

/** List all seasons */
export async function listSeasonsAction() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  requireAdmin(session);

  return db.select().from(season).orderBy(season.createdAt);
}

/** Get season detail with tracks */
export async function getSeasonDetailAction(seasonId: string) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  requireAdmin(session);

  const [s] = await db
    .select()
    .from(season)
    .where(eq(season.id, seasonId))
    .limit(1);

  if (!s) return null;

  const tracks = await db
    .select()
    .from(seasonTrack)
    .where(eq(seasonTrack.seasonId, seasonId))
    .orderBy(seasonTrack.tier);

  return { ...s, tracks };
}

/**
 * Generate a default 25-tier track template.
 * Distributes rewards across tiers:
 * - Credits at most tiers (25-100 per tier)
 * - Cosmetic slots at tiers 5, 10, 15, 20, 25
 * - New cinderling at free tier 5 (unlocked day 15 for free players)
 * - Premium launch skin at tier 15
 */
export async function generateDefaultTrack(): Promise<TierDef[]> {
  const tiers: TierDef[] = [];

  for (let i = 1; i <= 25; i++) {
    let freeReward: RewardDef | null = null;
    let premiumReward: RewardDef | null = null;

    // Free track rewards
    if (i === 5) {
      freeReward = {
        type: "vellymon",
        description: "New Season Cinderling (unlocks day 15)",
      };
    } else if (i % 5 === 0) {
      freeReward = {
        type: "cosmetic",
        description: `Tier ${i} cosmetic`,
      };
    } else {
      freeReward = {
        type: "credits",
        description: `${25 + i * 3} credits`,
        amount: 25 + i * 3,
      };
    }

    // Premium track rewards
    if (i === 15) {
      premiumReward = {
        type: "cosmetic",
        description: "Exclusive launch skin for new cinderling",
      };
    } else if (i === 25) {
      premiumReward = {
        type: "title",
        description: "Season Champion",
      };
    } else if (i % 5 === 0) {
      premiumReward = {
        type: "cosmetic",
        description: `Premium tier ${i} cosmetic`,
      };
    } else {
      premiumReward = {
        type: "credits",
        description: `${50 + i * 5} credits`,
        amount: 50 + i * 5,
      };
    }

    tiers.push({ tier: i, freeReward, premiumReward });
  }

  return tiers;
}
