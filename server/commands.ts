/**
 * Command set for cinderling matches.
 *
 * Four action slots per cinderling per turn (Pokémon-style):
 * - Move — move one space in a cardinal direction (free)
 * - Attack 1 — use first attack in a direction (costs energy)
 * - Attack 2 — use second attack in a direction (costs energy)
 * - Harvest — gather energy from adjacent space in a direction (free, must be harvestable)
 *
 * All actions are directional — player picks an action, then a direction vector.
 * Direction is stored as {dx, dy} — a unit cardinal Vec2 — so it is
 * orientation-agnostic. Clients translate screen directions to Vec2 before
 * sending; TurnHistory labels them based on the viewer's orientation.
 *
 * One command per cinderling per turn.
 * At 0 team energy, Attacks are unavailable.
 */

import { GAME_CONFIG } from "./config";
import { spendEnergy, harvestEnergy, hasEnergy } from "./energy";
import type {
  GameState,
  TeamState,
  CinderlingState,
  BoardSpace,
  Position,
  Vec2,
} from "./types";

// ─── Command Types ───────────────────────────────────────────────────────────

export type MoveCommand = {
  type: "move";
  cinderlingUuid: string;
  /** Cardinal unit vector in game space: {dx:1,dy:0} = right, {dx:0,dy:-1} = up, etc. */
  vec: Vec2;
};

export type AttackCommand = {
  type: "attack";
  cinderlingUuid: string;
  attackIndex: number;
  /** Cardinal unit vector in game space. */
  vec: Vec2;
};

export type HarvestCommand = {
  type: "harvest";
  cinderlingUuid: string;
  /** Cardinal unit vector in game space. */
  vec: Vec2;
};

export type Command = MoveCommand | AttackCommand | HarvestCommand;

export type CommandResult = {
  command: Command;
  success: boolean;
  reason?: string;
  /** Energy change from this command (negative = spent, positive = gained) */
  energyDelta?: number;
  /** Damage dealt (attack only) */
  damageDealt?: number;
  /** Target KO'd (attack only) */
  targetKO?: boolean;
  /** UUID of the cinderling that was hit (attack only, absent on whiff) */
  targetUuid?: string;
  /** Name of the attack used (attack only, e.g. "Snipe", "Strike") */
  attackName?: string;
  /**
   * Energy changes caused by special power effects on this command.
   * Keyed by team ID (1 or 2). Negative = drained, positive = gained.
   * e.g. { 2: -2 } means team 2 lost 2 energy (Voidclaw drain).
   */
  powerEnergyDeltas?: Partial<Record<1 | 2, number>>;
  /**
   * Effects triggered by the defender's special power (onDamaged hook).
   * e.g. Ironpup Loyal Guard: 2 bonus damage to attacker + 1 HP heal to self.
   */
  defenderPowerEffects?: Array<{
    type: "bonus_damage" | "heal";
    targetName: string;
    amount: number;
    powerName: string;
  }>;
  /**
   * Heal/damage effects triggered by the actor's own special power (onAfterCommand hook).
   * e.g. Sproutail Regrowth Tail: +3 HP heal to self after harvest.
   */
  actorPowerEffects?: Array<{
    type: "bonus_damage" | "heal";
    targetName: string;
    targetUuid: string;
    amount: number;
    powerName: string;
  }>;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSpace(
  board: BoardSpace[],
  pos: Position,
): BoardSpace | undefined {
  return board.find(
    (s) => s.position.x === pos.x && s.position.y === pos.y,
  );
}

function getCinderlingAtPosition(
  state: GameState,
  pos: Position,
): CinderlingState | undefined {
  for (const team of state.teams) {
    const found = team.active.find(
      (v) =>
        !v.isKO &&
        v.position?.x === pos.x &&
        v.position?.y === pos.y,
    );
    if (found) return found;
  }
  return undefined;
}

/**
 * Snapshot-aware variant: find the cinderling that occupied `pos` at the START
 * of the turn (before any moves resolved).  Returns the LIVE CinderlingState
 * object so that damage can still be applied to the correct entity, but only
 * matches against pre-turn positions to prevent movers from being hit when
 * they stepped into the attacker's line of fire mid-turn.
 */
function getCinderlingAtPositionFromSnapshot(
  state: GameState,
  pos: Position,
  snapshot: Map<string, Position | null>,
): CinderlingState | undefined {
  for (const team of state.teams) {
    for (const v of team.active) {
      if (v.isKO) continue;
      const snapPos = snapshot.get(v.uuid);
      if (snapPos && snapPos.x === pos.x && snapPos.y === pos.y) {
        return v; // live object, snapshot position
      }
    }
  }
  return undefined;
}

/**
 * Scan along a Vec2 direction from a position for the first enemy within range.
 * Returns the position of the first enemy found, or null if none.
 *
 * When `positionSnapshot` is provided, occupancy uses a "was-there-and-still-there"
 * rule: a mon is only a valid target at a tile if it was there at turn start AND
 * has not since moved. This handles two dodge cases correctly:
 *   • A mon that moved AWAY from a tile this turn is NOT hit (they dodged).
 *   • A mon that moved INTO a tile this turn is NOT hit (don't punish repositioning).
 * In both cases the tile is treated as empty and scanning continues.
 *
 * When no snapshot is provided, live positions are used (legacy / no-snapshot paths).
 */
function scanForTarget(
  state: GameState,
  from: Position,
  vec: Vec2,
  range: number,
  ownTeam: TeamState,
  positionSnapshot?: Map<string, Position | null>,
  arcOver?: boolean,
): { position: Position; target: CinderlingState } | null {
  for (let dist = 1; dist <= range; dist++) {
    const pos: Position = {
      x: from.x + vec.dx * dist,
      y: from.y + vec.dy * dist,
    };

    // Out of bounds — stop scanning
    if (
      pos.x < 0 ||
      pos.x >= state.boardWidth ||
      pos.y < 0 ||
      pos.y >= state.boardHeight
    ) {
      break;
    }

    // Void space — stop scanning (can't shoot through walls)
    const space = getSpace(state.board, pos);
    if (!space || space.type === "void") break;

    // Determine who (if anyone) is a valid occupant at this tile.
    // With snapshot: "was-there-and-still-there" — the same mon must appear in
    // both the start-of-turn snapshot and the current live state.  If the snapshot
    // mon moved away, liveOccupant will be null or a different uuid → tile is empty.
    // If a different mon moved in, the snapshot shows no one → tile is empty.
    let occupant: CinderlingState | undefined;
    if (positionSnapshot) {
      const snapOccupant = getCinderlingAtPositionFromSnapshot(state, pos, positionSnapshot);
      const liveOccupant = getCinderlingAtPosition(state, pos);
      if (snapOccupant && liveOccupant?.uuid === snapOccupant.uuid) {
        occupant = snapOccupant;
      }
      // else: mon moved away or moved in — treat tile as empty, keep scanning
    } else {
      occupant = getCinderlingAtPosition(state, pos);
    }

    if (occupant) {
      const isOwnTeam = ownTeam.active.some((v) => v.uuid === occupant.uuid);
      if (isOwnTeam) {
        if (arcOver) continue; // arc over allies — keep scanning
        break;                 // normal attacks stop at allied blockers
      }
      return { position: pos, target: occupant };
    }
  }

  return null;
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validate a command before resolution.
 * Returns an error string if invalid, null if valid.
 */
export function validateCommand(
  command: Command,
  team: TeamState,
  state: GameState,
): string | null {
  const cinderling = team.active.find(
    (v) => v.uuid === command.cinderlingUuid && !v.isKO,
  );

  if (!cinderling) {
    return "Cinderling not found or KO'd";
  }

  if (!cinderling.position) {
    return "Cinderling has no position";
  }

  switch (command.type) {
    case "move": {
      const target: Position = {
        x: cinderling.position.x + command.vec.dx,
        y: cinderling.position.y + command.vec.dy,
      };

      // Bounds check
      if (
        target.x < 0 ||
        target.x >= state.boardWidth ||
        target.y < 0 ||
        target.y >= state.boardHeight
      ) {
        return "Move out of bounds";
      }

      // Space type check
      const space = getSpace(state.board, target);
      if (!space || space.type === "void") {
        return "Cannot move to void space";
      }

      return null;
    }

    case "attack": {
      if (!hasEnergy(team)) {
        return "No energy — cannot attack";
      }

      const attack = cinderling.attacks[command.attackIndex];
      if (!attack) {
        return "Invalid attack index";
      }

      if (team.energy < attack.energyCost) {
        return `Not enough energy (need ${attack.energyCost}, have ${team.energy})`;
      }

      // No target check here — attacking into empty space is allowed and costs
      // energy (whiff penalty). resolveAttack handles the no-hit case.
      return null;
    }

    case "harvest": {
      const targetPos: Position = {
        x: cinderling.position.x + command.vec.dx,
        y: cinderling.position.y + command.vec.dy,
      };

      // Bounds check
      if (
        targetPos.x < 0 ||
        targetPos.x >= state.boardWidth ||
        targetPos.y < 0 ||
        targetPos.y >= state.boardHeight
      ) {
        return "Harvest target out of bounds";
      }

      const space = getSpace(state.board, targetPos);
      if (!space || space.type !== "harvestable") {
        return "Target space is not harvestable";
      }

      // Check for enemy blocking
      const blocker = getCinderlingAtPosition(state, targetPos);
      if (blocker) {
        const isOwnTeam = team.active.some((v) => v.uuid === blocker.uuid);
        if (!isOwnTeam) {
          return "Harvest blocked by enemy";
        }
      }

      return null;
    }
  }
}

/**
 * Get available commands for a cinderling (for UI).
 */
export function getAvailableCommands(
  cinderling: CinderlingState,
  team: TeamState,
  state: GameState,
): ("move" | "attack" | "harvest")[] {
  if (cinderling.isKO || !cinderling.position) return [];

  const available: ("move" | "attack" | "harvest")[] = [];

  // Move is always available (validation checks bounds at resolution)
  available.push("move");

  // Attack available whenever the team has energy — whiffing is allowed (costs energy)
  if (hasEnergy(team)) {
    available.push("attack");
  }

  // Harvest is always shown — direction validation happens at resolution
  available.push("harvest");

  return available;
}

// ─── Resolution ──────────────────────────────────────────────────────────────

/**
 * Resolve a single Move command.
 */
export function resolveMove(
  command: MoveCommand,
  team: TeamState,
  state: GameState,
): CommandResult {
  const cinderling = team.active.find(
    (v) => v.uuid === command.cinderlingUuid && !v.isKO,
  );
  if (!cinderling?.position) {
    return { command, success: false, reason: "Cinderling not found" };
  }

  const target: Position = {
    x: cinderling.position.x + command.vec.dx,
    y: cinderling.position.y + command.vec.dy,
  };

  const space = getSpace(state.board, target);
  if (
    !space ||
    space.type === "void" ||
    target.x < 0 ||
    target.x >= state.boardWidth ||
    target.y < 0 ||
    target.y >= state.boardHeight
  ) {
    return { command, success: false, reason: "Invalid move target" };
  }

  // Check for collision (another cinderling already at target that isn't moving away)
  const occupant = getCinderlingAtPosition(state, target);
  if (occupant) {
    return { command, success: false, reason: "Space occupied" };
  }

  cinderling.position = target;
  return { command, success: true };
}

/**
 * Resolve a single Attack command.
 * Scans along the vec for the first enemy within the attack's range.
 */
export function resolveAttack(
  command: AttackCommand,
  team: TeamState,
  state: GameState,
  positionSnapshot?: Map<string, Position | null>,
): CommandResult {
  const cinderling = team.active.find(
    (v) => v.uuid === command.cinderlingUuid && !v.isKO,
  );
  if (!cinderling?.position) {
    return { command, success: false, reason: "Cinderling not found" };
  }

  const attack = cinderling.attacks[command.attackIndex];
  if (!attack) {
    return { command, success: false, reason: "Invalid attack" };
  }

  if (!spendEnergy(team, attack.energyCost)) {
    return {
      command,
      success: false,
      reason: "Not enough energy",
    };
  }

  // Scan for first enemy in direction within range.
  // When positionSnapshot is provided, scanForTarget uses "was-there-and-still-there"
  // logic: a mon must have been at the scanned tile at turn start AND still be
  // there now to count as a valid hit.  Mons that moved are treated as having dodged.
  const hit = scanForTarget(
    state,
    cinderling.position,
    command.vec,
    attack.range,
    team,
    positionSnapshot,
    attack.arcOver,
  );

  if (!hit) {
    // Energy spent but no target — whiffed
    return {
      command,
      success: true,
      energyDelta: -attack.energyCost,
      damageDealt: 0,
      attackName: attack.name,
    };
  }

  // Deal damage
  const damage = attack.damage + cinderling.attack;
  hit.target.hp = Math.max(0, hit.target.hp - damage);
  const ko = hit.target.hp === 0;

  if (ko) {
    hit.target.isKO = true;
    hit.target.position = null;
  }

  return {
    command,
    success: true,
    energyDelta: -attack.energyCost,
    damageDealt: damage,
    targetKO: ko,
    targetUuid: hit.target.uuid,
    attackName: attack.name,
  };
}

/**
 * Resolve a single Harvest command.
 * Harvests the adjacent tile in the given vec direction.
 * Fails if blocked by an enemy or target isn't harvestable.
 */
export function resolveHarvest(
  command: HarvestCommand,
  team: TeamState,
  state: GameState,
): CommandResult {
  const cinderling = team.active.find(
    (v) => v.uuid === command.cinderlingUuid && !v.isKO,
  );
  if (!cinderling?.position) {
    return { command, success: false, reason: "Cinderling not found" };
  }

  const targetPos: Position = {
    x: cinderling.position.x + command.vec.dx,
    y: cinderling.position.y + command.vec.dy,
  };

  const space = getSpace(state.board, targetPos);
  if (!space || space.type !== "harvestable") {
    return {
      command,
      success: false,
      reason: "Target not harvestable",
    };
  }

  // A space occupied by any cinderling (ally or enemy) cannot be harvested —
  // only uninhabited harvestable spaces yield energy.
  const blocker = getCinderlingAtPosition(state, targetPos);
  if (blocker) {
    return {
      command,
      success: false,
      reason: "Harvest blocked — space is occupied",
    };
  }

  const gained = harvestEnergy(team, space);
  return {
    command,
    success: true,
    energyDelta: gained,
  };
}

/**
 * Resolve a single command (dispatches to type-specific resolver).
 */
export function resolveCommand(
  command: Command,
  team: TeamState,
  state: GameState,
  positionSnapshot?: Map<string, Position | null>,
): CommandResult {
  switch (command.type) {
    case "move":
      return resolveMove(command, team, state);
    case "attack":
      // Pass the snapshot so scanForTarget uses "was-there-and-still-there"
      // targeting: a mon is only hit if it occupied the scanned tile at turn
      // start AND is still there now.  Mons that moved (whether faster or tied
      // on speed/phase) are treated as having dodged.
      return resolveAttack(command, team, state, positionSnapshot);
    case "harvest":
      return resolveHarvest(command, team, state);
  }
}
