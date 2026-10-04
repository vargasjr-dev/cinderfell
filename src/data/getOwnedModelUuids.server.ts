import { db } from "../../data/db";
import { cinderlingInstance } from "../../data/schema";
import { eq } from "drizzle-orm";

/** Returns the set of model UUIDs the user already owns */
const getOwnedModelUuids = async (userId: string): Promise<Set<string>> => {
  const instances = await db
    .select({ modelUuid: cinderlingInstance.modelUuid })
    .from(cinderlingInstance)
    .where(eq(cinderlingInstance.userId, userId));

  return new Set(instances.map((i) => i.modelUuid));
};

export default getOwnedModelUuids;
