import { db } from "../../data/db";
import { team, teamSlot } from "../../data/schema";
import validateTeamSlots from "./validateTeamSlots.server";

export type SlotInput = {
  cinderlingInstanceUuid: string;
  slotIndex: number;
  isActive: boolean;
};

import { TEAM_NAME_MAX_LENGTH } from "./teamConstants";
export { TEAM_NAME_MAX_LENGTH };

const createTeam = async ({
  name,
  userId,
  slots,
}: {
  name: string;
  userId: string;
  slots: SlotInput[];
}) => {
  try {
    // Validate name length
    if (name.trim().length > TEAM_NAME_MAX_LENGTH) {
      return {
        success: false,
        message: `Team name must be ${TEAM_NAME_MAX_LENGTH} characters or fewer`,
      };
    }

    // Validate slots before creating
    const validation = await validateTeamSlots(slots, userId);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }

    const [newTeam] = await db
      .insert(team)
      .values({ name, userId })
      .returning();

    if (slots.length > 0) {
      await db.insert(teamSlot).values(
        slots.map((s) => ({
          teamUuid: newTeam.uuid,
          cinderlingInstanceUuid: s.cinderlingInstanceUuid,
          slotIndex: s.slotIndex,
          isActive: s.isActive,
        })),
      );
    }

    return {
      success: true,
      message: "Team created!",
      teamUuid: newTeam.uuid,
    };
  } catch (error) {
    console.error("Failed to create team:", error);
    return {
      success: false,
      message: "Failed to create team",
    };
  }
};

export default createTeam;
