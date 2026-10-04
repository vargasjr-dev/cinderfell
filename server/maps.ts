/**
 * Map configurations for cinderling matches.
 *
 * Each map defines its dimensions and a string-based layout:
 *   1 = Team 1 spawn
 *   2 = Team 2 spawn
 *   . = Harvestable (yield 1 — small fern)
 *   f = Fertile (yield 2 — medium fern)
 *   r = Rich (yield 3 — large fern)
 *   h = Lush (yield 4 — glowing tree)
 *   O = Occupation point
 *   V = Void (impassable)
 *
 * Maps are registered in MAPS and looked up by ID.
 */

import type { BoardSpace, Position } from "./types";
import type { SpaceType } from "./config";

// ─── Types ───────────────────────────────────────────────────────────────────

export type MapConfig = {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  /** Layout rows (top to bottom). Cells separated by spaces. */
  layout: string[];
};

// ─── Map Definitions ─────────────────────────────────────────────────────────

/**
 * Standard — Classic 9×5 open battlefield.
 *
 * Every walkable tile is harvestable. Yield mix (37 tiles, mirrored for
 * fairness): 6× +1 (edges), 16× +3 (the common ground), 12× +6, 3× +10.
 * The +10 vaults run down the center column — the fight happens there.
 *
 * ```
 * 1 , r . h . r , 2     y=0  ← vault column: +6 +10 +6
 * 1 . . O r . . . 2     y=1  ← star west, +6 center
 * , r r r h r r r ,     y=2  ← the vault row: +6s stacked around the center +10
 * 1 . . . r O . . 2     y=3  ← star east, +6 center
 * 1 , r . h . r , 2     y=4
 * ```
 */
const STANDARD: MapConfig = {
  id: "standard",
  name: "Standard",
  description: "Classic 9×5 open battlefield",
  width: 9,
  height: 5,
  layout: [
    "1 , r . h . r , 2",
    "1 . . O r . . . 2",
    ", r r r h r r r ,",
    "1 . . . r O . . 2",
    "1 , r . h . r , 2",
  ],
};

/**
 * The Choke — 9×7 with void walls creating a chokepoint.
 *
 * Every walkable tile is harvestable. Yield mix (49 tiles, mirrored):
 * 10× +1 (edges), 20× +3 (common ground), 14× +6, 5× +10.
 * +10s guard the chokepoint gap and its flanks; +6s ring them.
 *
 * ```
 * 1 , . . V . . , 2     y=0
 * . , r . V . r , .     y=1
 * 1 r O r h r . r 2     y=2  ← choke mouth: +10 flanked by +6s
 * , r h . h . h r ,     y=3  ← center row: three +10s
 * 1 r . r h r O r 2     y=4  ← choke mouth: +10 flanked by +6s
 * . , r . V . r , .     y=5
 * 1 , . . V . . , 2     y=6
 * ```
 */
const THE_CHOKE: MapConfig = {
  id: "the-choke",
  name: "The Choke",
  description: "9×7 with void walls — fight through the center",
  width: 9,
  height: 7,
  layout: [
    "1 , . . V . . , 2",
    ". , r . V . r , .",
    "1 r O r h r . r 2",
    ", r h . h . h r ,",
    "1 r . r h r O r 2",
    ". , r . V . r , .",
    "1 , . . V . . , 2",
  ],
};

// ─── Registry ────────────────────────────────────────────────────────────────

export const MAPS: Record<string, MapConfig> = {
  standard: STANDARD,
  "the-choke": THE_CHOKE,
};

export const MAP_LIST: MapConfig[] = Object.values(MAPS);

export function getMapById(id: string): MapConfig {
  const map = MAPS[id];
  if (!map) throw new Error(`Unknown map: ${id}`);
  return map;
}

// ─── Layout Parsing ──────────────────────────────────────────────────────────

type CellDef = { type: SpaceType; team?: 1 | 2; harvestYield?: number };

const CELL_MAP: Record<string, CellDef> = {
  "1": { type: "spawn", team: 1 },
  "2": { type: "spawn", team: 2 },
  ".": { type: "harvestable", harvestYield: 3 },
  ",": { type: "harvestable", harvestYield: 1 },
  r: { type: "harvestable", harvestYield: 6 },
  h: { type: "harvestable", harvestYield: 10 },
  O: { type: "occupation" },
  V: { type: "void" },
};

/**
 * Parse a map layout into BoardSpace[].
 */
export function parseBoardFromMap(map: MapConfig): BoardSpace[] {
  const board: BoardSpace[] = [];

  for (let y = 0; y < map.layout.length; y++) {
    const cells = map.layout[y].split(" ");
    if (cells.length !== map.width) {
      throw new Error(
        `Map "${map.id}" row ${y}: expected ${map.width} cells, got ${cells.length}`,
      );
    }

    for (let x = 0; x < cells.length; x++) {
      const cell = CELL_MAP[cells[x]];
      if (!cell) {
        throw new Error(
          `Map "${map.id}" row ${y} col ${x}: unknown cell "${cells[x]}"`,
        );
      }

      const position: Position = { x, y };
      const space: BoardSpace = { position, type: cell.type };
      if (cell.team) space.team = cell.team;
      if (cell.type === "occupation") space.occupationCounter = 0;
      if (cell.harvestYield !== undefined) space.harvestYield = cell.harvestYield;

      board.push(space);
    }
  }

  return board;
}

/**
 * Extract spawn positions for a team from a map layout.
 */
export function getMapSpawnPositions(
  map: MapConfig,
  teamId: 1 | 2,
): Position[] {
  const marker = teamId === 1 ? "1" : "2";
  const positions: Position[] = [];

  for (let y = 0; y < map.layout.length; y++) {
    const cells = map.layout[y].split(" ");
    for (let x = 0; x < cells.length; x++) {
      if (cells[x] === marker) {
        positions.push({ x, y });
      }
    }
  }

  return positions;
}
