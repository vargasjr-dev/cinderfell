/**
 * Toxiblast — "Toxic Residue"
 *
 * After Toxiblast attacks, it leaves toxic residue on the
 * target's space — a poison space effect that lingers for
 * 3 turns. Enemies walking through or standing on it take
 * damage.
 *
 * Hook: onAfterCommand (attack)
 * Effect: space_effect "poison" on self's position, duration 3
 *
 * Design: Toxiblast is a glass cannon (HP 70, ATK 15, SPD 4).
 * Higher HP than most glass cannons — more of a durable
 * damage dealer. Toxic Residue adds area denial on top of
 * raw damage. Unlike Quicksilk (webs slow) or Skidmark
 * (scorch burns), poison is a lingering damage threat.
 * Attack → poison the space you're standing on → move away.
 * Battlefield control through contamination.
 */

import {
  registerPower,
  type CommandHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "toxic_residue",
  name: "Toxic Residue",
  description:
    "Attacking leaves poison on your space for 3 turns.",
  hooks: {
    onAfterCommand: (ctx: CommandHookContext): PowerEffect[] => {
      if (ctx.command.cinderlingUuid !== ctx.self.uuid) return [];
      if (ctx.command.type !== "attack") return [];
      if (!ctx.self.position) return [];

      return [
        {
          type: "space_effect",
          position: ctx.self.position,
          effectName: "poison",
          duration: 3,
        },
      ];
    },
  },
});
