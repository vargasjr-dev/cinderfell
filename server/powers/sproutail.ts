/**
 * Sproutail — "Regrowth Tail"
 *
 * After Sproutail harvests, its tail sprouts — healing
 * itself for 3 HP. A self-sustaining support that stays
 * alive through economy play.
 *
 * Hook: onAfterCommand (harvest)
 * Effect: heal 3 HP to self
 *
 * Design: Sproutail is a support (HP 78, ATK 7, SPD 6).
 * Unlike Scoopuff (harvest → team energy) or Nectarb
 * (passive energy gen), Sproutail pairs harvesting with
 * self-sustain. It contributes to the team economy while
 * keeping itself alive — the harvester that won't die.
 * Low ATK means it's not a threat, but good luck KO'ing
 * it while it keeps regrowing.
 */

import {
  registerPower,
  type CommandHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "regrowth_tail",
  name: "Regrowth Tail",
  description:
    "Harvesting heals Sproutail for 3 HP.",
  hooks: {
    onAfterCommand: (ctx: CommandHookContext): PowerEffect[] => {
      if (ctx.command.cinderlingUuid !== ctx.self.uuid) return [];
      if (ctx.command.type !== "harvest") return [];

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
