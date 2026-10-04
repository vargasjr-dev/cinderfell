"use server";

import { headers } from "next/headers";
import { auth } from "~/lib/auth.server";
import {
  getUserCosmetics,
  getLoadout,
  equipSkin,
  areCosmeticsActive,
} from "../../../../lib/cosmetics";
import type { CosmeticType } from "../../../../lib/cosmetics";

export type CosmeticItem = {
  id: string;
  cinderlingId: string | null;
  type: string;
  name: string;
  imageUrl: string | null;
  source: string;
  createdAt: Date;
};

export type CosmeticsPageData = {
  cosmetics: CosmeticItem[];
  active: boolean;
  loadouts: Record<string, string | null>; // cinderlingId → equippedSkinId
};

export async function getCosmeticsPageData(): Promise<CosmeticsPageData> {
  const headersList = await headers();
  const session = (await auth.api.getSession({ headers: headersList }))!;

  const [cosmetics, active] = await Promise.all([
    getUserCosmetics(session.user.id),
    areCosmeticsActive(session.user.id),
  ]);

  // Build loadout map for all unique cinderlingIds
  const cinderlingIds = [
    ...new Set(
      cosmetics
        .map((c) => c.cinderlingId)
        .filter((id): id is string => id !== null),
    ),
  ];

  const loadoutEntries = await Promise.all(
    cinderlingIds.map(async (vid) => {
      const loadout = await getLoadout(session.user.id, vid);
      return [vid, loadout?.equippedSkinId ?? null] as const;
    }),
  );

  return {
    cosmetics,
    active,
    loadouts: Object.fromEntries(loadoutEntries),
  };
}

export async function equipCosmeticAction(
  cinderlingId: string,
  cosmeticId: string | null,
): Promise<{ success: boolean; error?: string }> {
  const headersList = await headers();
  const session = (await auth.api.getSession({ headers: headersList }))!;

  try {
    const active = await areCosmeticsActive(session.user.id);
    if (!active) {
      return { success: false, error: "Subscription required to equip cosmetics" };
    }

    await equipSkin(session.user.id, cinderlingId, cosmeticId);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to equip",
    };
  }
}
