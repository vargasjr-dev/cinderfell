/**
 * Hexaflare — "Flare Burst"
 *
 * After Hexaflare attacks, the target burns for 3 damage
 * at the start of the next turn. A delayed detonation
 * that punishes anything Hexaflare touches.
 *
 * Hook: onAfterCommand (attack) + onTurnStart (burn tick)
 * Effect: bonus_damage 3 on the burned target
 *
 * Design: Hexaflare is a glass cannon (HP 60, ATK 16, SPD 5).
 * The highest attack stat in the game so far. Flare Burst adds
 * a burn DOT on top of already devastating hits — effective
 * ATK becomes 16 + 3 = 19 per cycle. Fragile enough that
 * opponents need to burst it down before the burns stack up.
 */

import {
  registerPower,
  type CommandHookContext,
  type HookContext,
  type PowerEffect,
} from "../specialPowers";

let burnTargetId: string | null = null;

registerPower({
  id: "flare-burst",
  name: "Flare Burst",
  description:
    "After attacking, the target burns for 3 damage next turn.",
  hooks: {
    onAfterCommand: (ctx: CommandHookContext): PowerEffect[] => {
      if (ctx.command.type !== "attack") return [];
      if (ctx.command.cinderlingUuid !== ctx.self.uuid) return [];

      // Find the nearest enemy as the burn target
      const enemyTeam = ctx.state.teams[ctx.team === 1 ? 1 : 0];
      const target = enemyTeam.active.find((v) => !v.isKO);
      if (target) {
        burnTargetId = target.uuid;
      }
      return [];
    },

    onTurnStart: (ctx: HookContext): PowerEffect[] => {
      if (!burnTargetId) return [];

      // Apply burn damage to the marked target
      const targetId = burnTargetId;
      burnTargetId = null; // Burn expires after one tick

      return [
        {
          type: "bonus_damage",
          targetId,
          amount: 3,
        },
      ];
    },
  },
});
