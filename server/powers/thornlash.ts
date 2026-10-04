/**
 * Thornlash — "Thorn Reach"
 *
 * After Thornlash attacks, its whip-like thorns lash
 * out at the space it attacked from range, leaving a
 * block effect on Thornlash's own position. The thorns
 * create temporary cover, making it harder for enemies
 * to close in after Thornlash strikes.
 *
 * Hook: onAfterCommand (attack)
 * Effect: block on own position
 *
 * Design: Thornlash is a glass cannon (HP 55, ATK 17, SPD 5).
 * Third-highest ATK in the game. The block after attacking
 * creates defensive terrain — a glass cannon that fortifies
 * its position after each strike. Different from other glass
 * cannons: Pyroburst trades self-HP, Shrednova drains energy,
 * Thornlash blocks space. Devastating reach + area denial.
 */

import {
  registerPower,
  type CommandHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "thorn_reach",
  name: "Thorn Reach",
  description:
    "Attacking creates a block on Thornlash's position.",
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
