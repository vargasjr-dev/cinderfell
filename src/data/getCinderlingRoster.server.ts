import { db } from "../../data/db";
import { cinderlingInstance } from "../../data/schema";
import { eq } from "drizzle-orm";
import getCinderlingModel from "./getCinderlingModel.server";

const getCinderlingRoster = async (userId: string) => {
  const instances = await db
    .select()
    .from(cinderlingInstance)
    .where(eq(cinderlingInstance.userId, userId));

  return Promise.all(
    instances.map(async (instance) => {
      const model = await getCinderlingModel(instance.modelUuid);
      return { ...model, ...instance };
    })
  );
};

export default getCinderlingRoster;
