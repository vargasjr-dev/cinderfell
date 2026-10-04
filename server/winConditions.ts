/**
 * Win condition detection for cinderling matches.
 *
 * Three win conditions, checked after each priority resolution:
 * 1. Elimination — KO all opponent's cinderlings (active + bench + knocked = all KO'd)
 * 2. Occupation — control all occupation points on the board
 * 3. Accumulation — reach energy threshold
 *
 * If both players trigger a win condition on the same resolution step,
 * the condition with higher priority wins (Elimination > Occupation > Accumulation).
 */

import { GAME_CONFIG } from "./config";
import type { GameState, TeamState, WinResult, BoardSpace } from "./types";

// ─── Individual Checks ───────────────────────────────────────────────────────

/**
 * Check if a team has eliminated all of the opponent's cinderlings.
 * All 8 cinderlings (active + bench + knocked) must be KO'd.
 */
export function checkElimination(
  opponent: TeamState,
): boolean {
  const totalAlive =
    opponent.active.filter((v) => !v.isKO).length +
    opponent.bench.length;
  return totalAlive === 0;
}

/**
 * Check if a team controls all occupation points on the board.
 * A point is "controlled" when the counter reaches ±ticksToControl
 * in that team's direction.
 *
 * Convention: negative counters = team 1 controls, positive = team 2 controls.
 */
export function checkOccupation(
  teamId: 1 | 2,
  board: BoardSpace[],
): boolean {
  const occupationSpaces = board.filter((s) => s.type === "occupation");

  if (occupationSpaces.length === 0) return false;

  const threshold = GAME_CONFIG.occupation.ticksToControl;

  return occupationSpaces.every((space) => {
    const counter = space.occupationCounter ?? 0;
    if (teamId === 1) return counter <= -threshold;
    return counter >= threshold;
  });
}

/**
 * Check if a team has reached the energy accumulation threshold.
 * @param threshold Override threshold; falls back to GAME_CONFIG default.
 */
export function checkAccumulation(
  team: TeamState,
  threshold = GAME_CONFIG.energy.accumulationWinThreshold,
): boolean {
  return team.energy >= threshold;
}

// ─── Combined Check ──────────────────────────────────────────────────────────

/**
 * Check all win conditions for both teams.
 *
 * Returns the winning result if someone has won, or null if game continues.
 *
 * Priority when both teams win simultaneously:
 * Elimination > Occupation > Accumulation
 * If same condition triggers for both teams on the same step, it's a draw
 * (for now, first team in array wins — revisit if this edge case matters).
 */
export function checkWinConditions(state: GameState): WinResult | null {
  const [team1, team2] = state.teams;

  // Check Elimination (highest priority)
  const team1Eliminates = checkElimination(team2);
  const team2Eliminates = checkElimination(team1);

  if (team1Eliminates && !team2Eliminates) {
    return { winner: 1, condition: "elimination" };
  }
  if (team2Eliminates && !team1Eliminates) {
    return { winner: 2, condition: "elimination" };
  }
  if (team1Eliminates && team2Eliminates) {
    // Simultaneous elimination — extremely rare, team 1 wins (first mover)
    return { winner: 1, condition: "elimination" };
  }

  // Check Occupation
  const team1Occupies = checkOccupation(1, state.board);
  const team2Occupies = checkOccupation(2, state.board);

  if (team1Occupies && !team2Occupies) {
    return { winner: 1, condition: "occupation" };
  }
  if (team2Occupies && !team1Occupies) {
    return { winner: 2, condition: "occupation" };
  }
  // Both controlling all points simultaneously is impossible by definition

  // Check Accumulation (lowest priority)
  const accThreshold = state.winningEnergy ?? GAME_CONFIG.energy.accumulationWinThreshold;
  const team1Accumulates = checkAccumulation(team1, accThreshold);
  const team2Accumulates = checkAccumulation(team2, accThreshold);

  if (team1Accumulates && !team2Accumulates) {
    return { winner: 1, condition: "accumulation" };
  }
  if (team2Accumulates && !team1Accumulates) {
    return { winner: 2, condition: "accumulation" };
  }
  if (team1Accumulates && team2Accumulates) {
    // Both hit threshold same turn — higher energy wins, tie = team 1
    return {
      winner: team1.energy >= team2.energy ? 1 : 2,
      condition: "accumulation",
    };
  }

  return null;
}

// ─── Occupation Counter Update ───────────────────────────────────────────────

export type OccupationEvent = {
  x: number;
  y: number;
  /** Counter before this turn's update */
  counterBefore: number;
  /** Counter after this turn's update */
  counterAfter: number;
  /** Which team is ticking the point (or null if no change) */
  tickingTeam: 1 | 2;
};

/**
 * Update occupation counters based on which cinderlings are standing on
 * occupation points at the end of a turn.
 *
 * Rules:
 * - Team cinderling on point → tick counter toward that team
 * - Opponent cinderling on point → tick counter back (contest/decrement)
 * - Both teams on same point → cancel out (no change)
 * - Nobody on point → no change
 *
 * Returns one event per point that actually changed.
 */
export function updateOccupationCounters(state: GameState): OccupationEvent[] {
  const [team1, team2] = state.teams;
  const threshold = GAME_CONFIG.occupation.ticksToControl;
  const events: OccupationEvent[] = [];

  for (const space of state.board) {
    if (space.type !== "occupation") continue;

    const team1OnSpace = team1.active.some(
      (v) =>
        !v.isKO &&
        v.position?.x === space.position.x &&
        v.position?.y === space.position.y,
    );
    const team2OnSpace = team2.active.some(
      (v) =>
        !v.isKO &&
        v.position?.x === space.position.x &&
        v.position?.y === space.position.y,
    );

    const counterBefore = space.occupationCounter ?? 0;

    if (team1OnSpace && !team2OnSpace) {
      // Tick toward team 1 (negative direction)
      space.occupationCounter = Math.max(counterBefore - 1, -threshold);
      if (space.occupationCounter !== counterBefore) {
        events.push({ x: space.position.x, y: space.position.y, counterBefore, counterAfter: space.occupationCounter, tickingTeam: 1 });
      }
    } else if (team2OnSpace && !team1OnSpace) {
      // Tick toward team 2 (positive direction)
      space.occupationCounter = Math.min(counterBefore + 1, threshold);
      if (space.occupationCounter !== counterBefore) {
        events.push({ x: space.position.x, y: space.position.y, counterBefore, counterAfter: space.occupationCounter, tickingTeam: 2 });
      }
    }
    // Both or neither → no change
  }

  return events;
}
