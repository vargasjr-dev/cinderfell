/**
 * Whispurr — "Calming Purr"
 *
 * At the start of each turn, Whispurr's soothing frequency
 * calms one ally — reducing their next action cost by 1.
 * The purr makes the whole team more efficient.
 *
 * Hook: onTurnStart
 * Effect: cost_mod -1 on a random active non-KO ally
 *
 * Design: Whispurr is a support (HP 75, ATK 6, SPD 7).
 * Unlike Starveil (self cost reduction) or Nectarb (team
 * energy gen), Whispurr gives cost reduction to ALLIES.
 * A team buffer that makes everyone around it cheaper
 * to operate. Fast for a support (SPD 7) — acts early
 * to set up the team's turn.
 */

import {
  registerPower,
  type HookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "calming_purr",
  name: "Calming Purr",
  description:
    "Each turn, reduces one ally's next action cost by 1.",
  hooks: {
    onTurnStart: (ctx: HookContext): PowerEffect[] => {
      const allies = ctx.state.teams[ctx.team - 1].active.filter(
        (v) => !v.isKO && v.uuid !== ctx.self.uuid
      );
      if (allies.length === 0) return [];

      const target = allies[Math.floor(Math.random() * allies.length)];
      return [
        {
          type: "cost_mod",
          cinderlingId: target.uuid,
          amount: -1,
        },
      ];
    },
  },
});
