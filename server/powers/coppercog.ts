/**
 * Coppercog — "Gear Grind"
 *
 * Each consecutive attack Coppercog lands winds up its gears for +2 more
 * bonus damage on the next, stacking up to +8. Moving or harvesting resets
 * the chain back to zero.
 *
 *   1st consecutive attack: +2 bonus
 *   2nd consecutive attack: +4 bonus
 *   3rd consecutive attack: +6 bonus
 *   4th+ consecutive attack: +8 bonus (cap)
 *
 * Hook: onAfterCommand
 * Effect: bonus_damage to the hit target (scales with chain depth)
 *         powerState.gearGrind tracks the current chain depth (0–4)
 *
 * Design: Coppercog (HP 80, ATK 12, SPD 4) rewards commitment.
 * A patient Coppercog that keeps attacking snowballs hard; an opponent
 * who forces it to reposition resets the advantage. The gears need time
 * to spin up, so it pairs well with a team that can stall or cover its flanks.
 */

import {
  registerPower,
  type CommandHookContext,
  type PowerEffect,
} from "../specialPowers";

const GEAR_GRIND_KEY = "gearGrind";
const MAX_STACK = 4;

registerPower({
  id: "gear_grind",
  name: "Gear Grind",
  description:
    "Each consecutive attack deals +2 more bonus damage (up to +8). Moving or harvesting resets the chain.",
  hooks: {
    onAfterCommand: (ctx: CommandHookContext): PowerEffect[] => {
      if (ctx.command.cinderlingUuid !== ctx.self.uuid) return [];

      // Move or harvest → reset the chain, no effect
      if (ctx.command.type === "move" || ctx.command.type === "harvest") {
        if (ctx.self.powerState) {
          ctx.self.powerState[GEAR_GRIND_KEY] = 0;
        }
        return [];
      }

      if (ctx.command.type !== "attack") return [];

      // Advance the chain counter
      const prevStack = ctx.self.powerState?.[GEAR_GRIND_KEY] ?? 0;
      const newStack = Math.min(prevStack + 1, MAX_STACK);
      if (!ctx.self.powerState) ctx.self.powerState = {};
      ctx.self.powerState[GEAR_GRIND_KEY] = newStack;

      // No hit (whiff) — chain advances but no bonus to apply
      const targetUuid = ctx.commandResult?.targetUuid;
      if (!targetUuid) return [];

      const bonus = newStack * 2; // +2, +4, +6, +8
      return [{ type: "bonus_damage", targetId: targetUuid, amount: bonus }];
    },
  },
});
