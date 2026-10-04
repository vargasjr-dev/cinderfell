/**
 * Mosswall — "Regrowth"
 *
 * At the end of each turn, Mosswall regenerates 3 HP. The
 * moss slowly grows back, patching any damage. A wall that
 * heals itself — try to outdamage the regen.
 *
 * Hook: onTurnEnd
 * Effect: heal self 3 HP
 *
 * Design: Mosswall is a pure tank (HP 100, ATK 10, SPD 3).
 * Max HP tied with Grumblix but much less aggressive. Regrowth
 * makes it nearly unkillable if left alone — 3 HP/turn regen
 * on a 100 HP pool means opponents need to commit serious
 * damage to bring it down. The slowest non-Grumblix cinderling
 * at SPD 3, it anchors a position and refuses to die.
 */

import {
  registerPower,
  type HookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "regrowth",
  name: "Regrowth",
  description:
    "Regenerates 3 HP at end of turn.",
  hooks: {
    onTurnEnd: (ctx: HookContext): PowerEffect[] => {
      if (ctx.self.hp <= 0) return [];
      if (ctx.self.hp >= ctx.self.maxHp) return [];

      return [
        {
          type: "heal",
          targetId: ctx.self.uuid,
          amount: 3,
        },
      ];
    },
  },
});
