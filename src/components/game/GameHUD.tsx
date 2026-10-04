"use client";

import type {
  TeamPayload,
  OpponentTeamPayload,
  CinderlingPayload,
  OpponentCinderlingPayload,
  BoardPayload,
} from "~/hooks/useGameSocket";

// ─── Config (mirrored from server for display) ──────────────────────────────

const ACCUMULATION_THRESHOLD = 120;
const OCCUPATION_WIN_THRESHOLD = 2;

// ─── Main HUD ────────────────────────────────────────────────────────────────

type GameHUDProps = {
  turn: number;
  yourTeam: TeamPayload;
  opponentTeam: OpponentTeamPayload;
  board: BoardPayload;
  timerSeconds: number;
  phase: "setup" | "playing" | "ended";
};

export default function GameHUD({
  turn,
  yourTeam,
  opponentTeam,
  board,
  timerSeconds,
  phase,
}: GameHUDProps) {
  // Extract occupation points
  const occupationSpaces = board.spaces.filter((s) => s.type === "occupation");

  return (
    <div className="flex flex-col gap-2">
      {/* Top bar — turn + timer */}
      <div className="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-2">
        <div className="text-sm text-gray-400">
          Turn <span className="text-white font-bold">{turn + 1}</span>
        </div>
        <div className="text-xs text-gray-500 uppercase tracking-wider">
          {phase}
        </div>
        <div
          className={`text-sm tabular-nums font-mono ${
            timerSeconds <= 10
              ? "text-red-400 animate-pulse"
              : timerSeconds <= 20
                ? "text-yellow-400"
                : "text-gray-300"
          }`}
        >
          {timerSeconds}s
        </div>
      </div>

      {/* Energy bars — side by side */}
      <div className="grid grid-cols-2 gap-2">
        <EnergyBar
          label={yourTeam.name}
          energy={yourTeam.energy}
          color="blue"
          isYours
        />
        <EnergyBar
          label={opponentTeam.name}
          energy={opponentTeam.energy}
          color="red"
          isYours={false}
        />
      </div>

      {/* Occupation counters */}
      {occupationSpaces.length > 0 && (
        <OccupationDisplay spaces={occupationSpaces} />
      )}

      {/* Team rosters — side by side */}
      <div className="grid grid-cols-2 gap-2">
        <TeamRoster
          label="Your Team"
          active={yourTeam.active}
          benchCount={yourTeam.benchCount}
          knockedCount={yourTeam.knockedCount}
          color="blue"
          showHP
        />
        <TeamRoster
          label="Opponent"
          active={opponentTeam.active}
          benchCount={opponentTeam.benchCount}
          knockedCount={opponentTeam.knockedCount}
          color="red"
          showHP={false}
        />
      </div>
    </div>
  );
}

// ─── Energy Bar ──────────────────────────────────────────────────────────────

function EnergyBar({
  label,
  energy,
  color,
  isYours,
}: {
  label: string;
  energy: number;
  color: "blue" | "red";
  isYours: boolean;
}) {
  const progress = Math.min(energy / ACCUMULATION_THRESHOLD, 1) * 100;
  const barColor = color === "blue" ? "bg-blue-500" : "bg-red-500";
  const bgColor = color === "blue" ? "bg-blue-900/30" : "bg-red-900/30";
  const textColor = color === "blue" ? "text-blue-300" : "text-red-300";

  return (
    <div className={`rounded-lg p-2 ${bgColor}`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-bold ${textColor}`}>
          {isYours ? "⚡ You" : "⚡ Opp"}
        </span>
        <span className="text-xs text-gray-400 tabular-nums">
          {energy}/{ACCUMULATION_THRESHOLD}
        </span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-500`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="text-[10px] text-gray-500 mt-0.5 truncate">{label}</div>
    </div>
  );
}

// ─── Occupation Display ──────────────────────────────────────────────────────

function OccupationDisplay({
  spaces,
}: {
  spaces: { x: number; y: number; occupationCounter?: number }[];
}) {
  return (
    <div className="bg-amber-900/20 rounded-lg p-2">
      <div className="text-xs font-bold text-amber-300 mb-1.5">
        ⭐ Occupation Points
      </div>
      <div className="flex gap-2 justify-center">
        {spaces.map((space, i) => {
          const counter = space.occupationCounter ?? 0;
          const team1Progress = counter < 0 ? Math.min(Math.abs(counter) / OCCUPATION_WIN_THRESHOLD, 1) : 0;
          const team2Progress = counter > 0 ? Math.min(counter / OCCUPATION_WIN_THRESHOLD, 1) : 0;
          const controlled =
            counter <= -OCCUPATION_WIN_THRESHOLD
              ? "team1"
              : counter >= OCCUPATION_WIN_THRESHOLD
                ? "team2"
                : null;

          return (
            <div
              key={i}
              className={`flex flex-col items-center gap-1 px-2 py-1 rounded
                ${controlled === "team1" ? "bg-blue-900/40 ring-1 ring-blue-400" : ""}
                ${controlled === "team2" ? "bg-red-900/40 ring-1 ring-red-400" : ""}
                ${!controlled ? "bg-gray-800/60" : ""}
              `}
            >
              <span className="text-sm">⭐</span>

              {/* Tug-of-war indicator */}
              <div className="flex items-center gap-0.5">
                {/* Team 1 (blue) side */}
                <div className="w-6 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${team1Progress * 100}%` }}
                  />
                </div>

                <span className="text-[9px] text-gray-500 tabular-nums w-4 text-center">
                  {counter}
                </span>

                {/* Team 2 (red) side */}
                <div className="w-6 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full transition-all"
                    style={{ width: `${team2Progress * 100}%` }}
                  />
                </div>
              </div>

              <span className="text-[9px] text-gray-600">
                ({space.x},{space.y})
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Team Roster ─────────────────────────────────────────────────────────────

function TeamRoster({
  label,
  active,
  benchCount,
  knockedCount,
  color,
  showHP,
}: {
  label: string;
  active: (CinderlingPayload | OpponentCinderlingPayload)[];
  benchCount: number;
  knockedCount: number;
  color: "blue" | "red";
  showHP: boolean;
}) {
  const bgColor = color === "blue" ? "bg-blue-900/20" : "bg-red-900/20";
  const textColor = color === "blue" ? "text-blue-300" : "text-red-300";

  return (
    <div className={`rounded-lg p-2 ${bgColor}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-xs font-bold ${textColor}`}>{label}</span>
        <div className="flex gap-1.5 text-[10px] text-gray-500">
          <span>🪑 {benchCount}</span>
          <span>💀 {knockedCount}</span>
        </div>
      </div>

      <div className="space-y-1">
        {active.map((mon) => (
          <RosterRow
            key={mon.uuid}
            name={mon.name}
            hp={mon.hp}
            maxHp={mon.maxHp}
            isKO={mon.isKO}
            showHP={showHP}
            color={color}
          />
        ))}
      </div>
    </div>
  );
}

function RosterRow({
  name,
  hp,
  maxHp,
  isKO,
  showHP,
  color,
}: {
  name: string;
  hp: number;
  maxHp: number;
  isKO: boolean;
  showHP: boolean;
  color: "blue" | "red";
}) {
  const hpPercent = (hp / maxHp) * 100;
  const hpColor =
    hpPercent > 50 ? "bg-green-500" : hpPercent > 25 ? "bg-yellow-500" : "bg-red-500";
  const dotColor = color === "blue" ? "bg-blue-400" : "bg-red-400";

  return (
    <div
      className={`flex items-center gap-1.5 text-xs ${isKO ? "opacity-40" : ""}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isKO ? "bg-gray-600" : dotColor}`} />
      <span className="truncate flex-1 text-gray-300">{name}</span>
      {isKO ? (
        <span className="text-[10px] text-red-400 font-bold">KO</span>
      ) : showHP ? (
        <div className="flex items-center gap-1">
          <div className="w-10 h-1 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${hpColor}`}
              style={{ width: `${hpPercent}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-500 tabular-nums w-8 text-right">
            {hp}/{maxHp}
          </span>
        </div>
      ) : (
        <div className="w-10 h-1 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${hpColor}`}
            style={{ width: `${hpPercent}%` }}
          />
        </div>
      )}
    </div>
  );
}
