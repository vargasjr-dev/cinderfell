"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Message Types ───────────────────────────────────────────────────────────

/** Messages FROM the server */
export type ServerMessage =
  | { type: "connected"; matchUuid: string; teamId: 1 | 2 }
  | { type: "game_state"; state: GameStatePayload }
  | { type: "turn_start"; turn: number; timerSeconds: number }
  | { type: "timer_update"; remainingSeconds: number; opponentReady: boolean }
  | { type: "commands_accepted" }
  | { type: "turn_result"; results: TurnResultPayload }
  | { type: "game_over"; winner: 1 | 2; condition: string }
  | { type: "error"; message: string }
  | { type: "opponent_disconnected" }
  | { type: "opponent_reconnected" };

/** Messages TO the server */
export type ClientMessage =
  | { type: "submit_commands"; commands: CommandPayload[] }
  | { type: "request_state" };

/** Simplified command for the wire — direction as orientation-agnostic Vec2 */
export type CommandPayload = {
  type: "move" | "attack" | "harvest";
  cinderlingUuid: string;
  /** Cardinal unit vector in game space, e.g. {dx:1,dy:0} for right */
  vec: { dx: number; dy: number };
  attackIndex?: number;
};

/** Game state as sent to client */
export type GameStatePayload = {
  turn: number;
  phase: "setup" | "playing" | "ended";
  yourTeam: TeamPayload;
  opponentTeam: OpponentTeamPayload;
  board: BoardPayload;
  timerSeconds: number;
};

export type TeamPayload = {
  id: 1 | 2;
  name: string;
  energy: number;
  active: CinderlingPayload[];
  benchCount: number;
  knockedCount: number;
};

/** Opponent team — limited info (no exact HP, no bench details) */
export type OpponentTeamPayload = {
  id: 1 | 2;
  name: string;
  energy: number;
  active: OpponentCinderlingPayload[];
  benchCount: number;
  knockedCount: number;
};

export type CinderlingPayload = {
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
  attacks: { name: string; damage: number; energyCost: number; range: number }[];
};

export type OpponentCinderlingPayload = {
  uuid: string;
  name: string;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  isKO: boolean;
};

export type BoardPayload = {
  width: number;
  height: number;
  spaces: { x: number; y: number; type: string; team?: 1 | 2; occupationCounter?: number; harvestYield?: number }[];
};

export type TurnResultPayload = {
  turn: number;
  events: TurnEvent[];
  nextTurn: number;
};

export type TurnEvent = {
  type: "move" | "attack" | "harvest" | "ko" | "bench_entry" | "occupation_tick";
  cinderlingName?: string;
  detail: string;
};

// ─── Connection States ───────────────────────────────────────────────────────

export type ConnectionState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

// ─── Hook ────────────────────────────────────────────────────────────────────

export type UseGameSocketReturn = {
  connectionState: ConnectionState;
  teamId: 1 | 2 | null;
  gameState: GameStatePayload | null;
  turnResults: TurnResultPayload | null;
  timerSeconds: number;
  opponentReady: boolean;
  commandsAccepted: boolean;
  gameOver: { winner: 1 | 2; condition: string } | null;
  error: string | null;
  sendCommands: (commands: CommandPayload[]) => void;
  requestState: () => void;
};

export function useGameSocket(
  matchUuid: string,
  authToken: string,
): UseGameSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [teamId, setTeamId] = useState<1 | 2 | null>(null);
  const [gameState, setGameState] = useState<GameStatePayload | null>(null);
  const [turnResults, setTurnResults] = useState<TurnResultPayload | null>(
    null,
  );
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [opponentReady, setOpponentReady] = useState(false);
  const [commandsAccepted, setCommandsAccepted] = useState(false);
  const [gameOver, setGameOver] = useState<{
    winner: 1 | 2;
    condition: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Send a message to the server
  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const sendCommands = useCallback(
    (commands: CommandPayload[]) => {
      setCommandsAccepted(false);
      send({ type: "submit_commands", commands });
    },
    [send],
  );

  const requestState = useCallback(() => {
    send({ type: "request_state" });
  }, [send]);

  // WebSocket connection lifecycle
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/game/${matchUuid}?token=${authToken}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionState("connected");
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;

        switch (msg.type) {
          case "connected":
            setTeamId(msg.teamId);
            break;

          case "game_state":
            setGameState(msg.state);
            setCommandsAccepted(false);
            break;

          case "turn_start":
            setTimerSeconds(msg.timerSeconds);
            setCommandsAccepted(false);
            setOpponentReady(false);
            setTurnResults(null);
            break;

          case "timer_update":
            setTimerSeconds(msg.remainingSeconds);
            setOpponentReady(msg.opponentReady);
            break;

          case "commands_accepted":
            setCommandsAccepted(true);
            break;

          case "turn_result":
            setTurnResults(msg.results);
            break;

          case "game_over":
            setGameOver({ winner: msg.winner, condition: msg.condition });
            break;

          case "error":
            setError(msg.message);
            break;

          case "opponent_disconnected":
            setError("Opponent disconnected — waiting for reconnect...");
            break;

          case "opponent_reconnected":
            setError(null);
            break;
        }
      } catch {
        console.error("Failed to parse game message");
      }
    };

    ws.onclose = () => {
      setConnectionState("disconnected");
    };

    ws.onerror = () => {
      setConnectionState("error");
      setError("Connection error");
    };

    return () => {
      ws.close();
    };
  }, [matchUuid, authToken]);

  return {
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
  };
}
