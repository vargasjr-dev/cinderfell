/**
 * Unified energy system for cinderling matches.
 *
 * Energy is a team-wide pool — shared across all cinderlings.
 * - Attacks spend energy from the pool (cost varies per attack)
 * - Harvesting generates energy (+1 base rate per action, some spaces give more)
 * - At 0 energy, only Move and Harvest are available (no attacks)
 * - Energy is both the Accumulation win condition AND the attack resource
 *
 * This creates the core tension: every attack is a direct tradeoff against
 * winning via Accumulation, and every harvest is a turn not attacking.
 */

import { GAME_CONFIG } from "./config";
import type { TeamState, GameState, BoardSpace } from "./types";

// ─── Energy Operations ───────────────────────────────────────────────────────

/**
 * Initialize energy for a team at match start.
 */
export function initializeEnergy(team: TeamState): void {
  team.energy = GAME_CONFIG.energy.starting;
}

/**
 * Spend energy from a team's pool for an attack.
 * Returns true if successful, false if insufficient energy.
 */
export function spendEnergy(team: TeamState, cost: number): boolean {
  if (cost < 0) return false;
  if (team.energy < cost) return false;

  team.energy -= cost;
  return true;
}

/**
 * Harvest energy — add to team pool based on the space's harvest value.
 *
 * @param team The team harvesting
 * @param space The board space being harvested (must be harvestable)
 * @returns The amount of energy gained, or 0 if space isn't harvestable
 */
export function harvestEnergy(
  team: TeamState,
  space: BoardSpace,
): number {
  if (space.type !== "harvestable") return 0;

  const amount = space.harvestYield ?? GAME_CONFIG.energy.baseHarvestRate;
  team.energy += amount;
  return amount;
}

/**
 * Check if a team can afford an attack of the given energy cost.
 */
export function canAffordAttack(team: TeamState, cost: number): boolean {
  return team.energy >= cost && cost >= 0;
}

/**
 * Check if a team has any energy at all (determines if Attack is available).
 * Per rules: at 0 energy, only Move and Harvest are available.
 */
export function hasEnergy(team: TeamState): boolean {
  return team.energy > 0;
}

// ─── Energy Queries ──────────────────────────────────────────────────────────

/**
 * Get the energy needed to reach the Accumulation win threshold.
 */
export function energyToWin(team: TeamState): number {
  return Math.max(0, GAME_CONFIG.energy.accumulationWinThreshold - team.energy);
}

/**
 * Get energy as a percentage toward the Accumulation win threshold.
 * Useful for HUD display.
 */
export function energyProgress(team: TeamState): number {
  return Math.min(
    100,
    (team.energy / GAME_CONFIG.energy.accumulationWinThreshold) * 100,
  );
}

/**
 * Get a summary of both teams' energy state for the turn log.
 */
export function energySummary(state: GameState): {
  team1: { energy: number; progress: number; canAttack: boolean };
  team2: { energy: number; progress: number; canAttack: boolean };
} {
  const [team1, team2] = state.teams;
  return {
    team1: {
      energy: team1.energy,
      progress: energyProgress(team1),
      canAttack: hasEnergy(team1),
    },
    team2: {
      energy: team2.energy,
      progress: energyProgress(team2),
      canAttack: hasEnergy(team2),
    },
  };
}
