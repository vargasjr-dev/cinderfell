/**
 * Pebblink — "Stone Blink"
 *
 * When Pebblink takes damage, it blinks — gaining +2 SPD
 * until end of turn. The pebble flickers in and out, becoming
 * harder to catch the more you hit it.
 *
 * Hook: onDamaged
 * Effect: speed_mod +2 to self
 *
 * Design: Pebblink is balanced (HP 82, ATK 10, SPD 5).
 * Solid all-around stats. Stone Blink turns defensive pressure
 * into mobility — each hit makes Pebblink faster, letting it
 * reposition or escape. At base SPD 5, a single hit puts it
 * at effective SPD 7. Multiple attackers focusing Pebblink
 * just makes it harder to catch. Don't underestimate the pebble.
 */

import {
  registerPower,
  type DamagedHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "stone_blink",
  name: "Stone Blink",
  description:
    "When damaged, gains +2 SPD this turn.",
  hooks: {
    onDamaged: (ctx: DamagedHookContext): PowerEffect[] => {
      return [
        {
          type: "speed_mod",
          cinderlingId: ctx.self.uuid,
          amount: 2,
        },
      ];
    },
  },
});
