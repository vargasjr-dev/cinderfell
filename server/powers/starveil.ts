/**
 * Starveil — "Starlight Veil"
 *
 * At the start of each turn, Starveil's starlight veil
 * reduces the cost of its next action by 1. The veil
 * makes it unpredictable — always one step cheaper
 * than the opponent expects.
 *
 * Hook: onTurnStart
 * Effect: cost_mod -1 on self
 *
 * Design: Starveil is balanced (HP 77, ATK 11, SPD 6).
 * True generalist with economy advantage — every turn
 * it gets a 1-energy discount, compounding over the game.
 * Unlike Sandscout (same cost_mod but less ATK), Starveil
 * has stronger attack and lower HP — a more aggressive
 * economy fighter. "Hard to predict" because it acts
 * for less energy than its stats suggest.
 */

import {
  registerPower,
  type HookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "starlight_veil",
  name: "Starlight Veil",
  description:
    "Each turn, Starveil's next action costs 1 less energy.",
  hooks: {
    onTurnStart: (ctx: HookContext): PowerEffect[] => {
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
