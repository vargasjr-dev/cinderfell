"use server";

import { headers } from "next/headers";
import { auth } from "~/lib/auth.server";
import {
  getMatchGameState,
  submitMatchCommands,
  concedeMatch,
} from "~/data/gameEngine.server";
import { db } from "../../../../../../data/db";
import { matchStats } from "../../../../../../data/schema";
import { eq, and, desc, gte, lt, count } from "drizzle-orm";

import { getQuestsCompletedAroundMatch } from "../../../../../../lib/questService";
import type { QuestWithProgress } from "../../../../../../lib/questService";

// Command type for the play page — direction as orientation-agnostic Vec2
export type PlayCommand = {
  type: "move" | "attack" | "harvest";
  cinderlingUuid: string;
  /** Cardinal unit vector in game space, e.g. {dx:1,dy:0} for right */
  vec: { dx: number; dy: number };
  attackIndex?: number;
};

export async function getGameStateAction(matchUuid: string) {
  return getMatchGameState(matchUuid);
}

export async function submitCommandsAction(
  matchUuid: string,
  commands: PlayCommand[],
  asTeamId?: 1 | 2,
) {
  const headersList = await headers();
  const session = (await auth.api.getSession({ headers: headersList }))!;

  // Map to engine Command type
  const engineCommands = commands.map((c) => ({
    type: c.type,
    cinderlingUuid: c.cinderlingUuid,
    vec: c.vec,
    attackIndex: c.attackIndex,
  }));

  return submitMatchCommands(
    matchUuid,
    session.user.id,
    engineCommands as never[],
    asTeamId,
  );
}

export async function concedeAction(matchUuid: string, asTeamId?: 1 | 2) {
  const headersList = await headers();
  const session = (await auth.api.getSession({ headers: headersList }))!;
  return concedeMatch(matchUuid, session.user.id, asTeamId);
}

// ─── Cinderling info (reads from library + power registry at runtime) ──────────

export type CinderlingInfo = {
  flavor: string;
  powerName: string;
  powerDesc: string;
};

/**
 * Look up display metadata for cinderlings by name.
 * Reads from the server-side library + power registry — always in sync.
 */
export async function getCinderlingInfoAction(
  names: string[],
): Promise<Record<string, CinderlingInfo>> {
  const { CINDERLING_LIBRARY } =
    await import("../../../../../../server/cinderlings");
  await import("../../../../../../server/powers");
  const { getPower } = await import("../../../../../../server/specialPowers");
  const result: Record<string, CinderlingInfo> = {};
  for (const name of names) {
    const template = CINDERLING_LIBRARY.find((v) => v.name === name);
    if (!template) continue;
    const power = template.specialPowerId
      ? getPower(template.specialPowerId)
      : undefined;
    result[name] = {
      flavor: template.flavor ?? "",
      powerName: power?.name ?? "",
      powerDesc: power?.description ?? "",
    };
  }
  return result;
}

// ─── Match Rewards ────────────────────────────────────────────────────────────

export type MatchRewards = {
  result: "win" | "loss" | null;
  xpAwarded: number;
  creditsAwarded: number;
  /** e.g. "Silver ★★" — null if not a ranked match or rank data unavailable */
  rankChange: string | null;
  isSparring: boolean;
  /** Daily quests completed by this match — empty array if none */
  newlyCompletedQuests: QuestWithProgress[];
};

/**
 * Fetch progression rewards for the current user in a completed match.
 * Reads the matchStats row written by writeMatchStats on game-over.
 * Returns null if stats haven't been written yet (slight async lag after game-over).
 */
export async function getMatchRewardsAction(
  matchUuid: string,
): Promise<MatchRewards | null> {
  const headersList = await headers();
  const session = (await auth.api.getSession({ headers: headersList }))!;

  const [row] = await db
    .select()
    .from(matchStats)
    .where(
      and(
        eq(matchStats.gameSessionUuid, matchUuid),
        eq(matchStats.userId, session.user.id),
      ),
    )
    .orderBy(desc(matchStats.completedAt))
    .limit(1);

  if (!row) return null;

  const won = row.result === "win";
  const isSparring = row.isSparring;

  // Currency awarded: 10 participation + 25 win bonus (PvP only; nothing for sparring)
  const creditsAwarded = isSparring ? 0 : 10 + (won ? 25 : 0);

  // XP awarded: 0 for sparring; 1.5x for ranked PvP
  const baseXp = won ? 100 : 50;
  let xpAwarded = isSparring ? 0 : Math.round(baseXp * 1.5);

  // Detect first-win-today: if exactly 1 win exists in matchStats today, this was it
  // Only applies to ranked PvP matches, not sparring
  if (won && !isSparring) {
    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);

    const [{ value: winsToday }] = await db
      .select({ value: count() })
      .from(matchStats)
      .where(
        and(
          eq(matchStats.userId, session.user.id),
          eq(matchStats.result, "win"),
          gte(matchStats.completedAt, todayStart),
          lt(matchStats.completedAt, tomorrowStart),
        ),
      );

    if (winsToday === 1) {
      xpAwarded += 50; // first-win daily bonus
    }
  }

  // Fetch newly completed quests
  const newlyCompletedQuests = await getQuestsCompletedAroundMatch(
    session.user.id,
    row.completedAt,
  );

  return {
    result: row.result as "win" | "loss",
    xpAwarded,
    creditsAwarded,
    rankChange: null, // Phase 12 item 1 will surface this from userRank
    isSparring,
    newlyCompletedQuests,
  };
}
