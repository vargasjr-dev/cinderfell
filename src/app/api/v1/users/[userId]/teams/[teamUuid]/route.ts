/**
 * GET    /api/v1/users/[userId]/teams/[teamUuid]  — get a single team
 * PUT    /api/v1/users/[userId]/teams/[teamUuid]  — update name and/or slots
 * DELETE /api/v1/users/[userId]/teams/[teamUuid]  — delete a team
 *
 * Auth: Bearer vjk_* (admin API key)
 *
 * PUT body (all fields optional):
 *   {
 *     "name": "New Name",
 *     "slots": [
 *       { "cinderlingInstanceUuid": "<uuid>", "slotIndex": 0, "isActive": true },
 *       ...
 *     ]
 *   }
 */

import { NextResponse } from "next/server";
import { db } from "../../../../../../../../data/db";
import {
  team,
  teamSlot,
  cinderlingInstance,
} from "../../../../../../../../data/schema";
import { eq, and } from "drizzle-orm";
import { validateApiKey } from "../../../../../../../lib/apiKeyAuth.server";
import updateTeam from "../../../../../../../data/updateTeam.server";
import deleteTeam from "../../../../../../../data/deleteTeam.server";
import type { SlotInput } from "../../../../../../../data/createTeam.server";
import getCinderlingModel from "../../../../../../../data/getCinderlingModel.server";
import "../../../../../../../../server/powers";

async function getTeamWithSlots(teamUuid: string, userId: string) {
  const [t] = await db
    .select({ uuid: team.uuid, name: team.name, createdAt: team.createdAt })
    .from(team)
    .where(and(eq(team.uuid, teamUuid), eq(team.userId, userId)))
    .limit(1);
  if (!t) return null;

  const slots = await db
    .select({
      slotIndex: teamSlot.slotIndex,
      isActive: teamSlot.isActive,
      cinderlingInstanceUuid: teamSlot.cinderlingInstanceUuid,
    })
    .from(teamSlot)
    .where(eq(teamSlot.teamUuid, teamUuid));

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
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ userId: string; teamUuid: string }> },
) {
  const apiKey = await validateApiKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId, teamUuid } = await params;
  const result = await getTeamWithSlots(teamUuid, userId);
  if (!result) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ userId: string; teamUuid: string }> },
) {
  const apiKey = await validateApiKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId, teamUuid } = await params;

  let body: { name?: string; slots?: SlotInput[] };
  try {
    body = (await req.json()) as { name?: string; slots?: SlotInput[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, slots } = body;
  if (
    name !== undefined &&
    (typeof name !== "string" || name.trim().length === 0)
  ) {
    return NextResponse.json(
      { error: "name must be a non-empty string" },
      { status: 400 },
    );
  }

  const result = await updateTeam({
    teamUuid,
    userId,
    name: name?.trim(),
    slots,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.message }, { status: 422 });
  }

  const updated = await getTeamWithSlots(teamUuid, userId);
  return NextResponse.json({ ok: true, team: updated });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ userId: string; teamUuid: string }> },
) {
  const apiKey = await validateApiKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId, teamUuid } = await params;

  const result = await deleteTeam({ teamUuid, userId });
  if (!result.success) {
    return NextResponse.json({ error: result.message }, { status: 422 });
  }

  return NextResponse.json({ ok: true });
}
