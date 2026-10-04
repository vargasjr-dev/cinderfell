import { db } from "../../data/db";
import { cinderlingInstance } from "../../data/schema";
import { inArray, eq, and } from "drizzle-orm";
import type { SlotInput } from "./createTeam.server";

const MAX_SLOTS = 8;
const MAX_ACTIVE = 4;

export type ValidationResult =
  | { valid: true }
  | { valid: false; message: string };

const validateTeamSlots = async (
  slots: SlotInput[],
  userId: string,
): Promise<ValidationResult> => {
  // Rule 1: max 8 slots per team
  if (slots.length > MAX_SLOTS) {
    return {
      valid: false,
      message: `A team can have at most ${MAX_SLOTS} cinderlings (got ${slots.length})`,
    };
  }

  // Rule 2: max 4 active slots
  const activeCount = slots.filter((s) => s.isActive).length;
  if (activeCount > MAX_ACTIVE) {
    return {
      valid: false,
      message: `A team can have at most ${MAX_ACTIVE} active cinderlings (got ${activeCount})`,
    };
  }

  // Rule 3: slot indices must be valid and unique
  const indices = slots.map((s) => s.slotIndex);
  const uniqueIndices = new Set(indices);
  if (uniqueIndices.size !== indices.length) {
    return { valid: false, message: "Duplicate slot indices" };
  }
  if (indices.some((i) => i < 0 || i >= MAX_SLOTS)) {
    return {
      valid: false,
      message: `Slot indices must be between 0 and ${MAX_SLOTS - 1}`,
    };
  }

  if (slots.length === 0) {
    return { valid: true };
  }

  // Fetch the actual instances to verify ownership and check types
  const instanceUuids = slots.map((s) => s.cinderlingInstanceUuid);
  const instances = await db
    .select({
      uuid: cinderlingInstance.uuid,
      userId: cinderlingInstance.userId,
      modelUuid: cinderlingInstance.modelUuid,
    })
    .from(cinderlingInstance)
    .where(inArray(cinderlingInstance.uuid, instanceUuids));

  // Rule 4: all instances must exist
  if (instances.length !== instanceUuids.length) {
    return {
      valid: false,
      message: "One or more cinderlings not found",
    };
  }

  // Rule 5: ownership check — all instances must belong to this user
  const notOwned = instances.filter((i) => i.userId !== userId);
  if (notOwned.length > 0) {
    return {
      valid: false,
      message: "You can only add your own cinderlings to a team",
    };
  }

  // Rule 6: no duplicate types (by modelUuid) per team
  const modelUuids = instances.map((i) => i.modelUuid);
  const uniqueModels = new Set(modelUuids);
  if (uniqueModels.size !== modelUuids.length) {
    return {
      valid: false,
      message: "A team cannot have duplicate cinderling types",
    };
  }

  return { valid: true };
};

export default validateTeamSlots;
