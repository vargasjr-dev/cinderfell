/**
 * Jev (TypeSafe System One) player model for Cinderling.
 *
 * Jev does not generate text — it evaluates typed questions against a state
 * block and returns structured decisions with calibrated probabilities.
 *
 * Interface design:
 *   state     = the shared game-state description (same text Claude reads)
 *   questions = one Choice question per active cinderling, whose criteria are
 *               that cinderling's enumerated legal actions this turn
 *
 * All questions are evaluated in parallel against the same state in a single
 * API call, so a full team turn costs one round-trip regardless of team size.
 * Answers are then assembled into Command[] with an energy budget applied in
 * confidence order, and any mon without a usable answer falls back to the
 * rule-based strategy.
 *
 * API: POST https://api.typesafe.ai/v1/systemone  (docs.typesafe.ai)
 */

import { db } from "../data/db";
import { llmRequest } from "../data/schema";
import { lt } from "drizzle-orm";
import type { GameState, TeamState, Vec2 } from "./types";
import type { Command } from "./commands";
import {
  describeGameState,
  enumerateValidActions,
  fallbackCommandFor,
  type ValidAction,
} from "./ai-shared";

const JEV_MODEL = "jev-latest";
const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";

/** Warn once per process about a missing TypeSafe key (CLI runs without env). */
let warnedNoKey = false;

export type JevOptions = {
  matchId: string;
  turn: number;
  profileId?: string;
  /** Profile strategy text — injected into every question's instructions. */
  strategy?: string;
};

// ─── Request/response shapes (docs.typesafe.ai/api) ─────────────────────────

type JevChoiceQuestion = {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
};

type JevChoiceAnswer = {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};

type JevResponse = {
  model: string;
  answers: Record<string, JevChoiceAnswer>;
  usage?: { input_tokens: number; output_tokens: number };
};

/** Generate commands for the AI team using Jev typed decisions. */
export async function generateJevAICommands(
  state: GameState,
  aiTeamId: 1 | 2,
  opts: JevOptions,
): Promise<Command[]> {
  const aiTeam = state.teams[aiTeamId - 1];
  const enemyTeam = state.teams[aiTeamId === 1 ? 1 : 0];
  const activeCinderlings = aiTeam.active.filter((v) => !v.isKO && v.position != null);

  if (activeCinderlings.length === 0) return [];

  const stateText = describeGameState(state, aiTeam, aiTeamId, enemyTeam);

  // Build one Choice question per cinderling from its legal actions
  const questions: Record<string, JevChoiceQuestion> = {};
  const actionsByMon = new Map<string, ValidAction[]>();

  for (const v of activeCinderlings) {
    const actions = enumerateValidActions(v, aiTeam, enemyTeam, state);
    actionsByMon.set(v.uuid, actions);
    if (actions.length === 0) continue; // no legal actions — fallback below

    const strategyNote = opts.strategy
      ? ` Follow this strategy: ${opts.strategy}`
      : "";
    questions[`mon_${v.uuid}`] = {
      type: "choice",
      instructions: `Choose the best action for ${v.name} (HP ${v.hp}/${v.maxHp}) this turn.${strategyNote}`,
      criteria: Object.fromEntries(
        actions.map((a) => [a.key, a.description]),
      ),
    };
  }

  let rawResponse = "";
  let answers: Record<string, JevChoiceAnswer> | undefined;
  let errorMessage: string | undefined;

  if (Object.keys(questions).length > 0) {
    try {
      const apiKey = process.env.TYPESAFE_API_KEY;
      if (!apiKey) {
        throw new Error("TYPESAFE_API_KEY is not configured");
      }

      const res = await fetch(JEV_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ state: stateText, model: JEV_MODEL, questions }),
      });

      if (!res.ok) {
        throw new Error(`TypeSafe API returned ${res.status}: ${await res.text()}`);
      }

      const data = (await res.json()) as JevResponse;
      answers = data.answers;
      rawResponse = JSON.stringify(data.answers ?? data);
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes("not configured")) {
        if (!warnedNoKey) {
          warnedNoKey = true;
          console.error(`[ai-jev] ${errorMessage} — falling back to rule-based commands`);
        }
      } else {
        console.error(`[ai-jev] Jev call failed (match ${opts.matchId} turn ${opts.turn}):`, err);
      }
    }
  }

  // Assemble commands — energy budget applied in confidence order so the
  // most-certain attacks claim the shared team energy first.
  const commands: Command[] = [];
  const pending = activeCinderlings
    .map((v) => {
      const answer = answers?.[`mon_${v.uuid}`];
      const actions = actionsByMon.get(v.uuid) ?? [];
      const chosen = answer?.choice
        ? actions.find((a) => a.key === answer.choice)
        : undefined;
      return { v, answer, chosen, confidence: answer?.confidence ?? 0 };
    })
    .sort((a, b) => b.confidence - a.confidence);

  let energyLeft = aiTeam.energy;
  for (const { v, chosen } of pending) {
    if (chosen) {
      const cost = chosen.kind === "attack"
        ? (v.attacks[chosen.attackIndex ?? 0]?.energyCost ?? 0)
        : 0;
      if (cost <= energyLeft) {
        energyLeft -= cost;
        commands.push(toCommand(v.uuid, chosen));
        continue;
      }
      // Not enough energy for this choice — fall through to rule-based
    }
    commands.push(fallbackCommandFor(state, aiTeamId, v.uuid));
  }

  // Persist the request/response log (same table + debug UI as the Claude path).
  // Skip when the key was never configured — there's nothing to inspect.
  const skipLog = errorMessage?.includes("not configured") ?? false;
  if (!skipLog) void persistLog({
    matchId: opts.matchId,
    turn: opts.turn,
    teamId: aiTeamId,
    profileId: opts.profileId,
    strategy: opts.strategy ?? "",
    stateText,
    questions,
    rawResponse,
    commands,
    errorMessage,
  });

  return commands;
}

function toCommand(cinderlingUuid: string, action: ValidAction): Command {
  switch (action.kind) {
    case "attack":
      return {
        type: "attack",
        cinderlingUuid,
        attackIndex: action.attackIndex ?? 0,
        vec: action.vec,
      };
    case "harvest":
      return { type: "harvest", cinderlingUuid, vec: action.vec };
    case "move":
    default:
      return { type: "move", cinderlingUuid, vec: action.vec };
  }
}

// ─── Persistence (llmRequest table, shared with the Claude path) ─────────────

async function persistLog(data: {
  matchId: string;
  turn: number;
  teamId: number;
  profileId?: string;
  strategy: string;
  stateText: string;
  questions: Record<string, JevChoiceQuestion>;
  rawResponse: string;
  commands: Command[];
  errorMessage?: string;
}): Promise<void> {
  const id = Math.random().toString(36).slice(2, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    await Promise.all([
      db.delete(llmRequest).where(lt(llmRequest.createdAt, sevenDaysAgo)),
      db.insert(llmRequest).values({
        id,
        matchId: data.matchId,
        turn: data.turn,
        teamId: data.teamId,
        profileId: data.profileId ?? null,
        model: JEV_MODEL,
        // For Jev rows: "systemPrompt" holds the profile strategy injected into
        // every question; "userMessage" holds the state block; "rawResponse"
        // holds the full answers JSON (choices + probabilities + confidence).
        systemPrompt: data.strategy,
        userMessage: data.stateText,
        rawResponse: data.rawResponse,
        commands: data.commands as unknown as Record<string, unknown>[],
        errorMessage: data.errorMessage ?? null,
      }),
    ]);
  } catch (err) {
    console.error("[ai-jev] Failed to persist llmRequest log:", err);
  }
}

// Re-export for callers that want the vec type without importing types.ts
export type { Vec2 };
