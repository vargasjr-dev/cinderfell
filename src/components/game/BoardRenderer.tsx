"use client";

import type {
  BoardPayload,
  CinderlingPayload,
  OpponentCinderlingPayload,
} from "~/hooks/useGameSocket";

type BoardRendererProps = {
  board: BoardPayload;
  yourActive: CinderlingPayload[];
  opponentActive: OpponentCinderlingPayload[];
  teamId: 1 | 2;
  /** Currently selected cinderling UUID (for command input) */
  selectedUuid?: string | null;
  /** Callback when a space is clicked */
  onSpaceClick?: (x: number, y: number) => void;
  /** Callback when a cinderling is clicked */
  onCinderlingClick?: (uuid: string) => void;
};

const SPACE_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  spawn: {
    bg: "bg-gray-200",
    border: "border-gray-400",
    label: "S",
  },
  occupation: {
    bg: "bg-amber-100",
    border: "border-amber-400",
    label: "⭐",
  },
  harvestable: {
    bg: "bg-green-50",
    border: "border-green-300",
    label: "",
  },
  void: {
    bg: "bg-gray-800",
    border: "border-gray-900",
    label: "",
  },
};

export default function BoardRenderer({
  board,
  yourActive,
  opponentActive,
  teamId,
  selectedUuid,
  onSpaceClick,
  onCinderlingClick,
}: BoardRendererProps) {
  // Build a grid lookup
  const spaceMap = new Map<string, (typeof board.spaces)[0]>();
  for (const space of board.spaces) {
    spaceMap.set(`${space.x},${space.y}`, space);
  }

  // Build cinderling position lookup
  const cinderlingMap = new Map<
    string,
    { mon: CinderlingPayload | OpponentCinderlingPayload; isYours: boolean }
  >();
  for (const mon of yourActive) {
    if (!mon.isKO) {
      cinderlingMap.set(`${mon.x},${mon.y}`, { mon, isYours: true });
    }
  }
  for (const mon of opponentActive) {
    if (!mon.isKO) {
      cinderlingMap.set(`${mon.x},${mon.y}`, { mon, isYours: false });
    }
  }

  return (
    <div className="w-full overflow-x-auto">
      <div
        className="grid gap-1 mx-auto"
        style={{
          gridTemplateColumns: `repeat(${board.width}, minmax(3rem, 1fr))`,
          maxWidth: `${board.width * 4.5}rem`,
        }}
      >
        {Array.from({ length: board.height }, (_, y) =>
          Array.from({ length: board.width }, (_, x) => {
            const key = `${x},${y}`;
            const space = spaceMap.get(key);
            const cinderling = cinderlingMap.get(key);
            const spaceType = space?.type ?? "void";
            const colors = SPACE_COLORS[spaceType] ?? SPACE_COLORS.void;

            // Occupation point coloring
            let occIndicator: string | null = null;
            if (spaceType === "occupation" && space?.occupationCounter != null) {
              const c = space.occupationCounter;
              if (c < 0) occIndicator = "team1";
              else if (c > 0) occIndicator = "team2";
            }

            // Spawn team coloring
            const isTeamSpawn =
              spaceType === "spawn" && space?.team === teamId;
            const isOpponentSpawn =
              spaceType === "spawn" && space?.team !== teamId;

            return (
              <button
                key={key}
                onClick={() => {
                  if (cinderling?.isYours && onCinderlingClick) {
                    onCinderlingClick(cinderling.mon.uuid);
                  } else if (onSpaceClick) {
                    onSpaceClick(x, y);
                  }
                }}
                className={`
                  relative aspect-square rounded-md border-2 transition-all
                  flex items-center justify-center text-xs font-bold
                  ${spaceType === "void" ? "cursor-not-allowed opacity-30" : "cursor-pointer hover:brightness-95"}
                  ${colors.bg} ${colors.border}
                  ${isTeamSpawn ? "border-blue-400 bg-blue-50" : ""}
                  ${isOpponentSpawn ? "border-red-300 bg-red-50" : ""}
                  ${occIndicator === "team1" ? "ring-2 ring-blue-400 ring-offset-1" : ""}
                  ${occIndicator === "team2" ? "ring-2 ring-red-400 ring-offset-1" : ""}
                `}
              >
                {/* Space label */}
                {!cinderling && spaceType === "occupation" && (
                  <span className="text-amber-600 text-sm">⭐</span>
                )}
                {!cinderling &&
                  spaceType === "harvestable" && (
                    <span className="text-green-300 text-[10px]">·</span>
                  )}

                {/* Cinderling token */}
                {cinderling && (
                  <CinderlingToken
                    name={cinderling.mon.name}
                    hp={cinderling.mon.hp}
                    maxHp={cinderling.mon.maxHp}
                    isYours={cinderling.isYours}
                    isSelected={
                      cinderling.isYours &&
                      cinderling.mon.uuid === selectedUuid
                    }
                  />
                )}

                {/* Coordinate debug (tiny, bottom-right) */}
                <span className="absolute bottom-0 right-0.5 text-[8px] text-gray-300 font-mono">
                  {x},{y}
                </span>
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}

// ─── Cinderling Token ──────────────────────────────────────────────────────────

function CinderlingToken({
  name,
  hp,
  maxHp,
  isYours,
  isSelected,
}: {
  name: string;
  hp: number;
  maxHp: number;
  isYours: boolean;
  isSelected: boolean;
}) {
  const hpPercent = (hp / maxHp) * 100;
  const hpColor =
    hpPercent > 50 ? "bg-green-500" : hpPercent > 25 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div
      className={`
        absolute inset-1 rounded flex flex-col items-center justify-center
        ${isYours ? "bg-blue-500" : "bg-red-500"}
        ${isSelected ? "ring-2 ring-yellow-400 ring-offset-1 scale-110 z-10" : ""}
        text-white shadow-sm transition-all
      `}
    >
      {/* Name (truncated) */}
      <span className="text-[9px] font-bold leading-tight truncate w-full text-center px-0.5">
        {name.slice(0, 4)}
      </span>

      {/* HP bar */}
      <div className="w-[80%] h-1 bg-gray-700 rounded-full mt-0.5">
        <div
          className={`h-full rounded-full ${hpColor} transition-all`}
          style={{ width: `${hpPercent}%` }}
        />
      </div>
    </div>
  );
}
