/**
 * Skidmark — "Friction Burn"
 *
 * After Skidmark moves, it leaves a scorch mark on the
 * departed space. Enemies on scorch marks take 2 damage
 * at the start of each turn.
 *
 * Hook: onAfterCommand (move)
 * Effect: space_effect "scorch" on departed position, duration 2
 *
 * Design: Skidmark is a speedster (HP 58, ATK 10, SPD 8).
 * Balanced attack for a speedster. Friction Burn is area
 * denial through damage (unlike Quicksilk's speed-reducing
 * webs). Scorch marks last 2 turns and threaten anyone
 * standing on them. Skidmark zooms around leaving a trail
 * of fire — the battlefield becomes increasingly dangerous
 * the longer it lives.
 */

import {
  registerPower,
  type CommandHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "friction_burn",
  name: "Friction Burn",
  description:
    "Moving leaves a scorch mark for 2 turns. Enemies on scorches take damage.",
  hooks: {
    onAfterCommand: (ctx: CommandHookContext): PowerEffect[] => {
      if (ctx.command.cinderlingUuid !== ctx.self.uuid) return [];
      if (ctx.command.type !== "move") return [];
      if (!ctx.self.position) return [];

      return [
        {
          type: "space_effect",
          position: ctx.self.position,
          effectName: "scorch",
          duration: 2,
        },
      ];
    },
  },
});
