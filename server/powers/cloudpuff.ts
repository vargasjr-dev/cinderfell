/**
 * Cloudpuff — "Rain Dance"
 *
 * At the start of each turn, all allies heal 1 HP.
 * A tiny cloud raining gentle nourishment over the team.
 *
 * Hook: onTurnStart
 * Effect: heal all allied cinderlings by 1 HP
 */

import {
  registerPower,
  type HookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "rain-dance",
  name: "Rain Dance",
  description:
    "At the start of each turn, all allies heal 1 HP.",
  hooks: {
    onTurnStart: (ctx: HookContext): PowerEffect[] => {
      const allies = ctx.state.teams[ctx.team - 1].active.filter(
        (a) => a.uuid !== ctx.self.uuid && !a.isKO,
      );
      return allies.map((ally) => ({
        type: "heal" as const,
        targetId: ally.uuid,
        amount: 1,
      }));
    },
  },
});
