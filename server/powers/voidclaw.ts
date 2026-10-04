/**
 * Voidclaw — "Void Rend"
 *
 * After Voidclaw attacks, its void portals drain 2 energy
 * from the opponent team. Each strike tears through
 * dimensions, hitting both health and economy.
 *
 * Hook: onAfterCommand (attack)
 * Effect: energy -2 to enemy team
 *
 * Design: Voidclaw is a glass cannon (HP 37, ATK 17, SPD 5).
 * Among the lowest HP in the game combined with very high ATK.
 * Void Rend drains 2 energy per attack — double Shrednova's drain.
 * A single Voidclaw attack is devastating: 17 damage + 2 energy loss.
 * But at 37 HP, one good hit ends it. High risk, high reward.
 */

import {
  registerPower,
  type CommandHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "void_rend",
  name: "Void Rend",
  description:
    "Attacks drain 2 energy from the opponent.",
  hooks: {
    onAfterCommand: (ctx: CommandHookContext): PowerEffect[] => {
      if (ctx.command.cinderlingUuid !== ctx.self.uuid) return [];
      if (ctx.command.type !== "attack") return [];

      const enemyTeam = ctx.team === 1 ? 2 : 1;
      return [
        {
          type: "energy",
          team: enemyTeam as 1 | 2,
          amount: -2,
        },
      ];
    },
  },
});
