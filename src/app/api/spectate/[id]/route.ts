/**
 * Spectate API route — serves match state for the read-only spectator view.
 *
 * Reads from two sources in order:
 *  1. `.cinderling/[id].json` on the filesystem — for CLI-created local matches
 *  2. Database — for uploaded matches (matchSnapshot table)
 *
 * No auth required — spectating is public.
 */

import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { db } from "../../../../../data/db";
import { matchSnapshot, gameSession } from "../../../../../data/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Sanitize: allow alphanumeric + hyphens (UUIDs) to prevent path traversal
  if (!/^[a-zA-Z0-9-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid match ID" }, { status: 400 });
  }

  // ── 1. Try local .cinderling file (CLI / dev mode) ──────────────────────────
  try {
    const filePath = join(process.cwd(), ".vellymon", `${id}.json`);
    const raw = await readFile(filePath, "utf-8");
    const data = JSON.parse(raw) as {
      gameState: unknown;
      turnHistory?: unknown[];
      turnSnapshots?: unknown[];
      turnLogs?: unknown[];
    };

    return NextResponse.json({
      gameState: data.gameState,
      status: "completed",
      turnSnapshots: data.turnSnapshots ?? [],
      turnLogs: data.turnLogs ?? [],
      turnHistory: data.turnHistory ?? [],
    });
  } catch {
    // File not found — fall through to DB
  }

  // ── 2. DB fallback — matchSnapshot table (for CLI-uploaded matches) ────────
  try {
    const [row] = await db
      .select()
      .from(matchSnapshot)
      .where(eq(matchSnapshot.id, id));

    if (row) {
      return NextResponse.json({
        gameState: row.gameState,
        status: row.status,
        turnSnapshots: (row.turnSnapshots as unknown[]) ?? [],
        turnLogs: (row.turnLogs as unknown[]) ?? [],
        turnHistory: [],
        p1ProfileId: row.p1ProfileId ?? null,
        p2ProfileId: row.p2ProfileId ?? null,
      });
    }
  } catch {
    // DB unavailable — fall through
  }

  // ── 3. gameSession fallback — web practice/ranked matches ─────────────────
  try {
    const [row] = await db
      .select()
      .from(gameSession)
      .where(eq(gameSession.uuid, id));

    if (row) {
      const meta = row.metadata as {
        gameState?: {
          turn: number;
          teams: Array<{
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
              attack: number;
              attacks?: unknown[];
              position: { x: number; y: number } | null;
              isKO: boolean;
              imageUrl?: string;
            }>;
            bench: unknown[];
            knocked: unknown[];
          }>;
          board: unknown[];
          boardWidth: number;
          boardHeight: number;
          result: { winner: 1 | 2; condition: string } | null;
        };
        turnHistory?: Array<{
          turn: number;
          boardBefore: unknown[];
          teamsBefore: Array<{
            id: 1 | 2;
            name: string;
            energy: number;
            active: Array<{
              uuid: string;
              name: string;
              hp: number;
              maxHp: number;
              position: { x: number; y: number } | null;
              isKO: boolean;
            }>;
            benchCount: number;
            knockedCount: number;
          }>;
          log: unknown;
        }>;
      } | null;

      const finalState = meta?.gameState ?? null;
      const history = meta?.turnHistory ?? [];

      // Reconstruct turn snapshots for replay if we have both gameState and history
      if (finalState && history.length > 0) {
        // Build uuid → static stats lookup from the full final gameState
        type CinderlingStats = {
          speed: number;
          attack: number;
          attacks?: unknown[];
          imageUrl?: string;
        };
        const statsLookup = new Map<string, CinderlingStats>();
        for (const team of finalState.teams) {
          const allCinderlings = [
            ...team.active,
            ...(team.bench as typeof team.active),
            ...(team.knocked as typeof team.active),
          ];
          for (const v of allCinderlings) {
            statsLookup.set(v.uuid, {
              speed: v.speed,
              attack: v.attack,
              attacks: v.attacks,
              imageUrl: v.imageUrl,
            });
          }
        }

        // userId per team id from final gameState
        const userIdByTeam = new Map<1 | 2, string>(
          finalState.teams.map((t) => [t.id, t.userId]),
        );

        // Build per-turn RawGameState snapshots from slim turnHistory entries
        const turnSnapshots = history.map((snap) => ({
          turn: snap.turn,
          teams: snap.teamsBefore.map((t) => ({
            id: t.id,
            userId: userIdByTeam.get(t.id) ?? "",
            name: t.name,
            energy: t.energy,
            active: t.active.map((v) => {
              const stats = statsLookup.get(v.uuid);
              return {
                uuid: v.uuid,
                name: v.name,
                hp: v.hp,
                maxHp: v.maxHp,
                speed: stats?.speed ?? 1,
                attack: stats?.attack ?? 1,
                attacks: stats?.attacks ?? [],
                position: v.position,
                isKO: v.isKO,
                imageUrl: stats?.imageUrl,
              };
            }),
            // bench/knocked only need length for display; full data not stored
            bench: new Array(t.benchCount).fill({}),
            knocked: new Array(t.knockedCount).fill({}),
          })),
          board: snap.boardBefore,
          boardWidth: finalState.boardWidth,
          boardHeight: finalState.boardHeight,
          result: null,
        }));

        // Append final gameState as last snapshot (with result)
        const finalSnapshot = {
          turn: finalState.turn,
          teams: finalState.teams,
          board: finalState.board,
          boardWidth: finalState.boardWidth,
          boardHeight: finalState.boardHeight,
          result: finalState.result,
        };

        return NextResponse.json({
          gameState: finalState,
          status: "completed",
          turnSnapshots: [...turnSnapshots, finalSnapshot],
          turnLogs: history.map((snap) => snap.log),
          turnHistory: [],
          p1ProfileId: null,
          p2ProfileId: null,
        });
      }

      // Fallback for sessions without full history (old matches)
      return NextResponse.json({
        gameState: finalState,
        status: "completed",
        turnSnapshots: [],
        turnLogs: [],
        turnHistory: history,
        p1ProfileId: null,
        p2ProfileId: null,
      });
    }
  } catch {
    // DB unavailable — fall through
  }

  return NextResponse.json({ error: "Match not found" }, { status: 404 });
}
