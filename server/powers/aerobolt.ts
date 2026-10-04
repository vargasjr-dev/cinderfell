/**
 * Aerobolt — "Shockwave Trail"
 *
 * After Aerobolt moves, the shockwave it leaves behind deals 2 chip
 * damage to every enemy standing on an adjacent tile. Zip through
 * enemy formations and they pay for standing in your wake.
 *
 * Hook: onAfterCommand (move only, self only)
 * Effect: bonus_damage +2 on each adjacent enemy (up to 4 directions)
 *
 * Design: Aerobolt is a speedster (SPD 8) — it moves often and
 * repositions aggressively. Shockwave Trail turns every move into
 * passive area denial. Stack multiple moves across turns to whittle
 * tightly-grouped opponents without spending energy on attacks.
 * Synergizes with Snipe (range 2) — reposition for a safe angle,
 * deal trail damage in the process, then fire from distance.
 */

import {
  registerPower,
  type CommandHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "shockwave-surfer",
  name: "Shockwave Trail",
  description:
    "After moving, deals 2 damage to each enemy on an adjacent tile.",
  hooks: {
    onAfterCommand: (ctx: CommandHookContext): PowerEffect[] => {
      if (ctx.command.cinderlingUuid !== ctx.self.uuid) return [];
      if (ctx.command.type !== "move") return [];
      if (!ctx.commandResult?.success) return [];

      const pos = ctx.self.position;
      if (!pos) return [];

      const enemyTeamId = ctx.team === 1 ? 2 : 1;
      const enemyTeam = ctx.state.teams.find((t) => t.id === enemyTeamId);
      if (!enemyTeam) return [];

      const adjacentOffsets = [
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
      ];

      const effects: PowerEffect[] = [];
      for (const { dx, dy } of adjacentOffsets) {
        const nx = pos.x + dx;
        const ny = pos.y + dy;
        const hit = enemyTeam.active.find(
          (v) => !v.isKO && v.position?.x === nx && v.position?.y === ny,
        );
        if (hit) {
          effects.push({ type: "bonus_damage", targetId: hit.uuid, amount: 2 });
        }
      }

      return effects;
    },
  },
});
