"use client";

import { useState, useEffect, useCallback } from "react";
import type { TurnResultPayload, TurnEvent } from "~/hooks/useGameSocket";

type TurnAnimationProps = {
  /** The turn result to animate */
  results: TurnResultPayload;
  /** Called when animation is complete — signals ready for next turn */
  onComplete: () => void;
  /** Speed multiplier (1 = normal, 2 = fast, 0.5 = slow) */
  speed?: number;
};

const EVENT_ICONS: Record<TurnEvent["type"], string> = {
  move: "⬆",
  attack: "⚔️",
  harvest: "🌿",
  ko: "💀",
  bench_entry: "🔄",
  occupation_tick: "⭐",
};

const EVENT_COLORS: Record<TurnEvent["type"], string> = {
  move: "text-blue-300",
  attack: "text-red-300",
  harvest: "text-green-300",
  ko: "text-red-500",
  bench_entry: "text-purple-300",
  occupation_tick: "text-amber-300",
};

const BASE_EVENT_DURATION_MS = 800;

export default function TurnAnimation({
  results,
  onComplete,
  speed = 1,
}: TurnAnimationProps) {
  const [currentEventIndex, setCurrentEventIndex] = useState(-1);
  const [phase, setPhase] = useState<"intro" | "events" | "summary">("intro");
  const [isSkipped, setIsSkipped] = useState(false);

  const eventDuration = BASE_EVENT_DURATION_MS / speed;
  const totalEvents = results.events.length;

  // Auto-advance through events
  useEffect(() => {
    if (isSkipped) return;

    if (phase === "intro") {
      const timer = setTimeout(() => {
        setPhase("events");
        setCurrentEventIndex(0);
      }, 600 / speed);
      return () => clearTimeout(timer);
    }

    if (phase === "events" && currentEventIndex >= 0) {
      if (currentEventIndex >= totalEvents) {
        setPhase("summary");
        return;
      }
      const timer = setTimeout(() => {
        setCurrentEventIndex((i) => i + 1);
      }, eventDuration);
      return () => clearTimeout(timer);
    }

    if (phase === "summary") {
      const timer = setTimeout(() => {
        onComplete();
      }, 1200 / speed);
      return () => clearTimeout(timer);
    }
  }, [phase, currentEventIndex, totalEvents, eventDuration, speed, isSkipped, onComplete]);

  // Skip handler — jump to end
  const handleSkip = useCallback(() => {
    setIsSkipped(true);
    setCurrentEventIndex(totalEvents);
    setPhase("summary");
    // Delay onComplete slightly so the summary flashes
    setTimeout(() => onComplete(), 300);
  }, [totalEvents, onComplete]);

  return (
    <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-gray-900 rounded-xl shadow-2xl p-4 w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold text-lg">
            Turn {results.turn} Results
          </h3>
          <button
            onClick={handleSkip}
            className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            Skip ⏭
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-800 rounded-full mb-3">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{
              width: `${totalEvents > 0 ? (Math.min(currentEventIndex, totalEvents) / totalEvents) * 100 : 100}%`,
            }}
          />
        </div>

        {/* Intro phase */}
        {phase === "intro" && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-2xl text-white font-bold animate-pulse">
              Resolving Turn {results.turn}...
            </div>
          </div>
        )}

        {/* Events list */}
        {(phase === "events" || phase === "summary") && (
          <div className="flex-1 overflow-y-auto space-y-1 min-h-[100px]">
            {results.events.map((event, i) => {
              const isVisible = i <= currentEventIndex;
              const isCurrent = i === currentEventIndex && phase === "events";

              if (!isVisible) return null;

              return (
                <EventRow
                  key={i}
                  event={event}
                  isCurrent={isCurrent}
                />
              );
            })}

            {totalEvents === 0 && (
              <div className="text-gray-500 text-sm text-center py-4">
                No events this turn
              </div>
            )}
          </div>
        )}

        {/* Summary phase */}
        {phase === "summary" && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <TurnSummary events={results.events} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Event Row ───────────────────────────────────────────────────────────────

function EventRow({
  event,
  isCurrent,
}: {
  event: TurnEvent;
  isCurrent: boolean;
}) {
  const icon = EVENT_ICONS[event.type];
  const color = EVENT_COLORS[event.type];

  return (
    <div
      className={`
        flex items-start gap-2 px-2 py-1.5 rounded transition-all duration-200
        ${isCurrent ? "bg-gray-800 scale-[1.02]" : "bg-transparent"}
      `}
    >
      <span className="text-sm flex-shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        {event.cinderlingName && (
          <span className={`text-xs font-bold ${color}`}>
            {event.cinderlingName}
          </span>
        )}
        <span className="text-xs text-gray-300 ml-1">{event.detail}</span>
      </div>
      <span className="text-[10px] text-gray-600 flex-shrink-0 uppercase">
        {event.type}
      </span>
    </div>
  );
}

// ─── Turn Summary ────────────────────────────────────────────────────────────

function TurnSummary({ events }: { events: TurnEvent[] }) {
  const counts: Record<string, number> = {};
  for (const event of events) {
    counts[event.type] = (counts[event.type] ?? 0) + 1;
  }

  const entries = Object.entries(counts);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([type, count]) => {
        const icon = EVENT_ICONS[type as TurnEvent["type"]] ?? "•";
        const color = EVENT_COLORS[type as TurnEvent["type"]] ?? "text-gray-400";
        return (
          <span
            key={type}
            className={`text-xs px-2 py-0.5 rounded-full bg-gray-800 ${color}`}
          >
            {icon} {count} {type}
            {count > 1 ? "s" : ""}
          </span>
        );
      })}
    </div>
  );
}

// ─── Battle Log (persistent, non-overlay version) ────────────────────────────

type BattleLogEntry = {
  turn: number;
  events: TurnEvent[];
};

type BattleLogProps = {
  /** All turn results accumulated so far */
  history: BattleLogEntry[];
  /** Max entries to show before scrolling */
  maxVisible?: number;
};

/**
 * Persistent battle log sidebar showing all events from the match.
 * Separate from the overlay animation — this persists between turns.
 */
export function BattleLog({ history, maxVisible = 50 }: BattleLogProps) {
  // Flatten and take most recent
  const allEvents: { turn: number; event: TurnEvent }[] = [];
  for (const entry of history) {
    for (const event of entry.events) {
      allEvents.push({ turn: entry.turn, event });
    }
  }
  const visible = allEvents.slice(-maxVisible);

  return (
    <div className="bg-gray-900 rounded-lg p-2 h-full flex flex-col">
      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
        Battle Log
      </h4>
      <div className="flex-1 overflow-y-auto space-y-0.5">
        {visible.length === 0 && (
          <div className="text-gray-600 text-xs text-center py-4">
            No events yet
          </div>
        )}
        {visible.map((item, i) => {
          const icon = EVENT_ICONS[item.event.type];
          const color = EVENT_COLORS[item.event.type];
          const showTurnHeader =
            i === 0 || visible[i - 1].turn !== item.turn;

          return (
            <div key={i}>
              {showTurnHeader && (
                <div className="text-[10px] text-gray-500 font-bold mt-1.5 mb-0.5 px-1">
                  Turn {item.turn}
                </div>
              )}
              <div className="flex items-start gap-1.5 px-1 py-0.5 text-[11px]">
                <span className="flex-shrink-0">{icon}</span>
                <span className="text-gray-400">
                  {item.event.cinderlingName && (
                    <span className={`font-medium ${color}`}>
                      {item.event.cinderlingName}
                    </span>
                  )}{" "}
                  {item.event.detail}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
