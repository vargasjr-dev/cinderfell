import { db } from "../../data/db";
import { team, teamSlot, cinderlingInstance } from "../../data/schema";
import { eq } from "drizzle-orm";
import getCinderlingModel from "./getCinderlingModel.server";

const getTeams = async (userId: string) => {
  const teams = await db
    .select()
    .from(team)
    .where(eq(team.userId, userId))
    .orderBy(team.createdAt);

  return Promise.all(
    teams.map(async (t) => {
      const slots = await db
        .select({
          uuid: teamSlot.uuid,
          slotIndex: teamSlot.slotIndex,
          isActive: teamSlot.isActive,
          cinderlingInstanceUuid: teamSlot.cinderlingInstanceUuid,
          instanceUuid: cinderlingInstance.uuid,
          modelUuid: cinderlingInstance.modelUuid,
        })
        .from(teamSlot)
        .innerJoin(
          cinderlingInstance,
          eq(teamSlot.cinderlingInstanceUuid, cinderlingInstance.uuid),
        )
        .where(eq(teamSlot.teamUuid, t.uuid))
        .orderBy(teamSlot.slotIndex);

      const populatedSlots = await Promise.all(
        slots.map(async (s) => {
          const model = await getCinderlingModel(s.modelUuid);
          return {
            ...s,
            cinderling: model,
          };
        }),
      );

      return {
        ...t,
        slots: populatedSlots,
        activeCount: populatedSlots.filter((s) => s.isActive).length,
      };
    }),
  );
};

export default getTeams;
