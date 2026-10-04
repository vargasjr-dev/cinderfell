/**
 * Duskfin — "Twilight Veil"
 *
 * After turn 5, Duskfin gains +2 SPD each turn. The longer the
 * match, the more dangerous it becomes.
 *
 * Hook: onTurnStart
 * Effect: speed_mod +2 after turn 5
 */

import {
  registerPower,
  type HookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "twilight-veil",
  name: "Twilight Veil",
  description:
    "After turn 5, gains +2 SPD each turn.",
  hooks: {
    onTurnStart: (ctx: HookContext): PowerEffect[] => {
      if (ctx.turn < 5) return [];
      return [{ type: "speed_mod", cinderlingId: ctx.self.uuid, amount: 2 }];
    },
  },
});
