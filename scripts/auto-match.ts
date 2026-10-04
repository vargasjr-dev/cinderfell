#!/usr/bin/env bun
/**
 * auto-match.ts — plays a full AI vs AI cinderling match and uploads it.
 *
 * Usage:
 *   bun scripts/auto-match.ts --p1 <profileId> --p2 <profileId>   Run two profiles head-to-head
 *   bun scripts/auto-match.ts --random                             Random teams (no profiles)
 *   bun scripts/auto-match.ts --list                               List all profiles in DB
 *
 * Profiles are stored in the aiProfile DB table. Create them through the
 * admin UI at /admin/profiles.
 */

import { resolve, join } from "node:path";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { CINDERLING_LIBRARY } from "../server/cinderlings";
import { buildTeamSetup } from "../server/matchSetup";
import {
  initializeGame,
  startTurn,
  resolveTurn,
  isGameActive,
  getWinner,
  type TurnLog,
} from "../server/engine";
import { submitCommands } from "../server/turnTimer";
import { generateAICommands } from "../server/ai-opponent";
import { generateAIPlayerCommands, isAIPlayerModel, type AIPlayerModel } from "../server/ai-player";
import { getMapById, parseBoardFromMap } from "../server/maps";
import { GAME_CONFIG } from "../server/config";
import { buildSystemPrompt } from "../server/ai-llm";
import { db } from "../data/db";
import { aiProfile, matchSnapshot } from "../data/schema";
import { eq } from "drizzle-orm";
import type { GameState } from "../server/types";
import type { Command } from "../server/commands";
import type { TurnTimerState } from "../server/turnTimer";

// ─── State dir ────────────────────────────────────────────────────────────────

const STATE_DIR = resolve(new URL(".", import.meta.url).pathname, "../.cinderling");
if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortId(): string {
  return Math.random().toString(36).slice(2, 8);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Match file type ──────────────────────────────────────────────────────────

type MatchFile = {
  id: string;
  createdAt: string;
  gameState: GameState;
  timer: TurnTimerState | null;
  pendingCommands: Record<string, Command[]>;
  turnLogs: TurnLog[];
  turnSnapshots: GameState[];
  p1ProfileId?: string;
  p2ProfileId?: string;
};

// ─── Parse args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const p1Flag = args.indexOf("--p1");
const p2Flag = args.indexOf("--p2");
const isRandom = args.includes("--random");
const isList = args.includes("--list");

// ─── List profiles ────────────────────────────────────────────────────────────

if (isList) {
  const profiles = await db.select().from(aiProfile).orderBy(aiProfile.createdAt);
  if (profiles.length === 0) {
    console.log("No AI profiles found. Create some at /admin/profiles.");
    process.exit(0);
  }
  console.log(`\n${"ID".padEnd(24)} ${"Name".padEnd(28)} ${"Difficulty".padEnd(10)} Team`);
  console.log("─".repeat(100));
  for (const p of profiles) {
    const team = (p.teamNames as string[]).slice(0, 4).join(", ");
    console.log(
      `${p.id.padEnd(24)} ${p.name.padEnd(28)} ${"r=" + (p.randomness ?? 0.5).toFixed(2).padEnd(8)} ${team}`,
    );
  }
  console.log();
  process.exit(0);
}

// ─── Load profiles (or build random teams) ────────────────────────────────────

type ProfileConfig = {
  id: string;
  name: string;
  teamNames: string[];
  randomness: number;
  /** Player model driving this profile ("claude" default, or "jev"). Absent = rule-based. */
  model?: AIPlayerModel;
  /** Profile strategy/prompt text, used by the claude and jev player models. */
  description?: string;
};

let p1Config: ProfileConfig;
let p2Config: ProfileConfig;

if (!isRandom && p1Flag !== -1 && p2Flag !== -1) {
  const p1Id = args[p1Flag + 1];
  const p2Id = args[p2Flag + 1];

  if (!p1Id || !p2Id) {
    console.error("Usage: auto-match.ts --p1 <profileId> --p2 <profileId>");
    process.exit(1);
  }

  const [p1Row] = await db.select().from(aiProfile).where(eq(aiProfile.id, p1Id));
  const [p2Row] = await db.select().from(aiProfile).where(eq(aiProfile.id, p2Id));

  if (!p1Row) { console.error(`❌ Profile not found: ${p1Id}`); process.exit(1); }
  if (!p2Row) { console.error(`❌ Profile not found: ${p2Id}`); process.exit(1); }

  p1Config = {
    id: p1Row.id,
    name: p1Row.name,
    teamNames: p1Row.teamNames as string[],
    randomness: (p1Row.randomness as number | null) ?? 0.5,
    model: isAIPlayerModel(p1Row.model) ? p1Row.model : "claude",
    description: (p1Row.description as string | null) ?? "",
  };
  p2Config = {
    id: p2Row.id,
    name: p2Row.name,
    teamNames: p2Row.teamNames as string[],
    randomness: (p2Row.randomness as number | null) ?? 0.5,
    model: isAIPlayerModel(p2Row.model) ? p2Row.model : "claude",
    description: (p2Row.description as string | null) ?? "",
  };
} else {
  // --random or no args: pick random teams from the library
  const picked = shuffle(CINDERLING_LIBRARY).slice(0, 16);
  p1Config = {
    id: "random-1",
    name: "Random Team 1",
    teamNames: picked.slice(0, 8).map((v) => v.name),
    randomness: 0.5,
  };
  p2Config = {
    id: "random-2",
    name: "Random Team 2",
    teamNames: picked.slice(8, 16).map((v) => v.name),
    randomness: 0.5,
  };
}

// ─── Build team setups ────────────────────────────────────────────────────────

function resolveTeamTemplates(names: string[]) {
  return names.map((name) => {
    const t = CINDERLING_LIBRARY.find((v) => v.name.toLowerCase() === name.toLowerCase());
    if (!t) throw new Error(`Unknown cinderling name: "${name}"`);
    return t;
  });
}

// ─── Map (single source: server/maps.ts) ─────────────────────────────────────

const standardMap = getMapById("standard");
const mapBoard = parseBoardFromMap(standardMap);

const setup1 = buildTeamSetup(resolveTeamTemplates(p1Config.teamNames), 1, standardMap);
setup1.teamName = p1Config.name;

const setup2 = buildTeamSetup(resolveTeamTemplates(p2Config.teamNames), 2, standardMap);
setup2.teamName = p2Config.name;

// ─── Run match ────────────────────────────────────────────────────────────────

const MAX_TURNS = GAME_CONFIG.match.maxTurns;
const id = shortId();

/** Profile-driven command generation (claude / jev); rule-based for random mode. */
function playerCommands(
  config: ProfileConfig,
  gs: GameState,
  teamId: 1 | 2,
): Promise<Command[]> {
  if (config.model) {
    return generateAIPlayerCommands(gs, teamId, {
      matchId: id,
      turn: gs.turn,
      profileId: config.id,
      model: config.model,
      systemPrompt: buildSystemPrompt(config.description ?? "", ""),
      strategy: config.description,
    });
  }
  return Promise.resolve(generateAICommands(gs, teamId));
}

console.log(`\n⚔️  Auto-match ${id}`);
console.log(`   P1: ${p1Config.name}${p1Config.model ? ` [${p1Config.model}]` : ""} (randomness=${p1Config.randomness.toFixed(2)})`);
console.log(`   P2: ${p2Config.name}${p2Config.model ? ` [${p2Config.model}]` : ""} (randomness=${p2Config.randomness.toFixed(2)})`);
console.log();

const gs = initializeGame(id, setup1, setup2, {
  board: mapBoard,
  width: standardMap.width,
  height: standardMap.height,
});

const match: MatchFile = {
  id,
  createdAt: new Date().toISOString(),
  gameState: gs,
  timer: null,
  pendingCommands: {},
  turnLogs: [],
  turnSnapshots: [JSON.parse(JSON.stringify(gs)) as GameState],
  p1ProfileId: p1Config.id,
  p2ProfileId: p2Config.id,
};

while (isGameActive(gs) && gs.turn < MAX_TURNS) {
  const timer = startTurn(gs);
  const [cmds1, cmds2] = await Promise.all([
    playerCommands(p1Config, gs, 1),
    playerCommands(p2Config, gs, 2),
  ]);
  submitCommands(timer, 1, cmds1);
  submitCommands(timer, 2, cmds2);

  const turnLog = resolveTurn(gs, timer);
  match.turnLogs.push(turnLog);
  match.turnSnapshots.push(JSON.parse(JSON.stringify(gs)) as GameState);

  const [t1, t2] = gs.teams;
  const alive1 = t1.active.filter((v) => !v.isKO).length;
  const alive2 = t2.active.filter((v) => !v.isKO).length;
  const winSuffix = gs.result
    ? ` → ${getWinner(gs)?.name} WINS (${gs.result.condition})`
    : "";
  console.log(
    `Turn ${gs.turn}: T1 ${alive1} alive (${t1.energy}⚡) | T2 ${alive2} alive (${t2.energy}⚡)${winSuffix}`,
  );

  if (!isGameActive(gs)) break;
}

match.gameState = gs;

const winner = getWinner(gs);
const outPath = join(STATE_DIR, `${id}.json`);
writeFileSync(outPath, JSON.stringify(match, null, 2));
console.log(`\n✅ Match saved → .cinderling/${id}.json`);
console.log(`   Turns: ${gs.turn} | Snapshots: ${match.turnSnapshots.length}`);
console.log(
  winner
    ? `   Winner: ${winner.name} (${gs.result?.condition})`
    : "   Result: max turns reached (no winner)",
);

// ─── Upload ───────────────────────────────────────────────────────────────────

const configPath = join(STATE_DIR, "config.json");
let baseUrl = "https://cinderfell.vercel.app";
let apiKey: string | undefined;
if (existsSync(configPath)) {
  try {
    const cfg = JSON.parse(readFileSync(configPath, "utf-8")) as Record<string, string>;
    if (cfg.url) baseUrl = cfg.url;
    if (cfg.apiKey) apiKey = cfg.apiKey;
  } catch {}
}
apiKey = process.env.CINDERLING_UPLOAD_API_KEY ?? apiKey;

if (!apiKey) {
  console.error("\n❌ No API key — set CINDERLING_UPLOAD_API_KEY or add to .cinderling/config.json");
  process.exit(1);
}

console.log("\nUploading...");

const res = await fetch(`${baseUrl}/api/matches/upload`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
  body: JSON.stringify({
    id: match.id,
    gameState: match.gameState,
    turnSnapshots: match.turnSnapshots,
    turnLogs: match.turnLogs,
    status: "completed",
    p1ProfileId: p1Config.id.startsWith("random-") ? null : (match.p1ProfileId ?? null),
    p2ProfileId: p2Config.id.startsWith("random-") ? null : (match.p2ProfileId ?? null),
  }),
});

if (!res.ok) {
  const body = await res.text().catch(() => "");
  console.error(`❌ Upload failed (HTTP ${res.status}): ${body}`);
  process.exit(1);
}

const result = (await res.json()) as { ok: boolean; spectateUrl: string };
console.log(`✅ Spectate: ${result.spectateUrl}`);
