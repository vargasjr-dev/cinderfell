import { db } from "../../data/db";
import { cinderlingInstance } from "../../data/schema";

const buyFromMarket = async ({
  model,
  userId,
}: {
  model: string;
  userId: string;
}) => {
  try {
    const [instance] = await db
      .insert(cinderlingInstance)
      .values({
        modelUuid: model,
        userId,
        // Generate unique values for legacy blockchain fields
        address: `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`,
        network: Math.floor(Math.random() * 2_000_000_000),
        version: "0.1.0",
      })
      .returning();

    return {
      success: true,
      message: "Successfully bought cinderling!",
      instanceUuid: instance.uuid,
    };
  } catch (error) {
    console.error("Failed to buy from market:", error);
    return {
      success: false,
      message: "Failed to purchase cinderling",
    };
  }
};

export default buyFromMarket;
