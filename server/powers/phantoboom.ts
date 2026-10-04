/**
 * Phantoboom — "Detonation"
 *
 * When Phantoboom is knocked out, it detonates — dealing 8
 * bonus damage to the first active enemy cinderling. The
 * phantom materializes one final time to explode.
 *
 * Hook: onKnockout
 * Effect: bonus_damage 8 to first active enemy
 *
 * Design: Phantoboom is a glass cannon (HP 65, ATK 15, SPD 5).
 * High attack with moderate speed. Detonation makes it a
 * lose-lose for opponents — killing Phantoboom costs 8 HP to
 * an enemy. Combined with ATK 15 output while alive, the
 * total damage Phantoboom inflicts often exceeds its own HP.
 * Tanks especially hate this — they invest turns taking it
 * down only to eat phantom shrapnel.
 */

import {
  registerPower,
  type KnockoutHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "detonation",
  name: "Detonation",
  description:
    "On knockout, deals 8 damage to the first active enemy cinderling.",
  hooks: {
    onKnockout: (ctx: KnockoutHookContext): PowerEffect[] => {
      // Only trigger when Phantoboom itself is knocked out
      if (ctx.target.uuid !== ctx.self.uuid) return [];

      // Find enemy team and first active cinderling
      const enemyTeamIdx = ctx.team === 1 ? 1 : 0;
      const enemyTeam = ctx.state.teams[enemyTeamIdx];
      const firstAlive = enemyTeam.active.find((v) => !v.isKO);

      if (!firstAlive) return [];

      return [
        {
          type: "bonus_damage",
          targetId: firstAlive.uuid,
          amount: 8,
        },
      ];
    },
  },
});
