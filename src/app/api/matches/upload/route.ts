/**
 * Match upload API — accepts a CLI match state and stores it in the DB
 * so the spectate view works from the deployed site.
 *
 * Auth: Bearer token checked against CINDERLING_UPLOAD_API_KEY env var.
 *
 * POST /api/matches/upload
 * Body: { id: string, gameState: object, turnSnapshots?: object[], status?: string }
 * Returns: { ok: true, id: string, spectateUrl: string }
 */

import { NextResponse } from "next/server";
import { db } from "../../../../../data/db";
import { matchSnapshot } from "../../../../../data/schema";
import { getBaseUrl } from "~/lib/app-url";

export async function POST(req: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const apiKey = process.env.CINDERLING_UPLOAD_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Upload API not configured (CINDERLING_UPLOAD_API_KEY not set)" },
      { status: 503 },
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (token !== apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { id?: string; gameState?: unknown; turnSnapshots?: unknown[]; turnLogs?: unknown[]; status?: string; p1ProfileId?: string; p2ProfileId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, gameState, turnSnapshots, turnLogs, status = "completed", p1ProfileId, p2ProfileId } = body;

  if (!id || typeof id !== "string" || !/^[a-zA-Z0-9]+$/.test(id)) {
    return NextResponse.json({ error: "Missing or invalid match id" }, { status: 400 });
  }
  if (!gameState || typeof gameState !== "object") {
    return NextResponse.json({ error: "Missing gameState" }, { status: 400 });
  }

  // ── Upsert ────────────────────────────────────────────────────────────────
  try {
    await db
      .insert(matchSnapshot)
      .values({
        id,
        gameState,
        turnSnapshots: turnSnapshots ?? null,
        turnLogs: turnLogs ?? null,
        status,
        p1ProfileId: p1ProfileId ?? null,
        p2ProfileId: p2ProfileId ?? null,
      })
      .onConflictDoUpdate({
        target: matchSnapshot.id,
        set: {
          gameState,
          turnSnapshots: turnSnapshots ?? null,
          turnLogs: turnLogs ?? null,
          status,
          p1ProfileId: p1ProfileId ?? null,
          p2ProfileId: p2ProfileId ?? null,
          updatedAt: new Date(),
        },
      });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "DB upsert failed", detail: msg }, { status: 500 });
  }

  const origin = req.headers.get("origin") ?? req.headers.get("host") ?? getBaseUrl();
  const spectateUrl = `${origin.startsWith("http") ? "" : "https://"}${origin}/matches/${id}/spectate`;

  return NextResponse.json({ ok: true, id, spectateUrl });
}
