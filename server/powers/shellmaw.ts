/**
 * Shellmaw — "Iron Shell"
 *
 * When Shellmaw takes damage, the shell absorbs 2 points of
 * it. The impenetrable shell reduces all incoming damage.
 * Combined with 108 HP, Shellmaw is nearly unkillable.
 *
 * Hook: onDamaged
 * Effect: heal self 2 HP (effectively -2 damage taken)
 *
 * Design: Shellmaw is THE ultimate tank (HP 108, ATK 10,
 * SPD 2). Highest HP in the entire game. Slowest cinderling
 * at SPD 2. Iron Shell heals 2 on every hit — effectively
 * making that 108 HP pool even deeper. At ATK 10 it's not
 * a threat offensively, but good luck killing it. The
 * massive jaw hidden inside means it CAN bite back if you
 * give it time. Mosswall regens, Shellmaw absorbs.
 */

import {
  registerPower,
  type DamagedHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "iron_shell",
  name: "Iron Shell",
  description:
    "Takes 2 less damage from every hit.",
  hooks: {
    onDamaged: (ctx: DamagedHookContext): PowerEffect[] => {
      return [
        {
          type: "heal",
          targetId: ctx.self.uuid,
          amount: 2,
        },
      ];
    },
  },
});
