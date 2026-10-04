/**
 * Glintpaw — "Flash Strike"
 *
 * Every 3rd attack deals +4 bonus damage. The paws charge
 * up with each strike and release a blinding flash.
 *
 * Hook: onBeforeCommand
 * Effect: bonus damage +4 on every 3rd attack
 *
 * Design: Glintpaw is balanced (HP 85, ATK 10, SPD 5). Solid
 * all-around stats with a rhythmic power spike. Players who
 * track the cycle can time big attacks for maximum impact.
 * Rewards consistent aggression over hit-and-run.
 */

import {
  registerPower,
  type CommandHookContext,
  type PowerEffect,
} from "../specialPowers";

let attackCount = 0;

registerPower({
  id: "flash-strike",
  name: "Flash Strike",
  description:
    "Every 3rd attack deals +4 bonus damage.",
  hooks: {
    onBeforeCommand: (ctx: CommandHookContext): PowerEffect[] => {
      if (ctx.command.type !== "attack") return [];
      if (ctx.command.cinderlingUuid !== ctx.self.uuid) return [];

      attackCount++;

      if (attackCount % 3 === 0) {
        // Find nearest enemy target
        const enemyTeam = ctx.state.teams[ctx.team === 1 ? 1 : 0];
        const target = enemyTeam.active.find((v) => !v.isKO);
        if (!target) return [];

        return [
          {
            type: "bonus_damage",
            targetId: target.uuid,
            amount: 4,
          },
        ];
      }

      return [];
    },
  },
});
