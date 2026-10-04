/**
 * Core game state types for the cinderling engine.
 *
 * These types define the shape of game state that all engine modules
 * (win conditions, energy, commands, board) operate on.
 */

import type { SpaceType } from "./config";

// ─── Positions & Board ───────────────────────────────────────────────────────

export type Position = {
  x: number;
  y: number;
};

/** A directional delta — orientation-agnostic. Always one of the four cardinal unit vectors. */
export type Vec2 = {
  dx: number;
  dy: number;
};

export type BoardSpace = {
  position: Position;
  type: SpaceType;
  /** Which team this spawn belongs to (1 or 2), only for spawn spaces */
  team?: 1 | 2;
  /** Occupation counter: negative = team 1, positive = team 2. 0 = neutral */
  occupationCounter?: number;
  /** Harvest yield for harvestable spaces (default = baseHarvestRate from config) */
  harvestYield?: number;
};

// ─── Cinderling State ──────────────────────────────────────────────────────────

export type Attack = {
  /** References the canonical key in ATTACK_TEMPLATES */
  key: string;
  name: string;
  damage: number;
  energyCost: number;
  range: number;
  /** When true, scan skips over own-team cinderlings (arcs over them). See AttackTemplate. */
  arcOver?: boolean;
};

export type CinderlingState = {
  uuid: string;
  name: string;
  /** Current HP (0 = KO'd) */
  hp: number;
  maxHp: number;
  /** Effective speed this turn (may be temporarily modified by powers) */
  speed: number;
  /** Base speed from the cinderling template — never modified */
  baseSpeed: number;
  attack: number;
  attacks: Attack[];
  /** Current board position (null if KO'd and not yet replaced, or on bench) */
  position: Position | null;
  /** Whether this cinderling is KO'd */
  isKO: boolean;
  /** Pre-assigned spawn position for bench entry */
  spawnPosition: Position;
  /** Optional special power ID — references the power registry */
  specialPowerId?: string;
  /** Avatar image URL (e.g. /cinderling/aerobolt.png) */
  imageUrl?: string;
  /**
   * Persistent per-turn state for powers that need counters/accumulators.
   * Keys are power-specific strings (e.g. "gearGrind"). Serialized with GameState.
   */
  powerState?: Record<string, number>;
};

// ─── Team State ──────────────────────────────────────────────────────────────

export type TeamState = {
  /** Team identifier (1 or 2) */
  id: 1 | 2;
  /** Player user ID */
  userId: string;
  /** Team name */
  name: string;
  /** Team energy pool */
  energy: number;
  /** Active cinderlings on the board */
  active: CinderlingState[];
  /** Bench cinderlings waiting to enter (ordered) */
  bench: CinderlingState[];
  /** KO'd cinderlings (no longer in play) */
  knocked: CinderlingState[];
};

// ─── Game State ──────────────────────────────────────────────────────────────

export type WinCondition = "elimination" | "occupation" | "accumulation" | "concession";

export type WinResult = {
  winner: 1 | 2;
  condition: WinCondition;
};

export type GameState = {
  /** Current turn number (starts at 1) */
  turn: number;
  /** The two teams */
  teams: [TeamState, TeamState];
  /** Board layout — flat array of spaces */
  board: BoardSpace[];
  /** Board dimensions */
  boardWidth: number;
  boardHeight: number;
  /** Match result (null if game still in progress) */
  result: WinResult | null;
  /** Match UUID */
  matchUuid: string;
  /** Game phase */
  phase: "setup" | "playing" | "ended";
  /**
   * Possession arrow for speed-tie resolution.
   * The team whose arrow it is acts first when commands are fully tied
   * (same phase, same speed, same base damage). Initialized randomly on the
   * first actual tie and flips after each tie group it resolves.
   * Intentionally omitted from match UI.
   */
  possessionArrow?: 1 | 2;
  /**
   * Override for the Accumulation win threshold (energy needed to win).
   * When absent, falls back to GAME_CONFIG.energy.accumulationWinThreshold.
   */
  winningEnergy?: number;
};
