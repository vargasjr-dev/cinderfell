/**
 * Plateor — "Tectonic Charge"
 *
 * When Plateor moves, it builds seismic momentum, gaining +1
 * ATK boost (via cost reduction making attacks cheaper by 1).
 * The tectonic plates shift with every step.
 *
 * Hook: onAfterCommand (move)
 * Effect: cost_mod -1 on self (makes attacks cheaper)
 *
 * Design: Plateor is a tank (HP 90, ATK 12, SPD 3). Slow
 * but hits hard at base. Tectonic Charge rewards movement —
 * each move reduces attack cost by 1 energy, effectively
 * increasing Plateor's efficiency the more it repositions.
 * A patient tank that gets better value the longer it lives.
 */

import {
  registerPower,
  type CommandHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "tectonic_charge",
  name: "Tectonic Charge",
  description:
    "Moving reduces attack cost by 1 energy.",
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
