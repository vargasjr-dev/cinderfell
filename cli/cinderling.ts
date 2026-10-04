#!/usr/bin/env bun
/**
 * cinderling CLI — play and QA matches from the terminal.
 *
 * Runs the engine in-memory (no DB needed). Match state stored as
 * local JSON files in .cinderling/ directory.
 *
 * Usage:
 *   cinderling match create              Create a new admin match
 *   cinderling match list                List local matches
 *   cinderling board <matchId>           Show the board
 *   cinderling status <matchId>          One-line match summary
 *   cinderling cmd <matchId> <teamId> <cinderlingId> <action> [direction]
 *   cinderling submit <matchId> <teamId> Submit team's turn (auto-resolves when both submit)
 *   cinderling report <matchId>          Generate JSON match report
 */

import { resolve, join } from "path";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { CINDERLING_LIBRARY } from "../server/cinderlings";

import { buildTeamSetup } from "../server/matchSetup";
import {
  initializeGame,
  startTurn,
  resolveTurn,
  isGameActive,
  getWinner,
  getGameSummary,
  type TeamSetup,
  type TurnLog,
} from "../server/engine";
import {
  createTurnTimer,
  submitCommands as submitTimerCommands,
  bothTeamsReady,
  type TurnTimerState,
} from "../server/turnTimer";
import { GAME_CONFIG } from "../server/config";
import { getMapById, parseBoardFromMap } from "../server/maps";

import type { GameState, CinderlingState, TeamState } from "../server/types";
import type { Command } from "../server/commands";

// ─── State Storage ───────────────────────────────────────────────────────────

const STATE_DIR = resolve(new URL(".", import.meta.url).pathname, "../.vellymon");

type MatchFile = {
  id: string;
  createdAt: string;
  gameState: GameState;
  timer: TurnTimerState | null;
  pendingCommands: Record<string, Command[]>;
  turnLogs: TurnLog[];
  /** Per-cinderling cumulative stats for the report */
  stats: Record<string, { damageDealt: number; damageTaken: number; harvests: number; kos: number; moves: number }>;
};

function ensureDir() {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
}

function savePath(id: string) { return join(STATE_DIR, `${id}.json`); }

function saveMatch(match: MatchFile) {
  ensureDir();
  writeFileSync(savePath(match.id), JSON.stringify(match, null, 2));
}

function loadMatch(id: string): MatchFile {
  const path = savePath(id);
  if (!existsSync(path)) {
    console.error(`Match not found: ${id}`);
    console.error(`Run 'cinderling match list' to see available matches.`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, "utf-8"));
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 8);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Board Rendering ─────────────────────────────────────────────────────────

function renderBoard(state: GameState): string {
  const { board, teams } = state;
  const W = GAME_CONFIG.board.width;
  const H = GAME_CONFIG.board.height;

  // Build position → cinderling lookup
  const posMap = new Map<string, { vm: CinderlingState; teamId: 1 | 2 }>();
  for (const t of teams) {
    for (const vm of t.active) {
      if (vm.position && !vm.isKO) {
        posMap.set(`${vm.position.x},${vm.position.y}`, { vm, teamId: t.id });
      }
    }
  }

  // Build position → space type lookup
  const spaceMap = new Map<string, typeof board[0]>();
  for (const s of board) {
    spaceMap.set(`${s.position.x},${s.position.y}`, s);
  }

  const lines: string[] = [];

  // Header
  lines.push(getGameSummary(state));
  lines.push("");

  // Column numbers
  let colHeader = "    ";
  for (let x = 0; x < W; x++) colHeader += ` ${x}   `;
  lines.push(colHeader);

  // Top border
  lines.push("  ┌" + "────┬".repeat(W - 1) + "────┐");

  for (let y = 0; y < H; y++) {
    let line1 = "  │"; // space type + cinderling name
    let line2 = `${y} │`; // HP or occupation info
    for (let x = 0; x < W; x++) {
      const key = `${x},${y}`;
      const space = spaceMap.get(key);
      const occupant = posMap.get(key);

      if (occupant) {
        const name = occupant.vm.name.slice(0, 3).toUpperCase();
        const teamMarker = occupant.teamId === 1 ? "\x1b[34m" : "\x1b[31m"; // blue/red
        const reset = "\x1b[0m";
        line1 += ` ${teamMarker}${name}${reset}│`;
        const hpPct = Math.round((occupant.vm.hp / occupant.vm.maxHp) * 100);
        const hpStr = `${occupant.vm.hp}`.padStart(3);
        line2 += ` ${hpStr}│`;
      } else if (space?.type === "occupation") {
        const counter = space.occupationCounter ?? 0;
        const ctrl = counter < 0 ? "T1" : counter > 0 ? "T2" : "  ";
        const ticks = Math.abs(counter);
        line1 += ` \x1b[33m★${ctrl}\x1b[0m│`; // yellow star
        line2 += ` ${ticks}/${GAME_CONFIG.occupation.ticksToControl} │`;
      } else if (space?.type === "spawn") {
        const tm = space.team === 1 ? "\x1b[34mS1\x1b[0m" : "\x1b[31mS2\x1b[0m";
        line1 += ` ${tm} │`;
        line2 += `    │`;
      } else {
        line1 += `  · │`; // harvestable
        line2 += `    │`;
      }
    }
    lines.push(line1);
    lines.push(line2);

    if (y < H - 1) {
      lines.push("  ├" + "────┼".repeat(W - 1) + "────┤");
    }
  }

  // Bottom border
  lines.push("  └" + "────┴".repeat(W - 1) + "────┘");

  // Team rosters
  lines.push("");
  for (const t of teams) {
    const color = t.id === 1 ? "\x1b[34m" : "\x1b[31m";
    const reset = "\x1b[0m";
    lines.push(`${color}${t.name}${reset} ⚡${t.energy}`);
    lines.push("  Active:");
    for (const vm of t.active) {
      const ko = vm.isKO ? " [KO]" : "";
      const pos = vm.position ? `(${vm.position.x},${vm.position.y})` : "(---)";
      lines.push(`    ${vm.uuid.padEnd(4)} ${vm.name.padEnd(12)} HP ${vm.hp}/${vm.maxHp} SPD ${vm.speed} ${pos}${ko}`);
    }
    if (t.bench.length > 0) {
      lines.push("  Bench: " + t.bench.map((v) => v.name).join(", "));
    }
    if (t.knocked.length > 0) {
      lines.push("  KO'd: " + t.knocked.map((v) => v.name).join(", "));
    }
  }

  return lines.join("\n");
}

// ─── Commands ────────────────────────────────────────────────────────────────

function cmdMatchCreate() {
  const id = shortId();
  const shuffled = shuffle(CINDERLING_LIBRARY);
  const picked = shuffled.slice(0, 16);

  const map = getMapById("standard");
  const setup1 = buildTeamSetup(picked.slice(0, 8), 1, map);
  const setup2 = buildTeamSetup(picked.slice(8, 16), 2, map);

  const gameState = initializeGame(id, setup1, setup2, {
    board: parseBoardFromMap(map),
    width: map.width,
    height: map.height,
  });
  const timer = startTurn(gameState);

  const match: MatchFile = {
    id,
    createdAt: new Date().toISOString(),
    gameState,
    timer,
    pendingCommands: {},
    turnLogs: [],
    stats: {},
  };

  // Initialize stats for all cinderlings
  for (const t of gameState.teams) {
    for (const vm of [...t.active, ...t.bench]) {
      match.stats[vm.uuid] = { damageDealt: 0, damageTaken: 0, harvests: 0, kos: 0, moves: 0 };
    }
  }

  saveMatch(match);

  console.log(`\nMatch created: ${id}`);
  console.log(`\n${renderBoard(gameState)}`);
}

function cmdMatchList() {
  ensureDir();
  const files = readdirSync(STATE_DIR).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.log("No matches. Run 'cinderling match create' to start one.");
    return;
  }
  console.log("\nLocal matches:");
  for (const f of files) {
    const match = JSON.parse(readFileSync(join(STATE_DIR, f), "utf-8")) as MatchFile;
    const gs = match.gameState;
    const status = gs.result ? `OVER — ${gs.teams[gs.result.winner - 1].name} wins` : `Turn ${gs.turn}`;
    console.log(`  ${match.id}  ${status}  (${match.createdAt.slice(0, 16)})`);
  }
}

function cmdBoard(matchId: string) {
  const match = loadMatch(matchId);
  console.log(`\n${renderBoard(match.gameState)}`);

  // Show pending commands
  const pending = match.pendingCommands;
  const keys = Object.keys(pending);
  if (keys.length > 0) {
    console.log("\nPending commands:");
    for (const teamId of keys) {
      console.log(`  Team ${teamId}: ${pending[teamId].length} commands`);
      for (const cmd of pending[teamId]) {
        const dir = "direction" in cmd ? ` ${cmd.direction}` : "";
        console.log(`    ${cmd.cinderlingUuid} → ${cmd.type}${dir}`);
      }
    }
  }
}

function cmdStatus(matchId: string) {
  const match = loadMatch(matchId);
  console.log(getGameSummary(match.gameState));
}

function cmdCmd(matchId: string, teamIdStr: string, cinderlingId: string, action: string, direction?: string) {
  const match = loadMatch(matchId);
  const teamId = parseInt(teamIdStr) as 1 | 2;

  if (teamId !== 1 && teamId !== 2) {
    console.error("Team ID must be 1 or 2");
    process.exit(1);
  }

  // Find the cinderling
  const team = match.gameState.teams[teamId - 1];
  const vm = team.active.find((v) => v.uuid === cinderlingId || v.name.toLowerCase() === cinderlingId.toLowerCase());
  if (!vm) {
    console.error(`Cinderling '${cinderlingId}' not found on Team ${teamId}.`);
    console.error("Active cinderlings:");
    for (const v of team.active) {
      console.error(`  ${v.uuid}  ${v.name}  ${v.isKO ? "[KO]" : `HP ${v.hp}/${v.maxHp}`}`);
    }
    process.exit(1);
  }

  // Build the command
  /** Convert CLI direction string to game-space Vec2 */
  function dirToVec(dir: string): { dx: number; dy: number } {
    switch (dir) {
      case "up":    return { dx: 0, dy: -1 };
      case "down":  return { dx: 0, dy:  1 };
      case "left":  return { dx: -1, dy: 0 };
      case "right": return { dx:  1, dy: 0 };
      default: throw new Error(`Unknown direction: ${dir}`);
    }
  }

  let cmd: Command;
  switch (action.toLowerCase()) {
    case "move": {
      if (!direction || !["up", "down", "left", "right"].includes(direction)) {
        console.error("Move requires a direction: up, down, left, right");
        process.exit(1);
      }
      cmd = { type: "move", cinderlingUuid: vm.uuid, vec: dirToVec(direction) };
      break;
    }
    case "attack": {
      if (!direction || !["up", "down", "left", "right"].includes(direction)) {
        console.error("Attack requires a direction: up, down, left, right");
        process.exit(1);
      }
      // Use attack index 0 (primary attack) — directional scan finds target
      cmd = {
        type: "attack",
        cinderlingUuid: vm.uuid,
        attackIndex: 0,
        vec: dirToVec(direction),
      };
      break;
    }
    case "harvest": {
      if (!direction || !["up", "down", "left", "right"].includes(direction)) {
        console.error("Harvest requires a direction: up, down, left, right");
        process.exit(1);
      }
      cmd = { type: "harvest", cinderlingUuid: vm.uuid, vec: dirToVec(direction) };
      break;
    }
    default: {
      console.error(`Unknown action '${action}'. Use: move, attack, harvest`);
      process.exit(1);
    }
  }

  // Add to pending commands for this team
  const key = String(teamId);
  if (!match.pendingCommands[key]) match.pendingCommands[key] = [];

  // Replace existing command for this cinderling
  match.pendingCommands[key] = match.pendingCommands[key].filter((c) => c.cinderlingUuid !== vm.uuid);
  match.pendingCommands[key].push(cmd);

  saveMatch(match);

  const dirStr = direction ? ` ${direction}` : "";
  console.log(`✓ ${vm.name} → ${action}${dirStr}`);
}

function cmdSubmit(matchId: string, teamIdStr: string) {
  const match = loadMatch(matchId);
  const teamId = parseInt(teamIdStr) as 1 | 2;
  const { gameState, timer } = match;

  if (!timer) {
    console.error("No active turn (game may be over).");
    process.exit(1);
  }

  if (!isGameActive(gameState)) {
    console.error("Game is already over.");
    const winner = getWinner(gameState);
    if (winner) console.log(`Winner: ${winner.name}`);
    process.exit(1);
  }

  const key = String(teamId);
  const commands = match.pendingCommands[key] ?? [];

  // Submit to timer
  submitTimerCommands(timer, teamId, commands);
  console.log(`Team ${teamId} submitted ${commands.length} commands.`);

  // Check if both teams ready → auto-resolve
  if (bothTeamsReady(timer)) {
    console.log("\nBoth teams submitted. Resolving turn...\n");

    const turnLog = resolveTurn(gameState, timer);
    match.turnLogs.push(turnLog);

    // Print turn results
    if (turnLog && typeof turnLog === "object") {
      const log = turnLog as Record<string, unknown>;
      if (Array.isArray(log.results)) {
        for (const r of log.results) {
          const result = r as Record<string, unknown>;
          const cmd = result.command as Record<string, unknown>;
          const success = result.success ? "✓" : "✗";
          const dmg = result.damageDealt ? ` (${result.damageDealt} dmg)` : "";
          const ko = result.targetKO ? " [KO!]" : "";
          const reason = result.reason ? ` — ${result.reason}` : "";
          const dir = cmd.direction ? ` ${cmd.direction}` : "";
          console.log(`  ${success} ${cmd.cinderlingUuid} ${cmd.type}${dir}${dmg}${ko}${reason}`);
        }
      }
    }

    // Clear pending commands
    match.pendingCommands = {};

    // Check game over
    if (!isGameActive(gameState)) {
      const winner = getWinner(gameState);
      console.log(`\n🏆 GAME OVER — ${winner?.name ?? "Unknown"} wins! (${gameState.result?.condition})`);
    } else {
      // Start next turn
      match.timer = startTurn(gameState);
      console.log(`\n${renderBoard(gameState)}`);
    }
  } else {
    console.log("Waiting for the other team to submit...");
  }

  saveMatch(match);
}

function cmdReport(matchId: string) {
  const match = loadMatch(matchId);
  const { gameState, turnLogs, stats } = match;

  const report = {
    matchId: match.id,
    createdAt: match.createdAt,
    completedAt: new Date().toISOString(),
    turns: gameState.turn,
    result: gameState.result,
    winner: gameState.result ? gameState.teams[gameState.result.winner - 1].name : null,
    teams: gameState.teams.map((t) => ({
      id: t.id,
      name: t.name,
      energy: t.energy,
      active: t.active.map((v) => ({
        uuid: v.uuid,
        name: v.name,
        hp: v.hp,
        maxHp: v.maxHp,
        isKO: v.isKO,
        position: v.position,
        stats: stats[v.uuid] ?? null,
      })),
      bench: t.bench.map((v) => ({ uuid: v.uuid, name: v.name, hp: v.hp, maxHp: v.maxHp })),
      knocked: t.knocked.map((v) => ({ uuid: v.uuid, name: v.name, stats: stats[v.uuid] ?? null })),
    })),
    turnLogs,
    config: GAME_CONFIG,
  };

  const reportPath = join(STATE_DIR, `${matchId}-report.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report saved: ${reportPath}`);
  console.log(JSON.stringify(report, null, 2));
}

// ─── Upload ──────────────────────────────────────────────────────────────────

/**
 * Upload a local match to the cinderling.game server so the spectate view
 * works from the deployed site.
 *
 * Usage:
 *   cinderling upload <matchId> [--url <baseUrl>] [--key <apiKey>]
 *
 * Config (in priority order):
 *   1. CLI flags: --url, --key
 *   2. Env vars: CINDERLING_URL, CINDERLING_UPLOAD_API_KEY
 *   3. .cinderling/config.json: { "url": "...", "apiKey": "..." }
 */
async function cmdUpload(matchId: string, cliUrl?: string, cliKey?: string) {
  // ── Load config ──────────────────────────────────────────────────────────
  let fileUrl: string | undefined;
  let fileKey: string | undefined;
  const configPath = join(STATE_DIR, "config.json");
  if (existsSync(configPath)) {
    try {
      const cfg = JSON.parse(readFileSync(configPath, "utf-8")) as Record<string, string>;
      fileUrl = cfg.url;
      fileKey = cfg.apiKey;
    } catch { /* ignore malformed config */ }
  }

  const baseUrl = (cliUrl ?? process.env.CINDERLING_URL ?? fileUrl ?? "https://cinderling.game").replace(/\/$/, "");
  const apiKey  = cliKey ?? process.env.CINDERLING_UPLOAD_API_KEY ?? fileKey;

  if (!apiKey) {
    console.error("❌  No API key found. Provide one via:");
    console.error("    --key <apiKey>");
    console.error("    CINDERLING_UPLOAD_API_KEY=<key> in env");
    console.error("    .cinderling/config.json → { \"apiKey\": \"...\" }");
    process.exit(1);
  }

  // ── Load match ───────────────────────────────────────────────────────────
  const match = loadMatch(matchId);

  // ── POST to server ───────────────────────────────────────────────────────
  const url = `${baseUrl}/api/matches/upload`;
  console.log(`Uploading match ${matchId} → ${url} ...`);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        id: match.id,
        gameState: match.gameState,
        status: match.gameState.result ? "completed" : "playing",
      }),
    });
  } catch (e) {
    console.error(`❌  Network error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`❌  Upload failed (HTTP ${res.status}): ${body}`);
    process.exit(1);
  }

  const result = await res.json() as { ok: boolean; id: string; spectateUrl: string };
  console.log(`✅  Match uploaded successfully!`);
  console.log(`🔗  Spectate: ${result.spectateUrl}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const cmd = args[0];
const sub = args[1];

switch (cmd) {
  case "match":
    if (sub === "create") cmdMatchCreate();
    else if (sub === "list") cmdMatchList();
    else { console.error("Usage: cinderling match <create|list>"); process.exit(1); }
    break;

  case "board":
    if (!sub) { console.error("Usage: cinderling board <matchId>"); process.exit(1); }
    cmdBoard(sub);
    break;

  case "status":
    if (!sub) { console.error("Usage: cinderling status <matchId>"); process.exit(1); }
    cmdStatus(sub);
    break;

  case "cmd":
    if (args.length < 5) {
      console.error("Usage: cinderling cmd <matchId> <teamId> <cinderlingId> <action> [direction]");
      console.error("  action: move, attack, harvest");
      console.error("  direction: up, down, left, right (required for move/attack)");
      console.error("  cinderlingId: uuid (e.g. '1-0') or name (e.g. 'aerobolt')");
      process.exit(1);
    }
    cmdCmd(args[1], args[2], args[3], args[4], args[5]);
    break;

  case "submit":
    if (args.length < 3) {
      console.error("Usage: cinderling submit <matchId> <teamId>"); process.exit(1);
    }
    cmdSubmit(args[1], args[2]);
    break;

  case "report":
    if (!sub) { console.error("Usage: cinderling report <matchId>"); process.exit(1); }
    cmdReport(sub);
    break;

  case "upload": {
    if (!sub) { console.error("Usage: cinderling upload <matchId> [--url <baseUrl>] [--key <apiKey>]"); process.exit(1); }
    // Parse optional --url and --key flags
    const uploadArgs = args.slice(2);
    let uploadUrl: string | undefined;
    let uploadKey: string | undefined;
    for (let i = 0; i < uploadArgs.length; i++) {
      if (uploadArgs[i] === "--url" && uploadArgs[i + 1]) uploadUrl = uploadArgs[++i];
      else if (uploadArgs[i] === "--key" && uploadArgs[i + 1]) uploadKey = uploadArgs[++i];
    }
    await cmdUpload(sub, uploadUrl, uploadKey);
    break;
  }

  default:
    console.log(`
cinderling CLI — playtest matches from the terminal

Commands:
  cinderling match create                              Create a new match
  cinderling match list                                List local matches
  cinderling board <matchId>                           Show the board
  cinderling status <matchId>                          One-line summary
  cinderling cmd <id> <team> <cinderling> <action> [dir] Issue a command
  cinderling submit <matchId> <teamId>                 Submit team's turn
  cinderling report <matchId>                          Generate match report
  cinderling upload <matchId> [--url <url>] [--key <key>]
                                                     Upload match to server for spectating

Examples:
  cinderling match create
  cinderling cmd abc123 1 aerobolt move right
  cinderling cmd abc123 1 1-0 attack down
  cinderling submit abc123 1
  cinderling upload abc123 --key myapikey
`);
}
