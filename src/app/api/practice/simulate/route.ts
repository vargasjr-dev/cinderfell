/**
 * POST /api/practice/simulate
 *
 * User-facing automated simulation: runs two AI profiles against each other
 * server-side and returns a spectatable replay link.
 *
 * Auth: session required + active subscription.
 * Rate limit: DAILY_SIMULATE_LIMIT simulations per user per 24 hours.
 * Cost tracking: records triggeredByUserId + simulationMs on the matchSnapshot row.
 *
 * Body: { p1ProfileId: string; p2ProfileId: string }
 * Response: { matchId, spectateUrl, winner, turns, simulationMs, remaining, limit }
 */

import { headers } from "next/headers";
import { auth } from "~/lib/auth.server";
import { isSubscriber } from "../../../../../lib/subscription";
import { db } from "../../../../../data/db";
import { aiProfile, matchSnapshot } from "../../../../../data/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { CINDERLING_LIBRARY } from "../../../../../server/cinderlings";
import { buildTeamSetup } from "../../../../../server/matchSetup";
import { getMapById, parseBoardFromMap } from "../../../../../server/maps";
import "../../../../../server/powers";
import {
  initializeGame,
  startTurn,
  resolveTurn,
  isGameActive,
  getWinner,
  type TurnLog,
} from "../../../../../server/engine";
import { submitCommands } from "../../../../../server/turnTimer";
import { GAME_CONFIG } from "../../../../../server/config";
import { generateAICommands } from "../../../../../server/ai-opponent";
import type { GameState } from "../../../../../server/types";

/** Max simulations a single subscriber can trigger per 24-hour window. */
const DAILY_SIMULATE_LIMIT = 10;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function POST(req: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscribed = await isSubscriber(session.user.id);
  if (!subscribed) {
    return Response.json(
      { error: "Premium subscription required" },
      { status: 403 },
    );
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(matchSnapshot)
    .where(
      and(
        eq(matchSnapshot.triggeredByUserId, session.user.id),
        gte(matchSnapshot.uploadedAt, windowStart),
      ),
    );

  if (count >= DAILY_SIMULATE_LIMIT) {
    return Response.json(
      {
        error: `Daily simulation limit reached (${DAILY_SIMULATE_LIMIT}/day). Try again tomorrow.`,
        limitReached: true,
        limit: DAILY_SIMULATE_LIMIT,
      },
      { status: 429 },
    );
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { p1ProfileId: string; p2ProfileId: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.p1ProfileId || !body.p2ProfileId) {
    return Response.json(
      { error: "p1ProfileId and p2ProfileId are required" },
      { status: 400 },
    );
  }

  // ── Load profiles ─────────────────────────────────────────────────────────
  const [p1Row, p2Row] = await Promise.all([
    db
      .select()
      .from(aiProfile)
      .where(eq(aiProfile.id, body.p1ProfileId))
      .limit(1)
      .then((r: typeof aiProfile.$inferSelect[]) => r[0]),
    db
      .select()
      .from(aiProfile)
      .where(eq(aiProfile.id, body.p2ProfileId))
      .limit(1)
      .then((r: typeof aiProfile.$inferSelect[]) => r[0]),
  ]);

  if (!p1Row) {
    return Response.json({ error: "Profile 1 not found" }, { status: 404 });
  }
  if (!p2Row) {
    return Response.json({ error: "Profile 2 not found" }, { status: 404 });
  }

  // ── Build team setups ─────────────────────────────────────────────────────
  function resolveTemplates(names: string[]) {
    return names.map((name) => {
      const t = CINDERLING_LIBRARY.find(
        (v) => v.name.toLowerCase() === name.toLowerCase(),
      );
      if (!t) throw new Error(`Unknown cinderling: "${name}"`);
      return t;
    });
  }

  const standardMap = getMapById("standard");
  let setup1: ReturnType<typeof buildTeamSetup>;
  let setup2: ReturnType<typeof buildTeamSetup>;
  try {
    setup1 = buildTeamSetup(
      resolveTemplates(shuffle(p1Row.teamNames as string[]).slice(0, 6)),
      1,
      standardMap,
    );
    setup1.teamName = p1Row.name;
    setup2 = buildTeamSetup(
      resolveTemplates(shuffle(p2Row.teamNames as string[]).slice(0, 6)),
      2,
      standardMap,
    );
    setup2.teamName = p2Row.name;
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Team setup failed" },
      { status: 400 },
    );
  }

  // ── Run simulation ────────────────────────────────────────────────────────
  const matchId = shortId();
  const simStart = Date.now();

  try {
    const board = parseBoardFromMap(standardMap);
    const gs = initializeGame(matchId, setup1, setup2, { board, width: standardMap.width, height: standardMap.height });
    const turnLogs: TurnLog[] = [];
    const turnSnapshots: GameState[] = [
      JSON.parse(JSON.stringify(gs)) as GameState,
    ];

    const MAX_TURNS = GAME_CONFIG.match.maxTurns;
    while (isGameActive(gs) && gs.turn < MAX_TURNS) {
      const timer = startTurn(gs);
      submitCommands(timer, 1, generateAICommands(gs, 1));
      submitCommands(timer, 2, generateAICommands(gs, 2));
      const turnLog = resolveTurn(gs, timer);
      turnLogs.push(turnLog);
      turnSnapshots.push(JSON.parse(JSON.stringify(gs)) as GameState);
      if (!isGameActive(gs)) break;
    }

    const simulationMs = Date.now() - simStart;
    const winner = getWinner(gs);

    // ── Save snapshot ───────────────────────────────────────────────────────
    await db.insert(matchSnapshot).values({
      id: matchId,
      gameState: gs as unknown as Record<string, unknown>,
      turnSnapshots: turnSnapshots as unknown as Record<string, unknown>[],
      turnLogs: turnLogs as unknown as Record<string, unknown>[],
      status: "completed",
      p1ProfileId: p1Row.id,
      p2ProfileId: p2Row.id,
      triggeredByUserId: session.user.id,
      simulationMs,
    });

    return Response.json({
      matchId,
      spectateUrl: `/matches/${matchId}/spectate`,
      winner: winner?.name ?? null,
      turns: gs.turn,
      simulationMs,
      remaining: DAILY_SIMULATE_LIMIT - count - 1,
      limit: DAILY_SIMULATE_LIMIT,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Simulation failed" },
      { status: 500 },
    );
  }
}
