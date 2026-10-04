/**
 * GAME_CONFIG — Playtest-tunable parameters for cinderling matches.
 *
 * All game balance values live here. Change any value to adjust gameplay
 * without touching engine code. See .internal/RULES.md for full context.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type SpaceType = "spawn" | "occupation" | "harvestable" | "void";

export type GameConfig = {
  /** Energy system */
  energy: {
    /** Team energy pool at match start */
    starting: number;
    /** Energy threshold to win via Accumulation */
    accumulationWinThreshold: number;
    /** Base energy gained per Harvest action */
    baseHarvestRate: number;
  };

  /** Occupation win condition */
  occupation: {
    /** Tug-of-war ticks required to control a point */
    ticksToControl: number;
    /** Number of occupation points on the board (must all be controlled to win) */
    pointCount: number;
  };

  /** Turn timing */
  timing: {
    /** Seconds per turn for command submission */
    turnTimerSeconds: number;
  };

  /** Team composition */
  teams: {
    /** Total cinderlings per team (active + bench) */
    rosterSize: number;
    /** Number of active starters per match */
    activeSlots: number;
  };

  /** Board dimensions and layout */
  board: {
    /** Grid width in spaces */
    width: number;
    /** Grid height in spaces */
    height: number;
    /** Number of spawn points per team */
    spawnsPerTeam: number;
  };

  /** Match structure */
  match: {
    /** Max players per match */
    maxPlayers: number;
    /** Match format label */
    format: string;
    /** Hard turn cap — match ends with no winner if reached */
    maxTurns: number;
  };

  /** Elimination win condition */
  elimination: {
    /** KOs required to win (= opponent's full roster) */
    kosToWin: number;
  };

  /** Command costs */
  commands: {
    /** Energy cost of Move command */
    moveCost: number;
    /** Energy cost of Harvest command */
    harvestCost: number;
    /** Attack costs are per-cinderling, not global — see attack definitions */
  };
};

// ─── Default Config ──────────────────────────────────────────────────────────

export const GAME_CONFIG: GameConfig = {
  energy: {
    starting: 20,
    accumulationWinThreshold: 120,
    baseHarvestRate: 1,
  },

  occupation: {
    ticksToControl: 2,
    pointCount: 3,
  },

  timing: {
    turnTimerSeconds: 30,
  },

  teams: {
    rosterSize: 8,
    activeSlots: 4,
  },

  board: {
    width: 9,
    height: 5,
    spawnsPerTeam: 4,
  },

  match: {
    maxPlayers: 2,
    format: "1v1",
    maxTurns: 50,
  },

  elimination: {
    kosToWin: 8,
  },

  commands: {
    moveCost: 0,
    harvestCost: 0,
  },
} as const satisfies GameConfig;

// ─── Derived Constants ───────────────────────────────────────────────────────

/** Number of bench slots per team */
export const BENCH_SLOTS =
  GAME_CONFIG.teams.rosterSize - GAME_CONFIG.teams.activeSlots;

// ─── Validation ──────────────────────────────────────────────────────────────

function validateConfig(config: GameConfig): void {
  const errors: string[] = [];

  if (config.teams.activeSlots > config.teams.rosterSize) {
    errors.push(
      `activeSlots (${config.teams.activeSlots}) cannot exceed rosterSize (${config.teams.rosterSize})`,
    );
  }

  if (config.energy.starting >= config.energy.accumulationWinThreshold) {
    errors.push(
      `startingEnergy (${config.energy.starting}) must be less than accumulationWinThreshold (${config.energy.accumulationWinThreshold})`,
    );
  }

  if (config.occupation.pointCount < 1) {
    errors.push("occupationPointCount must be at least 1");
  }

  if (config.board.spawnsPerTeam < config.teams.activeSlots) {
    errors.push(
      `spawnsPerTeam (${config.board.spawnsPerTeam}) should be >= activeSlots (${config.teams.activeSlots})`,
    );
  }

  const nonVoidSpaces =
    config.board.width * config.board.height -
    config.board.spawnsPerTeam * 2 -
    config.occupation.pointCount;
  if (nonVoidSpaces < 1) {
    errors.push("Board too small — no room for harvestable spaces");
  }

  if (errors.length > 0) {
    throw new Error(
      `GAME_CONFIG validation failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
    );
  }
}

// Validate on import — catches misconfigurations immediately
validateConfig(GAME_CONFIG);
