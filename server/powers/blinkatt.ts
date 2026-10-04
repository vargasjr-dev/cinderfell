/**
 * Blinkatt — "Phase Dodge"
 *
 * Once per match, the first attack that would KO Blinkatt instead
 * leaves it at 1 HP. It phased through reality at the last second.
 *
 * Mechanics:
 * - Triggers in onDamaged when self.hp drops to 0
 * - Heals back to 1 HP and sets powerState.phaseDodgeUsed = 1 so it
 *   can never trigger again in the same match
 * - Completely passive — no energy cost, no timing requirement
 *
 * Hook: onDamaged (lethal hit only, once per match)
 * Effects: heal +1 self, set_power_state phaseDodgeUsed=1
 */

import {
  registerPower,
  type DamagedHookContext,
  type PowerEffect,
} from "../specialPowers";

registerPower({
  id: "phase-shift",
  name: "Phase Dodge",
  description: "Once per match, survive a KO hit at 1 HP instead.",
  hooks: {
    onDamaged: (ctx: DamagedHookContext): PowerEffect[] => {
      // Only trigger on lethal damage
      if (ctx.self.hp > 0) return [];
      // Only trigger once
      if (ctx.self.powerState?.phaseDodgeUsed) return [];

      return [
        { type: "heal", targetId: ctx.self.uuid, amount: 1 },
        {
          type: "set_power_state",
          cinderlingId: ctx.self.uuid,
          key: "phaseDodgeUsed",
          value: 1,
        },
      ];
    },
  },
});
