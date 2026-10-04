/**
 * Joltmink — "Static Charge"
 *
 * Every time Joltmink moves, it builds up static. After 2
 * moves, the next attack zaps the target for +5 bonus damage.
 * Speed becomes a weapon — the fastest cinderling charges up
 * with every dash.
 *
 * Hook: onAfterCommand (move to charge, attack to discharge)
 * Effect: bonus_damage +5 on discharge
 *
 * Design: Joltmink is a speedster (HP 55, ATK 8, SPD 10).
 * Max speed but low attack. Static Charge transforms that
 * speed into burst damage — 2 moves then a 13-damage strike.
 * Rewards hit-and-run playstyle: move, move, ZAP, repeat.
 */

import {
  registerPower,
  type CommandHookContext,
  type PowerEffect,
} from "../specialPowers";

let chargeCount = 0;
const CHARGE_THRESHOLD = 2;

registerPower({
  id: "static-charge",
  name: "Static Charge",
  description:
    "After 2 moves, next attack deals +5 bonus damage.",
  hooks: {
    onAfterCommand: (ctx: CommandHookContext): PowerEffect[] => {
      if (ctx.command.cinderlingUuid !== ctx.self.uuid) return [];

      if (ctx.command.type === "move") {
        chargeCount++;
        return [];
      }

      if (ctx.command.type === "attack" && chargeCount >= CHARGE_THRESHOLD) {
        chargeCount = 0;

        // Find the target
        const enemyTeam = ctx.state.teams[ctx.team === 1 ? 1 : 0];
        const target = enemyTeam.active.find((v) => !v.isKO);
        if (!target) return [];

        return [
          {
            type: "bonus_damage",
            targetId: target.uuid,
            amount: 5,
          },
        ];
      }

      return [];
    },
  },
});
