/**
 * Humbloom — "Zen Harvest"
 *
 * When Humbloom harvests, it also heals the lowest-HP ally
 * for 3 HP. The hum resonates with teammates.
 *
 * Hook: onAfterCommand (harvest)
 * Effect: heal 3 HP to lowest-HP active ally
 *
 * Design: Humbloom is a support (HP 72, ATK 7, SPD 7).
 * Balanced stats with low attack. Zen Harvest turns the
 * economy action (harvesting for energy) into a dual-purpose
 * move — energy + healing. Teams with Humbloom can sustain
 * longer, making it a linchpin for Accumulation wins.
 */

import {
  registerPower,
  type CommandHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "zen-harvest",
  name: "Zen Harvest",
  description:
    "Harvesting also heals the lowest-HP ally for 3 HP.",
  hooks: {
    onAfterCommand: (ctx: CommandHookContext): PowerEffect[] => {
      if (ctx.command.type !== "harvest") return [];
      if (ctx.command.cinderlingUuid !== ctx.self.uuid) return [];

      // Find the lowest-HP active ally (including self)
      const myTeam = ctx.state.teams[ctx.team === 1 ? 0 : 1];
      const alive = myTeam.active.filter((v) => !v.isKO && v.hp < v.maxHp);
      if (alive.length === 0) return [];

      const lowest = alive.reduce((a, b) => (a.hp < b.hp ? a : b));

      return [
        {
          type: "heal",
          targetId: lowest.uuid,
          amount: 3,
        },
      ];
    },
  },
});
