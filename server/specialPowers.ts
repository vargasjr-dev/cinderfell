/**
 * Special Power Hook System
 *
 * Each cinderling can have an optional special power that triggers at specific
 * points during turn resolution. Powers are defined as hook functions that
 * receive game state and return modifications.
 *
 * Hook Points (in resolution order):
 *   1. onTurnStart     — Before any commands resolve (e.g. passive regen)
 *   2. onBeforeCommand — Before a specific command resolves (e.g. cost reduction)
 *   3. onAfterCommand  — After a specific command resolves (e.g. bonus effects)
 *   4. onKnockout      — When this cinderling KOs an opponent (e.g. energy steal)
 *   5. onDamaged       — When this cinderling takes damage (e.g. thorns)
 *   6. onTurnEnd       — After all commands resolve (e.g. area effects)
 *
 * Design Philosophy:
 *   - Powers modify the game state through returned effect objects, not direct mutation
 *   - Each power is small and testable in isolation
 *   - The engine calls hooks at the right time — powers don't need to know about resolution order
 *   - Powers are optional — cinderlings without one are still valid
 */

import type { CinderlingState, Position, GameState, Vec2 } from "./types";

/** Minimal command reference for hooks */
export type CommandRef = {
  type: "move" | "attack" | "harvest";
  /** UUID of the cinderling executing this command (matches Command.cinderlingUuid) */
  cinderlingUuid: string;
  /** Cardinal unit vector in game space. Absent for some legacy hook contexts. */
  vec?: Vec2;
};

// ─── Effect Types ────────────────────────────────────────────────────────────

/** Heal a cinderling */
export type HealEffect = {
  type: "heal";
  targetId: string;
  amount: number;
};

/** Deal bonus damage */
export type BonusDamageEffect = {
  type: "bonus_damage";
  targetId: string;
  amount: number;
};

/** Modify energy */
export type EnergyEffect = {
  type: "energy";
  team: 1 | 2;
  amount: number; // positive = gain, negative = drain
};

/** Modify command cost */
export type CostModEffect = {
  type: "cost_mod";
  cinderlingId: string;
  amount: number; // negative = cheaper
};

/** Modify speed for this turn */
export type SpeedModEffect = {
  type: "speed_mod";
  cinderlingId: string;
  amount: number;
};

/** Apply a status to a space (e.g. "hazard", "slow zone") */
export type SpaceEffect = {
  type: "space_effect";
  position: Position;
  effectName: string;
  duration: number; // turns
};

/** Block movement into a position */
export type BlockEffect = {
  type: "block";
  position: Position;
};

/** Persist a numeric value to a cinderling's powerState record */
export type SetPowerStateEffect = {
  type: "set_power_state";
  cinderlingId: string;
  key: string;
  value: number;
};

export type PowerEffect =
  | HealEffect
  | BonusDamageEffect
  | EnergyEffect
  | CostModEffect
  | SpeedModEffect
  | SpaceEffect
  | BlockEffect
  | SetPowerStateEffect;

// ─── Hook Context ────────────────────────────────────────────────────────────

export type HookContext = {
  /** The cinderling with this power */
  self: CinderlingState;
  /** Which team this cinderling is on */
  team: 1 | 2;
  /** Full game state (read-only for hooks) */
  state: Readonly<GameState>;
  /** Current turn number */
  turn: number;
};

export type CommandHookContext = HookContext & {
  /** The command being resolved */
  command: CommandRef;
  /**
   * The result of the resolved command — available in onAfterCommand hooks.
   * Lets powers know whether the attack hit, how much damage was dealt, and who was hit.
   */
  commandResult?: {
    success: boolean;
    damageDealt?: number;
    targetUuid?: string;
    /** Energy gained or spent by the command (positive = gained, negative = spent). */
    energyDelta?: number;
  };
};

export type KnockoutHookContext = HookContext & {
  /** The cinderling that was knocked out */
  target: CinderlingState;
};

export type DamagedHookContext = HookContext & {
  /** The attacker */
  attacker: CinderlingState;
  /** Damage amount before mitigation */
  damage: number;
};

// ─── Special Power Definition ────────────────────────────────────────────────

export type SpecialPower = {
  /** Unique identifier (matches cinderling template) */
  id: string;
  /** Display name */
  name: string;
  /** Short description for the UI */
  description: string;
  /** Hook functions — all optional */
  hooks: {
    onTurnStart?: (ctx: HookContext) => PowerEffect[];
    onBeforeCommand?: (ctx: CommandHookContext) => PowerEffect[];
    onAfterCommand?: (ctx: CommandHookContext) => PowerEffect[];
    onKnockout?: (ctx: KnockoutHookContext) => PowerEffect[];
    onDamaged?: (ctx: DamagedHookContext) => PowerEffect[];
    onTurnEnd?: (ctx: HookContext) => PowerEffect[];
  };
};

// ─── Registry ────────────────────────────────────────────────────────────────

const registry = new Map<string, SpecialPower>();

export function registerPower(power: SpecialPower): void {
  if (registry.has(power.id)) {
    throw new Error(`Duplicate special power ID: ${power.id}`);
  }
  registry.set(power.id, power);
}

export function getPower(id: string): SpecialPower | undefined {
  return registry.get(id);
}

export function getAllPowers(): SpecialPower[] {
  return Array.from(registry.values());
}

// ─── Hook Runner ─────────────────────────────────────────────────────────────

/**
 * Run a specific hook for a cinderling, collecting all effects.
 * Returns empty array if the cinderling has no power or no hook for this phase.
 */
export function runHook<T extends HookContext>(
  hookName: keyof SpecialPower["hooks"],
  powerId: string | undefined,
  context: T
): PowerEffect[] {
  if (!powerId) return [];
  const power = registry.get(powerId);
  if (!power) return [];
  const hook = power.hooks[hookName] as ((ctx: T) => PowerEffect[]) | undefined;
  if (!hook) return [];
  try {
    return hook(context);
  } catch (err) {
    console.error(`[SpecialPower] Error in ${powerId}.${hookName}:`, err);
    return []; // Fail silently — a buggy power shouldn't crash the game
  }
}

/**
 * Run a hook for ALL active cinderlings on a team, collecting effects.
 */
export function runTeamHooks(
  hookName: keyof SpecialPower["hooks"],
  cinderlings: CinderlingState[],
  team: 1 | 2,
  state: Readonly<GameState>,
  turn: number
): PowerEffect[] {
  const effects: PowerEffect[] = [];
  for (const v of cinderlings) {
    if (v.hp <= 0 || v.isKO) continue; // Dead cinderlings don't trigger
    const ctx: HookContext = { self: v, team, state, turn };
    effects.push(...runHook(hookName, v.specialPowerId, ctx));
  }
  return effects;
}

// ─── Effect Applicator ───────────────────────────────────────────────────────

/**
 * Apply a list of effects to the game state.
 * Returns a summary of what changed (for event logging).
 */
export function applyEffects(
  effects: PowerEffect[],
  state: GameState
): { healed: string[]; damaged: string[]; energyChanged: boolean } {
  const summary = { healed: [] as string[], damaged: [] as string[], energyChanged: false };

  for (const effect of effects) {
    switch (effect.type) {
      case "heal": {
        const target = findCinderling(state, effect.targetId);
        if (target) {
          target.hp = Math.min(target.maxHp, target.hp + effect.amount);
          summary.healed.push(effect.targetId);
        }
        break;
      }
      case "bonus_damage": {
        const target = findCinderling(state, effect.targetId);
        if (target) {
          target.hp = Math.max(0, target.hp - effect.amount);
          summary.damaged.push(effect.targetId);
          // KO check — must mirror resolveAttack so self-damage can knock out a cinderling
          if (target.hp === 0 && !target.isKO) {
            target.isKO = true;
            target.position = null;
          }
        }
        break;
      }
      case "energy": {
        const team = state.teams[effect.team - 1];
        if (team) {
          team.energy += effect.amount;
        }
        summary.energyChanged = true;
        break;
      }
      case "speed_mod": {
        const target = findCinderling(state, effect.cinderlingId);
        if (target) {
          target.speed = Math.max(1, target.speed + effect.amount);
        }
        break;
      }
      case "set_power_state": {
        const target = findCinderling(state, effect.cinderlingId);
        if (target) {
          if (!target.powerState) target.powerState = {};
          target.powerState[effect.key] = effect.value;
        }
        break;
      }
      // cost_mod, space_effect, block are not handled here
      default:
        break;
    }
  }

  return summary;
}

function findCinderling(state: GameState, id: string): CinderlingState | undefined {
  for (const team of state.teams) {
    const found =
      team.active.find((v) => v.uuid === id) ??
      team.bench.find((v) => v.uuid === id) ??
      team.knocked.find((v) => v.uuid === id);
    if (found) return found;
  }
  return undefined;
}
