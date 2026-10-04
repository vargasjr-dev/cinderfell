/**
 * Blastova — "Supernova Burst"
 *
 * Every 5th turn (5, 10, 15…), Blastova's attack deals +5 bonus damage.
 * A living supernova — erupts on a cycle, bright and devastating each time.
 *
 * Turn 1 was the original trigger but mons start far apart so it almost
 * never connected. Every-5th-turn keeps the power relevant throughout the match.
 *
 * Hook: onAfterCommand (attack, self only, turn % 5 === 0, successful hit)
 * Effect: bonus_damage +5 on the actual attack target
 */

import {
  registerPower,
  type CommandHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "supernova-burst",
  name: "Supernova Burst",
  description: "Every 5th turn, your attack deals +5 bonus damage.",
  hooks: {
    onAfterCommand: (ctx: CommandHookContext): PowerEffect[] => {
      if (ctx.command.type !== "attack") return [];
      if (ctx.command.cinderlingUuid !== ctx.self.uuid) return [];
      if (ctx.turn % 5 !== 0) return [];
      if (!ctx.commandResult?.success || !ctx.commandResult.targetUuid) return [];
      return [
        { type: "bonus_damage", targetId: ctx.commandResult.targetUuid, amount: 5 },
      ];
    },
  },
});
