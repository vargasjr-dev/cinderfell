/**
 * Crimshard — "Crystal Barrage"
 *
 * After attacking, Crimshard deals 4 bonus splash damage to another
 * enemy. Red crystal shards lash out at nearby targets.
 *
 * Hook: onAfterCommand (attack)
 * Effect: bonus_damage 4 to a secondary enemy
 */

import {
  registerPower,
  type CommandHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "crystal-barrage",
  name: "Crystal Barrage",
  description:
    "After attacking, deals 4 splash damage to another enemy.",
  hooks: {
    onAfterCommand: (ctx: CommandHookContext): PowerEffect[] => {
      if (ctx.command.type !== "attack") return [];
      const enemyTeam = ctx.state.teams[ctx.team === 1 ? 1 : 0];
      const others = enemyTeam.active.filter(
        (v) => !v.isKO && v.uuid !== ctx.command.cinderlingUuid,
      );
      if (others.length === 0) return [];
      const splash = others[Math.floor(Math.random() * others.length)];
      return [{ type: "bonus_damage", targetId: splash.uuid, amount: 4 }];
    },
  },
});
