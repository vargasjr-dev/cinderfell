/**
 * Tundrak — "Permafrost"
 *
 * When Tundrak moves, it freezes the ground behind it —
 * leaving a "frost" space effect on its departed position
 * for 2 turns. Enemies on frost lose speed.
 *
 * Hook: onAfterCommand (move)
 * Effect: space_effect "frost" on departed position, duration 2
 *
 * Design: Tundrak is a tank (HP 105, ATK 9, SPD 2).
 * Third-highest HP in the game. Slow but massive. Permafrost
 * creates area denial through slowing — unlike Skidmark's
 * scorch (damage) or Quicksilk's webs (speed reduction),
 * Tundrak's frost is thematic slow-terrain left by a
 * glacial tank. Even at SPD 2, every move it makes
 * reshapes the battlefield.
 */

import {
  registerPower,
  type CommandHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "permafrost",
  name: "Permafrost",
  description:
    "Moving freezes the departed space for 2 turns.",
  hooks: {
    onAfterCommand: (ctx: CommandHookContext): PowerEffect[] => {
      if (ctx.command.cinderlingUuid !== ctx.self.uuid) return [];
      if (ctx.command.type !== "move") return [];
      if (!ctx.self.position) return [];

      return [
        {
          type: "space_effect",
          position: ctx.self.position,
          effectName: "frost",
          duration: 2,
        },
      ];
    },
  },
});
