import { db } from "../data/db";
import { userRank } from "../data/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getActiveSeason } from "./seasons";

// ─── Rank Configuration ──────────────────────────────────────────────────────

export const RANKS = [
  "bronze",
  "silver",
  "gold",
  "platinum",
  "diamond",
  "legend",
] as const;
export type Rank = (typeof RANKS)[number];

/** Stars required to advance from each rank */
export const STARS_PER_RANK: Record<Rank, number> = {
  bronze: 3,
  silver: 4,
  gold: 5,
  platinum: 5,
  diamond: 5,
  legend: Infinity, // Legend doesn't advance via stars
};

/** Whether losing a match can cost stars at this rank */
export const CAN_LOSE_STARS: Record<Rank, boolean> = {
  bronze: false, // Bronze exempt from star loss
  silver: true,
  gold: true,
  platinum: true,
  diamond: true,
  legend: false, // Legend uses numbered ranking, not stars
};

/** Get the next rank above the given rank, or null if Legend */
export function nextRank(rank: Rank): Rank | null {
  const idx = RANKS.indexOf(rank);
  return idx < RANKS.length - 1 ? RANKS[idx + 1] : null;
}

/** Get the rank below, or null if Bronze */
export function prevRank(rank: Rank): Rank | null {
  const idx = RANKS.indexOf(rank);
  return idx > 0 ? RANKS[idx - 1] : null;
}

/** Numeric rank index for ordering (0=bronze, 5=legend) */
export function rankIndex(rank: Rank): number {
  return RANKS.indexOf(rank);
}

/** Compare two rank states — returns positive if a is higher */
export function compareRank(
  aRank: Rank,
  aStars: number,
  bRank: Rank,
  bStars: number,
): number {
  const rankDiff = rankIndex(aRank) - rankIndex(bRank);
  if (rankDiff !== 0) return rankDiff;
  return aStars - bStars;
}

// ─── User Rank Queries ───────────────────────────────────────────────────────

/** Get or create a user's rank for the active season */
export async function getUserRank(userId: string, seasonId: string) {
  const [existing] = await db
    .select()
    .from(userRank)
    .where(
      and(eq(userRank.userId, userId), eq(userRank.seasonId, seasonId)),
    )
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(userRank)
    .values({
      userId,
      seasonId,
      rank: "bronze",
      stars: 0,
      peakRank: "bronze",
      peakStars: 0,
      mmr: 1000,
    })
    .returning();

  return created;
}

/** Get user's rank for the active season, or null if no active season */
export async function getActiveRank(userId: string) {
  const activeSeason = await getActiveSeason();
  if (!activeSeason) return null;
  return getUserRank(userId, activeSeason.id);
}

// ─── Rank Progression ────────────────────────────────────────────────────────

export type RankUpdateResult = {
  previousRank: Rank;
  previousStars: number;
  newRank: Rank;
  newStars: number;
  rankedUp: boolean;
  rankedDown: boolean;
  reachedLegend: boolean;
  legendPosition?: number;
  mmrChange: number;
};

/**
 * Process a ranked match result.
 * Win: +1 star (advance rank if full). Loss: -1 star (demote if 0, bronze exempt).
 * Also updates MMR, games played, W/L counts, and peak rank.
 */
export async function processRankedResult(
  userId: string,
  seasonId: string,
  won: boolean,
): Promise<RankUpdateResult> {
  const rank = await getUserRank(userId, seasonId);
  const currentRank = rank.rank as Rank;
  let newRank: Rank = currentRank;
  let newStars = rank.stars;
  let rankedUp = false;
  let rankedDown = false;
  let reachedLegend = false;
  let legendPosition: number | undefined;

  // MMR adjustment
  const mmrChange = won ? 25 : -25;
  const newMmr = Math.max(0, rank.mmr + mmrChange);

  if (won) {
    newStars += 1;
    const maxStars = STARS_PER_RANK[currentRank];

    // Check for rank-up
    if (newStars >= maxStars && currentRank !== "legend") {
      const next = nextRank(currentRank);
      if (next) {
        newRank = next;
        newStars = 0;
        rankedUp = true;

        // Check if reaching Legend
        if (next === "legend") {
          reachedLegend = true;
          // Count existing legends to determine position
          const [legendCount] = await db
            .select({ count: sql<number>`count(*)` })
            .from(userRank)
            .where(
              and(
                eq(userRank.seasonId, seasonId),
                eq(userRank.rank, "legend"),
              ),
            );
          legendPosition = (legendCount?.count ?? 0) + 1;
        }
      }
    }
  } else {
    // Loss
    if (CAN_LOSE_STARS[currentRank] && currentRank !== "legend") {
      newStars -= 1;

      // Check for rank-down
      if (newStars < 0) {
        const prev = prevRank(currentRank);
        if (prev) {
          newRank = prev;
          newStars = STARS_PER_RANK[prev] - 1;
          rankedDown = true;
        } else {
          newStars = 0; // Can't go below bronze 0
        }
      }
    }
  }

  // Update peak rank
  let peakRank = rank.peakRank as Rank;
  let peakStars = rank.peakStars;
  if (compareRank(newRank, newStars, peakRank, peakStars) > 0) {
    peakRank = newRank;
    peakStars = newStars;
  }

  // Persist
  await db
    .update(userRank)
    .set({
      rank: newRank,
      stars: newStars,
      peakRank,
      peakStars,
      legendEntry: reachedLegend ? legendPosition : rank.legendEntry,
      gamesPlayed: rank.gamesPlayed + 1,
      wins: won ? rank.wins + 1 : rank.wins,
      losses: won ? rank.losses : rank.losses + 1,
      mmr: newMmr,
    })
    .where(eq(userRank.id, rank.id));

  return {
    previousRank: currentRank,
    previousStars: rank.stars,
    newRank,
    newStars,
    rankedUp,
    rankedDown,
    reachedLegend,
    legendPosition,
    mmrChange,
  };
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export type LeaderboardEntry = {
  userId: string;
  rank: Rank;
  stars: number;
  legendEntry: number | null;
  wins: number;
  losses: number;
  mmr: number;
};

/** Get ranked leaderboard for a season (top players by rank then MMR) */
export async function getLeaderboard(
  seasonId: string,
  limit = 50,
): Promise<LeaderboardEntry[]> {
  const rows = await db
    .select({
      userId: userRank.userId,
      rank: userRank.rank,
      stars: userRank.stars,
      legendEntry: userRank.legendEntry,
      wins: userRank.wins,
      losses: userRank.losses,
      mmr: userRank.mmr,
    })
    .from(userRank)
    .where(eq(userRank.seasonId, seasonId))
    .orderBy(desc(userRank.mmr))
    .limit(limit);

  return rows.map((r) => ({ ...r, rank: r.rank as Rank }));
}

// ─── Rank Reward Milestones ──────────────────────────────────────────────────

export type RankMilestone = {
  rank: Rank;
  rewards: {
    type: string;
    description: string;
    credits: number;
  };
};

export const RANK_MILESTONES: RankMilestone[] = [
  { rank: "bronze", rewards: { type: "profile_border", description: "Bronze Border", credits: 50 } },
  { rank: "silver", rewards: { type: "board_theme", description: "Silver Board Theme", credits: 100 } },
  { rank: "gold", rewards: { type: "skin", description: "Common Cinderling Skin", credits: 150 } },
  { rank: "platinum", rewards: { type: "vfx_set", description: "Rare VFX Set", credits: 200 } },
  { rank: "diamond", rewards: { type: "skin", description: "Exclusive Diamond Skin", credits: 300 } },
  { rank: "legend", rewards: { type: "title", description: "Legend Title + Animated Border", credits: 500 } },
];

/** Get milestone for a rank */
export function getMilestone(rank: Rank): RankMilestone | undefined {
  return RANK_MILESTONES.find((m) => m.rank === rank);
}
