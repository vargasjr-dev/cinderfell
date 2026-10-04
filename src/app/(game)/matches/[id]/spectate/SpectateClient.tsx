"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import TurnHistory, { type TurnSnapshot } from "../play/TurnHistory";
import type { CinderlingDisplay as CanvasCinderling } from "../play/BattleCanvas";
import {
  type RawGameState,
  type RawTeam,
  type RawTurnLog,
  type Vec2,
  buildUnifiedSteps,
  buildCinderlingLookup,
} from "../play/turnAnimation";
import { useTurnAnimation } from "../play/useTurnAnimation";

// ─── Power description lookup (client-safe) ───────────────────────────────────
import { CINDERLING_LIBRARY } from "../../../../../../server/cinderlings";
import { getPower } from "../../../../../../server/specialPowers";
import "../../../../../../server/powers"; // side-effect: registers all powers

const POWER_DESC_BY_NAME = new Map<string, string>(
  CINDERLING_LIBRARY.flatMap((v) => {
    if (!v.specialPowerId) return [];
    const power = getPower(v.specialPowerId);
    if (!power?.description) return [];
    return [[v.name.toLowerCase(), power.description]];
  }),
);

const POWER_NAME_BY_NAME = new Map<string, string>(
  CINDERLING_LIBRARY.flatMap((v) => {
    if (!v.specialPowerId) return [];
    const power = getPower(v.specialPowerId);
    if (!power?.name) return [];
    return [[v.name.toLowerCase(), power.name]];
  }),
);

const BattleCanvas = dynamic(() => import("../play/BattleCanvas"), {
  ssr: false,
});

// ─── Local display types ──────────────────────────────────────────────────────

type AttackDisplay = {
  key: string;
  name: string;
  damage: number;
  energyCost: number;
  range: number;
};

type CinderlingDisplay = {
  uuid: string;
  name: string;
  hp: number;
  maxHp: number;
  speed: number;
  attack: number;
  x: number;
  y: number;
  isKO: boolean;
  imageUrl?: string;
  attacks: AttackDisplay[];
};

type TeamDisplay = {
  id: 1 | 2;
  name: string;
  energy: number;
  active: CinderlingDisplay[];
  benchCount: number;
  knockedCount: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapTeam(t: RawTeam): TeamDisplay {
  return {
    id: t.id,
    name: t.name,
    energy: t.energy,
    active: t.active.map((v) => ({
      uuid: v.uuid,
      name: v.name,
      hp: v.hp,
      maxHp: v.maxHp,
      speed: v.speed,
      attack: v.attack,
      x: v.position?.x ?? 0,
      y: v.position?.y ?? 0,
      isKO: v.isKO,
      imageUrl: v.imageUrl,
      attacks: (v.attacks ?? []) as AttackDisplay[],
    })),
    benchCount: t.bench.length,
    knockedCount: t.knocked.length,
  };
}

function parseGameState(gs: RawGameState) {
  const teams: [TeamDisplay, TeamDisplay] | null =
    gs.teams.length >= 2 ? [mapTeam(gs.teams[0]), mapTeam(gs.teams[1])] : null;
  const boardSpaces =
    gs.board?.map((s) => ({
      x: s.position.x,
      y: s.position.y,
      type: s.type,
      occupationCounter: s.occupationCounter,
      harvestYield: s.harvestYield,
    })) ?? [];
  const gameOver = gs.result
    ? {
        winner:
          gs.teams.find((t) => t.id === gs.result!.winner)?.name ??
          `Team ${gs.result.winner}`,
        condition: gs.result.condition,
      }
    : null;
  return {
    turn: gs.turn,
    teams,
    boardWidth: gs.boardWidth,
    boardHeight: gs.boardHeight,
    boardSpaces,
    gameOver,
  };
}

// ─── Direction helpers ────────────────────────────────────────────────────────

/**
 * Convert a game-space Vec2 to a screen-space label for display in spectate logs.
 * Spectate always renders with yourTeamId=1 in portrait:
 *   Team1 col=gy, row=bw-1-gx → game +x = screen up.
 */
function vecToScreenLabel(vec: Vec2 | undefined, isPortrait: boolean): string {
  if (!vec) return "";
  const { dx, dy } = vec;
  if (!isPortrait) {
    return dx === 1 ? " right" : dx === -1 ? " left" : dy === 1 ? " down" : " up";
  }
  // Spectate uses team1 perspective
  return dx === 1 ? " up" : dx === -1 ? " down" : dy === 1 ? " right" : " left";
}

// ─── Component ───────────────────────────────────────────────────────────────

type Props = { matchId: string; initialTurn?: number };

export default function SpectateClient({ matchId, initialTurn = 0 }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AI team tracking — which team IDs are AI-driven (have LLM logs)
  const [aiTeamIds, setAiTeamIds] = useState<Set<1 | 2>>(new Set());

  // Replay mode
  const [turnSnapshots, setTurnSnapshots] = useState<RawGameState[] | null>(
    null,
  );
  const [turnLogs, setTurnLogs] = useState<RawTurnLog[]>([]);
  const [replayIndex, setReplayIndex] = useState(0);
  const [logOpen, setLogOpen] = useState(false);

  // Animation — shared hook owns all animation state
  const { animPhase, overlays, activeTween, startAnimation } =
    useTurnAnimation();

  // Live mode
  const [liveState, setLiveState] = useState<ReturnType<
    typeof parseGameState
  > | null>(null);
  const [turnHistory, setTurnHistory] = useState<TurnSnapshot[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const router = useRouter();
  const pathname = usePathname();

  const isReplay = turnSnapshots !== null && turnSnapshots.length > 0;

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    let interval: ReturnType<typeof setInterval> | null = null;

    const fetchState = async () => {
      try {
        const res = await fetch(`/api/spectate/${matchId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          gameState: RawGameState;
          turnSnapshots?: RawGameState[];
          turnLogs?: RawTurnLog[];
          status: string;
          turnHistory?: TurnSnapshot[];
          p1ProfileId?: string | null;
          p2ProfileId?: string | null;
        };
        if (!active) return;

        const snapshots = data.turnSnapshots ?? [];

        if (snapshots.length > 0) {
          setTurnSnapshots(snapshots);
          setTurnLogs(data.turnLogs ?? []);
          setReplayIndex(Math.min(initialTurn, snapshots.length - 1));
          // Determine which teams are AI-driven (have profileIds)
          const ids = new Set<1 | 2>();
          if (data.p1ProfileId) ids.add(1);
          if (data.p2ProfileId) ids.add(2);
          setAiTeamIds(ids);
          setLoading(false);
          return;
        }

        // Live mode
        setLiveState(parseGameState(data.gameState));
        if (data.turnHistory?.length) setTurnHistory(data.turnHistory);
        setLastUpdated(new Date());
        setLoading(false);

        interval = setInterval(async () => {
          if (!active) return;
          try {
            const r = await fetch(`/api/spectate/${matchId}`);
            if (!r.ok) return;
            const d = (await r.json()) as {
              gameState: RawGameState;
              turnHistory?: TurnSnapshot[];
            };
            if (!active) return;
            setLiveState(parseGameState(d.gameState));
            if (d.turnHistory?.length) setTurnHistory(d.turnHistory);
            setLastUpdated(new Date());
          } catch {
            /* ignore */
          }
        }, 2000);
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : "Failed to load match");
          setLoading(false);
        }
      }
    };

    void fetchState();
    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
  }, [matchId]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Close log when index changes
  useEffect(() => {
    setLogOpen(false);
  }, [replayIndex]);

  // Sync ?turn= query param so a refresh restores the current position
  useEffect(() => {
    if (!isReplay) return;
    const url = `${pathname}?turn=${replayIndex}`;
    router.replace(url, { scroll: false });
  }, [replayIndex, isReplay, pathname, router]);

  // Mon card overlay — tapping any cinderling on the board opens its card.
  const [selectedMonUuid, setSelectedMonUuid] = useState<string | null>(null);

  // Stable callback so BattleCanvas's draw effect doesn't re-run on every render.
  const handleSelectCinderling = useCallback(
    (uuid: string | null) => setSelectedMonUuid(uuid),
    [],
  );

  // ── Step forward through replay ───────────────────────────────────────────
  const stepForward = useCallback(() => {
    if (!turnSnapshots || !isReplay) return;
    if (animPhase !== "idle") return;
    const nextIdx = replayIndex + 1;
    if (nextIdx >= turnSnapshots.length) return;

    const fromSnap = turnSnapshots[replayIndex];
    const toSnap = turnSnapshots[nextIdx];
    const log = turnLogs[replayIndex] ?? null;
    const lookup = buildCinderlingLookup(fromSnap);

    // Sort commands by cinderling speed (fastest first)
    const cmds = log?.commandResults ?? [];
    const getSpeed = (uuid: string): number => {
      for (const team of fromSnap.teams) {
        const vm = team.active.find((av) => av.uuid === uuid);
        if (vm) return vm.speed;
      }
      return 0;
    };
    const sortedCmds = [...cmds].sort(
      (x, y) =>
        getSpeed(y.command.cinderlingUuid) - getSpeed(x.command.cinderlingUuid),
    );

    const steps = buildUnifiedSteps(
      sortedCmds,
      fromSnap,
      toSnap,
      lookup,
      log?.turnStartEvents ?? [],
    );

    startAnimation(steps, () => setReplayIndex(nextIdx));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnSnapshots, replayIndex, turnLogs, animPhase, isReplay, startAnimation]);

  // ── Replay display state ──────────────────────────────────────────────────
  const replayParsed = useMemo(() => {
    if (!isReplay || !turnSnapshots) return null;
    return parseGameState(turnSnapshots[replayIndex]);
  }, [isReplay, turnSnapshots, replayIndex]);

  const displayState = isReplay ? replayParsed : liveState;
  const { turn, teams, boardWidth, boardHeight, boardSpaces, gameOver } =
    displayState ?? {
      turn: 0,
      teams: null,
      boardWidth: 9,
      boardHeight: 5,
      boardSpaces: [],
      gameOver: null,
    };

  const [t1, t2] = teams ?? [null, null];

  // Stable empty set — passing `new Set()` inline creates a new reference each
  // render, which fires the cinderlings useEffect in BattleCanvas and clears
  // committed displayVmsRef positions during multi-step animations.
  const emptyCommandedUuids = useMemo(() => new Set<string>(), []);

  const allCinderlings = useMemo(
    () => [
      ...(t1?.active.map((v: CinderlingDisplay) => ({
        ...v,
        teamId: t1.id as 1 | 2,
      })) ?? []),
      ...(t2?.active.map((v: CinderlingDisplay) => ({
        ...v,
        teamId: t2.id as 1 | 2,
      })) ?? []),
    ],
    [t1, t2],
  );

  // ── Turn log for the current replay index ─────────────────────────────────
  // turnLogs[i] describes the transition from snapshot[i] → snapshot[i+1].
  // So for replayIndex N (N > 0), the log is turnLogs[N - 1].
  const currentLog: RawTurnLog | null =
    isReplay && replayIndex > 0 ? (turnLogs[replayIndex - 1] ?? null) : null;

  const cinderlingLookup = useMemo(() => {
    if (!currentLog || !turnSnapshots)
      return new Map<string, { name: string; teamId: 1 | 2 }>();
    return buildCinderlingLookup(turnSnapshots[replayIndex - 1]);
  }, [currentLog, turnSnapshots, replayIndex]);

  const hasLog = currentLog !== null && turnLogs.length > 0;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0a0f1a] flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Loading match...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-[#0a0f1a] flex items-center justify-center">
        <div className="text-center text-white max-w-md px-4">
          <p className="text-red-400 mb-4">{error}</p>
          <Link
            href={`/matches/${matchId}`}
            className="text-blue-400 hover:underline"
          >
            ← Match summary
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0f1a] text-white flex flex-col">
      {/* ── Top bar ── */}
      <div className="flex justify-between items-center px-4 py-2 shrink-0 border-b border-gray-800">
        <Link
          href={`/matches/${matchId}`}
          className="text-gray-400 text-sm hover:text-white bg-black/40 px-3 py-1.5 rounded-lg"
        >
          ← Back
        </Link>

        {/* Center: replay stepper or live turn counter */}
        {isReplay && turnSnapshots ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setReplayIndex((i: number) => Math.max(0, i - 1))}
              disabled={replayIndex === 0}
              className="text-gray-300 bg-black/40 px-3 py-1.5 rounded-lg font-mono hover:bg-black/60 transition disabled:opacity-30 disabled:cursor-not-allowed text-sm"
            >
              ←
            </button>
            <button
              onClick={() => hasLog && setLogOpen((o: boolean) => !o)}
              className={`text-sm bg-black/40 px-3 py-1.5 rounded-lg font-mono min-w-[120px] text-center transition ${
                hasLog
                  ? "text-gray-300 hover:bg-black/60 cursor-pointer"
                  : "text-gray-500 cursor-default"
              }`}
            >
              {replayIndex === 0 ? "Start" : `Turn ${turn}`}
              {hasLog && (
                <span className="text-[10px] text-gray-500 ml-1">
                  {logOpen ? "▲" : "▼"}
                </span>
              )}
              <span className="text-gray-600 text-xs ml-1">
                / {turnSnapshots.length - 1}
              </span>
            </button>
            <button
              onClick={stepForward}
              disabled={
                replayIndex === turnSnapshots.length - 1 || animPhase !== "idle"
              }
              className="text-gray-300 bg-black/40 px-3 py-1.5 rounded-lg font-mono hover:bg-black/60 transition disabled:opacity-30 disabled:cursor-not-allowed text-sm"
            >
              {animPhase !== "idle" ? (
                <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin align-middle" />
              ) : (
                "→"
              )}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded font-mono">
              👁 SPECTATING
            </span>
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              className="text-gray-300 text-sm bg-black/40 px-3 py-1.5 rounded-lg font-mono hover:bg-black/60 transition flex items-center gap-1"
            >
              Turn {turn}
              {turnHistory.length > 0 && (
                <span className="text-[10px] text-gray-500">▼</span>
              )}
            </button>
          </div>
        )}

        {/* Right: live indicator */}
        <div className="w-16 flex items-center justify-end gap-1.5">
          {!isReplay && !gameOver && (
            <>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-gray-500">
                {lastUpdated ? lastUpdated.toLocaleTimeString() : "live"}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Game over banner ── */}
      {gameOver &&
        (isReplay
          ? replayIndex === (turnSnapshots?.length ?? 1) - 1
          : true) && (
          <div className="fixed inset-x-0 top-16 z-[70] flex justify-center pointer-events-none px-4">
            <div className="bg-yellow-900/90 border border-yellow-500/60 rounded-xl px-6 py-3 text-center shadow-lg backdrop-blur-sm">
              <p className="text-yellow-300 font-bold text-lg">
                🏆 {gameOver.winner} wins!
              </p>
              <p className="text-yellow-500 text-sm capitalize">
                Victory by {gameOver.condition}
              </p>
            </div>
          </div>
        )}

      {/* ── Board canvas ── */}
      <div className="flex-1 relative min-h-0">
        {/* Turn log drawer (replay mode) */}
        {isReplay && logOpen && currentLog && (
          <div className="absolute top-0 left-0 right-0 z-10">
            <TurnLogDrawer
              log={currentLog}
              lookup={cinderlingLookup}
              aiTeamIds={aiTeamIds}
              matchId={matchId}
            />
          </div>
        )}
        {t1 && <CompactTeamHUD team={t1} color="blue" position="bottom-left" />}
        {t2 && <CompactTeamHUD team={t2} color="red" position="top-right" />}
        {selectedMonUuid && (
          <MonCardOverlay
            uuid={selectedMonUuid}
            teams={teams}
            onClose={() => setSelectedMonUuid(null)}
          />
        )}
        <BattleCanvas
          boardWidth={boardWidth}
          boardHeight={boardHeight}
          spaces={boardSpaces}
          cinderlings={allCinderlings as CanvasCinderling[]}
          yourTeamId={1}
          selectedCinderling={selectedMonUuid}
          onSelectCinderling={handleSelectCinderling}
          commandedUuids={emptyCommandedUuids}
          overlays={overlays ?? undefined}
          tween={activeTween ?? undefined}
          tapAllCinderlings
        />
      </div>

      {/* ── Turn history sheet (live mode only) ── */}
      {!isReplay && (
        <TurnHistory
          history={turnHistory}
          isOpen={historyOpen}
          onToggle={() => setHistoryOpen(!historyOpen)}
        />
      )}
    </div>
  );
}

// ─── LLM Debug Modal ─────────────────────────────────────────────────────────

type LlmLog = {
  turn: number;
  teamId: number;
  model: string;
  systemPrompt: string;
  userMessage: string;
  rawResponse: string;
  commands: unknown;
  errorMessage: string | null;
};

function LlmDebugModal({
  matchId,
  turn,
  teamId,
  onClose,
}: {
  matchId: string;
  turn: number;
  teamId: 1 | 2;
  onClose: () => void;
}) {
  const [log, setLog] = useState<LlmLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"prompt" | "message" | "response">("message");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(
          `/api/llm-requests?matchId=${encodeURIComponent(matchId)}&turn=${turn}&teamId=${teamId}`,
        );
        if (res.status === 404) {
          setError("No LLM log found — this turn may have used rule-based AI.");
        } else if (!res.ok) {
          setError(`Error ${res.status}`);
        } else {
          setLog((await res.json()) as LlmLog);
        }
      } catch {
        setError("Failed to load LLM log.");
      } finally {
        setLoading(false);
      }
    })();
  }, [matchId, turn, teamId]);

  const teamColor = teamId === 1 ? "border-blue-500/60 bg-blue-900/20" : "border-red-500/60 bg-red-900/20";
  const tabBase = "px-3 py-1 text-xs rounded-md transition-colors";
  const tabActive = "bg-gray-700 text-white";
  const tabInactive = "text-gray-400 hover:text-white";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className={`bg-[#0d1520] border ${teamColor} rounded-2xl p-4 mx-4 w-full max-w-2xl max-h-[80vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-white font-bold text-sm">🤖 AI Debug — Turn {turn}, Team {teamId}</span>
            {log && <span className="text-gray-400 text-xs ml-2">({log.model})</span>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
        </div>

        {loading && <p className="text-gray-400 text-sm text-center py-8">Loading…</p>}
        {error && <p className="text-red-400 text-sm text-center py-8">{error}</p>}

        {log && (
          <>
            {log.errorMessage && (
              <div className="mb-3 px-3 py-2 bg-red-900/30 border border-red-700/40 rounded-lg text-red-300 text-xs">
                ⚠️ LLM error (fell back to rule-based AI): {log.errorMessage}
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 mb-3 bg-gray-900/60 p-1 rounded-lg w-fit">
              <button className={`${tabBase} ${tab === "message" ? tabActive : tabInactive}`} onClick={() => setTab("message")}>
                Game State
              </button>
              <button className={`${tabBase} ${tab === "prompt" ? tabActive : tabInactive}`} onClick={() => setTab("prompt")}>
                System Prompt
              </button>
              <button className={`${tabBase} ${tab === "response" ? tabActive : tabInactive}`} onClick={() => setTab("response")}>
                Response
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed bg-gray-900/50 rounded-lg p-3">
                {tab === "prompt" && log.systemPrompt}
                {tab === "message" && log.userMessage}
                {tab === "response" && log.rawResponse}
              </pre>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Turn Log Drawer ──────────────────────────────────────────────────────────

function TurnLogDrawer({
  log,
  lookup,
  aiTeamIds,
  matchId,
}: {
  log: RawTurnLog;
  lookup: Map<string, { name: string; teamId: 1 | 2 }>;
  aiTeamIds: Set<1 | 2>;
  matchId: string;
}) {
  const [debugModal, setDebugModal] = useState<{ turn: number; teamId: 1 | 2 } | null>(null);
  const bench1 = log.benchEntries?.team1 ?? [];
  const bench2 = log.benchEntries?.team2 ?? [];
  const allBench = [...bench1, ...bench2];

  return (
    <div className="border-b border-gray-800 bg-[#0d1520]/95 backdrop-blur-sm px-3 py-2 max-h-52 overflow-y-auto">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 font-semibold">
        Turn {log.turn} — Actions
      </p>
      <div className="space-y-1">
        {(log.turnStartEvents ?? []).map((e, i) => {
          const teamColor = e.team === 1 ? "text-blue-400" : "text-red-400";
          if (e.damageAmount) {
            return (
              <div
                key={`ts-${i}`}
                className="flex items-center gap-1.5 text-xs"
              >
                <span className={`font-semibold w-20 truncate ${teamColor}`}>
                  {e.casterName}
                </span>
                <span className="text-gray-500">🔥</span>
                <span className="text-gray-300">{e.powerName}</span>
                <span className="text-orange-400 font-mono">
                  −{e.damageAmount} HP
                </span>
                <span className="text-gray-400">→ {e.targetName}</span>
              </div>
            );
          }
          if (e.healAmount) {
            return (
              <div
                key={`ts-${i}`}
                className="flex items-center gap-1.5 text-xs"
              >
                <span className={`font-semibold w-20 truncate ${teamColor}`}>
                  {e.casterName}
                </span>
                <span className="text-gray-500">💧</span>
                <span className="text-gray-300">{e.powerName}</span>
                <span className="text-emerald-400 font-mono">
                  +{e.healAmount} HP
                </span>
                <span className="text-gray-400">→ {e.targetName}</span>
              </div>
            );
          }
          return null;
        })}

        {log.commandResults.map((r, i) => {
          const info = lookup.get(r.command.cinderlingUuid);
          const name = info?.name ?? r.command.cinderlingUuid;
          const teamId = info?.teamId ?? 1;
          const teamColor = teamId === 1 ? "text-blue-400" : "text-red-400";
          const icon =
            r.command.type === "attack"
              ? "⚔️"
              : r.command.type === "harvest"
                ? "🌿"
                : "👟";
          const dirStr = vecToScreenLabel(r.command.vec, true);
          const targetInfo = r.targetUuid ? lookup.get(r.targetUuid) : null;
          const victimStr = targetInfo ? ` → ${targetInfo.name}` : "";
          const dmgStr = r.damageDealt ? ` −${r.damageDealt} HP` : "";
          const koStr = r.targetKO ? " 💀 KO!" : "";
          const energyStr =
            r.energyDelta && r.energyDelta > 0 ? ` +${r.energyDelta}⚡` : "";
          const powerDrainStr = r.powerEnergyDeltas
            ? Object.entries(r.powerEnergyDeltas)
                .map(([t, amt]) =>
                  amt < 0 ? `T${t} −${Math.abs(amt)}⚡` : `T${t} +${amt}⚡`,
                )
                .join(" ")
            : "";
          const failStr = !r.success ? ` ✗ ${r.reason ?? "failed"}` : "";

          return (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <span className={`font-semibold w-20 truncate ${teamColor}`}>
                {name}
              </span>
              <span className="text-gray-500">{icon}</span>
              <span className="text-gray-300">
                {r.command.type === "attack" && r.attackName
                  ? `used ${r.attackName}`
                  : r.command.type}
                {dirStr}
              </span>
              {victimStr && <span className="text-gray-400">{victimStr}</span>}
              {dmgStr && (
                <span className="text-orange-400 font-mono">{dmgStr}</span>
              )}
              {koStr && <span className="text-red-400 font-bold">{koStr}</span>}
              {powerDrainStr && (
                <span className="text-purple-400 font-mono text-xs">
                  {powerDrainStr}
                </span>
              )}
              {energyStr && (
                <span className="text-yellow-400 font-mono">{energyStr}</span>
              )}
              {failStr && (
                <span className="text-gray-600 italic">{failStr}</span>
              )}
              {/* 🤖 debug button — only shown for AI team commands */}
              {aiTeamIds.has(teamId) && (
                <button
                  className="ml-auto text-gray-600 hover:text-purple-400 transition-colors leading-none text-xs"
                  title="View AI decision log"
                  onClick={() => setDebugModal({ turn: log.turn, teamId })}
                >
                  🤖
                </button>
              )}
            </div>
          );
        })}

        {/* LLM debug modal */}
        {debugModal && (
          <LlmDebugModal
            matchId={matchId}
            turn={debugModal.turn}
            teamId={debugModal.teamId}
            onClose={() => setDebugModal(null)}
          />
        )}

        {allBench.length > 0 && (
          <div className="pt-1 border-t border-gray-800/60 mt-1">
            {allBench.map((e, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <span className="text-gray-400 font-semibold w-20 truncate">
                  {e.cinderlingName}
                </span>
                <span className="text-gray-500">🔄</span>
                <span
                  className={
                    e.status === "entered" ? "text-green-400" : "text-gray-600"
                  }
                >
                  {e.status === "entered"
                    ? "entered from bench"
                    : "bench entry blocked"}
                </span>
              </div>
            ))}
          </div>
        )}

        {log.winResult && (
          <div className="pt-1 border-t border-yellow-800/40 mt-1">
            <span className="text-yellow-400 text-xs font-bold">
              🏆 Team {log.winResult.winner} wins by {log.winResult.condition}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Mon Card Overlay ─────────────────────────────────────────────────────────

function MonCardOverlay({
  uuid,
  teams,
  onClose,
}: {
  uuid: string;
  teams: [TeamDisplay, TeamDisplay] | null;
  onClose: () => void;
}) {
  if (!teams) return null;
  let vm: CinderlingDisplay | undefined;
  let teamId: 1 | 2 = 1;
  for (const t of teams) {
    const found = t.active.find((v) => v.uuid === uuid);
    if (found) {
      vm = found;
      teamId = t.id;
      break;
    }
  }
  if (!vm) return null;

  const pct = vm.maxHp > 0 ? vm.hp / vm.maxHp : 0;
  const barColor =
    pct > 0.5 ? "bg-green-500" : pct > 0.25 ? "bg-yellow-500" : "bg-red-500";
  const borderColor = teamId === 1 ? "border-blue-500/60" : "border-red-500/60";
  const headerBg = teamId === 1 ? "bg-blue-900/70" : "bg-red-900/70";

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className={`bg-[#0d1520] border-2 ${borderColor} rounded-2xl p-4 mx-4 w-full max-w-[280px]`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`${headerBg} rounded-xl px-3 py-2 mb-3 flex items-center justify-between`}
        >
          <span className="font-bold text-white text-base">{vm.name}</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Sprite */}
        {vm.imageUrl ? (
          <div
            className="w-32 h-32 mx-auto mb-3 rounded-xl"
            style={{
              backgroundImage: `url(${vm.imageUrl})`,
              backgroundSize: "200%",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          />
        ) : (
          <div
            className={`w-32 h-32 mx-auto mb-3 rounded-full opacity-60 ${teamId === 1 ? "bg-blue-500" : "bg-red-500"}`}
          />
        )}

        {/* HP */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>HP</span>
            <span className="font-mono">
              {vm.hp}/{vm.maxHp}
            </span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${barColor} transition-all`}
              style={{ width: `${pct * 100}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-gray-800/60 rounded-xl px-3 py-2 text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">
              Speed
            </p>
            <p className="text-white font-bold text-lg">{vm.speed}</p>
          </div>
          <div className="bg-gray-800/60 rounded-xl px-3 py-2 text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">
              Attack
            </p>
            <p className="text-white font-bold text-lg">{vm.attack}</p>
          </div>
        </div>

        {/* Special Power */}
        {(() => {
          const powerName = POWER_NAME_BY_NAME.get(vm.name.toLowerCase());
          const powerDesc = POWER_DESC_BY_NAME.get(vm.name.toLowerCase());
          if (!powerName && !powerDesc) return null;
          return (
            <div className="mb-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5">
                Special Power
              </p>
              <div className="bg-purple-900/40 border border-purple-500/30 rounded-xl px-3 py-2">
                {powerName && (
                  <p className="text-purple-300 text-xs font-semibold mb-0.5">
                    ✨ {powerName}
                  </p>
                )}
                {powerDesc && (
                  <p className="text-gray-300 text-xs leading-relaxed">
                    {powerDesc}
                  </p>
                )}
              </div>
            </div>
          );
        })()}

        {/* Moves */}
        {vm.attacks.length > 0 && (
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5">
              Moves
            </p>
            <div className="space-y-1">
              {vm.attacks.map((atk, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-gray-800/60 rounded-lg px-2.5 py-1.5"
                >
                  <span className="text-white text-xs font-medium">
                    {atk.name}
                  </span>
                  <div className="flex gap-2 text-[11px]">
                    <span className="text-orange-400">💥 {atk.damage}</span>
                    <span className="text-yellow-400">⚡ {atk.energyCost}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Compact Team HUD (corner overlay) ───────────────────────────────────────

function CompactTeamHUD({
  team,
  color,
  position,
}: {
  team: TeamDisplay;
  color: "blue" | "red";
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}) {
  const posClass =
    position === "top-left"
      ? "top-2 left-2"
      : position === "top-right"
        ? "top-2 right-2"
        : position === "bottom-left"
          ? "bottom-2 left-2"
          : "bottom-2 right-2";
  const bgClass =
    color === "blue"
      ? "bg-blue-950/85 border-blue-500/40"
      : "bg-red-950/85 border-red-500/40";
  const aliveOnField = team.active.filter((v) => !v.isKO).length;
  const totalAlive = aliveOnField + team.benchCount;

  const displayName =
    team.name.replace(/\s*\(.*\)\s*$/, "").trim() || team.name;

  return (
    <div
      className={`absolute ${posClass} z-10 ${bgClass} border rounded-xl px-2.5 py-1.5 backdrop-blur-sm pointer-events-none max-w-[140px]`}
    >
      <p className="font-bold text-xs text-white truncate">{displayName}</p>
      <div className="flex gap-2 text-xs text-gray-300 mt-0.5">
        <span>⚡{team.energy}</span>
        <span>🗡️{totalAlive}</span>
      </div>
    </div>
  );
}
