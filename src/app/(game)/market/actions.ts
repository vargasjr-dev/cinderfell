"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "~/lib/auth.server";
import buyFromMarket from "~/data/buyFromMarket.server";

export async function purchaseCinderling(modelUuid: string) {
  const headersList = await headers();
  // Session guaranteed by (game)/layout.tsx auth gate
  const session = (await auth.api.getSession({ headers: headersList }))!;

  const result = await buyFromMarket({
    model: modelUuid,
    userId: session.user.id,
  });

  if (result.success) {
    // Revalidate pages that show roster data
    revalidatePath("/player");
    revalidatePath("/roster");
  }

  return result;
}
