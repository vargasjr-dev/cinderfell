import { db } from "../../data/db";
import { cinderlingInstance } from "../../data/schema";
import { eq } from "drizzle-orm";
import type { CinderlingStats } from "../types/game";
import getCinderlingModel from "./getCinderlingModel.server";

const getCinderlingByUuid = async (uuid: string): Promise<CinderlingStats> => {
  const [instance] = await db
    .select()
    .from(cinderlingInstance)
    .where(eq(cinderlingInstance.uuid, uuid));

  if (!instance) {
    throw new Error(`Could not find cinderling instance ${uuid}`);
  }

  return getCinderlingModel(instance.modelUuid);
};

export default getCinderlingByUuid;
