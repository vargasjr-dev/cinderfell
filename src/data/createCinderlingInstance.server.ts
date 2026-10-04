import { db } from "../../data/db";
import { cinderlingInstance } from "../../data/schema";

const createCinderlingInstance = async ({
  model,
  userId,
  address,
  network,
  version,
}: {
  model: string;
  userId: string;
  address: string;
  network: number;
  version: string;
}): Promise<string> => {
  const [instance] = await db.insert(cinderlingInstance).values({
    modelUuid: model,
    userId,
    address,
    network,
    version,
  }).returning();

  return instance.uuid;
};

export default createCinderlingInstance;
