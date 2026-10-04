/**
 * Cosmog — "Dark Matter"
 *
 * When Cosmog attacks, it deals bonus damage equal to its missing HP ÷ 15
 * (floored). The more battered it is, the harder it strikes back.
 *
 * Examples (base HP 90):
 *   0 HP missing  → +0
 *   15 HP missing → +1
 *   30 HP missing → +2
 *   45 HP missing → +3
 *   60 HP missing → +4
 *   75 HP missing → +5
 *   89 HP missing → +5 (just before KO)
 *
 * Hook: onAfterCommand (attack, self only, successful hit)
 * Effect: bonus_damage on the attack target
 */

import {
  registerPower,
  type CommandHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "warp-strike",
  name: "Dark Matter",
  description:
    "When attacking, deals bonus damage equal to missing HP ÷ 15.",
  hooks: {
    onAfterCommand: (ctx: CommandHookContext): PowerEffect[] => {
      if (ctx.command.type !== "attack") return [];
      if (ctx.command.cinderlingUuid !== ctx.self.uuid) return [];
      if (!ctx.commandResult?.success || !ctx.commandResult.targetUuid) return [];

      const missingHp = ctx.self.maxHp - ctx.self.hp;
      const bonus = Math.floor(missingHp / 15);
      if (bonus <= 0) return [];

      return [
        { type: "bonus_damage", targetId: ctx.commandResult.targetUuid, amount: bonus },
      ];
    },
  },
});
