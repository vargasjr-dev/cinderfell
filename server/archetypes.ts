/**
 * Cinderling stat archetypes — the template system for the 64-mon library.
 *
 * Each cinderling is built from an archetype that defines stat ranges,
 * attack templates, and design constraints. Individual cinderlings
 * vary within their archetype's ranges for diversity.
 *
 * Stat budget: HP + (Attack × 5) + (Speed × 8) ≈ 160
 */

// ─── Archetype Definitions ───────────────────────────────────────────────────

export type ArchetypeId = "tank" | "speedster" | "glass_cannon" | "support" | "balanced";

export type StatRange = {
  min: number;
  max: number;
};

export type AttackTemplate = {
  /** Canonical identifier — matches the key in ATTACK_TEMPLATES */
  key: string;
  name: string;
  /** Canonical base damage — same for every mon that carries this attack */
  damage: number;
  energyCost: number;
  range: number;
  /**
   * When true, this attack arcs over allied cinderlings during target scanning
   * instead of stopping at them. It still stops at enemies and void tiles.
   * Represents physically lobbing a projectile over your own team.
   */
  arcOver?: boolean;
};

export type Archetype = {
  id: ArchetypeId;
  label: string;
  emoji: string;
  description: string;
  role: string;
  weakness: string;
  hp: StatRange;
  attack: StatRange;
  speed: StatRange;
  /** Attack templates this archetype draws from (pick 2 per cinderling) */
  attackPool: AttackTemplate[];
  count: number;
};

// ─── Attack Templates ────────────────────────────────────────────────────────

export const ATTACK_TEMPLATES: Record<string, AttackTemplate> = {
  poke:   { key: "poke",   name: "Poke",   damage: 3,  energyCost: 1, range: 1 },
  strike: { key: "strike", name: "Strike", damage: 8,  energyCost: 2, range: 1 },
  slam:   { key: "slam",   name: "Slam",   damage: 12, energyCost: 3, range: 1 },
  nuke:   { key: "nuke",   name: "Nuke",   damage: 15, energyCost: 3, range: 1 },
  snipe:  { key: "snipe",  name: "Snipe",  damage: 6,  energyCost: 2, range: 2 },
  lob:    { key: "lob",    name: "Lob",    damage: 10, energyCost: 3, range: 2, arcOver: true },
  chip:   { key: "chip",   name: "Chip",   damage: 2,  energyCost: 1, range: 1 },
};

const T = ATTACK_TEMPLATES;

// ─── Archetype Registry ──────────────────────────────────────────────────────

export const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  tank: {
    id: "tank",
    label: "Tank",
    emoji: "🛡️",
    description: "High HP, low speed, moderate attack. The wall.",
    role: "Hold occupation points, absorb damage, outlast.",
    weakness: "Slow to respond, can be outmaneuvered.",
    hp: { min: 90, max: 120 },
    attack: { min: 8, max: 12 },
    speed: { min: 1, max: 3 },
    attackPool: [T.poke, T.strike, T.slam],
    count: 12,
  },
  speedster: {
    id: "speedster",
    label: "Speedster",
    emoji: "⚡",
    description: "Blazing speed, low HP, moderate attack. First to act.",
    role: "Rush objectives, harass, pick off weakened targets.",
    weakness: "Fragile — goes down fast if focused.",
    hp: { min: 40, max: 65 },
    attack: { min: 8, max: 12 },
    speed: { min: 8, max: 10 },
    attackPool: [T.poke, T.snipe, T.strike],
    count: 12,
  },
  glass_cannon: {
    id: "glass_cannon",
    label: "Glass Cannon",
    emoji: "💥",
    description: "Huge attack, low HP, moderate speed. Hits like a truck.",
    role: "Burst damage, eliminate key targets, force trades.",
    weakness: "Expensive attacks drain team energy, fragile.",
    hp: { min: 45, max: 70 },
    attack: { min: 15, max: 20 },
    speed: { min: 4, max: 6 },
    attackPool: [T.poke, T.slam, T.nuke, T.lob],
    count: 12,
  },
  support: {
    id: "support",
    label: "Support",
    emoji: "🌿",
    description: "Balanced HP, low attack, high speed. The harvester.",
    role: "Harvest energy, contest occupation points, utility.",
    weakness: "Can't win fights, relies on team.",
    hp: { min: 65, max: 85 },
    attack: { min: 5, max: 9 },
    speed: { min: 6, max: 8 },
    attackPool: [T.chip, T.poke, T.snipe],
    count: 12,
  },
  balanced: {
    id: "balanced",
    label: "Balanced",
    emoji: "⚔️",
    description: "No glaring weakness, no standout strength. Flexible.",
    role: "Adaptable — fill any gap in a team composition.",
    weakness: "Outclassed by specialists in their domain.",
    hp: { min: 70, max: 90 },
    attack: { min: 10, max: 14 },
    speed: { min: 4, max: 6 },
    attackPool: [T.poke, T.strike, T.lob, T.snipe],
    count: 16,
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Total cinderlings across all archetypes */
export const TOTAL_CINDERLINGS = Object.values(ARCHETYPES).reduce(
  (sum, a) => sum + a.count,
  0,
);

/** Validate stat budget: HP + (Attack × 5) + (Speed × 8) should be ~160 ± 20 */
export function validateStatBudget(
  hp: number,
  attack: number,
  speed: number,
): { budget: number; valid: boolean } {
  const budget = hp + attack * 5 + speed * 8;
  return { budget, valid: budget >= 145 && budget <= 180 };
}

/** Check if stats fall within an archetype's ranges */
export function fitsArchetype(
  archetype: Archetype,
  hp: number,
  attack: number,
  speed: number,
): boolean {
  return (
    hp >= archetype.hp.min &&
    hp <= archetype.hp.max &&
    attack >= archetype.attack.min &&
    attack <= archetype.attack.max &&
    speed >= archetype.speed.min &&
    speed <= archetype.speed.max
  );
}
