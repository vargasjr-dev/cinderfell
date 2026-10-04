/**
 * Voltwing — "Thunderclap"
 *
 * After Voltwing moves, its electric wings discharge —
 * dealing 3 bonus damage to the nearest enemy. Each flap
 * sends a thunderclap striking the closest target.
 *
 * Hook: onAfterCommand (move)
 * Effect: bonus_damage 3 to first active enemy
 *
 * Design: Voltwing is a speedster (HP 48, ATK 11, SPD 8).
 * Fast and offensive — moves deal free damage. Unlike
 * Skidmark (area denial on move) or Quicksilk (webs on
 * move), Voltwing converts movement into direct damage.
 * A hit-and-run specialist: move → thunderclap → follow
 * up with attack for a double threat turn.
 */

import {
  registerPower,
  type CommandHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "thunderclap",
  name: "Thunderclap",
  description:
    "Moving deals 3 damage to the first active enemy.",
  hooks: {
    onAfterCommand: (ctx: CommandHookContext): PowerEffect[] => {
      if (ctx.command.cinderlingUuid !== ctx.self.uuid) return [];
      if (ctx.command.type !== "move") return [];

      const enemyTeam = ctx.team === 1 ? 2 : 1;
      const enemies = ctx.state.teams[enemyTeam - 1].active.filter(
        (v) => !v.isKO
      );
      if (enemies.length === 0) return [];

      return [
        {
          type: "bonus_damage",
          targetId: enemies[0].uuid,
          amount: 3,
        },
      ];
    },
  },
});
