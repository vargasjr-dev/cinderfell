/**
 * Barrikade — "Iron Curtain"
 *
 * When Barrikade is attacked, the attacker loses 2 SPD next turn.
 * Hit the wall, slow down.
 *
 * Hook: onDamaged
 * Effect: speed_mod attacker SPD -2
 */

import {
  registerPower,
  type DamagedHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "iron-curtain",
  name: "Iron Curtain",
  description:
    "When attacked, the attacker loses 2 SPD next turn.",
  hooks: {
    onDamaged: (ctx: DamagedHookContext): PowerEffect[] => {
      if (ctx.damage <= 0 || !ctx.attacker) return [];
      return [
        { type: "speed_mod", cinderlingId: ctx.attacker.uuid, amount: -2 },
      ];
    },
  },
});
