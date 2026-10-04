import WebSocket, { WebSocketServer } from "ws";
import { NULL_VEC } from "./map";
import { commandsToEvents, Command, Game, storeCommands } from "./game";
import getCinderling from "../src/data/getCinderling.server";
import getBoardById from "../src/data/getBoardById.server";

const port = Number(process.argv[2]) || 12345;
const MAX_BATTERY = 256;
const game: Game = {
  healthChecks: 0,
  gameSessionId: "",
  nextCinderlingId: 0,
  turn: 0,
  history: {},
  board: {
    spaces: [],
    height: 0,
    width: 0,
    primaryDock: new Set(),
    secondaryDock: new Set(),
  },
};

const initializeBoard = (boardId: string) => {
  return getBoardById(boardId).then((board) => {
    game.board = board;
    console.log(`Board ${boardId} loaded`);
  });
};

const EndGame = () => {
  console.log("Game session ending");
  game.primary?.ws?.close();
  game.secondary?.ws?.close();
};

const onStartGame = (
  {
    myCinderlings,
    myName,
    boardId,
  }: {
    myCinderlings: string[];
    myName: string;
    boardId?: string;
  },
  ws: WebSocket,
  game: Game
) => {
  console.log(
    "Client",
    myName,
    "Starting Game With Team",
    JSON.stringify(myCinderlings, null, 4)
  );

  const isPrimary = !game.primary?.joined;
  
  // Initialize board if provided and not already loaded
  const boardPromise = boardId && game.board.spaces.length === 0
    ? initializeBoard(boardId)
    : Promise.resolve();

  return boardPromise
    .then(() => Promise.all(myCinderlings.map(getCinderling)))
    .then((myCinderlings) => {
      const cinderlings = myCinderlings.map((v) => {
        const cinderling = {
          ...v,
          id: game.nextCinderlingId++,
          position: NULL_VEC,
          startingHealth: v.health,
          currentEnergy: v.energy,
        };
        // game.board add to dock
        return cinderling;
      });
      const player = {
        name: myName,
        joined: true,
        ready: false,
        ws,
        team: cinderlings,
        battery: MAX_BATTERY,
      };
      if (isPrimary) {
        game.primary = player;
      } else {
        game.secondary = player;
      }
      if (game.primary?.joined && game.secondary?.joined) {
        game.primary.ws.send(
          JSON.stringify({
            name: "GAME_READY",
            isPrimary: true,
            opponentName: game.secondary.name,
            myTeam: game.primary.team,
            opponentTeam: game.secondary.team,
          })
        );
        game.secondary.ws.send(
          JSON.stringify({
            name: "GAME_READY",
            isPrimary: false,
            opponentName: game.primary.name,
            myTeam: game.secondary.team,
            opponentTeam: game.primary.team,
          })
        );
      }
    })
    .catch((e) =>
      ws.send(JSON.stringify({ name: "ERROR", message: e.message }))
    );
};

const onJoinGame = (
  {
    playerSessionId,
    playerName,
    playerTeam,
    boardId,
  }: {
    playerSessionId: string;
    playerName: string;
    playerTeam: string[];
    boardId?: string;
  },
  ws: WebSocket,
  game: Game
) => {
  if (game.primary?.joined && game.secondary?.joined) {
    ws.send(
      JSON.stringify({
        name: "RESUME_GAME",
        // current game state
      })
    );
    return;
  }
  
  return onStartGame(
    {
      myName: playerName,
      myCinderlings: playerTeam,
      boardId,
    },
    ws,
    game
  );
};

const onSubmitCommands = (
  { commands }: { commands: Command[] },
  ws: WebSocket,
  game: Game
) => {
  console.log("Client Submitting Commands");
  try {
    const p =
      game.primary?.ws === ws
        ? game.primary
        : game.secondary?.ws === ws
        ? game.secondary
        : null;
    if (!p) {
      console.warn("Received submit commands from unknown player");
      return;
    }
    if (!game.primary || !game.secondary) {
      throw new Error("Lost reference to a player");
    }
    storeCommands(game, p, commands);
    if (game.primary.ready && game.secondary.ready) {
      const eventJsons = commandsToEvents(game as Required<Game>);
      const events = eventJsons.map((e) => JSON.stringify(e));
      game.primary.ws.send(
        JSON.stringify({
          name: "TURN_EVENTS",
          events,
          turn: game.turn,
        })
      );
      game.secondary.ws.send(
        JSON.stringify({
          name: "TURN_EVENTS",
          events,
          turn: game.turn,
        })
      );
      console.log("events sent: ", JSON.stringify(eventJsons, null, 4));
    } else {
      const otherWs =
        game.primary.ws === ws ? game.secondary.ws : game.primary.ws;
      otherWs.send(JSON.stringify({ name: "WAITING_COMMANDS" }));
    }
  } catch (err) {
    const e = err as Error;
    console.error(e);
    const props = {
      serverMessage:
        "Game server crashed when processing your submitted commands",
      exceptionType: e.name,
      exceptionMessage: e.message,
    };
    game.primary?.ws?.send?.(
      JSON.stringify({
        name: "SERVER_ERROR",
        props,
      })
    );
    game.secondary?.ws?.send?.(
      JSON.stringify({
        name: "SERVER_ERROR",
        props,
      })
    );
    EndGame();
  }
};

console.log(`Starting the cinderling game server at port: ${port}`);

const MESSAGE_HANDLERS = {
  JOIN_GAME: onJoinGame,
  START_GAME: onStartGame,
  SUBMIT_COMMANDS: onSubmitCommands,
} as const;

const wss = new WebSocketServer({ port }, () => {
  console.log("Cinderling game server started");
});

wss.on("connection", (ws) => {
  console.log("New client connected");
  
  ws.on("message", (data) => {
    try {
      const { name, ...props } = JSON.parse(data.toString());
      console.log("Received message:", name, props);
      
      const handler = MESSAGE_HANDLERS[name as keyof typeof MESSAGE_HANDLERS];
      if (handler) {
        handler(props as any, ws, game);
      } else {
        console.warn("Unknown message type:", name);
        ws.send(JSON.stringify({ name: "ERROR", message: `Unknown message type: ${name}` }));
      }
    } catch (e) {
      console.error("Failed to process message:");
      console.error("- data:", data.toString());
      console.error("- error:", e);
      ws.send(JSON.stringify({ name: "ERROR", message: "Failed to process message" }));
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    // Check if game should end
    if (game.primary?.ws === ws || game.secondary?.ws === ws) {
      console.log("Player disconnected, ending game");
      EndGame();
    }
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});

wss.on("listening", () => {
  console.log(`Cinderling game server listening on port ${port}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  wss.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  wss.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
