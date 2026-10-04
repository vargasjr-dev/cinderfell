/**
 * Match download API — fetch full match content by ID for offline analysis.
 *
 * Auth: same Bearer token as the upload API (CINDERLING_UPLOAD_API_KEY).
 *
 * GET /api/matches/download?id=<matchId>
 * Returns: { id, status, p1ProfileId, p2ProfileId, gameState, turnSnapshots, turnLogs, uploadedAt, updatedAt }
 *
 * List: GET /api/matches/download?limit=N&offset=N&profile=<profileId>
 * Returns: { matches: [{ id, status, p1ProfileId, p2ProfileId, uploadedAt, updatedAt }], total }
 * (gameState/turnSnapshots/turnLogs omitted from list view — fetch individual records for full content)
 */

import { NextResponse } from "next/server";
import { db } from "../../../../../data/db";
import { matchSnapshot } from "../../../../../data/schema";
import { eq, or, desc, count } from "drizzle-orm";

function checkAuth(req: Request): boolean {
  const apiKey = process.env.CINDERLING_UPLOAD_API_KEY;
  if (!apiKey) return false;
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  return token === apiKey;
}

export async function GET(req: Request) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  // ── Single match by ID ─────────────────────────────────────────────────────
  if (id) {
    const rows = await db
      .select()
      .from(matchSnapshot)
      .where(eq(matchSnapshot.id, id))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  }

  // ── List matches ───────────────────────────────────────────────────────────
  const limitRaw = parseInt(searchParams.get("limit") ?? "20", 10);
  const offsetRaw = parseInt(searchParams.get("offset") ?? "0", 10);
  const profileId = searchParams.get("profile");

  const limit = Math.min(Math.max(1, limitRaw), 100);
  const offset = Math.max(0, offsetRaw);

  const whereClause = profileId
    ? or(
        eq(matchSnapshot.p1ProfileId, profileId),
        eq(matchSnapshot.p2ProfileId, profileId),
      )
    : undefined;

  const [matches, totalRows] = await Promise.all([
    db
      .select({
        id: matchSnapshot.id,
        status: matchSnapshot.status,
        p1ProfileId: matchSnapshot.p1ProfileId,
        p2ProfileId: matchSnapshot.p2ProfileId,
        uploadedAt: matchSnapshot.uploadedAt,
        updatedAt: matchSnapshot.updatedAt,
      })
      .from(matchSnapshot)
      .where(whereClause)
      .orderBy(desc(matchSnapshot.uploadedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(matchSnapshot)
      .where(whereClause),
  ]);

  return NextResponse.json({ matches, total: totalRows[0]?.total ?? 0 });
}
