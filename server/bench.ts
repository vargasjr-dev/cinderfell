/**
 * Bench auto-entry and spawn space rules.
 *
 * When an active cinderling is KO'd:
 * - The next bench cinderling enters instantly at their pre-assigned spawn point
 * - No delay, no in-match choice — all decided during team setup
 * - If the spawn point is occupied, the cinderling queues until it's free
 *   (enters next turn the space is clear)
 *
 * Spawn spaces are one-way entry points:
 * - Cinderlings cannot move back onto spawn spaces after leaving
 * - This prevents spawn-blocking strategies
 *
 * Bench order and spawn positions are pre-assigned during team setup.
 */

import type {
  GameState,
  TeamState,
  CinderlingState,
  Position,
} from "./types";

// ─── Bench Queue ─────────────────────────────────────────────────────────────

/**
 * Check if a spawn position is clear (no cinderling occupying it).
 */
function isSpawnClear(state: GameState, position: Position): boolean {
  for (const team of state.teams) {
    const occupied = team.active.some(
      (v) =>
        !v.isKO &&
        v.position?.x === position.x &&
        v.position?.y === position.y,
    );
    if (occupied) return false;
  }
  return true;
}

/**
 * Process bench entries for a team after KOs have been resolved.
 *
 * For each KO'd active cinderling, if there's a bench cinderling waiting:
 * - Check if their pre-assigned spawn point is free
 * - If free: move them from bench to active at that position
 * - If occupied: they stay on the bench and try again next turn
 *
 * Returns a list of entries that occurred (for the battle log).
 */
export function processBenchEntries(
  team: TeamState,
  state: GameState,
): BenchEntry[] {
  const entries: BenchEntry[] = [];

  // Count how many active slots are open (KO'd cinderlings)
  const koCount = team.active.filter((v) => v.isKO).length;
  if (koCount === 0 || team.bench.length === 0) return entries;

  // Process bench entries in order (bench is pre-sorted by player)
  const toEnter: CinderlingState[] = [];
  const remaining: CinderlingState[] = [];

  for (const benchMon of team.bench) {
    if (toEnter.length >= koCount) {
      remaining.push(benchMon);
      continue;
    }

    // Try the pre-assigned spawn first, then fall back to any clear team spawn
    const assignedClear = isSpawnClear(state, benchMon.spawnPosition);
    const entryPos: Position | null = assignedClear
      ? benchMon.spawnPosition
      : (() => {
          // Find all spawn tiles belonging to this team and pick a clear one
          const teamSpawns = state.board.filter(
            (s) => s.type === "spawn" && s.team === team.id,
          );
          for (const s of teamSpawns) {
            if (isSpawnClear(state, s.position)) return s.position;
          }
          return null;
        })();

    if (entryPos) {
      // Enter the battlefield
      benchMon.position = { ...entryPos };
      benchMon.isKO = false;
      toEnter.push(benchMon);

      entries.push({
        cinderlingUuid: benchMon.uuid,
        cinderlingName: benchMon.name,
        spawnPosition: { ...entryPos },
        status: "entered",
      });
    } else {
      // All team spawns blocked — queue for next turn
      remaining.push(benchMon);

      entries.push({
        cinderlingUuid: benchMon.uuid,
        cinderlingName: benchMon.name,
        spawnPosition: { ...benchMon.spawnPosition },
        status: "blocked",
      });
    }
  }

  // Move entered cinderlings from bench to active
  team.active = [
    ...team.active.filter((v) => !v.isKO || !toEnter.some((e) => e.uuid === v.uuid)),
    ...toEnter,
  ];

  // Remove KO'd cinderlings that have been replaced from active to knocked
  const replacedKOs = team.active.filter(
    (v) => v.isKO && !team.knocked.some((k) => k.uuid === v.uuid),
  );
  team.knocked = [...team.knocked, ...replacedKOs];
  team.active = team.active.filter((v) => !v.isKO);

  // Update bench
  team.bench = remaining;

  return entries;
}

export type BenchEntry = {
  cinderlingUuid: string;
  cinderlingName: string;
  spawnPosition: Position;
  status: "entered" | "blocked";
};

// ─── Full Bench Processing ───────────────────────────────────────────────────

/**
 * Process bench entries for both teams after a resolution step.
 * Called after KOs are processed and before win conditions are checked.
 */
export function processAllBenchEntries(
  state: GameState,
): { team1: BenchEntry[]; team2: BenchEntry[] } {
  const [team1, team2] = state.teams;
  return {
    team1: processBenchEntries(team1, state),
    team2: processBenchEntries(team2, state),
  };
}

// ─── Team Setup Validation ───────────────────────────────────────────────────

/**
 * Validate that a team's bench spawn assignments are valid.
 * Each bench cinderling must have a spawn position that:
 * - Is on the correct team's side of the board
 * - Is a spawn-type space
 * - Is not assigned to another bench cinderling
 *
 * Returns error messages or empty array if valid.
 */
export function validateBenchSpawnAssignments(
  team: TeamState,
  state: GameState,
): string[] {
  const errors: string[] = [];
  const usedSpawns = new Set<string>();

  for (const benchMon of team.bench) {
    const posKey = `${benchMon.spawnPosition.x},${benchMon.spawnPosition.y}`;

    // Check for duplicates
    if (usedSpawns.has(posKey)) {
      errors.push(
        `${benchMon.name} has duplicate spawn position (${posKey})`,
      );
    }
    usedSpawns.add(posKey);

    // Check that position is a spawn space
    const space = state.board.find(
      (s) =>
        s.position.x === benchMon.spawnPosition.x &&
        s.position.y === benchMon.spawnPosition.y,
    );

    if (!space) {
      errors.push(
        `${benchMon.name} spawn position (${posKey}) is off the board`,
      );
    } else if (space.type !== "spawn") {
      errors.push(
        `${benchMon.name} spawn position (${posKey}) is not a spawn space`,
      );
    } else if (space.team !== team.id) {
      errors.push(
        `${benchMon.name} spawn position (${posKey}) belongs to the other team`,
      );
    }
  }

  return errors;
}
