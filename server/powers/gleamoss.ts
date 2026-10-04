/**
 * Gleamoss — "Photosynthesis"
 *
 * When Gleamoss harvests, the team gains +2 bonus energy.
 * Sunlight supercharges collection.
 *
 * Hook: onAfterCommand (harvest)
 * Effect: energy +2 to team
 */

import {
  registerPower,
  type CommandHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "photosynthesis",
  name: "Photosynthesis",
  description:
    "Harvests grant +2 bonus energy.",
  hooks: {
    onAfterCommand: (ctx: CommandHookContext): PowerEffect[] => {
      if (ctx.command.type !== "harvest") return [];
      if (ctx.command.cinderlingUuid !== ctx.self.uuid) return [];
      return [{ type: "energy", team: ctx.team, amount: 2 }];
    },
  },
});
