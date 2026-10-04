"use server";

import { headers } from "next/headers";
import { auth } from "~/lib/auth.server";
import {
  generateCosmetic,
  validateGeneration,
  getGenerationCost,
  type GenerationResult,
} from "../../../../../lib/cosmetic-generator";
import type { CosmeticType } from "../../../../../lib/cosmetics";
import getCinderlingRoster from "~/data/getCinderlingRoster.server";
import { getBalance } from "../../../../../lib/currency";
import { isSubscriber } from "../../../../../lib/subscription";

export type RosterItem = {
  uuid: string;
  name: string;
  imageUrl?: string;
};

export type CreatePageData = {
  roster: RosterItem[];
  balance: number;
  subscribed: boolean;
};

export async function getCreatePageData(): Promise<CreatePageData> {
  const headersList = await headers();
  const session = (await auth.api.getSession({ headers: headersList }))!;

  const [roster, balance, subscribed] = await Promise.all([
    getCinderlingRoster(session.user.id),
    getBalance(session.user.id),
    isSubscriber(session.user.id),
  ]);

  return {
    roster: roster.map((v) => ({
      uuid: v.uuid,
      name: v.name,
      imageUrl: v.imageUrl,
    })),
    balance,
    subscribed,
  };
}

export async function generateCosmeticAction(
  cinderlingId: string | null,
  type: CosmeticType,
  prompt: string,
  styleParams?: {
    colorPalette?: string;
    theme?: string;
    intensity?: number;
  },
): Promise<GenerationResult> {
  const headersList = await headers();
  const session = (await auth.api.getSession({ headers: headersList }))!;

  return generateCosmetic({
    userId: session.user.id,
    cinderlingId,
    type,
    prompt,
    styleParams,
  });
}

export async function getGenerationCostAction(type: string): Promise<number> {
  return getGenerationCost(type);
}
