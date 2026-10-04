/**
 * Dashpaw — "Phantom Sprint"
 *
 * After attacking, Dashpaw gains +3 SPD — hit-and-run mobility.
 * Strike then reposition before the enemy can retaliate.
 *
 * Hook: onAfterCommand (attack)
 * Effect: speed_mod +3 on self
 */

import {
  registerPower,
  type CommandHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "phantom-sprint",
  name: "Phantom Sprint",
  description:
    "After attacking, gains +3 SPD.",
  hooks: {
    onAfterCommand: (ctx: CommandHookContext): PowerEffect[] => {
      if (ctx.command.type !== "attack") return [];
      return [{ type: "speed_mod", cinderlingId: ctx.self.uuid, amount: 3 }];
    },
  },
});
