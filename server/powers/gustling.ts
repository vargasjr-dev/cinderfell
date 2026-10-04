/**
 * Gustling — "Breeze Trail"
 *
 * After Gustling moves, it leaves a breeze on the space it
 * departed from. The breeze lasts 2 turns and slows enemies.
 *
 * Hook: onAfterCommand (move)
 * Effect: space_effect on the departed position
 *
 * Design: Gustling is a speedster (HP 55, ATK 10, SPD 9).
 * Near-max speed with moderate attack and fragile HP.
 * Breeze Trail turns movement into area denial — every time
 * Gustling repositions, it leaves hazards behind. Perfect for
 * controlling the board while staying mobile and unpredictable.
 */

import {
  registerPower,
  type CommandHookContext,
  type PowerEffect,
} from "../specialPowers";

let lastPosition: { x: number; y: number } | null = null;

registerPower({
  id: "breeze-trail",
  name: "Breeze Trail",
  description:
    "After moving, leaves a breeze on the departed space (2 turns).",
  hooks: {
    onAfterCommand: (ctx: CommandHookContext): PowerEffect[] => {
      if (ctx.command.type !== "move") return [];
      if (ctx.command.cinderlingUuid !== ctx.self.uuid) return [];

      // If we had a previous position, leave a breeze there
      if (lastPosition) {
        const effect: PowerEffect = {
          type: "space_effect",
          position: { x: lastPosition.x, y: lastPosition.y },
          effectName: "breeze",
          duration: 2,
        };
        lastPosition = ctx.self.position
          ? { x: ctx.self.position.x, y: ctx.self.position.y }
          : null;
        return [effect];
      }

      // First move — just record position, no trail yet
      lastPosition = ctx.self.position
        ? { x: ctx.self.position.x, y: ctx.self.position.y }
        : null;
      return [];
    },
  },
});
