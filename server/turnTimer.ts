/**
 * Turn timer for cinderling matches.
 *
 * Each turn has a configurable time limit (default 30 seconds) for both
 * players to submit their commands. When the timer expires, any cinderlings
 * without submitted commands automatically Harvest (if on a harvestable space)
 * or stand idle (no-op).
 *
 * The timer is server-authoritative — clients get countdown updates
 * but the server decides when time is up.
 */

import { GAME_CONFIG } from "./config";
import type { Command } from "./commands";


// ─── Types ───────────────────────────────────────────────────────────────────

export type TurnTimerState = {
  /** Turn number this timer is for */
  turn: number;
  /** When the turn started (Unix ms) */
  startedAt: number;
  /** When the turn expires (Unix ms) */
  expiresAt: number;
  /** Duration in seconds */
  durationSeconds: number;
  /** Whether team 1 has submitted commands */
  team1Submitted: boolean;
  /** Whether team 2 has submitted commands */
  team2Submitted: boolean;
  /** Team 1's submitted commands (null if not yet submitted) */
  team1Commands: Command[] | null;
  /** Team 2's submitted commands (null if not yet submitted) */
  team2Commands: Command[] | null;
};

// ─── Timer Management ────────────────────────────────────────────────────────

/**
 * Create a new turn timer for the given turn.
 * Pass durationSeconds = 0 for no timer (turn never auto-expires).
 */
export function createTurnTimer(
  turn: number,
  durationOverride?: number,
): TurnTimerState {
  const now = Date.now();
  const durationSeconds =
    durationOverride ?? GAME_CONFIG.timing.turnTimerSeconds;

  return {
    turn,
    startedAt: now,
    // duration 0 = no timer — set expiry far in the future
    expiresAt:
      durationSeconds === 0
        ? now + 365 * 24 * 60 * 60 * 1000
        : now + durationSeconds * 1000,
    durationSeconds,
    team1Submitted: false,
    team2Submitted: false,
    team1Commands: null,
    team2Commands: null,
  };
}

/**
 * Submit commands for a team.
 * Returns true if accepted, false if already submitted or timer expired.
 */
export function submitCommands(
  timer: TurnTimerState,
  teamId: 1 | 2,
  commands: Command[],
): { accepted: boolean; reason?: string } {
  // Check if timer has expired
  if (isExpired(timer)) {
    return { accepted: false, reason: "Turn timer expired" };
  }

  // Check if already submitted
  if (teamId === 1 && timer.team1Submitted) {
    return { accepted: false, reason: "Commands already submitted" };
  }
  if (teamId === 2 && timer.team2Submitted) {
    return { accepted: false, reason: "Commands already submitted" };
  }

  // Accept commands
  if (teamId === 1) {
    timer.team1Submitted = true;
    timer.team1Commands = commands;
  } else {
    timer.team2Submitted = true;
    timer.team2Commands = commands;
  }

  return { accepted: true };
}

/**
 * Check if both teams have submitted their commands.
 */
export function bothTeamsReady(timer: TurnTimerState): boolean {
  return timer.team1Submitted && timer.team2Submitted;
}

/**
 * Check if the timer has expired.
 * Timers with durationSeconds=0 (no timer) never expire.
 */
export function isExpired(timer: TurnTimerState): boolean {
  if (timer.durationSeconds === 0) return false;
  return Date.now() >= timer.expiresAt;
}

/**
 * Check if the turn should resolve (both submitted OR timer expired).
 */
export function shouldResolveTurn(timer: TurnTimerState): boolean {
  return bothTeamsReady(timer) || isExpired(timer);
}

/**
 * Get remaining time in seconds.
 */
export function remainingSeconds(timer: TurnTimerState): number {
  const remaining = (timer.expiresAt - Date.now()) / 1000;
  return Math.max(0, Math.round(remaining));
}

/**
 * Get elapsed time in seconds.
 */
export function elapsedSeconds(timer: TurnTimerState): number {
  const elapsed = (Date.now() - timer.startedAt) / 1000;
  return Math.min(timer.durationSeconds, Math.round(elapsed));
}

// ─── Default Commands ────────────────────────────────────────────────────────

/**
 * Generate default commands for a team that didn't submit in time.
 *
 * Default behavior: each cinderling with no command does Harvest if on
 * a harvestable space, otherwise stands idle (no command).
 *
 * This is called when the timer expires and a team hasn't submitted.
 */
export function generateDefaultCommands(
  cinderlingUuids: string[],
): Command[] {
  // Default: all cinderlings harvest downward (dy+1 = game down).
  // If the adjacent space isn't harvestable or is blocked, the command fails gracefully.
  return cinderlingUuids.map((uuid) => ({
    type: "harvest" as const,
    cinderlingUuid: uuid,
    vec: { dx: 0, dy: 1 } as const,
  }));
}

/**
 * Get the final commands for both teams, filling in defaults for
 * any team that didn't submit before the timer expired.
 */
export function getFinalCommands(
  timer: TurnTimerState,
  team1ActiveUuids: string[],
  team2ActiveUuids: string[],
): { team1: Command[]; team2: Command[] } {
  return {
    team1: timer.team1Commands ?? generateDefaultCommands(team1ActiveUuids),
    team2: timer.team2Commands ?? generateDefaultCommands(team2ActiveUuids),
  };
}

// ─── Client Sync ─────────────────────────────────────────────────────────────

/**
 * Get timer state safe to send to a client.
 * Hides the opponent's commands until resolution.
 */
export function getClientTimerState(
  timer: TurnTimerState,
  forTeam: 1 | 2,
): {
  turn: number;
  remainingSeconds: number;
  durationSeconds: number;
  youSubmitted: boolean;
  opponentSubmitted: boolean;
} {
  return {
    turn: timer.turn,
    remainingSeconds: remainingSeconds(timer),
    durationSeconds: timer.durationSeconds,
    youSubmitted: forTeam === 1 ? timer.team1Submitted : timer.team2Submitted,
    opponentSubmitted: forTeam === 1 ? timer.team2Submitted : timer.team1Submitted,
  };
}
