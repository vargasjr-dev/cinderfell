/**
 * Shrednova — "Reality Shred"
 *
 * When Shrednova attacks, the reality-shredding claws also
 * drain 1 energy from the opponent. Each strike tears at
 * both health and the enemy's energy economy.
 *
 * Hook: onAfterCommand (attack)
 * Effect: energy -1 to enemy team
 *
 * Design: Shrednova is a glass cannon (HP 50, ATK 18, SPD 5).
 * Tied with Pyroburst for 2nd-highest ATK, but Shrednova has
 * no self-damage — instead it drains enemy energy. Terrifying
 * offensive pressure: high damage + economy disruption. The
 * catch is HP 50 (among the lowest) — one focused attack and
 * Shrednova shatters. Glass-cannon purity.
 */

import {
  registerPower,
  type CommandHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "reality_shred",
  name: "Reality Shred",
  description:
    "Attacks drain 1 energy from the opponent.",
  hooks: {
    onAfterCommand: (ctx: CommandHookContext): PowerEffect[] => {
      if (ctx.command.cinderlingUuid !== ctx.self.uuid) return [];
      if (ctx.command.type !== "attack") return [];

      const enemyTeam = ctx.team === 1 ? 2 : 1;
      return [
        {
          type: "energy",
          team: enemyTeam as 1 | 2,
          amount: -1,
        },
      ];
    },
  },
});
