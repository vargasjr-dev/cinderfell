/**
 * Quicksilk — "Web Trap"
 *
 * After Quicksilk moves, it leaves a sticky silk web on the
 * space it departed. Enemies stepping on webs lose 2 SPD.
 *
 * Hook: onAfterCommand (move)
 * Effect: space_effect "web" on departed position, duration 3
 *
 * Design: Quicksilk is a speedster (HP 60, ATK 9, SPD 9).
 * Very fast with moderate ATK. Web Trap is area denial —
 * Quicksilk zooms around the board leaving sticky webs that
 * slow anyone who walks through them. Combined with Gustling's
 * Breeze Trail (similar space_effect), the board becomes a
 * minefield of movement modifiers. Quicksilk controls space
 * while Gustling controls air — two speedster styles.
 */

import {
  registerPower,
  type CommandHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "web_trap",
  name: "Web Trap",
  description:
    "Moving leaves a sticky web on departed space. Enemies lose 2 SPD on webs.",
  hooks: {
    onAfterCommand: (ctx: CommandHookContext): PowerEffect[] => {
      if (ctx.command.cinderlingUuid !== ctx.self.uuid) return [];
      if (ctx.command.type !== "move") return [];

      if (!ctx.self.position) return [];

      return [
        {
          type: "space_effect",
          position: ctx.self.position,
          effectName: "web",
          duration: 3,
        },
      ];
    },
  },
});
