/**
 * Pyroburst — "Volatile Core"
 *
 * After Pyroburst attacks, it takes 2 self-damage from the
 * explosive recoil as it reassembles. But each attack also
 * costs 1 less energy (cost_mod) — the explosion is so
 * efficient it barely takes energy to detonate.
 *
 * Hook: onAfterCommand (attack)
 * Effects: cost_mod -1 to self, bonus_damage 2 to self
 *
 * Design: Pyroburst is a glass cannon (HP 52, ATK 18, SPD 4).
 * Second-highest ATK in the game (behind Magmorus at 19).
 * Volatile Core is a dual-edged sword: attacks are cheaper
 * (-1 energy cost) but the explosion damages Pyroburst too
 * (2 self-damage). Compared to Magmorus (3 self-damage, no
 * upside), Pyroburst trades less self-harm for an energy
 * efficiency boost. Two flavors of self-destruction.
 */

import {
  registerPower,
  type CommandHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "volatile_core",
  name: "Volatile Core",
  description:
    "Attacks cost 1 less energy but deal 2 self-damage.",
  hooks: {
    onAfterCommand: (ctx: CommandHookContext): PowerEffect[] => {
      if (ctx.command.cinderlingUuid !== ctx.self.uuid) return [];
      if (ctx.command.type !== "attack") return [];

      return [
        {
          type: "cost_mod",
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
