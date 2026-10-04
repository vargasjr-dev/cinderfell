/**
 * Pollyx — "Pollen Cloud"
 *
 * At the end of each turn, Pollyx spreads pollen that slows
 * all active enemy cinderlings by -1 SPD. Annoyingly persistent
 * debuff that blankets the entire enemy team.
 *
 * Hook: onTurnEnd
 * Effect: speed_mod -1 to each active enemy
 *
 * Design: Pollyx is a support (HP 68, ATK 6, SPD 8). Fast
 * but fragile with the lowest ATK among supports. Pollen Cloud
 * compensates by debuffing the entire enemy team's speed every
 * turn. Over 2-3 turns, even speedsters become sluggish. Pairs
 * perfectly with slow tanks like Plateor or Mosswall — slow
 * the enemy down so your bruisers can catch them.
 */

import {
  registerPower,
  type HookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "pollen_cloud",
  name: "Pollen Cloud",
  description:
    "At turn end, all active enemies lose 1 SPD.",
  hooks: {
    onTurnEnd: (ctx: HookContext): PowerEffect[] => {
      if (ctx.self.hp <= 0) return [];

      const enemyTeamIdx = ctx.team === 1 ? 1 : 0;
      const enemyTeam = ctx.state.teams[enemyTeamIdx];
      const alive = enemyTeam.active.filter((v) => !v.isKO);

      return alive.map((v) => ({
        type: "speed_mod" as const,
        cinderlingId: v.uuid,
        amount: -1,
      }));
    },
  },
});
