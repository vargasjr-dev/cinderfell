/**
 * Titanog — "Titanium Bones"
 *
 * Titanog's titanium skeleton absorbs impacts. When
 * damaged, it gains a cost reduction for its next action.
 * The more it gets hit, the more efficiently it fights back.
 *
 * Hook: onDamaged
 * Effect: cost_mod -1 on self
 *
 * Design: Titanog is a tank (HP 98, ATK 11, SPD 1).
 * Second-highest HP in the game (only Shellmaw has more).
 * Tied for slowest (SPD 1). Getting hit fuels economy —
 * each hit makes its next action cheaper. Different from
 * Shellmaw (heals on hit) and Terravex (gains ATK on hit):
 * Titanog converts punishment into energy efficiency.
 * A fortress that gets CHEAPER to operate under fire.
 */

import {
  registerPower,
  type DamagedHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "titanium_bones",
  name: "Titanium Bones",
  description:
    "Taking damage reduces next action cost by 1.",
  hooks: {
    onDamaged: (ctx: DamagedHookContext): PowerEffect[] => {
      return [
        {
          type: "cost_mod",
          cinderlingId: ctx.self.uuid,
          amount: -1,
        },
      ];
    },
  },
});
