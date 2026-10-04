/**
 * Cinderling Game Engine — Public API
 *
 * All engine modules exposed through a single entry point.
 * Import from 'server' to access the complete engine.
 */

// Config
export { GAME_CONFIG, type GameConfig, type SpaceType } from "./config";

// Types
export type {
  Position,
  BoardSpace,
  Attack,
  CinderlingState,
  TeamState,
  WinCondition,
  WinResult,
  GameState,
} from "./types";

// Engine (orchestrator)
export {
  initializeGame,
  startTurn,
  resolveTurn,
  isGameActive,
  getWinner,
  getGameSummary,
  type TeamSetup,
  type CinderlingSetup,
  type TurnLog,
} from "./engine";

// Commands
export {
  type Command,
  type MoveCommand,
  type AttackCommand,
  type HarvestCommand,
  type CommandResult,
  validateCommand,
  resolveCommand,
  getAvailableCommands,
} from "./commands";

// Energy
export {
  initializeEnergy,
  spendEnergy,
  harvestEnergy,
  canAffordAttack,
  hasEnergy,
  energyToWin,
  energyProgress,
  energySummary,
} from "./energy";

// Win Conditions
export {
  checkElimination,
  checkOccupation,
  checkAccumulation,
  checkWinConditions,
  updateOccupationCounters,
} from "./winConditions";

// Bench
export {
  processBenchEntries,
  processAllBenchEntries,
  validateBenchSpawnAssignments,
  type BenchEntry,
} from "./bench";

// Board
export {
  getSpaceAt,
  getSpacesByType,
  getTeamSpawns,
  getOccupationStatus,
  isInBounds,
  getAdjacentPositions,
  renderBoardText,
} from "./board";

// Turn Timer
export {
  createTurnTimer,
  submitCommands,
  bothTeamsReady,
  isExpired,
  shouldResolveTurn,
  remainingSeconds,
  elapsedSeconds,
  generateDefaultCommands,
  getFinalCommands,
  getClientTimerState,
  type TurnTimerState,
} from "./turnTimer";
