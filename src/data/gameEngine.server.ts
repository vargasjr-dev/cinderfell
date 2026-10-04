/**
 * Game engine integration — bridges the DB match data with the engine.
 *
 * Uses HTTP polling instead of WebSocket. Game state is stored in the
 * gameSession.metadata JSON column. Commands are stored there too until
 * both players submit, then the turn auto-resolves.
 */

import { db } from "../../data/db";
import {
  gameSession,
  gamePlayer,
  teamSlot,
  team,
  cinderlingInstance,
  matchStats,
} from "../../data/schema";
import {
  awardMatchProgression,
  updateMatchQuestProgress,
} from "../../lib/matchProgression";
import { eq, asc } from "drizzle-orm";
import {
  CINDERLING_LIBRARY,
  type CinderlingTemplate,
} from "../../server/cinderlings";

import {
  initializeGame,
  startTurn,
  resolveTurn,
  isGameActive,
  type TeamSetup,
  type CinderlingSetup,
  type TurnLog,
} from "../../server/engine";
import {
  submitCommands as submitTimerCommands,
  bothTeamsReady,
  isExpired,
  type TurnTimerState,
} from "../../server/turnTimer";
import { GAME_CONFIG } from "../../server/config";
import {
  getMapById,
  parseBoardFromMap,
  getMapSpawnPositions,
} from "../../server/maps";
import type { GameState } from "../../server/types";
import type { Command } from "../../server/commands";
import type { MatchSettings } from "../lib/matchSettings";
import { generateAIPlayerCommands } from "../../server/ai-player";

// ─── Cinderling lookup ─────────────────────────────────────────────────────────

/** Map from model UUID → CinderlingTemplate for fast lookup */
const templateByModelUuid = new Map<string, CinderlingTemplate>();

// Build UUID → template map (same UUID format as enums/cinderlings.ts)
function idToUuid(id: number): string {
  const hex = id.toString(16).padStart(4, "0");
  const padded = id.toString(16).padStart(12, "0");
  return `00be1100-${hex}-4000-8000-${padded}`;
}

for (const v of CINDERLING_LIBRARY) {
  templateByModelUuid.set(idToUuid(v.id), v);
}

function getTemplate(modelUuid: string): CinderlingTemplate {
  const t = templateByModelUuid.get(modelUuid);
  if (!t) throw new Error(`Unknown cinderling model: ${modelUuid}`);
  return t;
}

// ─── Metadata Shape ──────────────────────────────────────────────────────────

/** Snapshot of board + team state at a point in time (for replay) */
type TurnSnapshot = {
  turn: number;
  /** Deep copy of board state before this turn resolved */
  boardBefore: GameState["board"];
  /** Deep copy of team states before this turn resolved */
  teamsBefore: Array<{
    id: 1 | 2;
    name: string;
    energy: number;
    active: Array<{
      uuid: string;
      name: string;
      hp: number;
      maxHp: number;
      position: { x: number; y: number } | null;
      isKO: boolean;
    }>;
    benchCount: number;
    knockedCount: number;
  }>;
  /** The turn's resolution log */
  log: TurnLog;
};

type MatchMetadata = {
  /** Match settings selected at creation (timer, map). Optional for old matches. */
  matchSettings?: MatchSettings;
  gameState: GameState;
  timer: TurnTimerState | null;
  /** Commands keyed by team ID (1 or 2) */
  pendingCommands: Record<string, Command[]>;
  /** Most recent turn log (for backwards compat) */
  turnLog: unknown | null;
  /** Full turn history with snapshots (for history UI + future replay) */
  turnHistory: TurnSnapshot[];
  // ─── Sparring (AI opponent) fields ────────────────────────────────
  /** True when this is an AI sparring match (practice mode). */
  sparring?: boolean;
  /** Which team the AI controls (1 or 2). Only present when sparring === true. */
  aiTeamId?: 1 | 2;
  /** The human player's team UUID — used to build the human team setup. */
  playerTeamUuid?: string;
  /** AI profile ID (for LLM logging). */
  aiProfileId?: string;
  /** Which player model drives the AI: "claude" (default) or "jev". */
  aiModel?: "claude" | "jev";
  /** AI profile team names (for profile-based sparring). */
  aiProfileTeamNames?: string[];
  /** AI profile display name. */
  aiProfileName?: string;
  /** Pre-built system prompt for the Claude player model (set at match creation). */
  aiSystemPrompt?: string;
  /** Profile strategy text for the Jev player model (set at match creation). */
  aiProfileStrategy?: string;
};

// ─── Initialize ──────────────────────────────────────────────────────────────

/**
 * Load teams from DB and initialize the game engine for a match.
 * Reads matchSettings from existing metadata (set at creation time).
 */
export async function initializeMatchGame(matchUuid: string): Promise<void> {
  // Read existing metadata to get match settings
  const [existingMatch] = await db
    .select({ metadata: gameSession.metadata })
    .from(gameSession)
    .where(eq(gameSession.uuid, matchUuid));

  const existingMeta = existingMatch?.metadata as {
    matchSettings?: MatchSettings;
  } | null;
  const settings: MatchSettings = existingMeta?.matchSettings ?? {
    timerSeconds: 0,
    mapId: "standard",
    mode: "casual",
  };

  // Resolve map
  const map = getMapById(settings.mapId);
  const board = parseBoardFromMap(map);

  // Load players
  const players = await db
    .select({
      userId: gamePlayer.userId,
      teamUuid: gamePlayer.teamUuid,
    })
    .from(gamePlayer)
    .where(eq(gamePlayer.gameSessionUuid, matchUuid))
    .orderBy(asc(gamePlayer.joinedAt));

  if (players.length < 2) throw new Error("Need 2 players to start");
  if (!players[0].teamUuid || !players[1].teamUuid)
    throw new Error("Both players must have a team to start");

  // Build team setups (using map-specific spawn positions)
  const team1Setup = await buildTeamSetup(
    players[0].userId,
    players[0].teamUuid,
    1,
    map,
  );
  const team2Setup = await buildTeamSetup(
    players[1].userId,
    players[1].teamUuid,
    2,
    map,
  );

  // Initialize game state with custom board
  const gameState = initializeGame(matchUuid, team1Setup, team2Setup, {
    board,
    width: map.width,
    height: map.height,
  });
  const timer = startTurn(gameState, settings.timerSeconds);

  const metadata: MatchMetadata = {
    matchSettings: settings,
    gameState,
    timer,
    pendingCommands: {},
    turnLog: null,
    turnHistory: [],
  };

  await db
    .update(gameSession)
    .set({ metadata, status: "playing" })
    .where(eq(gameSession.uuid, matchUuid));
}

// ─── Sparring Initialization ─────────────────────────────────────────────────

/**
 * Initialize a sparring (AI opponent) match.
 *
 * Called the first time a sparring match's game state is requested.
 * Unlike initializeMatchGame, sparring matches:
 *   - Have only one human gamePlayer row in the DB
 *   - Use a randomly selected AI team from CINDERLING_LIBRARY
 *   - Store aiTeamId in metadata for auto-turn resolution
 *
 * AI team is always team 2. Human is always team 1.
 */
export async function initializeSparringGame(matchUuid: string): Promise<void> {
  const [row] = await db
    .select({ metadata: gameSession.metadata })
    .from(gameSession)
    .where(eq(gameSession.uuid, matchUuid));

  if (!row?.metadata) throw new Error("Sparring match not found");
  const meta = row.metadata as Partial<MatchMetadata>;

  if (!meta.sparring) throw new Error("Not a sparring match");
  if (!meta.playerTeamUuid)
    throw new Error("playerTeamUuid missing from sparring metadata");

  const settings: MatchSettings = meta.matchSettings ?? {
    timerSeconds: 0,
    mapId: "standard",
    mode: "casual",
  };
  const map = getMapById(settings.mapId);
  const board = parseBoardFromMap(map);

  // Load the human player's user ID
  const [humanPlayer] = await db
    .select({ userId: gamePlayer.userId })
    .from(gamePlayer)
    .where(eq(gamePlayer.gameSessionUuid, matchUuid));

  if (!humanPlayer) throw new Error("Human player not found in sparring match");

  const humanTeamSetup = await buildTeamSetup(
    humanPlayer.userId,
    meta.playerTeamUuid,
    1,
    map,
  );

  const aiTeamSetup = meta.aiProfileTeamNames
    ? buildProfileTeamSetup(meta.aiProfileTeamNames, meta.aiProfileName ?? "AI Profile", 2, map)
    : buildAITeamSetup(2, map);

  const gameState = initializeGame(matchUuid, humanTeamSetup, aiTeamSetup, {
    board,
    width: map.width,
    height: map.height,
  });
  const timer = startTurn(gameState, settings.timerSeconds);

  const newMeta: MatchMetadata = {
    matchSettings: settings,
    gameState,
    timer,
    pendingCommands: {},
    turnLog: null,
    turnHistory: [],
    sparring: true,
    aiTeamId: 2,
    playerTeamUuid: meta.playerTeamUuid,
  };

  await db
    .update(gameSession)
    .set({ metadata: newMeta })
    .where(eq(gameSession.uuid, matchUuid));
}

/**
 * Build an AI team setup by randomly selecting cinderlings from the library.
 * 4 active + 2 bench, using map spawn positions.
 */
function buildAITeamSetup(
  teamId: 1 | 2,
  map: import("../../server/maps").MapConfig,
): TeamSetup {
  // Shuffle the library and pick 6 (or fewer if library is small)
  const shuffled = [...CINDERLING_LIBRARY].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 6);

  const spawns = getMapSpawnPositions(map, teamId);

  const active: CinderlingSetup[] = [];
  const bench: CinderlingSetup[] = [];

  selected.forEach((template, index) => {
    const setup: CinderlingSetup = {
      uuid: `ai-${teamId}-${index}`,
      name: template.name,
      maxHp: template.hp,
      speed: template.speed,
      attack: template.attack,
      attacks: template.attacks.map((a) => ({
        key: a.key,
        name: a.name,
        damage: a.damage,
        energyCost: a.energyCost,
        range: a.range,
        ...(a.arcOver ? { arcOver: true } : {}),
      })),
      spawnPosition: spawns[index % spawns.length] ?? spawns[0],
      specialPowerId: template.specialPowerId,
      imageUrl: template.imageUrl,
    };
    if (index < 4) {
      active.push(setup);
    } else {
      bench.push(setup);
    }
  });

  return {
    userId: "ai-bot",
    teamName: "AI Bot",
    active,
    bench,
  };
}

/**
 * Build a TeamSetup from a specific list of cinderling names (used for AI profile sparring).
 * First 4 names → active; names 5-6 → bench.  Names 7-8 are reserved for future use.
 */
function buildProfileTeamSetup(
  teamNames: string[],
  profileName: string,
  teamId: 1 | 2,
  map: import("../../server/maps").MapConfig,
): TeamSetup {
  const spawns = getMapSpawnPositions(map, teamId);

  const templates = teamNames
    .slice(0, 6)
    .map((name) =>
      CINDERLING_LIBRARY.find((v) => v.name.toLowerCase() === name.toLowerCase()),
    )
    .filter((v): v is (typeof CINDERLING_LIBRARY)[0] => v !== undefined);

  const active: CinderlingSetup[] = [];
  const bench: CinderlingSetup[] = [];

  templates.forEach((template, index) => {
    const setup: CinderlingSetup = {
      uuid: `ai-${teamId}-${index}`,
      name: template.name,
      maxHp: template.hp,
      speed: template.speed,
      attack: template.attack,
      attacks: template.attacks.map((a) => ({
        key: a.key,
        name: a.name,
        damage: a.damage,
        energyCost: a.energyCost,
        range: a.range,
        ...(a.arcOver ? { arcOver: true } : {}),
      })),
      spawnPosition: spawns[index % spawns.length] ?? spawns[0],
      specialPowerId: template.specialPowerId,
      imageUrl: template.imageUrl,
    };
    if (index < 4) {
      active.push(setup);
    } else {
      bench.push(setup);
    }
  });

  return {
    userId: "ai-bot",
    teamName: profileName,
    active,
    bench,
  };
}

async function buildTeamSetup(
  userId: string,
  teamUuid: string,
  teamId: 1 | 2,
  map: import("../../server/maps").MapConfig,
): Promise<TeamSetup> {
  // Load team slots with cinderling instances
  const slots = await db
    .select({
      slotIndex: teamSlot.slotIndex,
      isActive: teamSlot.isActive,
      modelUuid: cinderlingInstance.modelUuid,
    })
    .from(teamSlot)
    .innerJoin(
      cinderlingInstance,
      eq(teamSlot.cinderlingInstanceUuid, cinderlingInstance.uuid),
    )
    .where(eq(teamSlot.teamUuid, teamUuid))
    .orderBy(asc(teamSlot.slotIndex));

  const spawns = getMapSpawnPositions(map, teamId);

  // First 4 slots = active, rest = bench
  const active: CinderlingSetup[] = [];
  const bench: CinderlingSetup[] = [];

  for (const slot of slots) {
    const template = getTemplate(slot.modelUuid);
    const setup: CinderlingSetup = {
      uuid: `${teamId}-${slot.slotIndex}`,
      name: template.name,
      maxHp: template.hp,
      speed: template.speed,
      attack: template.attack,
      attacks: template.attacks.map((a) => ({
        key: a.key,
        name: a.name,
        damage: a.damage,
        energyCost: a.energyCost,
        range: a.range,
        ...(a.arcOver ? { arcOver: true } : {}),
      })),
      spawnPosition: spawns[slot.slotIndex % spawns.length],
      specialPowerId: template.specialPowerId,
      imageUrl: template.imageUrl,
    };

    if (slot.slotIndex < 4) {
      active.push(setup);
    } else {
      bench.push(setup);
    }
  }

  // Load team name
  const [teamRow] = await db
    .select({ name: team.name })
    .from(team)
    .where(eq(team.uuid, teamUuid));

  return {
    userId,
    teamName: teamRow?.name ?? `Team ${teamId}`,
    active,
    bench,
  };
}

// ─── Read State ──────────────────────────────────────────────────────────────

export async function getMatchGameState(matchUuid: string) {
  const [match] = await db
    .select({ metadata: gameSession.metadata, status: gameSession.status })
    .from(gameSession)
    .where(eq(gameSession.uuid, matchUuid));

  if (!match?.metadata) return null;
  const meta = match.metadata as MatchMetadata;

  // ── Lazy sparring init ──────────────────────────────────────────────────────
  // Sparring matches are created with status "playing" but no gameState yet.
  // Initialize on first poll instead of at creation time (avoids blocking the
  // practice setup action on potentially slow team DB queries).
  if (meta.sparring && !meta.gameState) {
    await initializeSparringGame(matchUuid);
    // Re-read the freshly initialized state
    const [refreshed] = await db
      .select({ metadata: gameSession.metadata, status: gameSession.status })
      .from(gameSession)
      .where(eq(gameSession.uuid, matchUuid));
    if (!refreshed?.metadata) return null;
    const freshMeta = refreshed.metadata as MatchMetadata;
    return {
      gameState: freshMeta.gameState,
      turnLog: freshMeta.turnLog,
      turnHistory: freshMeta.turnHistory ?? [],
      status: refreshed.status,
    };
  }

  return {
    gameState: meta.gameState,
    turnLog: meta.turnLog,
    turnHistory: meta.turnHistory ?? [],
    status: match.status,
    sparring: meta.sparring ?? false,
  };
}

// ─── Match Stats ─────────────────────────────────────────────────────────────

/**
 * Write per-player match stats once a game session completes.
 *
 * Called from both turn-resolution and concede paths. Inserts one row per
 * human player (AI bots with userId "ai-bot" are skipped).
 *
 * Stats captured:
 *   result       — "win" | "loss"
 *   turns        — total turns played
 *   enemyKOs     — opponent cinderlings knocked out by this player's team
 *   ownKOs       — own cinderlings knocked out
 *   winCondition — engine win condition string (or "concession")
 *   isSparring   — true for AI practice matches
 *   sparring — true if this is a practice match
 */
async function writeMatchStats(
  matchUuid: string,
  gameState: GameState,
  meta: MatchMetadata,
): Promise<void> {
  const result = gameState.result;
  if (!result) return; // no-op if game not actually over

  const winCondition = result.condition ?? "unknown";

  // Collect human player records (skip AI sentinel)
  const players = await db
    .select({ userId: gamePlayer.userId })
    .from(gamePlayer)
    .where(eq(gamePlayer.gameSessionUuid, matchUuid));

  const rows = players
    .filter((p) => p.userId !== "ai-bot")
    .map((p) => {
      const teamIndex = gameState.teams.findIndex((t) => t.userId === p.userId);
      if (teamIndex === -1) return null;

      const myTeam = gameState.teams[teamIndex];
      const enemyTeam = gameState.teams[teamIndex === 0 ? 1 : 0];

      const isWinner = result.winner === myTeam.id;
      // Count all KO'd mons across active + knocked (bench mons never enter play so aren't KO'd)
      const countKOs = (t: (typeof gameState.teams)[0]) =>
        t.active.filter((v) => v.isKO).length + t.knocked.length;
      const ownKOs = countKOs(myTeam);
      const enemyKOs = countKOs(enemyTeam);

      return {
        gameSessionUuid: matchUuid,
        userId: p.userId,
        result: isWinner ? "win" : "loss",
        turns: gameState.turn,
        enemyKOs,
        ownKOs,
        winCondition,
        isSparring: meta.sparring ?? false,
      } as const;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length > 0) {
    await db.insert(matchStats).values(rows).onConflictDoNothing();
  }
}

// ─── Submit Commands ─────────────────────────────────────────────────────────

export async function submitMatchCommands(
  matchUuid: string,
  userId: string,
  commands: Command[],
  overrideTeamId?: 1 | 2,
) {
  const [match] = await db
    .select({ metadata: gameSession.metadata })
    .from(gameSession)
    .where(eq(gameSession.uuid, matchUuid));

  if (!match?.metadata) throw new Error("Game not initialized");
  const meta = match.metadata as MatchMetadata;
  const { gameState } = meta;
  let { timer } = meta;

  if (!timer) throw new Error("No active turn");

  // Determine which team this user is on
  // overrideTeamId is used for admin play-both-sides matches
  let teamId: 1 | 2;
  if (overrideTeamId) {
    teamId = overrideTeamId;
  } else {
    const teamIndex = gameState.teams.findIndex((t) => t.userId === userId);
    if (teamIndex === -1) throw new Error("User is not in this match");
    teamId = (teamIndex + 1) as 1 | 2;
  }

  // Store commands in timer — if rejected (e.g. expired), reset the timer
  const submitResult = submitTimerCommands(timer, teamId, commands);
  if (!submitResult.accepted) {
    // Timer expired — reset it so the player can resubmit
    const timerSeconds = meta.matchSettings?.timerSeconds ?? 0;
    meta.timer = startTurn(gameState, timerSeconds);
    // Re-set the turn number back (startTurn increments it)
    gameState.turn -= 1;
    meta.timer.turn = gameState.turn + 1;
    // Store commands in the fresh timer
    submitTimerCommands(meta.timer, teamId, commands);
    timer = meta.timer;
  }
  meta.pendingCommands[String(teamId)] = commands;

  // ── AI auto-submit ──────────────────────────────────────────────────────────
  // In sparring matches, after the human submits their commands, immediately
  // generate and submit AI commands so the turn resolves without a second poll.
  if (meta.sparring && meta.aiTeamId && meta.aiTeamId !== teamId) {
    const aiTeamId = meta.aiTeamId;
    const aiCommands = await generateAIPlayerCommands(gameState, aiTeamId, {
      matchId: matchUuid,
      turn: gameState.turn,
      profileId: meta.aiProfileId,
      model: meta.aiModel,
      systemPrompt: meta.aiSystemPrompt,
      strategy: meta.aiProfileStrategy,
    });
    submitTimerCommands(timer, aiTeamId, aiCommands);
    meta.pendingCommands[String(aiTeamId)] = aiCommands;
  }

  // Check if both teams have submitted
  const shouldResolve = bothTeamsReady(timer) || isExpired(timer);
  if (shouldResolve) {
    // Snapshot board state BEFORE resolving (for history/replay)
    const snapshot: TurnSnapshot = {
      turn: gameState.turn,
      boardBefore: JSON.parse(JSON.stringify(gameState.board)),
      teamsBefore: gameState.teams.map((t) => ({
        id: t.id,
        name: t.name,
        energy: t.energy,
        active: t.active.map((v) => ({
          uuid: v.uuid,
          name: v.name,
          hp: v.hp,
          maxHp: v.maxHp,
          position: v.position ? { ...v.position } : null,
          isKO: v.isKO,
        })),
        benchCount: t.bench.length,
        knockedCount: t.knocked.length,
      })),
      log: null as unknown as TurnLog, // filled after resolve
    };

    // Resolve the turn
    const turnLog = resolveTurn(gameState, timer);
    meta.turnLog = turnLog;
    snapshot.log = turnLog;

    // Append to history
    if (!meta.turnHistory) meta.turnHistory = [];
    meta.turnHistory.push(snapshot);
    meta.pendingCommands = {};

    if (isGameActive(gameState)) {
      // Start next turn (preserve timer settings from match creation)
      meta.timer = startTurn(gameState, meta.matchSettings?.timerSeconds ?? 0);
    } else {
      // Game over
      meta.timer = null;
      await db
        .update(gameSession)
        .set({ metadata: meta, status: "completed" })
        .where(eq(gameSession.uuid, matchUuid));
      // Sequence: write stats first, then run progression + quest checks fire-and-forget.
      const humanPlayerIds = gameState.teams
        .filter((t) => t.userId !== "ai-bot")
        .map((t) => t.userId);
      writeMatchStats(matchUuid, gameState, meta)
        .then(() =>
          Promise.all([
            awardMatchProgression(matchUuid, gameState, meta.sparring ?? false),
            updateMatchQuestProgress(matchUuid, humanPlayerIds),
          ]),
        )
        .catch((e) =>
          console.error("[game-over] post-match processing failed:", e),
        );
      return { resolved: true, turnLog, gameOver: true };
    }
  }

  await db
    .update(gameSession)
    .set({ metadata: meta })
    .where(eq(gameSession.uuid, matchUuid));

  return {
    resolved: shouldResolve,
    turnLog: meta.turnLog,
    gameOver: false,
  };
}

// ─── Concede ─────────────────────────────────────────────────────────────────

/**
 * Player concedes — opponent wins immediately via "concession" condition.
 */
export async function concedeMatch(
  matchUuid: string,
  userId: string,
  overrideTeamId?: 1 | 2,
) {
  const [match] = await db
    .select({ metadata: gameSession.metadata })
    .from(gameSession)
    .where(eq(gameSession.uuid, matchUuid));

  if (!match?.metadata) throw new Error("Game not initialized");
  const meta = match.metadata as MatchMetadata;
  const { gameState } = meta;

  if (gameState.result) throw new Error("Game is already over");

  // Determine which team is conceding
  let concedingTeamId: 1 | 2;
  if (overrideTeamId) {
    concedingTeamId = overrideTeamId;
  } else {
    const teamIndex = gameState.teams.findIndex((t) => t.userId === userId);
    if (teamIndex === -1) throw new Error("User is not in this match");
    concedingTeamId = (teamIndex + 1) as 1 | 2;
  }

  // The OTHER team wins
  const winnerId: 1 | 2 = concedingTeamId === 1 ? 2 : 1;

  gameState.result = { winner: winnerId, condition: "concession" };
  gameState.phase = "ended";
  meta.timer = null;

  await db
    .update(gameSession)
    .set({ metadata: meta, status: "completed" })
    .where(eq(gameSession.uuid, matchUuid));

  // Sequence: write stats first, then run progression + quest checks fire-and-forget.
  const humanPlayerIds = gameState.teams
    .filter((t) => t.userId !== "ai-bot")
    .map((t) => t.userId);
  writeMatchStats(matchUuid, gameState, meta)
    .then(() =>
      Promise.all([
        awardMatchProgression(matchUuid, gameState, meta.sparring ?? false),
        updateMatchQuestProgress(matchUuid, humanPlayerIds),
      ]),
    )
    .catch((e) =>
      console.error("[game-over] post-match processing failed (concede):", e),
    );

  const winnerTeam = gameState.teams[winnerId - 1];
  return {
    winner: winnerTeam.name,
    winnerId,
    condition: "concession" as const,
  };
}
