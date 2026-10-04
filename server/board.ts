/**
 * Board system for cinderling matches.
 *
 * Grid-based board with configurable dimensions and four space types:
 * - Spawn — where cinderlings start and bench replacements enter (one-way)
 * - Occupation — 3 tug-of-war control points (near team 1, center, near team 2)
 * - Harvestable — generates energy when harvested (every non-spawn, non-occ, non-void space)
 * - Void — impassable (for shaping maps)
 *
 * Board is represented as a flat array of BoardSpace objects.
 * Coordinates: (0,0) is top-left, x increases right, y increases down.
 * Team 1 starts on the left (low x), Team 2 on the right (high x).
 */

import { GAME_CONFIG } from "./config";
import type { BoardSpace, Position } from "./types";
import type { SpaceType } from "./config";

// ─── Board Generation ────────────────────────────────────────────────────────

// ─── Board Queries ───────────────────────────────────────────────────────────

/**
 * Get a space at a specific position.
 */
export function getSpaceAt(
  board: BoardSpace[],
  pos: Position,
): BoardSpace | undefined {
  return board.find(
    (s) => s.position.x === pos.x && s.position.y === pos.y,
  );
}

/**
 * Get all spaces of a specific type.
 */
export function getSpacesByType(
  board: BoardSpace[],
  type: SpaceType,
): BoardSpace[] {
  return board.filter((s) => s.type === type);
}

/**
 * Get all spawn spaces for a team.
 */
export function getTeamSpawns(
  board: BoardSpace[],
  teamId: 1 | 2,
): BoardSpace[] {
  return board.filter((s) => s.type === "spawn" && s.team === teamId);
}

/**
 * Get all occupation points and their current control state.
 */
export function getOccupationStatus(
  board: BoardSpace[],
): { position: Position; counter: number; controlledBy: 1 | 2 | null }[] {
  const threshold = GAME_CONFIG.occupation.ticksToControl;

  return board
    .filter((s) => s.type === "occupation")
    .map((s) => {
      const counter = s.occupationCounter ?? 0;
      let controlledBy: 1 | 2 | null = null;
      if (counter <= -threshold) controlledBy = 1;
      if (counter >= threshold) controlledBy = 2;

      return {
        position: s.position,
        counter,
        controlledBy,
      };
    });
}

/**
 * Check if a position is within board bounds.
 */
export function isInBounds(
  pos: Position,
  width: number = GAME_CONFIG.board.width,
  height: number = GAME_CONFIG.board.height,
): boolean {
  return pos.x >= 0 && pos.x < width && pos.y >= 0 && pos.y < height;
}

/**
 * Get adjacent positions (cardinal directions only).
 */
export function getAdjacentPositions(pos: Position): Position[] {
  return [
    { x: pos.x, y: pos.y - 1 },   // up
    { x: pos.x, y: pos.y + 1 },   // down
    { x: pos.x - 1, y: pos.y },   // left
    { x: pos.x + 1, y: pos.y },   // right
  ];
}

/**
 * Render a text-based board visualization (for debugging/logs).
 */
export function renderBoardText(board: BoardSpace[]): string {
  const width = GAME_CONFIG.board.width;
  const height = GAME_CONFIG.board.height;
  const lines: string[] = [];

  for (let y = 0; y < height; y++) {
    let line = "";
    for (let x = 0; x < width; x++) {
      const space = getSpaceAt(board, { x, y });
      if (!space) {
        line += "? ";
        continue;
      }
      switch (space.type) {
        case "spawn":
          line += space.team === 1 ? "1 " : "2 ";
          break;
        case "occupation":
          line += "O ";
          break;
        case "harvestable":
          line += "+ ";
          break;
        case "void":
          line += "X ";
          break;
      }
    }
    lines.push(line.trimEnd());
  }

  return lines.join("\n");
}
