import { db } from "../../data/db";
import { team, teamSlot } from "../../data/schema";
import { eq, and } from "drizzle-orm";
import type { SlotInput } from "./createTeam.server";
import { TEAM_NAME_MAX_LENGTH } from "./createTeam.server";
import validateTeamSlots from "./validateTeamSlots.server";

const updateTeam = async ({
  teamUuid,
  userId,
  name,
  slots,
}: {
  teamUuid: string;
  userId: string;
  name?: string;
  slots?: SlotInput[];
}) => {
  try {
    // Verify ownership
    const [existing] = await db
      .select({ uuid: team.uuid })
      .from(team)
      .where(and(eq(team.uuid, teamUuid), eq(team.userId, userId)));

    if (!existing) {
      return { success: false, message: "Team not found" };
    }

    // Update name if provided
    if (name !== undefined) {
      if (name.trim().length > TEAM_NAME_MAX_LENGTH) {
        return {
          success: false,
          message: `Team name must be ${TEAM_NAME_MAX_LENGTH} characters or fewer`,
        };
      }
      await db
        .update(team)
        .set({ name })
        .where(eq(team.uuid, teamUuid));
    }

    // Replace slots if provided
    if (slots !== undefined) {
      // Validate new slots before replacing
      const validation = await validateTeamSlots(slots, userId);
      if (!validation.valid) {
        return { success: false, message: validation.message };
      }

      // Delete existing slots
      await db
        .delete(teamSlot)
        .where(eq(teamSlot.teamUuid, teamUuid));

      // Insert new slots
      if (slots.length > 0) {
        await db.insert(teamSlot).values(
          slots.map((s) => ({
            teamUuid,
            cinderlingInstanceUuid: s.cinderlingInstanceUuid,
            slotIndex: s.slotIndex,
            isActive: s.isActive,
          })),
        );
      }
    }

    return { success: true, message: "Team updated!" };
  } catch (error) {
    console.error("Failed to update team:", error);
    return { success: false, message: "Failed to update team" };
  }
};

export default updateTeam;
