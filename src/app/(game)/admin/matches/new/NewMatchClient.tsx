"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { GAME_CONFIG } from "../../../../../../server/config";

type Profile = {
  id: string;
  name: string;
  teamNames: string[];
  randomness: number;
  description: string;
};

type ParticipantConfig =
  | { type: "profile"; id: string }
  | { type: "random" };

type TurnEvent = {
  type: "turn";
  turn: number;
  team1Alive: number;
  team2Alive: number;
  energy1: number;
  energy2: number;
  winner: string | null;
};

type DoneEvent = {
  type: "done";
  matchId: string;
  spectateUrl: string;
  winner: string | null;
  turns: number;
};

type SimEvent = TurnEvent | DoneEvent | { type: "error"; message: string };

function ParticipantPicker({
  label,
  profiles,
  value,
  onChange,
}: {
  label: string;
  profiles: Profile[];
  value: ParticipantConfig;
  onChange: (v: ParticipantConfig) => void;
}) {
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        {label}
      </p>

      {/* Random option */}
      <button
        type="button"
        onClick={() => onChange({ type: "random" })}
        className={`w-full text-left px-3 py-2 rounded-lg border mb-2 text-sm transition ${
          value.type === "random"
            ? "border-blue-500 bg-blue-50 text-blue-800"
            : "border-gray-200 bg-white text-gray-700 hover:border-blue-300"
        }`}
      >
        <span className="font-medium">🎲 Random team</span>
        <span className="text-gray-400 ml-2 text-xs">8 random cinderlings</span>
      </button>

      {/* Profile options */}
      {profiles.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-2">
          No profiles yet —{" "}
          <a href="/admin/profiles" className="text-blue-500 underline">
            create one
          </a>
        </p>
      ) : (
        <div className="space-y-1 max-h-56 overflow-y-auto">
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange({ type: "profile", id: p.id })}
              className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition ${
                value.type === "profile" && value.id === p.id
                  ? "border-blue-500 bg-blue-50 text-blue-800"
                  : "border-gray-200 bg-white text-gray-700 hover:border-blue-300"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{p.name}</span>
                <span className="text-[10px] text-gray-400 shrink-0 font-mono">
                  🎲{p.randomness.toFixed(1)}
                </span>
              </div>
              {p.description && (
                <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">
                  {p.description}
                </p>
              )}
              <div className="flex flex-wrap gap-1 mt-1">
                {(p.teamNames as string[]).slice(0, 4).map((n) => (
                  <span
                    key={n}
                    className="text-[10px] bg-blue-50 text-blue-600 rounded px-1"
                  >
                    {n}
                  </span>
                ))}
                {p.teamNames.length > 4 && (
                  <span className="text-[10px] text-gray-400">
                    +{p.teamNames.length - 4}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TurnProgressBar({
  turn,
  maxTurns,
}: {
  turn: number;
  maxTurns: number;
}) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
      <div
        className="h-full bg-blue-500 rounded-full transition-all duration-300"
        style={{ width: `${Math.min(100, (turn / maxTurns) * 100)}%` }}
      />
    </div>
  );
}

export default function NewMatchClient({ profiles }: { profiles: Profile[] }) {
  const router = useRouter();
  const [p1, setP1] = useState<ParticipantConfig>({ type: "random" });
  const [p2, setP2] = useState<ParticipantConfig>({ type: "random" });
  const [maxTurns, setMaxTurns] = useState(GAME_CONFIG.match.maxTurns);
  const [startingEnergy, setStartingEnergy] = useState(20);
  const [winningEnergy, setWinningEnergy] = useState(
    GAME_CONFIG.energy.accumulationWinThreshold,
  );
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<TurnEvent[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const bothProfiles =
    p1.type === "profile" && p2.type === "profile";
  const isSimulated = bothProfiles;

  const buttonLabel = isSimulated ? "⚡ Run Simulation" : "⚔️ Start Match";

  async function handleStart() {
    setRunning(true);
    setError(null);
    setTurns([]);

    if (!isSimulated) {
      // Live match — TODO: wire to createAdminMatchAction with chosen teams/profiles
      setError("Live profile vs player matches coming soon — use profiles for simulation.");
      setRunning(false);
      return;
    }

    // Simulated — stream SSE
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/admin/matches/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p1, p2, maxTurns, startingEnergy, winningEnergy }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        setError(`Server error: ${res.status}`);
        setRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event: SimEvent;
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          if (event.type === "turn") {
            setTurns((prev) => [...prev, event as TurnEvent]);
          } else if (event.type === "done") {
            setRunning(false);
            router.push(event.spectateUrl);
            return;
          } else if (event.type === "error") {
            setError(event.message);
            setRunning(false);
            return;
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError(e instanceof Error ? e.message : "Simulation failed");
      }
      setRunning(false);
    }
  }

  const lastTurn = turns[turns.length - 1];

  return (
    <div className="space-y-6">
      {/* Participant pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ParticipantPicker
          label="Player 1"
          profiles={profiles}
          value={p1}
          onChange={setP1}
        />
        <ParticipantPicker
          label="Player 2"
          profiles={profiles}
          value={p2}
          onChange={setP2}
        />
      </div>

      {/* Match type indicator */}
      <div className="text-center text-sm text-gray-500">
        {p1.type === "profile" && p2.type === "profile" && (
          <span className="bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-3 py-1 text-xs font-medium">
            ⚡ Simulated — runs to completion, watch the replay after
          </span>
        )}
        {p1.type === "random" && p2.type === "random" && (
          <span className="bg-gray-100 text-gray-600 rounded-full px-3 py-1 text-xs">
            🎲 Random vs Random — simulated
          </span>
        )}
        {(p1.type === "profile") !== (p2.type === "profile") && (
          <span className="bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1 text-xs font-medium">
            🎮 Live match — you play
          </span>
        )}
      </div>

      {/* Max turns */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-gray-700">Max turns</label>
          <span className="text-sm font-mono text-gray-600">{maxTurns}</span>
        </div>
        <input
          type="range"
          min="5"
          max="50"
          step="5"
          value={maxTurns}
          onChange={(e) => setMaxTurns(parseInt(e.target.value))}
          className="w-full accent-blue-600"
          disabled={running}
        />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>5</span>
          <span>50</span>
        </div>
      </div>

      {/* Starting energy */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-gray-700">Starting energy</label>
          <span className="text-sm font-mono text-gray-600">{startingEnergy}⚡</span>
        </div>
        <input
          type="range"
          min="0"
          max="50"
          step="5"
          value={startingEnergy}
          onChange={(e) => setStartingEnergy(parseInt(e.target.value))}
          className="w-full accent-green-600"
          disabled={running}
        />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>0</span>
          <span>50</span>
        </div>
      </div>

      {/* Winning energy */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-gray-700">Winning energy</label>
          <span className="text-sm font-mono text-gray-600">{winningEnergy}⚡</span>
        </div>
        <input
          type="range"
          min="50"
          max="200"
          step="10"
          value={winningEnergy}
          onChange={(e) => setWinningEnergy(parseInt(e.target.value))}
          className="w-full accent-yellow-500"
          disabled={running}
        />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>50</span>
          <span>200</span>
        </div>
      </div>

      {/* Simulation progress (only shown while running) */}
      {running && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">
              Simulating… turn {lastTurn?.turn ?? 0} / {maxTurns}
            </span>
            {lastTurn && (
              <span className="text-xs text-gray-400">
                T1 {lastTurn.team1Alive} alive · T2 {lastTurn.team2Alive} alive
              </span>
            )}
          </div>
          <TurnProgressBar turn={lastTurn?.turn ?? 0} maxTurns={maxTurns} />
          {lastTurn?.winner && (
            <p className="text-xs text-green-600 font-medium">
              🏆 {lastTurn.winner} wins!
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </p>
      )}

      <button
        onClick={handleStart}
        disabled={running}
        className="w-full bg-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {running ? "Running…" : buttonLabel}
      </button>
    </div>
  );
}
