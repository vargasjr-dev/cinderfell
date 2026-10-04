import { db } from "../../data/db";
import { user, matchStats, cinderlingInstance } from "../../data/schema";
import { eq, and, count, sql } from "drizzle-orm";
import { getActiveRank, type Rank } from "../../lib/ranked";

export type PlayerProfile = {
  userId: string;
  name: string;
  username: string | null;
  image: string | null;
  isSubscriber: boolean;
  joinedAt: Date;
  rank: Rank;
  stars: number;
  mmr: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number; // 0–100 percent
  rosterSize: number;
  /** Total ranked + sparring matches from matchStats */
  totalMatches: number;
};

const getPlayerProfile = async (
  userId: string,
): Promise<PlayerProfile | null> => {
  try {
    // Basic user info
    const [u] = await db
      .select({
        id: user.id,
        name: user.name,
        username: user.username,
        image: user.image,
        subscriptionStatus: user.subscriptionStatus,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!u) return null;

    // Aggregate match stats from matchStats table
    const [stats] = await db
      .select({
        totalMatches: count(),
        wins: sql<number>`SUM(CASE WHEN ${matchStats.result} = 'win' THEN 1 ELSE 0 END)::int`,
        losses: sql<number>`SUM(CASE WHEN ${matchStats.result} = 'loss' THEN 1 ELSE 0 END)::int`,
      })
      .from(matchStats)
      .where(eq(matchStats.userId, userId));

    const totalMatches = stats?.totalMatches ?? 0;
    const wins = stats?.wins ?? 0;
    const losses = stats?.losses ?? 0;
    const winRate =
      totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

    // Roster size
    const [rosterRow] = await db
      .select({ count: count() })
      .from(cinderlingInstance)
      .where(eq(cinderlingInstance.userId, userId));
    const rosterSize = rosterRow?.count ?? 0;

    // Active rank
    const activeRank = await getActiveRank(userId);
    const rank = (activeRank?.rank ?? "bronze") as Rank;
    const stars = activeRank?.stars ?? 0;
    const mmr = activeRank?.mmr ?? 1000;
    const gamesPlayed = activeRank?.gamesPlayed ?? 0;

    return {
      userId: u.id,
      name: u.name,
      username: u.username ?? null,
      image: u.image,
      isSubscriber: u.subscriptionStatus === "active",
      joinedAt: u.createdAt,
      rank,
      stars,
      mmr,
      gamesPlayed,
      wins,
      losses,
      winRate,
      rosterSize,
      totalMatches,
    };
  } catch (error) {
    console.error("Failed to get player profile:", error);
    return null;
  }
};

export default getPlayerProfile;
