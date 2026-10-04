/**
 * Scoopuff — "Cheek Pouch"
 *
 * When Scoopuff harvests, it scoops extra energy into its
 * fluffy cheek pouches — gaining +2 bonus energy on top of
 * the normal harvest amount.
 *
 * Hook: onAfterCommand (harvest)
 * Effect: energy +2 to team
 *
 * Design: Scoopuff is a support (HP 73, ATK 8, SPD 8). Fast
 * for a support, decent survivability. Cheek Pouch doubles
 * down on the harvesting role — each harvest gives +2 bonus
 * energy, making Scoopuff the best pure harvester. Similar to
 * Gleamoss (+2 harvest bonus) but Scoopuff is faster (SPD 8
 * vs 8) and tankier (HP 73 vs 65). The fluffy cheeks hold
 * more than they should.
 */

import {
  registerPower,
  type CommandHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "cheek_pouch",
  name: "Cheek Pouch",
  description:
    "Harvesting gives +2 bonus energy.",
  hooks: {
    onAfterCommand: (ctx: CommandHookContext): PowerEffect[] => {
      if (ctx.command.cinderlingUuid !== ctx.self.uuid) return [];
      if (ctx.command.type !== "harvest") return [];

      return [
        {
          type: "energy",
          team: ctx.team,
          amount: 2,
        },
      ];
    },
  },
});
