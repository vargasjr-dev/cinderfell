/**
 * Terravex — "Bedrock Stance"
 *
 * When Terravex takes damage, it digs in — reducing its
 * speed by 1 but increasing its attack power by 2. The
 * more hits it takes, the slower and more devastating
 * it becomes. Reliable as bedrock.
 *
 * Hook: onDamaged
 * Effects: speed_mod -1, bonus_damage +2 to self
 *
 * Design: Terravex is balanced (HP 70, ATK 14, SPD 4).
 * Already the highest ATK among balanced cinderlings. Each
 * hit trades mobility for raw power — a berserker that
 * roots itself deeper. After 2 hits: ATK effectively 18
 * (matching Pyroburst) but SPD 2. The opponent must
 * choose: ignore it and let it harvest, or hit it and
 * make it a monster. Classic risk/reward.
 */

import {
  registerPower,
  type DamagedHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "bedrock_stance",
  name: "Bedrock Stance",
  description:
    "Taking damage: -1 SPD but +2 ATK.",
  hooks: {
    onDamaged: (ctx: DamagedHookContext): PowerEffect[] => {
      return [
        {
          type: "speed_mod",
          cinderlingId: ctx.self.uuid,
          amount: -1,
        },
        {
          type: "bonus_damage",
          targetId: ctx.self.uuid,
          amount: 2,
        },
      ];
    },
  },
});
