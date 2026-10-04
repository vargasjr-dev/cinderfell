/**
 * Embercub — "Inner Fire"
 *
 * When Embercub drops below 50% HP, it gains +3 ATK from sheer
 * grit. A warm little cub that fights hardest when cornered.
 *
 * Hook: onDamaged
 * Effect: bonus_damage is checked via onTurnStart for the buff,
 *   but the trigger is being below half HP — a comeback mechanic.
 *
 * Design: Embercub is balanced (HP 72, ATK 13, SPD 4). Below 36 HP
 * it effectively becomes ATK 16, turning it into a glass cannon
 * that rewards risky positioning. Pairs well with healers.
 */

import {
  registerPower,
  type HookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "inner-fire",
  name: "Inner Fire",
  description:
    "Below 50% HP, Embercub's attacks deal +3 bonus damage.",
  hooks: {
    onBeforeCommand: (ctx): PowerEffect[] => {
      // Only triggers on Embercub's own attacks
      if (!("command" in ctx)) return [];
      const cmd = (ctx as any).command;
      if (cmd.type !== "attack" || cmd.cinderlingUuid !== ctx.self.uuid) return [];

      // Check if below 50% HP
      const maxHp = ctx.self.maxHp ?? 72;
      if (ctx.self.hp > maxHp / 2) return [];

      // Find attack target — bonus damage to the first enemy in range
      // The engine applies this as extra damage on the attack
      return [
        {
          type: "bonus_damage",
          targetId: cmd.targetId ?? ctx.self.uuid, // Engine fills targetId
          amount: 3,
        },
      ];
    },
  },
});
