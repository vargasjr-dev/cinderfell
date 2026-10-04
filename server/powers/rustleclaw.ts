/**
 * Rustleclaw — "Ambush Claws"
 *
 * At the start of each turn, Rustleclaw gains +1 SPD from
 * rustling anticipation. The longer the game goes, the faster
 * it gets — the ambush predator builds toward a pounce.
 *
 * Hook: onTurnStart
 * Effect: speed_mod +1 to self
 *
 * Design: Rustleclaw is balanced (HP 85, ATK 11, SPD 4).
 * Starts slow but Ambush Claws stacks +1 SPD every turn.
 * By turn 3 it's at effective SPD 7, by turn 5 at SPD 9
 * (speedster territory). A late-game predator that rewards
 * patience — protect it early and it becomes unstoppable
 * in the endgame. Opposite of burst cinderlings like Blastova.
 */

import {
  registerPower,
  type HookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "ambush_claws",
  name: "Ambush Claws",
  description:
    "Gains +1 SPD at the start of each turn.",
  hooks: {
    onTurnStart: (ctx: HookContext): PowerEffect[] => {
      if (ctx.self.hp <= 0) return [];

      return [
        {
          type: "speed_mod",
          cinderlingId: ctx.self.uuid,
          amount: 1,
        },
      ];
    },
  },
});
