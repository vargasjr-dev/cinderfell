/**
 * Razorush — "Razor Slipstream"
 *
 * After Razorush moves, its attacks cost 1 less energy this
 * turn. The razor fins create a slipstream that channels
 * momentum into striking power.
 *
 * Hook: onAfterCommand (move)
 * Effect: cost_mod -1 to self
 *
 * Design: Razorush is a speedster (HP 52, ATK 11, SPD 9).
 * Highest ATK among speedsters — a glass-cannon speedster.
 * Razor Slipstream rewards the move-then-attack pattern by
 * making attacks cheaper after repositioning. At SPD 9 it
 * moves first, positions with the slipstream, then strikes
 * for maximum value. Fragile at HP 52 though — one good hit
 * and the razor fins stop spinning.
 */

import {
  registerPower,
  type CommandHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "razor_slipstream",
  name: "Razor Slipstream",
  description:
    "Moving makes attacks 1 energy cheaper this turn.",
  hooks: {
    onAfterCommand: (ctx: CommandHookContext): PowerEffect[] => {
      if (ctx.command.cinderlingUuid !== ctx.self.uuid) return [];
      if (ctx.command.type !== "move") return [];

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
