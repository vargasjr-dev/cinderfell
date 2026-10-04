/**
 * GET  /api/v1/users/[userId]/teams  — list a user's teams with their slots
 * POST /api/v1/users/[userId]/teams  — create a new team for a user
 *
 * Auth: Bearer vjk_* (admin API key)
 *
 * POST body:
 *   {
 *     "name": "Team Name",
 *     "slots": [
 *       { "cinderlingInstanceUuid": "<uuid>", "slotIndex": 0, "isActive": true },
 *       ...
 *     ]
 *   }
 */

import { NextResponse } from "next/server";
import { db } from "../../../../../../../data/db";
import {
  team,
  teamSlot,
  cinderlingInstance,
  user,
} from "../../../../../../../data/schema";
import { eq } from "drizzle-orm";
import { validateApiKey } from "../../../../../../lib/apiKeyAuth.server";
import createTeam from "../../../../../../data/createTeam.server";
import type { SlotInput } from "../../../../../../data/createTeam.server";
import getCinderlingModel from "../../../../../../data/getCinderlingModel.server";
import "../../../../../../../server/powers";

async function requireUser(userId: string) {
  const [u] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return u ?? null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const apiKey = await validateApiKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  if (!(await requireUser(userId))) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const teams = await db
    .select({
      uuid: team.uuid,
      name: team.name,
      createdAt: team.createdAt,
    })
    .from(team)
    .where(eq(team.userId, userId));

  // Fetch slots for each team
  const result = await Promise.all(
    teams.map(async (t) => {
      const slots = await db
        .select({
          slotIndex: teamSlot.slotIndex,
          isActive: teamSlot.isActive,
          cinderlingInstanceUuid: teamSlot.cinderlingInstanceUuid,
        })
        .from(teamSlot)
        .where(eq(teamSlot.teamUuid, t.uuid));

      // Enrich with cinderling names
      const enrichedSlots = await Promise.all(
        slots.map(async (s) => {
          const [inst] = await db
            .select({ modelUuid: cinderlingInstance.modelUuid })
            .from(cinderlingInstance)
            .where(eq(cinderlingInstance.uuid, s.cinderlingInstanceUuid))
            .limit(1);
          let cinderlingName = "Unknown";
          if (inst) {
            try {
              cinderlingName = getCinderlingModel(inst.modelUuid).name;
            } catch {
              /* skip */
            }
          }
          return { ...s, cinderlingName };
        }),
      );

      return { ...t, slots: enrichedSlots };
    }),
  );

  return NextResponse.json({ userId, teams: result });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const apiKey = await validateApiKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  if (!(await requireUser(userId))) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body: { name?: string; slots?: SlotInput[] };
  try {
    body = (await req.json()) as { name?: string; slots?: SlotInput[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, slots = [] } = body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const result = await createTeam({ name: name.trim(), userId, slots });
  if (!result.success) {
    return NextResponse.json({ error: result.message }, { status: 422 });
  }

  return NextResponse.json(
    { ok: true, teamUuid: result.teamUuid },
    { status: 201 },
  );
}
