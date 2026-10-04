/**
 * getCinderlingInstance — fetch a single cinderling instance by UUID.
 *
 * Returns the merged model + instance data enriched with archetype info and
 * special power details. Returns null if the instance doesn't exist or belongs
 * to a different user (caller enforces ownership).
 *
 * Data sources:
 *   - cinderlingInstance table: ownership, address, network, version
 *   - getCinderlingModel: resolves modelUuid → CinderlingStats (name, stats, attacks)
 *   - CINDERLING_LIBRARY: archetype info (not exposed via CinderlingStats bridge)
 *   - getPower: special power description
 */

import { db } from "../../data/db";
import { cinderlingInstance } from "../../data/schema";
import { eq, and } from "drizzle-orm";
import getCinderlingModel from "./getCinderlingModel.server";
import { CINDERLING_LIBRARY } from "../../server/cinderlings";
import { getPower } from "../../server/specialPowers";
import "../../server/powers"; // trigger power registration

export type CinderlingInstanceDetail = {
  uuid: string;
  address: string;
  network: number;
  version: string;
  userId: string;
  modelUuid: string;
  // From CinderlingStats
  name: string;
  health: number;
  attack: number;
  speed: number;
  flavor?: string;
  imageUrl?: string;
  specialPowerId?: string;
  attacks: Array<{
    name: string;
    damage: number;
    energyCost: number;
    range: number;
  }>;
  // From CinderlingTemplate (via CINDERLING_LIBRARY lookup by name)
  archetype: string;
  // Enriched from power registry
  powerName?: string;
  powerDescription?: string;
};

export async function getCinderlingInstance(
  uuid: string,
  userId: string,
): Promise<CinderlingInstanceDetail | null> {
  const rows = await db
    .select()
    .from(cinderlingInstance)
    .where(
      and(eq(cinderlingInstance.uuid, uuid), eq(cinderlingInstance.userId, userId)),
    )
    .limit(1);

  if (rows.length === 0) return null;

  const instance = rows[0];
  const model = getCinderlingModel(instance.modelUuid);

  // Look up the template for archetype info (CinderlingStats doesn't expose it)
  const template = CINDERLING_LIBRARY.find(
    (t) => t.name.toLowerCase() === model.name.toLowerCase(),
  );

  const power = model.specialPowerId ? getPower(model.specialPowerId) : undefined;

  return {
    uuid: instance.uuid,
    address: instance.address,
    network: instance.network,
    version: instance.version,
    userId: instance.userId,
    modelUuid: instance.modelUuid,
    name: model.name,
    health: model.health,
    attack: model.attack,
    speed: model.speed,
    flavor: model.flavor,
    imageUrl: model.imageUrl,
    specialPowerId: model.specialPowerId,
    attacks: model.attacks.map((a) => ({
      name: a.name,
      damage: a.damage,
      energyCost: a.energyCost,
      range: a.range,
    })),
    archetype: template?.archetype ?? "balanced",
    powerName: power?.name,
    powerDescription: power?.description,
  };
}
