/**
 * createAdminMatch — auto-generates two random teams and a match
 * for playtesting. Admin can then play as either side.
 *
 * Flow:
 * 1. Shuffle the 64-cinderling library, pick 16 (no repeats)
 * 2. Split into two groups of 8
 * 3. Create cinderlingInstances for the admin user
 * 4. Create two teams (4 active + 4 bench each)
 * 5. Create a gameSession with both gamePlayers set to admin
 * 6. Return the match UUID
 */

import { db } from "../../data/db";
import {
  cinderlingInstance,
  team,
  teamSlot,
  gameSession,
  gamePlayer,
} from "../../data/schema";
import { CINDERLING_LIBRARY } from "../../server/cinderlings";

function idToUuid(id: number): string {
  const hex4 = id.toString(16).padStart(4, "0");
  const hex12 = id.toString(16).padStart(12, "0");
  return `00be1100-${hex4}-4000-8000-${hex12}`;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type MatchSettingsInput = {
  timerSeconds?: number;
  mapId?: string;
};

const createAdminMatch = async (
  adminUserId: string,
  settings?: MatchSettingsInput,
) => {
  try {
    // 1. Pick 16 random cinderlings (no repeats)
    const shuffled = shuffle(CINDERLING_LIBRARY);
    const picked = shuffled.slice(0, 16);
    const teamA = picked.slice(0, 8);
    const teamB = picked.slice(8, 16);

    // 2. Create cinderling instances for admin
    const createInstances = async (models: typeof teamA) => {
      const instances = [];
      for (const v of models) {
        const [inst] = await db
          .insert(cinderlingInstance)
          .values({
            modelUuid: idToUuid(v.id),
            userId: adminUserId,
            address: `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`,
            network: Math.floor(Math.random() * 2_000_000_000),
            version: "0.1.0",
          })
          .returning();
        instances.push({ instanceUuid: inst.uuid, name: v.name });
      }
      return instances;
    };

    const instancesA = await createInstances(teamA);
    const instancesB = await createInstances(teamB);

    // 3. Create two teams
    const teamNameA = `Admin Team α (${teamA.slice(0, 4).map((v) => v.name).join(", ")})`;
    const teamNameB = `Admin Team β (${teamB.slice(0, 4).map((v) => v.name).join(", ")})`;

    const [newTeamA] = await db
      .insert(team)
      .values({ name: teamNameA, userId: adminUserId })
      .returning();

    const [newTeamB] = await db
      .insert(team)
      .values({ name: teamNameB, userId: adminUserId })
      .returning();

    // 4. Create team slots (first 4 active, last 4 bench)
    const createSlots = async (
      teamUuid: string,
      instances: typeof instancesA,
    ) => {
      await db.insert(teamSlot).values(
        instances.map((inst, i) => ({
          teamUuid,
          cinderlingInstanceUuid: inst.instanceUuid,
          slotIndex: i,
          isActive: i < 4,
        })),
      );
    };

    await createSlots(newTeamA.uuid, instancesA);
    await createSlots(newTeamB.uuid, instancesB);

    // 5. Create game session (admin vs admin)
    // Both players added at creation — skip "waiting" and go straight to "ready"
    // so the WaitingRoom shows the Start Match button immediately.
    // Store match settings in metadata so initializeMatchGame picks them up.
    const matchSettings = {
      timerSeconds: settings?.timerSeconds ?? 0,
      mapId: settings?.mapId ?? "standard",
    };
    const [session] = await db
      .insert(gameSession)
      .values({
        createdBy: adminUserId,
        status: "ready",
        maxPlayers: 2,
        currentPlayers: 2,
        metadata: { matchSettings },
      })
      .returning();

    // 6. Add admin as both players
    await db.insert(gamePlayer).values([
      {
        gameSessionUuid: session.uuid,
        userId: adminUserId,
        teamUuid: newTeamA.uuid,
      },
      {
        gameSessionUuid: session.uuid,
        userId: adminUserId,
        teamUuid: newTeamB.uuid,
      },
    ]);

    return {
      success: true,
      matchUuid: session.uuid,
      teamA: {
        name: teamNameA,
        active: instancesA.slice(0, 4).map((i) => i.name),
        bench: instancesA.slice(4).map((i) => i.name),
      },
      teamB: {
        name: teamNameB,
        active: instancesB.slice(0, 4).map((i) => i.name),
        bench: instancesB.slice(4).map((i) => i.name),
      },
    };
  } catch (error) {
    console.error("Failed to create admin match:", error);
    return { success: false, message: "Failed to create admin match" };
  }
};

export default createAdminMatch;
