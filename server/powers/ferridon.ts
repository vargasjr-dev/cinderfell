/**
 * Ferridon — "Rust Aura"
 *
 * When Ferridon takes damage, the attacker's speed is reduced
 * by 1. Iron rusts everything it touches.
 *
 * Hook: onDamaged
 * Effect: speed_mod -1 on the attacker
 */

import {
  registerPower,
  type DamagedHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "rust-aura",
  name: "Rust Aura",
  description:
    "When hit, the attacker loses 1 SPD.",
  hooks: {
    onDamaged: (ctx: DamagedHookContext): PowerEffect[] => {
      if (ctx.damage <= 0 || !ctx.attacker) return [];
      return [
        { type: "speed_mod", cinderlingId: ctx.attacker.uuid, amount: -1 },
      ];
    },
  },
});
