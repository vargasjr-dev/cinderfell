/**
 * Wrecktor — "Wrecking Ball"
 *
 * After Wrecktor attacks, the sheer force knocks the
 * target back — creating a block on the attacked space.
 * Pure wrecking: damage + terrain disruption.
 *
 * Hook: onAfterCommand (attack)
 * Effect: block on self's position
 *
 * Design: Wrecktor is a glass cannon (HP 58, ATK 16, SPD 4).
 * Similar concept to Thornlash (attack → block), but
 * Wrecktor has higher ATK (16 vs 17) and more HP (58 vs 55).
 * Less extreme than Thornlash — slightly more durable,
 * slightly less damage. "Built to wreck" — every attack
 * leaves destruction in its wake, reshaping the board.
 * The simplest power for the simplest philosophy: wreck.
 */

import {
  registerPower,
  type CommandHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "wrecking_ball",
  name: "Wrecking Ball",
  description:
    "Attacking creates a block on your space.",
  hooks: {
    onAfterCommand: (ctx: CommandHookContext): PowerEffect[] => {
      if (ctx.command.cinderlingUuid !== ctx.self.uuid) return [];
      if (ctx.command.type !== "attack") return [];
      if (!ctx.self.position) return [];

      return [
        {
          type: "block",
          position: ctx.self.position,
        },
      ];
    },
  },
});
