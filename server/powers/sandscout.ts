/**
 * Sandscout — "Desert Sight"
 *
 * At the start of each turn, Sandscout's keen scouting gives
 * its team a tactical edge — harvesting costs 1 less energy.
 * The scout sees the best harvest spots before anyone else.
 *
 * Hook: onTurnStart
 * Effect: cost_mod -1 to self (cheaper harvests)
 *
 * Design: Sandscout is balanced (HP 80, ATK 10, SPD 6).
 * Well-rounded across all stats — the true generalist.
 * Desert Sight makes harvesting cheaper, accelerating the
 * energy economy. A quiet support-like balanced type that
 * enables accumulation strategies. Sees everything, reports
 * nothing — but the team benefits from the scout's intel.
 */

import {
  registerPower,
  type HookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "desert_sight",
  name: "Desert Sight",
  description:
    "Scout's vision reduces energy costs by 1 each turn.",
  hooks: {
    onTurnStart: (ctx: HookContext): PowerEffect[] => {
      if (ctx.self.hp <= 0) return [];

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
