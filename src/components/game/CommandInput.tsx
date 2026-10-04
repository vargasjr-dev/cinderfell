"use client";

import { useState } from "react";
import type {
  CommandPayload,
  CinderlingPayload,
  BoardPayload,
} from "~/hooks/useGameSocket";

type CommandInputProps = {
  /** The cinderling currently selected for command input */
  cinderling: CinderlingPayload;
  /** Team energy available */
  teamEnergy: number;
  /** Board data for range/target validation */
  board: BoardPayload;
  /** Already-submitted commands this turn (for other cinderlings) */
  pendingCommands: CommandPayload[];
  /** Callback when a command is confirmed for this cinderling */
  onSubmitCommand: (command: CommandPayload) => void;
  /** Callback to deselect this cinderling */
  onCancel: () => void;
};

type CommandMode = "select" | "move" | "attack" | "harvest";

type Vec2 = { dx: number; dy: number };

const DIRECTION_LABELS: Array<{ label: string; vec: Vec2; arrow: string }> = [
  { label: "↑ Up",    vec: { dx: 0, dy: -1 }, arrow: "up" },
  { label: "↓ Down",  vec: { dx: 0, dy:  1 }, arrow: "down" },
  { label: "← Left",  vec: { dx: -1, dy: 0 }, arrow: "left" },
  { label: "→ Right", vec: { dx:  1, dy: 0 }, arrow: "right" },
];

export default function CommandInput({
  cinderling,
  teamEnergy,
  board,
  pendingCommands,
  onSubmitCommand,
  onCancel,
}: CommandInputProps) {
  const [mode, setMode] = useState<CommandMode>("select");
  const [selectedAttackIndex, setSelectedAttackIndex] = useState<number | null>(null);

  // Check if this cinderling already has a pending command
  const alreadyHasCommand = pendingCommands.some(
    (c) => c.cinderlingUuid === cinderling.uuid,
  );

  // Check if cinderling is on a harvestable space
  const currentSpace = board.spaces.find(
    (s) => s.x === cinderling.x && s.y === cinderling.y,
  );
  const canHarvest = currentSpace?.type === "harvestable";
  const harvestYield = currentSpace?.harvestYield ?? 1;

  // Check if any attack is affordable
  const canAffordAnyAttack = cinderling.attacks.some(
    (a) => a.energyCost <= teamEnergy,
  );

  if (alreadyHasCommand) {
    return (
      <div className="bg-gray-800 text-white rounded-lg p-3 shadow-lg">
        <div className="text-sm text-gray-400">
          Command queued for <span className="font-bold text-blue-300">{cinderling.name}</span>
        </div>
        <div className="mt-1 text-xs text-gray-500">
          {pendingCommands.find((c) => c.cinderlingUuid === cinderling.uuid)?.type.toUpperCase()}
        </div>
      </div>
    );
  }

  if (cinderling.isKO) {
    return (
      <div className="bg-gray-800 text-white rounded-lg p-3 shadow-lg">
        <div className="text-sm text-red-400 font-bold">{cinderling.name} is KO&apos;d</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 text-white rounded-lg p-3 shadow-lg min-w-[200px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="font-bold text-sm text-blue-300">{cinderling.name}</div>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-white text-xs"
        >
          ✕
        </button>
      </div>

      {/* HP bar */}
      <div className="flex items-center gap-2 mb-3 text-xs">
        <span className="text-gray-400">HP</span>
        <div className="flex-1 h-1.5 bg-gray-600 rounded-full">
          <div
            className={`h-full rounded-full transition-all ${
              cinderling.hp / cinderling.maxHp > 0.5
                ? "bg-green-500"
                : cinderling.hp / cinderling.maxHp > 0.25
                  ? "bg-yellow-500"
                  : "bg-red-500"
            }`}
            style={{ width: `${(cinderling.hp / cinderling.maxHp) * 100}%` }}
          />
        </div>
        <span className="text-gray-300 tabular-nums">
          {cinderling.hp}/{cinderling.maxHp}
        </span>
      </div>

      {/* Command Selection Mode */}
      {mode === "select" && (
        <div className="flex flex-col gap-1.5">
          <CommandButton
            label="⬆ Move"
            sublabel="Free"
            onClick={() => setMode("move")}
            color="blue"
          />
          <CommandButton
            label="⚔ Attack"
            sublabel={canAffordAnyAttack ? `${teamEnergy} energy` : "No energy"}
            onClick={() => setMode("attack")}
            color="red"
            disabled={!canAffordAnyAttack}
          />
          <CommandButton
            label="🌿 Harvest"
            sublabel={canHarvest ? `+${harvestYield} energy` : "Not harvestable"}
            onClick={() => {
              onSubmitCommand({
                type: "harvest",
                cinderlingUuid: cinderling.uuid,
                vec: { dx: 0, dy: 1 }, // default: harvest tile below
              });
            }}
            color="green"
            disabled={!canHarvest}
          />
        </div>
      )}

      {/* Move Direction Selection */}
      {mode === "move" && (
        <div className="flex flex-col gap-1">
          <div className="text-xs text-gray-400 mb-1">Choose direction:</div>
          <div className="grid grid-cols-3 gap-1">
            <div /> {/* empty top-left */}
            <DirectionButton
              vec={{ dx: 0, dy: -1 }}
              label="↑ Up"
              cinderling={cinderling}
              board={board}
              onSelect={(v) => onSubmitCommand({ type: "move", cinderlingUuid: cinderling.uuid, vec: v })}
            />
            <div /> {/* empty top-right */}
            <DirectionButton
              vec={{ dx: -1, dy: 0 }}
              label="← Left"
              cinderling={cinderling}
              board={board}
              onSelect={(v) => onSubmitCommand({ type: "move", cinderlingUuid: cinderling.uuid, vec: v })}
            />
            <div className="flex items-center justify-center text-gray-500 text-[10px]">
              {cinderling.x},{cinderling.y}
            </div>
            <DirectionButton
              vec={{ dx: 1, dy: 0 }}
              label="→ Right"
              cinderling={cinderling}
              board={board}
              onSelect={(v) => onSubmitCommand({ type: "move", cinderlingUuid: cinderling.uuid, vec: v })}
            />
            <div /> {/* empty bottom-left */}
            <DirectionButton
              vec={{ dx: 0, dy: 1 }}
              label="↓ Down"
              cinderling={cinderling}
              board={board}
              onSelect={(v) => onSubmitCommand({ type: "move", cinderlingUuid: cinderling.uuid, vec: v })}
            />
            <div /> {/* empty bottom-right */}
          </div>
          <button
            onClick={() => setMode("select")}
            className="mt-1 text-xs text-gray-400 hover:text-white"
          >
            ← Back
          </button>
        </div>
      )}

      {/* Attack Selection */}
      {mode === "attack" && selectedAttackIndex === null && (
        <div className="flex flex-col gap-1">
          <div className="text-xs text-gray-400 mb-1">Choose attack:</div>
          {cinderling.attacks.map((attack, i) => {
            const canAfford = attack.energyCost <= teamEnergy;
            return (
              <button
                key={i}
                onClick={() => setSelectedAttackIndex(i)}
                disabled={!canAfford}
                className={`text-left px-2 py-1.5 rounded text-xs transition-all
                  ${canAfford
                    ? "bg-red-900/50 hover:bg-red-800/70 text-red-200"
                    : "bg-gray-700/50 text-gray-500 cursor-not-allowed"
                  }`}
              >
                <div className="flex justify-between">
                  <span className="font-medium">{attack.name}</span>
                  <span className="text-[10px]">{attack.energyCost}⚡</span>
                </div>
                <div className="text-[10px] text-gray-400">
                  {attack.damage} dmg · range {attack.range}
                </div>
              </button>
            );
          })}
          <button
            onClick={() => setMode("select")}
            className="mt-1 text-xs text-gray-400 hover:text-white"
          >
            ← Back
          </button>
        </div>
      )}

      {/* Attack Target Selection */}
      {mode === "attack" && selectedAttackIndex !== null && (
        <div className="flex flex-col gap-1">
          <div className="text-xs text-gray-400 mb-1">
            Click a target space on the board
          </div>
          <div className="text-xs text-red-300">
            {cinderling.attacks[selectedAttackIndex].name} — range{" "}
            {cinderling.attacks[selectedAttackIndex].range}
          </div>
          <button
            onClick={() => setSelectedAttackIndex(null)}
            className="mt-1 text-xs text-gray-400 hover:text-white"
          >
            ← Pick different attack
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function CommandButton({
  label,
  sublabel,
  onClick,
  color,
  disabled = false,
}: {
  label: string;
  sublabel: string;
  onClick: () => void;
  color: "blue" | "red" | "green";
  disabled?: boolean;
}) {
  const colorClasses = {
    blue: "bg-blue-900/50 hover:bg-blue-800/70 text-blue-200",
    red: "bg-red-900/50 hover:bg-red-800/70 text-red-200",
    green: "bg-green-900/50 hover:bg-green-800/70 text-green-200",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-between px-3 py-2 rounded text-sm transition-all
        ${disabled ? "bg-gray-700/50 text-gray-500 cursor-not-allowed" : colorClasses[color]}
      `}
    >
      <span className="font-medium">{label}</span>
      <span className="text-[10px] opacity-70">{sublabel}</span>
    </button>
  );
}

function DirectionButton({
  vec,
  label,
  cinderling,
  board,
  onSelect,
}: {
  vec: Vec2;
  label: string;
  cinderling: CinderlingPayload;
  board: BoardPayload;
  onSelect: (vec: Vec2) => void;
}) {
  const targetX = cinderling.x + vec.dx;
  const targetY = cinderling.y + vec.dy;

  // Check bounds
  const inBounds = targetX >= 0 && targetX < board.width && targetY >= 0 && targetY < board.height;

  // Check if target space is void
  const targetSpace = board.spaces.find((s) => s.x === targetX && s.y === targetY);
  const isVoid = targetSpace?.type === "void";

  const canMove = inBounds && !isVoid;

  return (
    <button
      onClick={() => canMove && onSelect(vec)}
      disabled={!canMove}
      className={`px-1.5 py-1 rounded text-xs font-mono transition-all
        ${canMove
          ? "bg-blue-900/50 hover:bg-blue-700/60 text-blue-200"
          : "bg-gray-700/30 text-gray-600 cursor-not-allowed"
        }`}
    >
      {label}
    </button>
  );
}

// ─── Turn Command Bar ────────────────────────────────────────────────────────

type TurnCommandBarProps = {
  activeCount: number;
  pendingCommands: CommandPayload[];
  onSubmitTurn: () => void;
  timerSeconds: number;
};

/**
 * Bottom bar showing how many commands are queued and a submit button.
 */
export function TurnCommandBar({
  activeCount,
  pendingCommands,
  onSubmitTurn,
  timerSeconds,
}: TurnCommandBarProps) {
  const ready = pendingCommands.length === activeCount;
  const remaining = activeCount - pendingCommands.length;

  return (
    <div className="flex items-center justify-between bg-gray-900 rounded-lg px-4 py-2">
      <div className="flex items-center gap-3">
        {/* Command count */}
        <div className="text-sm">
          <span className={ready ? "text-green-400" : "text-yellow-400"}>
            {pendingCommands.length}/{activeCount}
          </span>{" "}
          <span className="text-gray-400">commands</span>
        </div>

        {/* Pending command pills */}
        <div className="flex gap-1">
          {pendingCommands.map((cmd, i) => (
            <span
              key={i}
              className={`text-[10px] px-1.5 py-0.5 rounded-full
                ${cmd.type === "move" ? "bg-blue-900/60 text-blue-300" : ""}
                ${cmd.type === "attack" ? "bg-red-900/60 text-red-300" : ""}
                ${cmd.type === "harvest" ? "bg-green-900/60 text-green-300" : ""}
              `}
            >
              {cmd.type}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Timer */}
        <div className={`text-sm tabular-nums ${timerSeconds <= 10 ? "text-red-400 animate-pulse" : "text-gray-400"}`}>
          {timerSeconds}s
        </div>

        {/* Submit button */}
        <button
          onClick={onSubmitTurn}
          disabled={pendingCommands.length === 0}
          className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all
            ${ready
              ? "bg-green-600 hover:bg-green-500 text-white"
              : pendingCommands.length > 0
                ? "bg-yellow-600 hover:bg-yellow-500 text-white"
                : "bg-gray-700 text-gray-500 cursor-not-allowed"
            }`}
        >
          {ready
            ? "Submit Turn"
            : remaining > 0
              ? `${remaining} more`
              : "Submit"}
        </button>
      </div>
    </div>
  );
}
