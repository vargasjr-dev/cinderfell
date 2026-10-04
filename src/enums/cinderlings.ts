/**
 * Bridge between the 64-cinderling library (server/cinderlings.ts)
 * and the client-facing CinderlingStats type used by market/roster/UI.
 *
 * Generates stable UUIDs from library IDs so the market, purchases,
 * and team slots all reference consistent model identifiers.
 */
import type { CinderlingStats } from "../types/game";
import {
  CINDERLING_LIBRARY,
  type CinderlingTemplate,
} from "../../server/cinderlings";


/**
 * Generate a deterministic UUID from a cinderling library ID.
 *
 * Format: 00be1100-{id_hex}-4000-8000-{id_hex_padded_12}
 *
 * Uses only valid hex characters so PostgreSQL accepts it as a uuid.
 * The "0be11" prefix is a nod to "cinderling" in hex-safe form.
 * Deterministic: same ID always produces the same UUID.
 */
function idToUuid(id: number): string {
  const hex4 = id.toString(16).padStart(4, "0");
  const hex12 = id.toString(16).padStart(12, "0");
  return `00be1100-${hex4}-4000-8000-${hex12}`;
}

/**
 * Convert a library template to the client-facing CinderlingStats format.
 */
function templateToStats(t: CinderlingTemplate): CinderlingStats {
  return {
    uuid: idToUuid(t.id),
    name: t.name,
    health: t.hp,
    attack: t.attack,
    speed: t.speed,
    energy: 0, // Energy is team-wide now, not per-cinderling
    attacks: t.attacks.map((atk) => ({
      key: atk.key,
      name: atk.name,
      damage: atk.damage,
      energyCost: atk.energyCost,
      range: atk.range,
    })),
    flavor: t.flavor,
    imageUrl: t.imageUrl,
    specialPowerId: t.specialPowerId,
  };
}

/** All 64 cinderlings as CinderlingStats for the market/UI layer */
const all: CinderlingStats[] = CINDERLING_LIBRARY.map(templateToStats);

export default all;

/** Lookup helpers */
export const cinderlingByUuid = new Map<string, CinderlingStats>(
  all.map((v) => [v.uuid, v]),
);

export const cinderlingByName = new Map<string, CinderlingStats>(
  all.map((v) => [v.name.toLowerCase(), v]),
);

/** Convert a library ID to UUID */
export { idToUuid };
