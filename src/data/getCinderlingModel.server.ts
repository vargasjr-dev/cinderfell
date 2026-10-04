import all, { cinderlingByUuid, idToUuid } from "../enums/cinderlings";

/**
 * Legacy UUID mappings — two generations of old formats.
 *
 * Gen 1: Original 4 scaffold cinderlings with random UUIDs.
 * Gen 2: First library UUIDs using "ve11ym0n-" prefix (invalid hex for PostgreSQL).
 *
 * Both map to the current valid hex format: 00be1100-{id}-4000-8000-{id}.
 */

// Gen 1 → current: original 4 scaffold cinderlings
const GEN1_UUID_MAP: Record<string, number> = {
  // Platinum → Buldrok (now sorted as id may differ — use name lookup)
  "05da83b5-f7c7-4478-b426-e4a2b69ab2b7": 1,
  // Golden → Ferridon
  "f9564a8b-836e-4259-81bb-cdafadba0ed2": 2,
  // Silver → Shellguard
  "06ea4e02-0697-48f4-9296-d72153b5a58d": 3,
  // Bronze → Cragthorn
  "df38d5f0-2023-47ba-b614-67b86be047ba": 4,
};

/**
 * Try to parse a Gen 2 "ve11ym0n-" UUID and extract the library ID.
 * Format was: ve11ym0n-XXXX-4XXX-8000-00000000XXXXXXXX
 * The last 8 hex chars encode the original library ID.
 */
function parseGen2Uuid(uuid: string): number | null {
  if (!uuid.startsWith("ve11ym0n-")) return null;
  const lastSegment = uuid.split("-").pop();
  if (!lastSegment) return null;
  const id = parseInt(lastSegment, 16);
  return isNaN(id) || id < 1 || id > 999 ? null : id;
}

const getCinderlingModel = (uuid?: string) => {
  if (uuid) {
    // Try current format first
    let cinderlingModel = cinderlingByUuid.get(uuid);

    if (!cinderlingModel) {
      // Try Gen 1 mapping (original 4 scaffold UUIDs)
      const gen1Id = GEN1_UUID_MAP[uuid];
      if (gen1Id) {
        cinderlingModel = cinderlingByUuid.get(idToUuid(gen1Id));
      }
    }

    if (!cinderlingModel) {
      // Try Gen 2 mapping (ve11ym0n-* format)
      const gen2Id = parseGen2Uuid(uuid);
      if (gen2Id) {
        cinderlingModel = cinderlingByUuid.get(idToUuid(gen2Id));
      }
    }

    if (!cinderlingModel) {
      throw new Error(`Could not find cinderling model ${uuid}`);
    }
    return cinderlingModel;
  } else {
    // Random cinderling for testing
    const cinderlingModel = all[Math.floor(Math.random() * all.length)];
    return cinderlingModel;
  }
};

export default getCinderlingModel;
