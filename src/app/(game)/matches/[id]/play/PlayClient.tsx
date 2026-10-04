"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  useGameSocket,
  type CommandPayload,
  type TurnResultPayload,
} from "~/hooks/useGameSocket";
import BoardRenderer from "~/components/game/BoardRenderer";
import CommandInput, { TurnCommandBar } from "~/components/game/CommandInput";
import GameHUD from "~/components/game/GameHUD";
import TurnAnimation, { BattleLog } from "~/components/game/TurnAnimation";

type PlayClientProps = {
  matchUuid: string;
  userId: string;
  playerTeamName: string;
};

export default function PlayClient({
  matchUuid,
  userId,
  playerTeamName,
}: PlayClientProps) {
  const {
    connectionState,
    teamId,
    gameState,
    turnResults,
    timerSeconds,
    opponentReady,
    commandsAccepted,
    gameOver,
    error,
    sendCommands,
    requestState,
  } = useGameSocket(matchUuid, userId);

  // ─── Local State ─────────────────────────────────────────────────────────

  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const [pendingCommands, setPendingCommands] = useState<CommandPayload[]>([]);
  const [showAnimation, setShowAnimation] = useState(false);
  const [battleHistory, setBattleHistory] = useState<
    { turn: number; events: TurnResultPayload["events"] }[]
  >([]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleCinderlingClick = useCallback((uuid: string) => {
    setSelectedUuid((prev) => (prev === uuid ? null : uuid));
  }, []);

  const handleSpaceClick = useCallback(
    (x: number, y: number) => {
      // If we're in attack-target mode and have a selected cinderling with a pending attack
      // This will be expanded when CommandInput signals target mode
      setSelectedUuid(null);
    },
    [],
  );

  const handleSubmitCommand = useCallback((command: CommandPayload) => {
    setPendingCommands((prev) => {
      // Replace if same cinderling already has a command
      const filtered = prev.filter(
        (c) => c.cinderlingUuid !== command.cinderlingUuid,
      );
      return [...filtered, command];
    });
    setSelectedUuid(null);
  }, []);

  const handleSubmitTurn = useCallback(() => {
    if (pendingCommands.length > 0) {
      sendCommands(pendingCommands);
      setPendingCommands([]);
    }
  }, [pendingCommands, sendCommands]);

  const handleAnimationComplete = useCallback(() => {
    setShowAnimation(false);
    requestState();
  }, [requestState]);

  // ─── Effects: handle turn results ────────────────────────────────────────

  // When turn results arrive, show animation and log to history
  if (turnResults && !showAnimation && !battleHistory.some((h) => h.turn === turnResults.turn)) {
    setShowAnimation(true);
    setBattleHistory((prev) => [
      ...prev,
      { turn: turnResults.turn, events: turnResults.events },
    ]);
    setPendingCommands([]);
  }

  // ─── Render: Connection/Loading States ───────────────────────────────────

  if (connectionState === "connecting") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-400">Connecting to match...</p>
        </div>
      </div>
    );
  }

  if (connectionState === "error" || error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center max-w-md">
          <p className="text-red-400 text-lg font-bold mb-2">Connection Error</p>
          <p className="text-gray-400 text-sm mb-4">{error ?? "Failed to connect to game server"}</p>
          <Link
            href={`/matches/${matchUuid}`}
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            ← Back to match
          </Link>
        </div>
      </div>
    );
  }

  if (!gameState || !teamId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-pulse text-gray-400">Loading game state...</div>
      </div>
    );
  }

  // ─── Game Over Screen ────────────────────────────────────────────────────

  if (gameOver) {
    const isWinner = gameOver.winner === teamId;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">{isWinner ? "🏆" : "💀"}</div>
          <h1
            className={`text-3xl font-bold mb-2 ${isWinner ? "text-yellow-400" : "text-red-400"}`}
          >
            {isWinner ? "Victory!" : "Defeat"}
          </h1>
          <p className="text-gray-400 mb-1">
            {gameOver.condition === "elimination" && "All opposing cinderlings eliminated!"}
            {gameOver.condition === "occupation" && "Occupation points secured!"}
            {gameOver.condition === "accumulation" && "Energy threshold reached!"}
          </p>
          <p className="text-gray-500 text-sm mb-6">
            {playerTeamName} — {gameState.turn} turns played
          </p>
          <Link
            href="/matches"
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Back to Matches
          </Link>
        </div>
      </div>
    );
  }

  // ─── Main Game Layout ────────────────────────────────────────────────────

  const selectedCinderling = selectedUuid
    ? gameState.yourTeam.active.find((v) => v.uuid === selectedUuid) ?? null
    : null;

  const activeCount = gameState.yourTeam.active.filter((v) => !v.isKO).length;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Turn Animation Overlay */}
      {showAnimation && turnResults && (
        <TurnAnimation
          results={turnResults}
          onComplete={handleAnimationComplete}
        />
      )}

      {/* Responsive Layout: sidebar left, board center, sidebar right */}
      <div className="h-screen flex flex-col">
        {/* Top nav */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900 border-b border-gray-800">
          <Link
            href={`/matches/${matchUuid}`}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            ← Match
          </Link>
          <div className="flex items-center gap-2">
            <ConnectionDot state={connectionState} />
            <span className="text-xs text-gray-500">{playerTeamName}</span>
            {opponentReady && (
              <span className="text-[10px] bg-green-900 text-green-300 px-1.5 py-0.5 rounded">
                Opponent ready
              </span>
            )}
            {commandsAccepted && (
              <span className="text-[10px] bg-blue-900 text-blue-300 px-1.5 py-0.5 rounded">
                Commands sent
              </span>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left sidebar — HUD (hidden on mobile, shown on md+) */}
          <aside className="hidden md:flex md:w-64 lg:w-72 flex-col p-2 overflow-y-auto border-r border-gray-800">
            <GameHUD
              turn={gameState.turn}
              yourTeam={gameState.yourTeam}
              opponentTeam={gameState.opponentTeam}
              board={gameState.board}
              timerSeconds={timerSeconds}
              phase={gameState.phase}
            />
          </aside>

          {/* Center — Board + Command Input */}
          <main className="flex-1 flex flex-col p-2 overflow-y-auto">
            {/* Mobile-only HUD summary */}
            <div className="md:hidden mb-2">
              <div className="flex items-center justify-between bg-gray-900 rounded px-3 py-1.5 text-xs">
                <span>
                  Turn <span className="font-bold">{gameState.turn}</span>
                </span>
                <span className="text-blue-300">
                  ⚡ {gameState.yourTeam.energy}
                </span>
                <span className="text-red-300">
                  ⚡ {gameState.opponentTeam.energy}
                </span>
                <span
                  className={
                    timerSeconds <= 10
                      ? "text-red-400 animate-pulse"
                      : "text-gray-400"
                  }
                >
                  {timerSeconds}s
                </span>
              </div>
            </div>

            {/* Board */}
            <div className="flex-1 flex items-center justify-center">
              <BoardRenderer
                board={gameState.board}
                yourActive={gameState.yourTeam.active}
                opponentActive={gameState.opponentTeam.active}
                teamId={teamId}
                selectedUuid={selectedUuid}
                onCinderlingClick={handleCinderlingClick}
                onSpaceClick={handleSpaceClick}
              />
            </div>

            {/* Command Input (below board) */}
            {selectedCinderling && (
              <div className="mt-2 flex justify-center">
                <CommandInput
                  cinderling={selectedCinderling}
                  teamEnergy={gameState.yourTeam.energy}
                  board={gameState.board}
                  pendingCommands={pendingCommands}
                  onSubmitCommand={handleSubmitCommand}
                  onCancel={() => setSelectedUuid(null)}
                />
              </div>
            )}

            {/* Turn Command Bar (always visible during play) */}
            {gameState.phase === "playing" && (
              <div className="mt-2">
                <TurnCommandBar
                  activeCount={activeCount}
                  pendingCommands={pendingCommands}
                  onSubmitTurn={handleSubmitTurn}
                  timerSeconds={timerSeconds}
                />
              </div>
            )}
          </main>

          {/* Right sidebar — Battle Log (hidden on mobile) */}
          <aside className="hidden lg:flex lg:w-56 xl:w-64 flex-col p-2 overflow-y-auto border-l border-gray-800">
            <BattleLog history={battleHistory} />
          </aside>
        </div>
      </div>
    </div>
  );
}

// ─── Connection Indicator ────────────────────────────────────────────────────

function ConnectionDot({ state }: { state: string }) {
  const color =
    state === "connected"
      ? "bg-green-500"
      : state === "connecting"
        ? "bg-yellow-500 animate-pulse"
        : "bg-red-500";

  return <span className={`w-2 h-2 rounded-full ${color}`} />;
}
