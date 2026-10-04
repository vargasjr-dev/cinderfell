/**
 * Zipfang — "Blood Rush"
 *
 * Zipfang is so recklessly fast it burns through its own
 * body — losing 2 HP at the start of every turn. A true
 * glass cannon: the highest speed, great attack, and a
 * ticking clock built into its own biology.
 *
 * Hook: onTurnStart
 * Effect: bonus_damage (self-damage) 2 HP on self
 *
 * Design: Zipfang is a speedster (HP 40, ATK 12, SPD 10).
 * TIED FASTEST in the entire game (SPD 10, with Joltmink).
 * Second-lowest HP (40, only Voidclaw is lower at 45).
 * Blood Rush makes it even more fragile — it wins by
 * ending fights fast before the clock runs out on itself.
 *
 * 64th and FINAL cinderling enrichment. ⚔️
 */

import {
  registerPower,
  type HookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "blood_rush",
  name: "Blood Rush",
  description:
    "Zipfang loses 2 HP at the start of each turn, burning through its own body to move at blinding speed.",
  hooks: {
    onTurnStart: (ctx: HookContext): PowerEffect[] => {
      return [
        {
          type: "bonus_damage",
          targetId: ctx.self.uuid,
          amount: 2,
        },
      ];
    },
  },
});
