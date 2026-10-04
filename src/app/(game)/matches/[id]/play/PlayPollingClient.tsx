"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  getGameStateAction,
  submitCommandsAction,
  concedeAction,
  getCinderlingInfoAction,
  getMatchRewardsAction,
  type PlayCommand,
  type CinderlingInfo,
  type MatchRewards,
} from "./actions";
import { useRouter } from "next/navigation";
import VictoryModal from "./VictoryModal";
import { useSoundEffects } from "./useSoundEffects";

const BattleCanvas = dynamic(() => import("./BattleCanvas"), { ssr: false });
import type { PendingCommandDisplay } from "./BattleCanvas";

import TurnHistory, { type TurnSnapshot } from "./TurnHistory";
import {
  type RawGameState,
  type RawTurnLog,
  type RawCommandResult,
  buildUnifiedSteps,
  buildCinderlingLookup,
} from "./turnAnimation";
import { useTurnAnimation } from "./useTurnAnimation";
import CinderlingDrawer from "./CinderlingDrawer";

type Vec2 = { dx: number; dy: number };

// ─── Raw state type alias (re-exports from turnAnimation used locally) ─────────
// RawGameState + RawTurnLog are imported from turnAnimation.ts for animation.

/**
 * Convert a screen-space Vec2 to a game-space Vec2.
 *
 * In landscape, screen axes = game axes (no transform).
 * In portrait the board is rotated:
 *   Team 1 col=gy, row=boardWidth-1-gx → screen +dy maps to game +dx
 *   Team 2 col=gy, row=gx             → screen +dy maps to game -dx
 *
 * Screen convention: {dx:-1,dy:0}=←, {dx:1,dy:0}=→, {dx:0,dy:-1}=↑, {dx:0,dy:1}=↓
 */
function screenVecToGameVec(
  screenVec: Vec2,
  isPortrait: boolean,
  teamId: 1 | 2,
): Vec2 {
  if (!isPortrait) return screenVec;
  const { dx, dy } = screenVec;
  if (teamId === 1) {
    // Team 1 renders portrait as: col=gy, row=bw-1-gx
    // screen↑(dy-1) → decreasing row → increasing gx → game right (dx+1)
    // screen↓(dy+1) → increasing row → decreasing gx → game left  (dx-1)
    // screen←(dx-1) → decreasing col → decreasing gy → game up    (dy-1)
    // screen→(dx+1) → increasing col → increasing gy → game down  (dy+1)
    return { dx: -dy, dy: dx };
  } else {
    // Team 2 renders portrait as: col=gy, row=gx
    // screen↑(dy-1) → decreasing row → decreasing gx → game left  (dx-1)
    // screen↓(dy+1) → increasing row → increasing gx → game right (dx+1)
    // screen←(dx-1) → decreasing col → decreasing gy → game up    (dy-1)
    // screen→(dx+1) → increasing col → increasing gy → game down  (dy+1)
    return { dx: dy, dy: dx };
  }
}

/**
 * Convert a game-space Vec2 to the screen arrow symbol the player sees.
 * Portrait: Team1 col=gy row=bw-1-gx → game +x = screen up
 *           Team2 col=gy row=gx       → game +x = screen down
 * Landscape: game axes = screen axes.
 */
function gameVecToScreenArrow(
  vec: Vec2,
  isPortrait: boolean,
  teamId: 1 | 2,
): string {
  const { dx, dy } = vec;
  if (!isPortrait) {
    return dx === 1 ? "→" : dx === -1 ? "←" : dy === 1 ? "↓" : "↑";
  }
  if (teamId === 1) {
    return dx === 1 ? "↑" : dx === -1 ? "↓" : dy === 1 ? "→" : "←";
  } else {
    return dx === 1 ? "↓" : dx === -1 ? "↑" : dy === 1 ? "→" : "←";
  }
}

type Props = {
  matchUuid: string;
  userId: string;
  playerTeamName: string;
};

type AttackDisplay = {
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
  baseSpeed: number;
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

type RawTeam = {
  id: 1 | 2;
  userId: string;
  name: string;
  energy: number;
  active: Array<{
      uuid: string;
      name: string;
      hp: number;
      maxHp: number;
      speed: number;
      baseSpeed: number;
      attack: number;
      attacks?: AttackDisplay[];
      position: { x: number; y: number } | null;
      isKO: boolean;
      imageUrl?: string;
    }>;
  bench: unknown[];
  knocked: unknown[];
};

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
      baseSpeed: v.baseSpeed,
      attack: v.attack,
      x: v.position?.x ?? 0,
      y: v.position?.y ?? 0,
      isKO: v.isKO,
      imageUrl: v.imageUrl,
      attacks: v.attacks ?? [],
    })),
    benchCount: t.bench.length,
    knockedCount: t.knocked.length,
  };
}

export default function PlayPollingClient({ matchUuid, userId }: Props) {
  const [isPortrait, setIsPortrait] = useState(false);

  // Track orientation
  useEffect(() => {
    const check = () => setIsPortrait(window.innerHeight > window.innerWidth);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const [loading, setLoading] = useState(true);
  const [turnHistory, setTurnHistory] = useState<TurnSnapshot[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showGameMenu, setShowGameMenu] = useState(false);
  const [showConcedeConfirm, setShowConcedeConfirm] = useState(false);
  const [showVictory, setShowVictory] = useState<{
    winner: string;
    condition: string;
  } | null>(null);
  const [matchRewards, setMatchRewards] = useState<MatchRewards | null>(null);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [turn, setTurn] = useState(0);

  // Turn animation — shared hook, replaces the old healOverlays approach.
  const { animPhase, overlays: animOverlays, activeTween, startAnimation } =
    useTurnAnimation();
  // Snapshot of game state captured just before submitting commands.
  // Passed to buildUnifiedSteps as the "from" state for animation.
  const preTurnSnapRef = useRef<RawGameState | null>(null);

  const [teams, setTeams] = useState<[TeamDisplay, TeamDisplay] | null>(null);
  const [boardWidth, setBoardWidth] = useState(8);
  const [boardHeight, setBoardHeight] = useState(5);
  const [boardSpaces, setBoardSpaces] = useState<
    Array<{
      x: number;
      y: number;
      type: string;
      occupationCounter?: number;
      harvestYield?: number;
    }>
  >([]);
  const [selectedCinderling, setSelectedCinderling] = useState<string | null>(null);
  const [pendingCommands, setPendingCommands] = useState<PlayCommand[]>([]);
  const [gameOver, setGameOver] = useState<{
    winner: string;
    condition: string;
  } | null>(null);

  // Admin play-both-sides: track which team we're currently commanding
  const [activeTeamId, setActiveTeamId] = useState<1 | 2>(1);
  const [waitingForSwitch, setWaitingForSwitch] = useState(false);

  // We track raw team userIds to detect admin matches (same user on both teams)
  const [rawUserIds, setRawUserIds] = useState<[string, string] | null>(null);
  const isAdminSelfMatch = rawUserIds ? rawUserIds[0] === rawUserIds[1] : false;

  // Sparring (AI opponent) metadata
  const [isSparring, setIsSparring] = useState(false);

  // Cinderling display metadata — fetched once from server (library + power registry)
  const [cinderlingInfoCache, setCinderlingInfoCache] = useState<
    Record<string, CinderlingInfo>
  >({});
  const fetchedNamesRef = useRef<Set<string>>(new Set());

  // ─── Sound & animation ───────────────────────────────────────────────────
  const { play } = useSoundEffects();
  /** True while a turn submission is in-flight — shows "Submitting…" on button */
  const [submitting, setSubmitting] = useState(false);
  /** Briefly true after a turn resolves — pulses the Turn counter */
  const [turnFlash, setTurnFlash] = useState(false);
  /** Tracks previous KO counts to detect new KOs after turn resolve */
  const prevKnockedRef = useRef<{ t1: number; t2: number }>({ t1: 0, t2: 0 });
  /** Tracks whether victory/defeat sound has already been played */
  const resultSoundPlayedRef = useRef(false);

  // Your team = the one you're currently commanding
  const yourTeam = useMemo(() => {
    if (!teams) return null;
    if (isAdminSelfMatch) {
      return teams.find((t) => t.id === activeTeamId) ?? teams[0];
    }
    return teams.find((t) => t.id === activeTeamId) ?? teams[0];
  }, [teams, activeTeamId, isAdminSelfMatch]);

  const opponentTeam = useMemo(() => {
    if (!teams) return null;
    if (isAdminSelfMatch) {
      return teams.find((t) => t.id !== activeTeamId) ?? teams[1];
    }
    return teams.find((t) => t.id !== activeTeamId) ?? teams[1];
  }, [teams, activeTeamId, isAdminSelfMatch]);

  const parseState = useCallback(
    (
      data: {
        gameState: Record<string, unknown>;
        status: string;
        turnHistory?: TurnSnapshot[];
        sparring?: boolean;
      } | null,
    ) => {
      if (!data?.gameState) return;

      // Update turn history if provided
      if (data.turnHistory && data.turnHistory.length > 0) {
        setTurnHistory(data.turnHistory);
      }

      const gs = data.gameState as {
        turn: number;
        teams: RawTeam[];
        boardWidth: number;
        boardHeight: number;
        board: Array<{
          position: { x: number; y: number };
          type: string;
          occupationCounter?: number;
          harvestYield?: number;
        }>;
        result: { winner: 1 | 2; condition: string } | null;
        phase: string;
      };

      setTurn(gs.turn);
      setBoardWidth(gs.boardWidth);
      setBoardHeight(gs.boardHeight);
      setBoardSpaces(
        gs.board?.map((s) => ({
          x: s.position.x,
          y: s.position.y,
          type: s.type,
          occupationCounter: s.occupationCounter,
          harvestYield: s.harvestYield,
        })) ?? [],
      );

      // Store raw userIds for admin detection
      if (gs.teams.length >= 2) {
        setRawUserIds([gs.teams[0].userId, gs.teams[1].userId]);
      }

      // Sparring metadata — set once on first poll
      if (data.sparring) {
        setIsSparring(true);
      }

      // Figure out which team this user belongs to
      const userTeam = gs.teams.find((t) => t.userId === userId);
      if (userTeam && !isAdminSelfMatch) {
        // Normal match: lock activeTeamId to user's team
        setActiveTeamId(userTeam.id);
      }

      const t1 = mapTeam(gs.teams[0]);
      const t2 = gs.teams[1] ? mapTeam(gs.teams[1]) : t1;
      setTeams([t1, t2]);

      // KO detection — play KO sound if either team gained a new KO
      const newT1Knocked = gs.teams[0]?.knocked?.length ?? 0;
      const newT2Knocked = gs.teams[1]?.knocked?.length ?? 0;
      if (
        newT1Knocked > prevKnockedRef.current.t1 ||
        newT2Knocked > prevKnockedRef.current.t2
      ) {
        play("ko");
      }
      prevKnockedRef.current = { t1: newT1Knocked, t2: newT2Knocked };

      if (gs.result) {
        const winnerName =
          gs.teams.find((t) => t.id === gs.result!.winner)?.name ??
          `Team ${gs.result.winner}`;
        setGameOver({
          winner: winnerName,
          condition: gs.result.condition,
        });
        // Trigger victory modal if not already showing
        setShowVictory(
          (prev) =>
            prev ?? { winner: winnerName, condition: gs.result!.condition },
        );
        // Play victory or defeat sound once
        if (!resultSoundPlayedRef.current) {
          resultSoundPlayedRef.current = true;
          const userTeamId = gs.teams.find((t) => t.userId === userId)?.id;
          if (userTeamId === gs.result.winner) {
            play("victory");
          } else {
            play("defeat");
          }
          // Fetch progression rewards with a short delay to let matchStats write commit
          setTimeout(() => {
            getMatchRewardsAction(matchUuid).then((rewards) => {
              if (rewards) setMatchRewards(rewards);
            }).catch(() => {/* silent — rewards are enhancement only */});
          }, 1500);
        }
      }
    },
    [userId, isAdminSelfMatch, play],
  );

  // Fetch cinderling display metadata once when teams are known
  useEffect(() => {
    if (!teams) return;
    const allNames = [...teams[0].active, ...teams[1].active].map(
      (v) => v.name,
    );
    const unfetched = allNames.filter((n) => !fetchedNamesRef.current.has(n));
    if (unfetched.length === 0) return;
    unfetched.forEach((n) => fetchedNamesRef.current.add(n));
    getCinderlingInfoAction(unfetched).then((info) => {
      setCinderlingInfoCache((prev) => ({ ...prev, ...info }));
    });
  }, [teams]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Poll game state — skip parseState while a turn animation is playing so the
  // win modal doesn't fire mid-animation (parseState is called in onComplete instead).
  const animPhaseRef = useRef(animPhase);
  useEffect(() => {
    animPhaseRef.current = animPhase;
  }, [animPhase]);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const data = await getGameStateAction(matchUuid);
        if (active && animPhaseRef.current === "idle") {
          parseState(data);
          setLoading(false);
          setError(null);
        }
      } catch (e) {
        if (active) {
          setError(
            e instanceof Error ? e.message : "Failed to load game state",
          );
          setLoading(false);
        }
      }
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [matchUuid, parseState]);

  // Add command for a cinderling, then auto-deselect so user can pick the next one
  const addCommand = useCallback((cmd: PlayCommand) => {
    setPendingCommands((prev) => {
      const filtered = prev.filter((c) => c.cinderlingUuid !== cmd.cinderlingUuid);
      return [...filtered, cmd];
    });
    setSelectedCinderling(null);
    play("blip");
  }, [play]);

  // Wrap addCommand with screen→game vec translation
  const addDirectionalCommand = useCallback(
    (
      type: "move" | "attack" | "harvest",
      cinderlingUuid: string,
      screenVec: Vec2,
      attackIndex?: number,
    ) => {
      const gameVec = screenVecToGameVec(screenVec, isPortrait, yourTeam?.id ?? 1);
      addCommand({ type, cinderlingUuid, vec: gameVec, attackIndex });
    },
    [addCommand, isPortrait, yourTeam?.id],
  );

  const handleSubmitTurn = useCallback(async () => {
    play("submit");
    setSubmitting(true);

    // Capture the board state NOW (before submit) so animation can diff from→to.
    // We build a minimal RawGameState from current React state.
    const snapTeams = teams;
    const snapBoard = boardSpaces;
    const fromSnap: RawGameState | null =
      snapTeams
        ? {
            turn,
            teams: snapTeams.map((t) => ({
              id: t.id,
              userId: "",
              name: t.name,
              energy: t.energy,
              active: t.active.map((v) => ({
                uuid: v.uuid,
                name: v.name,
                hp: v.hp,
                maxHp: v.maxHp,
                speed: v.speed,
                attack: v.attack,
                attacks: v.attacks as RawGameState["teams"][0]["active"][0]["attacks"],
                position: { x: v.x, y: v.y },
                isKO: v.isKO,
                imageUrl: v.imageUrl,
              })),
              bench: [],
              knocked: [],
            })),
            boardWidth,
            boardHeight,
            board: snapBoard.map((s) => ({
              position: { x: s.x, y: s.y },
              type: s.type,
              occupationCounter: s.occupationCounter,
              harvestYield: s.harvestYield,
            })),
            result: null,
          }
        : null;
    preTurnSnapRef.current = fromSnap;

    try {
      const result = await submitCommandsAction(
        matchUuid,
        pendingCommands,
        isAdminSelfMatch ? activeTeamId : undefined,
      );
      setPendingCommands([]);
      setSelectedCinderling(null);

      if (isAdminSelfMatch && activeTeamId === 1) {
        // Admin match: switch to P2's perspective
        setActiveTeamId(2);
        setWaitingForSwitch(true);
        setTimeout(() => setWaitingForSwitch(false), 500);
      } else if (result.resolved) {
        // Turn resolved — fetch new state, then run animation
        const data = await getGameStateAction(matchUuid);
        if (!data) {
          setError("Failed to fetch game state after turn");
          return;
        }
        const rawLog = data.turnHistory?.[
          data.turnHistory.length - 1
        ]?.log as RawTurnLog | undefined;
        const gs = data.gameState as RawGameState;

        // Run animation before applying state (so cinderlings don't teleport)
        if (fromSnap && rawLog) {
          const lookup = buildCinderlingLookup(fromSnap);
          // Filter out "Cinderling not found" — the mon was KO'd earlier this turn,
          // its queued command should produce no animation.
          const cmds = (rawLog.commandResults ?? []).filter(
            (r: RawCommandResult) => r.reason !== "Cinderling not found",
          );
          const getSpeed = (uuid: string): number => {
            for (const t of fromSnap.teams) {
              const vm = t.active.find((av) => av.uuid === uuid);
              if (vm) return vm.speed;
            }
            return 0;
          };
          const sortedCmds = [...cmds].sort(
            (x, y) =>
              getSpeed(y.command.cinderlingUuid) -
              getSpeed(x.command.cinderlingUuid),
          );
          const steps = buildUnifiedSteps(
            sortedCmds,
            fromSnap,
            gs,
            lookup,
            rawLog.turnStartEvents ?? [],
            rawLog,
          );
          // Apply new state only after animation completes
          startAnimation(steps, () => {
            parseState(data);
            play("resolve");
            setTurnFlash(true);
            setTimeout(() => setTurnFlash(false), 400);
            if (isAdminSelfMatch) setActiveTeamId(1);
          });
        } else {
          // No animation data — apply state immediately
          parseState(data);
          play("resolve");
          setTurnFlash(true);
          setTimeout(() => setTurnFlash(false), 400);
          if (isAdminSelfMatch) setActiveTeamId(1);
        }
      } else if (isAdminSelfMatch && activeTeamId === 2) {
        // P2 submitted in admin match — turn should resolve now
        const data = await getGameStateAction(matchUuid);
        parseState(data);
        play("resolve");
        setTurnFlash(true);
        setTimeout(() => setTurnFlash(false), 400);
        setActiveTeamId(1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit commands");
    } finally {
      setSubmitting(false);
    }
  }, [matchUuid, pendingCommands, parseState, isAdminSelfMatch, activeTeamId, play, teams, boardSpaces, turn, boardWidth, boardHeight, startAnimation]);

  const handleConcede = useCallback(async () => {
    try {
      const result = await concedeAction(
        matchUuid,
        isAdminSelfMatch ? activeTeamId : undefined,
      );
      setShowConcedeConfirm(false);
      setShowVictory({ winner: result.winner, condition: result.condition });
      // Fetch rewards for the concede path too
      setTimeout(() => {
        getMatchRewardsAction(matchUuid).then((rewards) => {
          if (rewards) setMatchRewards(rewards);
        }).catch(() => {});
      }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to concede");
      setShowConcedeConfirm(false);
    }
  }, [matchUuid, isAdminSelfMatch, activeTeamId]);

  // Build all cinderlings for the canvas
  const allCinderlings = useMemo(
    () => [
      ...(teams?.[0]?.active.map((v) => ({
        ...v,
        teamId: teams[0].id as 1 | 2,
      })) ?? []),
      ...(teams?.[1]?.active.map((v) => ({
        ...v,
        teamId: teams[1].id as 1 | 2,
      })) ?? []),
    ],
    [teams],
  );

  // Check your team first; fall back to opponent (read-only scouting view)
  const selectedYourVm = yourTeam?.active.find(
    (v) => v.uuid === selectedCinderling && !v.isKO,
  );
  const selectedOpponentVm = !selectedYourVm
    ? opponentTeam?.active.find((v) => v.uuid === selectedCinderling && !v.isKO)
    : undefined;
  const selectedVm = selectedYourVm ?? selectedOpponentVm ?? null;
  const isOpponentVm = !!selectedOpponentVm;

  const pendingForSelected = pendingCommands.find(
    (c) => c.cinderlingUuid === selectedCinderling,
  );

  // Cinderlings that have pending commands (for board indicators)
  const commandedUuids = useMemo(
    () => new Set(pendingCommands.map((c) => c.cinderlingUuid)),
    [pendingCommands],
  );

  // Pending command overlays rendered on the board (faint badge per mon)
  const pendingCommandDisplays = useMemo<PendingCommandDisplay[]>(
    () =>
      pendingCommands.map((c) => ({
        cinderlingUuid: c.cinderlingUuid,
        type: c.type,
        vec: c.vec,
      })),
    [pendingCommands],
  );

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0f1a] text-white flex flex-col">
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-400">Loading match...</p>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md px-4">
            <p className="text-red-400 mb-4">{error}</p>
            <Link
              href={`/matches/${matchUuid}`}
              className="text-blue-400 hover:underline"
            >
              Back to match
            </Link>
          </div>
        </div>
      )}

      {gameOver && !showVictory && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md px-4">
            <h1 className="text-4xl font-bold mb-4">🏆 Game Over</h1>
            <p className="text-xl mb-2">
              <span className="text-yellow-400">{gameOver.winner}</span> wins!
            </p>
            <p className="text-gray-400 mb-6 capitalize">
              Victory by {gameOver.condition}
            </p>
            <Link
              href={`/matches/${matchUuid}`}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
            >
              Match Results
            </Link>
          </div>
        </div>
      )}

      {!loading && !error && !gameOver && (
        <>
          {/* ─── Top bar ─── */}
          <div className="flex justify-between items-center px-4 py-2 shrink-0">
            <Link
              href={`/matches/${matchUuid}`}
              className="text-gray-400 text-sm hover:text-white bg-black/40 px-3 py-1.5 rounded-lg"
            >
              ← Back
            </Link>
            <div className="flex items-center gap-2">
              {isAdminSelfMatch && (
                <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded">
                  Playing as Team {activeTeamId}
                </span>
              )}
              <button
                onClick={() => setHistoryOpen(!historyOpen)}
                className={`text-sm px-3 py-1.5 rounded-lg font-mono transition flex items-center gap-1 ${
                  turnFlash
                    ? "bg-green-600/80 text-white scale-105"
                    : "text-gray-300 bg-black/40 hover:bg-black/60 active:bg-black/80"
                }`}
              >
                Turn {turn}
                {turnHistory.length > 0 && (
                  <span className="text-[10px] text-gray-500">▼</span>
                )}
              </button>
            </div>
          </div>

          {/* ─── Team HUDs ─── */}
          <div className="flex gap-2 px-3 pb-2 shrink-0">
            {yourTeam && (
              <button
                onClick={() => setShowGameMenu(true)}
                className="flex-1 bg-blue-950/60 border border-blue-500/30 rounded-lg px-3 py-1.5 text-left hover:bg-blue-900/40 active:bg-blue-900/60 transition"
              >
                <p className="font-bold text-sm truncate">{yourTeam.name}</p>
                <div className="flex gap-2 text-xs text-gray-300">
                  <span>⚡{yourTeam.energy}</span>
                  <span>🗡️{yourTeam.active.filter((v) => !v.isKO).length}</span>
                  <span>💀{yourTeam.knockedCount}</span>
                </div>
              </button>
            )}
            {opponentTeam && (
              <div className="flex-1 bg-red-950/60 border border-red-500/30 rounded-lg px-3 py-1.5">
                <p className="font-bold text-sm truncate">
                  {opponentTeam.name}
                </p>
                <div className="flex gap-2 text-xs text-gray-300">
                  <span>⚡{opponentTeam.energy}</span>
                  <span>
                    🗡️{opponentTeam.active.filter((v) => !v.isKO).length}
                  </span>
                  <span>💀{opponentTeam.knockedCount}</span>

                </div>
              </div>
            )}
          </div>

          {/* ─── Canvas + drawer overlay ─── */}
          <div className="flex-1 relative min-h-0">
            <BattleCanvas
              boardWidth={boardWidth}
              boardHeight={boardHeight}
              spaces={boardSpaces}
              cinderlings={allCinderlings}
              yourTeamId={yourTeam?.id ?? 1}
              selectedCinderling={selectedCinderling}
              onSelectCinderling={setSelectedCinderling}
              tapAllCinderlings={true}
              commandedUuids={commandedUuids}
              pendingCommandDisplays={pendingCommandDisplays}
              overlays={animOverlays ?? undefined}
              tween={activeTween ?? undefined}
            />

            {/* Cinderling drawer — own mon → full command UI; opponent → read-only scout */}
            {selectedVm && !waitingForSwitch && (
              <CinderlingDrawer
                cinderling={selectedVm}
                info={cinderlingInfoCache[selectedVm.name]}
                teamEnergy={
                  isOpponentVm
                    ? (opponentTeam?.energy ?? 0)
                    : (yourTeam?.energy ?? 0)
                }
                pendingCommand={isOpponentVm ? null : (pendingForSelected ?? null)}
                vecToArrow={(gameVec) =>
                  gameVecToScreenArrow(gameVec, isPortrait, yourTeam?.id ?? 1)
                }
                onAction={
                  isOpponentVm
                    ? undefined
                    : (type, screenVec, attackIndex) =>
                        addDirectionalCommand(type, selectedVm.uuid, screenVec, attackIndex)
                }
                onClose={() => setSelectedCinderling(null)}
                readOnly={isOpponentVm}
              />
            )}
          </div>

          {/* ─── Bottom bar: pending commands + submit ─── */}
          <div className="shrink-0 bg-[#0c1220] border-t border-gray-800 px-4 py-3">
            {waitingForSwitch ? (
              <div className="text-center py-2">
                <p className="text-purple-400 text-sm animate-pulse">
                  Switching to Team {activeTeamId}...
                </p>
              </div>
            ) : null}

            {/* Submit button — disabled until every active mon has a command */}
            {!waitingForSwitch && (() => {
              const activeMonCount = yourTeam?.active.filter((v) => !v.isKO).length ?? 0;
              const allCommandsQueued = pendingCommands.length >= activeMonCount && activeMonCount > 0;
              const isDisabled = submitting || !allCommandsQueued;
              return (
                <button
                  onClick={handleSubmitTurn}
                  disabled={isDisabled}
                  className={`w-full py-3 rounded-xl font-semibold transition text-base mt-1 ${
                    submitting
                      ? "bg-gray-600 cursor-not-allowed opacity-70"
                      : allCommandsQueued
                        ? "bg-green-600 hover:bg-green-700 active:bg-green-800"
                        : "bg-gray-700 text-gray-500 cursor-not-allowed opacity-60"
                  }`}
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Submitting…
                    </span>
                  ) : allCommandsQueued ? (
                    "Submit Turn"
                  ) : (
                    `${pendingCommands.length}/${activeMonCount} commands queued`
                  )}
                </button>
              );
            })()}
          </div>
        </>
      )}

      {/* Turn History bottom sheet */}
      <TurnHistory
        history={turnHistory}
        isOpen={historyOpen}
        onToggle={() => setHistoryOpen(!historyOpen)}
        isPortrait={isPortrait}
        yourTeamId={yourTeam?.id ?? 1}
      />

      {/* Game menu (opens from your team card) */}
      {showGameMenu && !showConcedeConfirm && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowGameMenu(false)}
          />
          <div className="relative bg-[#1a2035] border-t border-gray-700 rounded-t-2xl w-full max-w-md mx-auto pb-safe">
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>
            <div className="px-4 pb-2 border-b border-gray-800">
              <p className="text-sm font-semibold text-gray-200">
                {yourTeam?.name ?? "Your Team"}
              </p>
            </div>
            <div className="p-4 space-y-2">
              {/* Team details */}
              {yourTeam && (
                <div className="grid grid-cols-3 gap-2 text-center text-xs text-gray-400 mb-3">
                  <div>
                    <span className="block text-lg text-white font-bold">
                      {yourTeam.active.filter((v) => !v.isKO).length}
                    </span>
                    Active
                  </div>
                  <div>
                    <span className="block text-lg text-white font-bold">
                      ⚡{yourTeam.energy}
                    </span>
                    Energy
                  </div>
                  <div>
                    <span className="block text-lg text-white font-bold">
                      {yourTeam.knockedCount}
                    </span>
                    KO&apos;d
                  </div>
                </div>
              )}

              {/* Concede */}
              <button
                onClick={() => {
                  setShowGameMenu(false);
                  setShowConcedeConfirm(true);
                }}
                className="w-full py-3 rounded-xl bg-red-950/60 border border-red-800/30 text-red-400 font-medium hover:bg-red-900/60 active:bg-red-800/60 transition text-sm"
              >
                🏳️ Concede Match
              </button>

              {/* Close */}
              <button
                onClick={() => setShowGameMenu(false)}
                className="w-full py-2.5 rounded-xl bg-gray-800 text-gray-400 font-medium hover:bg-gray-700 transition text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Concede confirmation dialog */}
      {showConcedeConfirm && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowConcedeConfirm(false)}
          />
          <div className="relative bg-[#1a2035] border border-gray-700 rounded-2xl p-6 mx-6 max-w-sm w-full text-center">
            <h3 className="text-lg font-bold text-white mb-2">
              Concede Match?
            </h3>
            <p className="text-sm text-gray-400 mb-6">
              Your opponent will be declared the winner. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConcedeConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConcede}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition"
              >
                Concede
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Victory celebration modal */}
      {showVictory && (
        <VictoryModal
          winner={showVictory.winner}
          condition={showVictory.condition}
          rewards={matchRewards}
          onComplete={() => {
            setShowVictory(null);
            router.push(`/matches/${matchUuid}`);
          }}
        />
      )}
    </div>
  );
}
