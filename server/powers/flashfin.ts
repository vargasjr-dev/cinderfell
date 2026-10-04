/**
 * Flashfin — "Blinding Dash"
 *
 * After Flashfin attacks, the target loses 2 SPD for the next
 * turn. The flash from its acceleration leaves opponents dazed.
 *
 * Hook: onAfterCommand
 * Effect: speed_mod -2 on the attack target
 *
 * Design: Flashfin is a speedster (HP 62, ATK 8, SPD 9). Fragile
 * but blindingly fast. Blinding Dash compounds its speed advantage
 * by slowing targets — hit and run, then hit again before they
 * recover. The ultimate skirmisher.
 */

import {
  registerPower,
  type CommandHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "blinding-dash",
  name: "Blinding Dash",
  description:
    "After attacking, the target loses 2 SPD next turn.",
  hooks: {
    onAfterCommand: (ctx: CommandHookContext): PowerEffect[] => {
      // Only triggers on Flashfin's own attacks
      if (ctx.command.type !== "attack") return [];
      if (ctx.command.cinderlingUuid !== ctx.self.uuid) return [];

      // Slow the target
      const targetId = (ctx.command as any).targetId;
      if (!targetId) return [];

      return [
        {
          type: "speed_mod",
          cinderlingId: targetId,
          amount: -2,
        },
      ];
    },
  },
});
