/**
 * Magmorus — "Meltdown"
 *
 * When Magmorus attacks, it also takes 3 self-damage from its
 * own molten core destabilizing. The thin rocky shell cracks
 * with every strike.
 *
 * Hook: onAfterCommand (attack)
 * Effect: bonus_damage 3 to self
 *
 * Design: Magmorus is THE ultimate glass cannon (HP 48, ATK 19,
 * SPD 4). Highest attack stat in the entire game but lowest HP
 * among glass cannons and brutally slow. Meltdown adds a
 * self-destruct timer — each attack costs 3 HP, meaning
 * Magmorus can attack roughly 16 times before KO'ing itself.
 * In practice, 2-3 devastating hits before it melts down.
 * Pure burst damage that demands precise positioning.
 */

import {
  registerPower,
  type CommandHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "meltdown",
  name: "Meltdown",
  description:
    "Attacking deals 3 self-damage.",
  hooks: {
    onAfterCommand: (ctx: CommandHookContext): PowerEffect[] => {
      if (ctx.command.type !== "attack") return [];
      if (ctx.command.cinderlingUuid !== ctx.self.uuid) return [];

      return [
        {
          type: "bonus_damage",
          targetId: ctx.self.uuid,
          amount: 3,
        },
      ];
    },
  },
});
