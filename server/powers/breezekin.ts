/**
 * Breezekin — "Tailwind"
 *
 * When Breezekin moves, its next attack deals +3 bonus damage.
 * Wind at your back. Position into power.
 *
 * Hook: onAfterCommand (move)
 * Effect: speed_mod +2 on self (positional advantage proxy)
 */

import {
  registerPower,
  type CommandHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "tailwind",
  name: "Tailwind",
  description:
    "After moving, gains +2 SPD.",
  hooks: {
    onAfterCommand: (ctx: CommandHookContext): PowerEffect[] => {
      if (ctx.command.type !== "move") return [];
      return [{ type: "speed_mod", cinderlingId: ctx.self.uuid, amount: 2 }];
    },
  },
});
