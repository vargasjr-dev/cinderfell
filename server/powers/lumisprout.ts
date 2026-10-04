/**
 * Lumisprout — "Bioluminescence"
 *
 * At the start of each turn, Lumisprout heals all active
 * allies for 1 HP. A gentle passive glow that sustains the
 * whole team over time.
 *
 * Hook: onTurnStart
 * Effect: heal 1 HP to each active ally (including self)
 *
 * Design: Lumisprout is a support (HP 85, ATK 9, SPD 6).
 * Tanky for a support with the highest HP in its class.
 * Bioluminescence is subtle but powerful — 1 HP per ally
 * per turn adds up fast with 4 active cinderlings (4 HP/turn
 * total team healing). The longer the game goes, the more
 * value Lumisprout provides. Kill it early or get outsustained.
 */

import {
  registerPower,
  type HookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "bioluminescence",
  name: "Bioluminescence",
  description:
    "At turn start, heals all active allies for 1 HP.",
  hooks: {
    onTurnStart: (ctx: HookContext): PowerEffect[] => {
      const myTeam = ctx.state.teams[ctx.team === 1 ? 0 : 1];
      const alive = myTeam.active.filter((v) => !v.isKO && v.hp < v.maxHp);

      return alive.map((v) => ({
        type: "heal" as const,
        targetId: v.uuid,
        amount: 1,
      }));
    },
  },
});
