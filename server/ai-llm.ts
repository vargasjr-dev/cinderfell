/**
 * LLM-based AI opponent for Cinderling.
 *
 * Replaces the rule-based ai-opponent.ts when an AI profile has a system prompt.
 * One LLM call per team per turn covers all of that team's active cinderlings.
 *
 * The request + raw response are persisted to the llmRequest DB table for
 * debugging in spectate/watch mode. Rows older than 7 days are pruned on insert.
 *
 * Falls back to generateAICommands (rule-based) if the LLM call or JSON parse fails.
 */

import Anthropic from "@anthropic-ai/sdk";
import { db } from "../data/db";
import { llmRequest } from "../data/schema";
import { lt } from "drizzle-orm";
import type { GameState, TeamState, CinderlingState, BoardSpace } from "./types";
import type { Command } from "./commands";
import { generateAICommands } from "./ai-opponent";
import { describeGameState } from "./ai-shared";

const MODEL = "claude-haiku-4-5";

// ─── Public API ───────────────────────────────────────────────────────────────

export type LlmAiOptions = {
  matchId: string;
  turn: number;
  profileId?: string;
  /** If provided, an LLM call is made. If absent, falls back to rule-based AI. */
  systemPrompt?: string;
};

/** Warn once per process about a missing Anthropic key (CLI runs without env). */
let warnedNoKey = false;

/**
 * Generate commands for the AI team. Uses the LLM when systemPrompt is provided,
 * otherwise delegates to the rule-based generateAICommands.
 */
export async function generateLlmAICommands(
  state: GameState,
  aiTeamId: 1 | 2,
  opts: LlmAiOptions,
): Promise<Command[]> {
  if (!opts.systemPrompt) {
    return generateAICommands(state, aiTeamId);
  }

  const aiTeam = state.teams[aiTeamId - 1];
  const activeCinderlings = aiTeam.active.filter((v) => !v.isKO && v.position != null);

  if (activeCinderlings.length === 0) {
    return [];
  }

  const userMessage = buildUserMessage(state, aiTeam, aiTeamId);

  let rawResponse = "";
  let commands: Command[] | null = null;
  let errorMessage: string | undefined;

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }
    const client = new Anthropic();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: opts.systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const block = message.content[0];
    rawResponse = block?.type === "text" ? block.text : JSON.stringify(message.content);
    commands = parseCommands(rawResponse, activeCinderlings);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    rawResponse = "";
    // Single-line message for expected conditions (e.g. missing key in local
    // CLI runs); full stack only for unexpected API failures. Don't persist a
    // debug row for a missing key — there's nothing to inspect.
    if (errorMessage.includes("not configured")) {
      if (!warnedNoKey) {
        warnedNoKey = true;
        console.error(`[ai-llm] ${errorMessage} — falling back to rule-based commands`);
      }
      return generateAICommands(state, aiTeamId);
    }
    console.error(`[ai-llm] LLM call failed (match ${opts.matchId} turn ${opts.turn}):`, err);
  }

  // Persist the request/response log (fire-and-forget pruning of old rows)
  void persistLog({
    matchId: opts.matchId,
    turn: opts.turn,
    teamId: aiTeamId,
    profileId: opts.profileId,
    systemPrompt: opts.systemPrompt,
    userMessage,
    rawResponse,
    commands,
    errorMessage,
  });

  // Fall back to rule-based if LLM failed or produced no parseable output
  if (!commands || commands.length === 0) {
    return generateAICommands(state, aiTeamId);
  }

  return commands;
}

// ─── Prompt building ──────────────────────────────────────────────────────────

export function buildSystemPrompt(profileDescription: string, matchRulesContext: string): string {
  return [
    matchRulesContext,
    profileDescription,
    "",
    "GAME MECHANICS:",
    "- Board: a grid where teams start on opposite sides (Team 1 spawns left, Team 2 spawns right).",
    "- Each turn every cinderling issues exactly one command simultaneously.",
    "- Commands: attack, move, or harvest.",
    "- Energy: shared per team. Attacks cost energy. Harvesting adjacent harvestable tiles gains energy.",
    "- Win: KO all enemy cinderlings (elimination), or accumulate energy to the win threshold (accumulation).",
    "- Attacks scan in a cardinal direction — the first enemy in range takes damage.",
    "- Moves are blocked by occupied tiles, walls, and void spaces.",
    "",
    "OUTPUT FORMAT: Respond with ONLY a JSON object on a single line with no markdown:",
    '{"commands":[{"cinderlingUuid":"...","type":"attack","attackIndex":0,"vec":{"dx":1,"dy":0}},{"cinderlingUuid":"...","type":"move","vec":{"dx":-1,"dy":0}},{"cinderlingUuid":"...","type":"harvest","vec":{"dx":0,"dy":1}}]}',
    "",
    "RULES:",
    "- Include exactly one command per cinderling listed in YOUR CINDERLINGS.",
    "- vec must be a cardinal direction: {\"dx\":1,\"dy\":0}, {\"dx\":-1,\"dy\":0}, {\"dx\":0,\"dy\":1}, {\"dx\":0,\"dy\":-1}.",
    "- For attack: vec is the direction to fire; attackIndex is which attack (0-indexed).",
    "- For move: the target tile must be adjacent, in-bounds, and unoccupied.",
    "- For harvest: an adjacent tile must be harvestable.",
    "- If you are unsure, default to moving toward the nearest enemy.",
  ].join("\n");
}

function buildUserMessage(state: GameState, aiTeam: TeamState, aiTeamId: 1 | 2): string {
  const enemyTeam = state.teams[aiTeamId === 1 ? 1 : 0];
  return `${describeGameState(state, aiTeam, aiTeamId, enemyTeam)}\n\nOutput your JSON commands now:`;
}

// ─── Response parsing ─────────────────────────────────────────────────────────

function parseCommands(raw: string, activeCinderlings: CinderlingState[]): Command[] | null {
  try {
    // Extract JSON from the response (model may wrap it in markdown)
    const jsonMatch = raw.match(/\{[\s\S]*"commands"[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as {
      commands?: Array<{
        cinderlingUuid?: string;
        type?: string;
        attackIndex?: number;
        vec?: { dx?: number; dy?: number };
      }>;
    };

    if (!Array.isArray(parsed.commands)) return null;

    const validUuids = new Set(activeCinderlings.map((v) => v.uuid));
    const validVecs = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
    ];

    const commands: Command[] = [];
    const seen = new Set<string>();

    for (const c of parsed.commands) {
      if (!c.cinderlingUuid || !validUuids.has(c.cinderlingUuid)) continue;
      if (seen.has(c.cinderlingUuid)) continue; // one command per mon

      const dx = typeof c.vec?.dx === "number" ? c.vec.dx : 0;
      const dy = typeof c.vec?.dy === "number" ? c.vec.dy : 0;
      const vec = validVecs.find((v) => v.dx === dx && v.dy === dy);
      if (!vec) continue;

      if (c.type === "attack" && typeof c.attackIndex === "number") {
        commands.push({ type: "attack", cinderlingUuid: c.cinderlingUuid, attackIndex: c.attackIndex, vec });
        seen.add(c.cinderlingUuid);
      } else if (c.type === "move") {
        commands.push({ type: "move", cinderlingUuid: c.cinderlingUuid, vec });
        seen.add(c.cinderlingUuid);
      } else if (c.type === "harvest") {
        commands.push({ type: "harvest", cinderlingUuid: c.cinderlingUuid, vec });
        seen.add(c.cinderlingUuid);
      }
    }

    // Fill any missing mons with a default fallback move (so we always have all commands)
    for (const v of activeCinderlings) {
      if (!seen.has(v.uuid)) {
        commands.push({ type: "move", cinderlingUuid: v.uuid, vec: { dx: 0, dy: -1 } });
      }
    }

    return commands.length > 0 ? commands : null;
  } catch {
    return null;
  }
}

// ─── Persistence ──────────────────────────────────────────────────────────────

async function persistLog(data: {
  matchId: string;
  turn: number;
  teamId: number;
  profileId?: string;
  systemPrompt: string;
  userMessage: string;
  rawResponse: string;
  commands: Command[] | null;
  errorMessage?: string;
}): Promise<void> {
  const id = Math.random().toString(36).slice(2, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    // Prune old rows + insert new row in parallel
    await Promise.all([
      db.delete(llmRequest).where(lt(llmRequest.createdAt, sevenDaysAgo)),
      db.insert(llmRequest).values({
        id,
        matchId: data.matchId,
        turn: data.turn,
        teamId: data.teamId,
        profileId: data.profileId ?? null,
        model: MODEL,
        systemPrompt: data.systemPrompt,
        userMessage: data.userMessage,
        rawResponse: data.rawResponse,
        commands: data.commands as unknown as Record<string, unknown>[] | null,
        errorMessage: data.errorMessage ?? null,
      }),
    ]);
  } catch (err) {
    // Non-fatal — don't crash the game if logging fails
    console.error("[ai-llm] Failed to persist llmRequest log:", err);
  }
}
