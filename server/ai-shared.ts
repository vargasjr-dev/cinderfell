/**
 * Shared helpers for AI player models (Claude + Jev).
 *
 * Both models need the same inputs: a description of the game state and the
 * set of legal actions available to each cinderling.  They differ in how they
 * consume them — Claude reads prose and writes JSON commands; Jev answers
 * typed Choice questions with one option per valid action.
 */

import type { GameState, TeamState, CinderlingState, Vec2 } from "./types";
import type { Command } from "./commands";
import { generateAICommands } from "./ai-opponent";

export const VECS: Vec2[] = [
  { dx: 0, dy: -1 }, // up
  { dx: 0, dy: 1 },  // down
  { dx: -1, dy: 0 }, // left
  { dx: 1, dy: 0 },  // right
];

export function vecName(vec: Vec2): string {
  if (vec.dx === 1) return "right";
  if (vec.dx === -1) return "left";
  if (vec.dy === 1) return "down";
  if (vec.dy === -1) return "up";
  return `(${vec.dx},${vec.dy})`;
}

/** One legal action a cinderling could take this turn. */
export type ValidAction = {
  /** Stable identifier, e.g. "attack_0_right" or "move_left". */
  key: string;
  kind: "attack" | "move" | "harvest";
  attackIndex?: number;
  vec: Vec2;
  /** Human-readable description of what this action does. */
  description: string;
};

/**
 * Enumerate every legal action for a cinderling this turn: attacks that have a
 * target in range (and affordable energy), unblocked moves, and adjacent
 * harvestable tiles.  Mirrors the engine's scanForTarget blocking rules.
 */
export function enumerateValidActions(
  v: CinderlingState,
  aiTeam: TeamState,
  enemyTeam: TeamState,
  state: GameState,
): ValidAction[] {
  const pos = v.position;
  if (!pos) return [];

  const actions: ValidAction[] = [];

  // Attacks
  for (let i = 0; i < v.attacks.length; i++) {
    const atk = v.attacks[i];
    if (!atk || aiTeam.energy < atk.energyCost) continue;
    for (const vec of VECS) {
      if (scanHasEnemy(v, vec, atk.range, atk.arcOver ?? false, aiTeam, enemyTeam, state)) {
        actions.push({
          key: `attack_${i}_${vecName(vec)}`,
          kind: "attack",
          attackIndex: i,
          vec,
          description: `Use ${atk.name} (${atk.damage} dmg, range ${atk.range}, cost ${atk.energyCost}) facing ${vecName(vec)} — hits the first enemy in that line`,
        });
      }
    }
  }

  // Moves
  for (const vec of VECS) {
    if (canMoveTo(v, vec, state)) {
      actions.push({
        key: `move_${vecName(vec)}`,
        kind: "move",
        vec,
        description: `Move ${vecName(vec)} to the adjacent tile`,
      });
    }
  }

  // Harvest
  for (const vec of VECS) {
    const tx = pos.x + vec.dx;
    const ty = pos.y + vec.dy;
    const space = state.board.find(
      (s) => s.position.x === tx && s.position.y === ty,
    );
    if (space?.type === "harvestable") {
      actions.push({
        key: `harvest_${vecName(vec)}`,
        kind: "harvest",
        vec,
        description: `Harvest the tile ${vecName(vec)} to gain team energy`,
      });
    }
  }

  return actions;
}

/** True if scanning from v along vec finds an enemy within range (with blocker rules). */
function scanHasEnemy(
  v: CinderlingState,
  vec: Vec2,
  range: number,
  arcOver: boolean,
  aiTeam: TeamState,
  enemyTeam: TeamState,
  state: GameState,
): boolean {
  const pos = v.position!;
  for (let r = 1; r <= range; r++) {
    const tx = pos.x + vec.dx * r;
    const ty = pos.y + vec.dy * r;
    const space = state.board.find(
      (s) => s.position.x === tx && s.position.y === ty,
    );
    if (!space || space.type === "void") return false;
    const enemy = enemyTeam.active.find(
      (e) => !e.isKO && e.position?.x === tx && e.position?.y === ty,
    );
    if (enemy) return true;
    const friendly = aiTeam.active.find(
      (f) => f.uuid !== v.uuid && !f.isKO && f.position?.x === tx && f.position?.y === ty,
    );
    if (friendly && !arcOver) return false;
  }
  return false;
}

function canMoveTo(v: CinderlingState, vec: Vec2, state: GameState): boolean {
  const pos = v.position!;
  const tx = pos.x + vec.dx;
  const ty = pos.y + vec.dy;
  const space = state.board.find(
    (s) => s.position.x === tx && s.position.y === ty,
  );
  if (!space || space.type === "void") return false;
  return !state.teams.some((t) =>
    t.active.some((a) => !a.isKO && a.position?.x === tx && a.position?.y === ty),
  );
}

/**
 * Shared text description of the game state for the AI team.  Both models
 * consume this — Claude as the user message, Jev as the state block.
 */
export function describeGameState(
  state: GameState,
  aiTeam: TeamState,
  aiTeamId: 1 | 2,
  enemyTeam: TeamState,
): string {
  const lines: string[] = [
    `TURN ${state.turn} — YOUR TEAM: Team ${aiTeamId} "${aiTeam.name}" (energy: ${aiTeam.energy})`,
    "",
    "YOUR CINDERLINGS:",
  ];

  const activeCinderlings = aiTeam.active.filter((v) => !v.isKO && v.position != null);
  for (const v of activeCinderlings) {
    const pos = v.position!;
    const attacks = v.attacks
      .map((a, i) => `[${i}] ${a.name} (cost:${a.energyCost}, dmg:${a.damage}, range:${a.range})`)
      .join(", ");
    const actions = enumerateValidActions(v, aiTeam, enemyTeam, state)
      .map((a) => a.key)
      .join(", ");
    lines.push(
      `  ${v.name} (uuid: ${v.uuid}) at (${pos.x},${pos.y}) HP:${v.hp}/${v.maxHp} SPD:${v.speed}`,
      `    Attacks: ${attacks}`,
      `    Valid actions: ${actions || "none (will use fallback move)"}`,
    );
  }

  lines.push("", `ENEMY TEAM: Team ${enemyTeam.id} "${enemyTeam.name}" (energy: ${enemyTeam.energy})`);
  const enemyActive = enemyTeam.active.filter((v) => !v.isKO && v.position != null);
  if (enemyActive.length === 0) {
    lines.push("  (no active cinderlings)");
  }
  for (const v of enemyActive) {
    const pos = v.position!;
    lines.push(`  ${v.name} at (${pos.x},${pos.y}) HP:${v.hp}/${v.maxHp}`);
  }

  const koCount = enemyTeam.knocked.length + enemyTeam.active.filter((v) => v.isKO).length;
  if (koCount > 0) lines.push(`  (${koCount} KO'd)`);

  const harvestables = state.board
    .filter((s) => s.type === "harvestable")
    .map((s) => `(${s.position.x},${s.position.y})`)
    .join(", ");
  if (harvestables) {
    lines.push("", `HARVESTABLE TILES: ${harvestables}`);
  }

  return lines.join("\n");
}

/**
 * Rule-based fallback command for a single cinderling.  Runs the deterministic
 * ai-opponent strategy and picks that mon's command out of the result.
 */
export function fallbackCommandFor(
  state: GameState,
  aiTeamId: 1 | 2,
  cinderlingUuid: string,
): Command {
  const all = generateAICommands(state, aiTeamId);
  return (
    all.find((c) => c.cinderlingUuid === cinderlingUuid) ?? {
      type: "move",
      cinderlingUuid,
      vec: { dx: 0, dy: -1 },
    }
  );
}
