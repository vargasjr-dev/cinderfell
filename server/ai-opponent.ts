/**
 * AI Opponent Engine for Cinderling sparring matches.
 *
 * The AI uses the same command interface as human players — it generates
 * Command[] for each of its active cinderlings each turn.
 */

import type { GameState, TeamState, CinderlingState, Position, Vec2 } from "./types";
import type { Command, MoveCommand, AttackCommand, HarvestCommand } from "./commands";
import { GAME_CONFIG } from "./config";

// ─── Core AI ─────────────────────────────────────────────────────────────────

/**
 * Generate commands for all active AI cinderlings for the current turn.
 */
export function generateAICommands(
  state: GameState,
  aiTeamId: 1 | 2,
): Command[] {
  const aiTeam = state.teams[aiTeamId - 1];
  const enemyTeam = state.teams[aiTeamId === 1 ? 1 : 0];

  const activeCinderlings = aiTeam.active.filter(
    (v) => !v.isKO && v.position != null,
  );

  return activeCinderlings.map((v) =>
    generateMediumCommand(v, aiTeam, enemyTeam, state),
  );
}

// ─── AI Strategy ─────────────────────────────────────────────────────────────

function generateMediumCommand(
  cinderling: CinderlingState,
  aiTeam: TeamState,
  enemyTeam: TeamState,
  state: GameState,
): Command {
  // Priority 1: Attack if possible
  if (aiTeam.energy > 0) {
    for (let i = 0; i < cinderling.attacks.length; i++) {
      const atk = cinderling.attacks[i];
      if (atk && aiTeam.energy >= atk.energyCost) {
        for (const vec of VECS) {
          if (findTarget(cinderling, vec, atk.range, enemyTeam, aiTeam)) {
            return {
              type: "attack",
              cinderlingUuid: cinderling.uuid,
              attackIndex: i,
              vec,
            };
          }
        }
      }
    }
  }

  // Priority 2: Harvest if low energy
  if (aiTeam.energy < 3) {
    for (const vec of VECS) {
      if (canHarvest(cinderling, vec, state)) {
        return { type: "harvest", cinderlingUuid: cinderling.uuid, vec };
      }
    }
  }

  // Priority 3: Move toward nearest enemy
  const nearestEnemy = findNearestEnemy(cinderling, enemyTeam);
  if (nearestEnemy) {
    const vec = vecToward(cinderling.position!, nearestEnemy);
    if (vec && canMove(cinderling, vec, state)) {
      return { type: "move", cinderlingUuid: cinderling.uuid, vec };
    }
  }

  // Fallback: random valid move
  for (const vec of VECS) {
    if (canMove(cinderling, vec, state)) {
      return { type: "move", cinderlingUuid: cinderling.uuid, vec };
    }
  }
  // No valid move — move up (will be blocked and logged as failed)
  return { type: "move", cinderlingUuid: cinderling.uuid, vec: { dx: 0, dy: -1 } };
}

// ─── Utility Functions ───────────────────────────────────────────────────────

const VECS: Vec2[] = [
  { dx: 0, dy: -1 }, // up
  { dx: 0, dy: 1 },  // down
  { dx: -1, dy: 0 }, // left
  { dx: 1, dy: 0 },  // right
];

function canMove(
  cinderling: CinderlingState,
  vec: Vec2,
  state: GameState,
): boolean {
  if (!cinderling.position) return false;
  const target = {
    x: cinderling.position.x + vec.dx,
    y: cinderling.position.y + vec.dy,
  };

  // Check bounds
  const board = state.board;
  if (!board) return false;
  const space = board.find(
    (s) => s.position.x === target.x && s.position.y === target.y,
  );
  if (!space || space.type === "void") return false;

  // Check occupation by any cinderling
  for (const team of state.teams) {
    for (const v of team.active) {
      if (
        v.position &&
        v.position.x === target.x &&
        v.position.y === target.y &&
        !v.isKO
      ) {
        return false;
      }
    }
  }

  return true;
}

function canHarvest(
  cinderling: CinderlingState,
  vec: Vec2,
  state: GameState,
): boolean {
  if (!cinderling.position) return false;
  const target = {
    x: cinderling.position.x + vec.dx,
    y: cinderling.position.y + vec.dy,
  };

  const board = state.board;
  if (!board) return false;
  const space = board.find(
    (s) => s.position.x === target.x && s.position.y === target.y,
  );

  return space?.type === "harvestable";
}

function findTarget(
  cinderling: CinderlingState,
  vec: Vec2,
  range: number,
  enemyTeam: TeamState,
  ownTeam?: TeamState,
): CinderlingState | null {
  if (!cinderling.position) return null;

  for (let r = 1; r <= range; r++) {
    const checkPos = {
      x: cinderling.position.x + vec.dx * r,
      y: cinderling.position.y + vec.dy * r,
    };

    // Stop if a friendly unit blocks the line of sight (mirrors engine scanForTarget)
    if (ownTeam) {
      const friendlyBlocker = ownTeam.active.find(
        (f) =>
          !f.isKO &&
          f.uuid !== cinderling.uuid &&
          f.position?.x === checkPos.x &&
          f.position?.y === checkPos.y,
      );
      if (friendlyBlocker) return null;
    }

    for (const enemy of enemyTeam.active) {
      if (
        !enemy.isKO &&
        enemy.position &&
        enemy.position.x === checkPos.x &&
        enemy.position.y === checkPos.y
      ) {
        return enemy;
      }
    }
  }

  return null;
}

function findNearestEnemy(
  cinderling: CinderlingState,
  enemyTeam: TeamState,
): Position | null {
  if (!cinderling.position) return null;

  let nearest: Position | null = null;
  let nearestDist = Infinity;

  for (const enemy of enemyTeam.active) {
    if (enemy.isKO || !enemy.position) continue;
    const dist =
      Math.abs(enemy.position.x - cinderling.position.x) +
      Math.abs(enemy.position.y - cinderling.position.y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = enemy.position;
    }
  }

  return nearest;
}

/** Return the cardinal Vec2 pointing most directly from `from` toward `to`. */
function vecToward(from: Position, to: Position): Vec2 | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx > 0) return { dx: 1, dy: 0 };
    if (dx < 0) return { dx: -1, dy: 0 };
    return null;
  } else {
    if (dy > 0) return { dx: 0, dy: 1 };
    if (dy < 0) return { dx: 0, dy: -1 };
    return null;
  }
}
