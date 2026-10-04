/**
 * Flicktail — "Evasive Flick"
 *
 * After moving, blocks the space Flicktail lands on.
 * Keep moving, stay alive.
 *
 * Hook: onAfterCommand (move)
 * Effect: block on current position
 */

import {
  registerPower,
  type CommandHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "evasive-flick",
  name: "Evasive Flick",
  description:
    "After moving, blocks the next attack targeting this space.",
  hooks: {
    onAfterCommand: (ctx: CommandHookContext): PowerEffect[] => {
      if (ctx.command.type !== "move") return [];
      if (ctx.command.cinderlingUuid !== ctx.self.uuid) return [];
      const pos = ctx.self.position;
      if (!pos) return [];
      return [{ type: "block", position: { x: pos.x, y: pos.y } }];
    },
  },
});
