/**
 * The complete 64-cinderling library.
 *
 * Each cinderling has a unique name, archetype, stat spread, and two attacks.
 * Stats respect the archetype ranges and budget constraint (HP + Atk×5 + Spd×8 ≈ 160).
 * Attacks are drawn from the archetype's attack pool.
 *
 * Distribution: 12 Tank, 12 Speedster, 12 Glass Cannon, 12 Support, 16 Balanced = 64
 */

import {
  type ArchetypeId,
  type AttackTemplate,
  ATTACK_TEMPLATES,
  validateStatBudget,
  fitsArchetype,
  ARCHETYPES,
} from "./archetypes";

const T = ATTACK_TEMPLATES;

// ─── Cinderling Template ───────────────────────────────────────────────────────

export type CinderlingTemplate = {
  id: number;
  name: string;
  archetype: ArchetypeId;
  hp: number;
  attack: number;
  speed: number;
  attacks: [AttackTemplate, AttackTemplate];
  /** Short flavor text */
  flavor: string;
  /** Avatar image URL — generated via Nano Banana (Gemini image gen) */
  imageUrl?: string;
  /** Optional special power ID — references server/specialPowers registry */
  specialPowerId?: string;
};

// ─── All 64 Cinderlings (alphabetical) ─────────────────────────────────────────

const ALL_CINDERLINGS: CinderlingTemplate[] = [
  { id: 1, name: "Aerobolt", archetype: "speedster", hp: 65, attack: 8, speed: 8, attacks: [T.snipe, T.strike], flavor: "Rides its own shockwave like a surfboard.", specialPowerId: "shockwave-surfer", imageUrl: "/cinderlings/aerobolt.png" },
  { id: 2, name: "Aquaplex", archetype: "balanced", hp: 73, attack: 12, speed: 5, attacks: [T.snipe, T.strike], flavor: "Water creature that adapts to any situation.", specialPowerId: "adaptive-flow", imageUrl: "/cinderlings/aquaplex.png" },
  { id: 3, name: "Barrikade", archetype: "tank", hp: 102, attack: 11, speed: 2, attacks: [T.poke, T.strike], flavor: "Literally a walking barricade. Blocks everything.", specialPowerId: "iron-curtain", imageUrl: "/cinderlings/barrikade.png" },
  { id: 4, name: "Blastova", archetype: "glass_cannon", hp: 45, attack: 20, speed: 4, attacks: [T.poke, T.nuke], flavor: "A living supernova. Bright, hot, and short-lived.", specialPowerId: "supernova-burst", imageUrl: "/cinderlings/blastova.png" },
  { id: 5, name: "Blinkatt", archetype: "speedster", hp: 42, attack: 11, speed: 10, attacks: [T.snipe, T.strike], flavor: "Blinks in and out of existence between attacks.", specialPowerId: "phase-shift", imageUrl: "/cinderlings/blinkatt.png" },
  { id: 6, name: "Breezekin", archetype: "balanced", hp: 75, attack: 13, speed: 5, attacks: [T.poke, T.lob], flavor: "Kin of the wind. Light on its feet, steady aim.", specialPowerId: "tailwind", imageUrl: "/cinderlings/breezekin.png" },
  { id: 7, name: "Buldrok", archetype: "tank", hp: 120, attack: 8, speed: 1, attacks: [T.poke, T.slam], flavor: "An ancient stone golem. Slow but nearly indestructible.", specialPowerId: "earthen-bulwark", imageUrl: "/cinderlings/buldrok.png" },
  { id: 8, name: "Cloudpuff", archetype: "support", hp: 78, attack: 8, speed: 7, attacks: [T.poke, T.chip], flavor: "A tiny cloud that floats just above the ground.", specialPowerId: "rain-dance", imageUrl: "/cinderlings/cloudpuff.png" },
  { id: 9, name: "Coppercog", archetype: "balanced", hp: 80, attack: 12, speed: 4, attacks: [T.strike, T.lob], flavor: "Mechanical cinderling made of spinning copper gears.", specialPowerId: "gear_grind", imageUrl: "/cinderlings/coppercog.png" },
  { id: 10, name: "Coralord", archetype: "tank", hp: 95, attack: 11, speed: 3, attacks: [T.strike, T.slam], flavor: "Coral reef creature. Slow on land, king of the shallows.", specialPowerId: "tide-harvest", imageUrl: "/cinderlings/coralord.png" },
  { id: 11, name: "Cosmog", archetype: "balanced", hp: 90, attack: 10, speed: 4, attacks: [T.poke, T.strike], flavor: "Cosmic origins. The most mysterious cinderling of all.", specialPowerId: "warp-strike", imageUrl: "/cinderlings/cosmog.png" },
  { id: 12, name: "Cragthorn", archetype: "tank", hp: 110, attack: 10, speed: 1, attacks: [T.strike, T.slam], flavor: "Covered in thorny rock formations. Touch at your peril.", specialPowerId: "thorns", imageUrl: "/cinderlings/cragthorn.png" },
  { id: 13, name: "Crimshard", archetype: "glass_cannon", hp: 47, attack: 17, speed: 6, attacks: [T.poke, T.nuke], flavor: "Red crystal shards orbit it like tiny daggers.", specialPowerId: "crystal-barrage", imageUrl: "/cinderlings/crimshard.png" },
  { id: 14, name: "Dashpaw", archetype: "speedster", hp: 55, attack: 13, speed: 6, attacks: [T.poke, T.snipe], flavor: "Paw prints everywhere but you never see it pass.", specialPowerId: "phantom-sprint", imageUrl: "/cinderlings/dashpaw.png" },
  { id: 15, name: "Dewdrop", archetype: "support", hp: 70, attack: 5, speed: 7, attacks: [T.chip, T.snipe], flavor: "A sentient dewdrop. Surprisingly hard to squish.", specialPowerId: "cleansing-mist", imageUrl: "/cinderlings/dewdrop.png" },
  { id: 16, name: "Doomsprout", archetype: "glass_cannon", hp: 58, attack: 17, speed: 4, attacks: [T.slam, T.lob], flavor: "An innocent sprout that unleashes devastating blooms.", specialPowerId: "bloom-burst", imageUrl: "/cinderlings/doomsprout.png" },
  { id: 17, name: "Duraclod", archetype: "tank", hp: 92, attack: 12, speed: 2, attacks: [T.poke, T.strike], flavor: "A clod of super-dense earth. Surprisingly determined.", specialPowerId: "fortify", imageUrl: "/cinderlings/duraclod.png" },
  { id: 18, name: "Duskfin", archetype: "balanced", hp: 83, attack: 13, speed: 4, attacks: [T.strike, T.snipe], flavor: "Emerges at dusk. Thrives in twilight conditions.", specialPowerId: "twilight-veil", imageUrl: "/cinderlings/duskfin.png" },
  { id: 19, name: "Embercub", archetype: "balanced", hp: 72, attack: 13, speed: 4, attacks: [T.poke, T.strike], flavor: "A warm little cub with surprising grit.", specialPowerId: "inner-fire", imageUrl: "/cinderlings/embercub.png" },
  { id: 20, name: "Ferridon", archetype: "tank", hp: 115, attack: 9, speed: 1, attacks: [T.poke, T.strike], flavor: "Iron-plated beast that rusts its enemies on contact.", specialPowerId: "rust-aura", imageUrl: "/cinderlings/ferridon.png" },
  { id: 21, name: "Flashfin", archetype: "speedster", hp: 62, attack: 8, speed: 9, attacks: [T.poke, T.snipe], flavor: "Glows bright when it accelerates. Blinding.", specialPowerId: "blinding-dash", imageUrl: "/cinderlings/flashfin.png" },
  { id: 22, name: "Flicktail", archetype: "speedster", hp: 50, attack: 10, speed: 10, attacks: [T.snipe, T.poke], flavor: "Flicks its tail to redirect mid-dash. Uncatchable.", specialPowerId: "evasive-flick", imageUrl: "/cinderlings/flicktail.png" },
  { id: 23, name: "Frostfawn", archetype: "balanced", hp: 72, attack: 12, speed: 6, attacks: [T.snipe, T.lob], flavor: "A frost-touched fawn. Graceful and deceptively tough.", specialPowerId: "frost-grace", imageUrl: "/cinderlings/frostfawn.png" },
  { id: 24, name: "Fungipal", archetype: "support", hp: 82, attack: 8, speed: 6, attacks: [T.chip, T.poke], flavor: "A friendly fungus. Absorbs energy from the ground.", specialPowerId: "spore-harvest", imageUrl: "/cinderlings/fungipal.png" },
  { id: 25, name: "Gleamoss", archetype: "support", hp: 65, attack: 5, speed: 8, attacks: [T.chip, T.snipe], flavor: "Glowing moss creature. Harvests energy from sunlight.", specialPowerId: "photosynthesis", imageUrl: "/cinderlings/gleamoss.png" },
  { id: 26, name: "Glintpaw", archetype: "balanced", hp: 85, attack: 10, speed: 5, attacks: [T.poke, T.strike], flavor: "Shiny paws that glint when it attacks. Flashy.", specialPowerId: "flash-strike", imageUrl: "/cinderlings/glintpaw.png" },
  { id: 27, name: "Grumblix", archetype: "tank", hp: 100, attack: 12, speed: 1, attacks: [T.poke, T.slam], flavor: "Always grumbling. The grumpiest cinderling alive.", specialPowerId: "grudge", imageUrl: "/cinderlings/grumblix.png" },
  { id: 28, name: "Gustling", archetype: "speedster", hp: 55, attack: 10, speed: 9, attacks: [T.snipe, T.strike], flavor: "A tiny wind spirit. Leaves a breeze trail everywhere.", specialPowerId: "breeze-trail", imageUrl: "/cinderlings/gustling.png" },
  { id: 29, name: "Hexaflare", archetype: "glass_cannon", hp: 60, attack: 16, speed: 5, attacks: [T.lob, T.nuke], flavor: "Six-pointed flare pattern. Mesmerizing and deadly.", specialPowerId: "flare-burst", imageUrl: "/cinderlings/hexaflare.png" },
  { id: 30, name: "Humbloom", archetype: "support", hp: 72, attack: 7, speed: 7, attacks: [T.poke, T.snipe], flavor: "Hums a gentle tune while harvesting. Very zen.", specialPowerId: "zen-harvest", imageUrl: "/cinderlings/humbloom.png" },
  { id: 31, name: "Ironpup", archetype: "balanced", hp: 70, attack: 14, speed: 5, attacks: [T.strike, T.snipe], flavor: "An iron-coated pup. Loyal, tough, decent in a fight.", specialPowerId: "loyal-guard", imageUrl: "/cinderlings/ironpup.png" },
  { id: 32, name: "Joltmink", archetype: "speedster", hp: 55, attack: 8, speed: 10, attacks: [T.poke, T.snipe], flavor: "Fuzzy and electrified. Don't pet it.", specialPowerId: "static-charge", imageUrl: "/cinderlings/joltmink.png" },
  { id: 33, name: "Lumisprout", archetype: "support", hp: 85, attack: 9, speed: 6, attacks: [T.snipe, T.poke], flavor: "Bioluminescent sprout. Lights up the whole board.", specialPowerId: "bioluminescence", imageUrl: "/cinderlings/lumisprout.png" },
  { id: 34, name: "Magmorus", archetype: "glass_cannon", hp: 48, attack: 19, speed: 4, attacks: [T.slam, T.nuke], flavor: "Molten core barely contained by a thin rocky shell.", specialPowerId: "meltdown", imageUrl: "/cinderlings/magmorus.png" },
  { id: 35, name: "Mosswall", archetype: "tank", hp: 100, attack: 10, speed: 3, attacks: [T.poke, T.slam], flavor: "A living wall of moss and stone. Regenerates slowly.", specialPowerId: "regrowth", imageUrl: "/cinderlings/mosswall.png" },
  { id: 36, name: "Nectarb", archetype: "support", hp: 75, attack: 9, speed: 7, attacks: [T.chip, T.snipe], flavor: "Drips sweet nectar that converts to pure energy.", specialPowerId: "sweet_nectar", imageUrl: "/cinderlings/nectarb.png" },
  { id: 37, name: "Pebblink", archetype: "balanced", hp: 82, attack: 10, speed: 5, attacks: [T.poke, T.lob], flavor: "A blinking pebble. Don't underestimate small things.", specialPowerId: "stone_blink", imageUrl: "/cinderlings/pebblink.png" },
  { id: 38, name: "Phantoboom", archetype: "glass_cannon", hp: 65, attack: 15, speed: 5, attacks: [T.poke, T.slam], flavor: "A phantom that materializes only to detonate.", specialPowerId: "detonation", imageUrl: "/cinderlings/phantoboom.png" },
  { id: 39, name: "Plateor", archetype: "tank", hp: 90, attack: 12, speed: 3, attacks: [T.strike, T.slam], flavor: "Tectonic plates shift when this one charges.", specialPowerId: "tectonic_charge", imageUrl: "/cinderlings/plateor.png" },
  { id: 40, name: "Pollyx", archetype: "support", hp: 68, attack: 6, speed: 8, attacks: [T.chip, T.poke], flavor: "Spreads pollen everywhere. Annoyingly persistent.", specialPowerId: "pollen_cloud", imageUrl: "/cinderlings/pollyx.png" },
  { id: 41, name: "Prismite", archetype: "balanced", hp: 88, attack: 12, speed: 4, attacks: [T.snipe, T.lob], flavor: "Refracts light into rainbow patterns. Beautiful fighter.", specialPowerId: "prismatic_shield", imageUrl: "/cinderlings/prismite.png" },
  { id: 42, name: "Pyroburst", archetype: "glass_cannon", hp: 52, attack: 18, speed: 4, attacks: [T.poke, T.slam], flavor: "Explodes on impact. Reassembles slowly.", specialPowerId: "volatile_core", imageUrl: "/cinderlings/pyroburst.png" },
  { id: 43, name: "Quicksilk", archetype: "speedster", hp: 60, attack: 9, speed: 9, attacks: [T.snipe, T.poke], flavor: "Spins silk webs at impossible speed.", specialPowerId: "web_trap", imageUrl: "/cinderlings/quicksilk.png" },
  { id: 44, name: "Razorush", archetype: "speedster", hp: 52, attack: 11, speed: 9, attacks: [T.poke, T.strike], flavor: "Razor-edged fins that slice the air at top speed.", specialPowerId: "razor_slipstream", imageUrl: "/cinderlings/razorush.png" },
  { id: 45, name: "Rustleclaw", archetype: "balanced", hp: 85, attack: 11, speed: 4, attacks: [T.strike, T.lob], flavor: "Rustling claws that sound like wind through leaves.", specialPowerId: "ambush_claws", imageUrl: "/cinderlings/rustleclaw.png" },
  { id: 46, name: "Sandscout", archetype: "balanced", hp: 80, attack: 10, speed: 6, attacks: [T.snipe, T.strike], flavor: "Desert scout. Sees everything, reports nothing.", specialPowerId: "desert_sight", imageUrl: "/cinderlings/sandscout.png" },
  { id: 47, name: "Scoopuff", archetype: "support", hp: 73, attack: 8, speed: 8, attacks: [T.chip, T.poke], flavor: "Scoops up energy pellets with its fluffy cheeks.", specialPowerId: "cheek_pouch", imageUrl: "/cinderlings/scoopuff.png" },
  { id: 48, name: "Shellmaw", archetype: "tank", hp: 108, attack: 10, speed: 2, attacks: [T.poke, T.slam], flavor: "A massive jaw hidden inside an impenetrable shell.", specialPowerId: "iron_shell", imageUrl: "/cinderlings/shellmaw.png" },
  { id: 49, name: "Shrednova", archetype: "glass_cannon", hp: 50, attack: 18, speed: 5, attacks: [T.poke, T.nuke], flavor: "Shreds reality with its claws. Terrifying but brittle.", specialPowerId: "reality_shred", imageUrl: "/cinderlings/shrednova.png" },
  { id: 50, name: "Skidmark", archetype: "speedster", hp: 58, attack: 10, speed: 8, attacks: [T.poke, T.strike], flavor: "Leaves scorch marks from sheer friction.", specialPowerId: "friction_burn", imageUrl: "/cinderlings/skidmark.png" },
  { id: 51, name: "Sproutail", archetype: "support", hp: 78, attack: 7, speed: 6, attacks: [T.chip, T.snipe], flavor: "Its tail grows a new sprout after each harvest.", specialPowerId: "regrowth_tail", imageUrl: "/cinderlings/sproutail.png" },
  { id: 52, name: "Starveil", archetype: "balanced", hp: 77, attack: 11, speed: 6, attacks: [T.poke, T.snipe], flavor: "Veiled in starlight. Hard to read, harder to predict.", specialPowerId: "starlight_veil", imageUrl: "/cinderlings/starveil.png" },
  { id: 53, name: "Terravex", archetype: "balanced", hp: 70, attack: 14, speed: 4, attacks: [T.strike, T.lob], flavor: "Earth-aspected all-rounder. Reliable as bedrock.", specialPowerId: "bedrock_stance", imageUrl: "/cinderlings/terravex.png" },
  { id: 54, name: "Thornlash", archetype: "glass_cannon", hp: 55, attack: 17, speed: 5, attacks: [T.lob, T.slam], flavor: "Whip-like thorns with devastating reach.", specialPowerId: "thorn_reach", imageUrl: "/cinderlings/thornlash.png" },
  { id: 55, name: "Tidalmini", archetype: "support", hp: 80, attack: 5, speed: 6, attacks: [T.snipe, T.poke], flavor: "Miniature tidal wave. Splashes harmlessly but fast.", specialPowerId: "tidal_splash", imageUrl: "/cinderlings/tidalmini.png" },
  { id: 56, name: "Titanog", archetype: "tank", hp: 98, attack: 11, speed: 1, attacks: [T.strike, T.slam], flavor: "Titanium-boned creature from deep underground.", specialPowerId: "titanium_bones", imageUrl: "/cinderlings/titanog.png" },
  { id: 57, name: "Toxiblast", archetype: "glass_cannon", hp: 70, attack: 15, speed: 4, attacks: [T.lob, T.slam], flavor: "Toxic goo with surprisingly good aim.", specialPowerId: "toxic_residue", imageUrl: "/cinderlings/toxiblast.png" },
  { id: 58, name: "Tundrak", archetype: "tank", hp: 105, attack: 9, speed: 2, attacks: [T.strike, T.slam], flavor: "Frost-covered mammoth that freezes the ground it walks on.", specialPowerId: "permafrost", imageUrl: "/cinderlings/tundrak.png" },
  { id: 59, name: "Verdantix", archetype: "balanced", hp: 78, attack: 11, speed: 5, attacks: [T.poke, T.strike], flavor: "Green crystal entity. Grows stronger near nature.", specialPowerId: "crystal_growth", imageUrl: "/cinderlings/verdantix.png" },
  { id: 60, name: "Voidclaw", archetype: "glass_cannon", hp: 37, attack: 17, speed: 5, attacks: [T.slam, T.lob], flavor: "Reaches through tiny void portals to strike.", specialPowerId: "void_rend", imageUrl: "/cinderlings/voidclaw.png" },
  { id: 61, name: "Voltwing", archetype: "speedster", hp: 48, attack: 11, speed: 8, attacks: [T.poke, T.strike], flavor: "Electric wings that crackle with each flap.", specialPowerId: "thunderclap", imageUrl: "/cinderlings/voltwing.png" },
  { id: 62, name: "Whispurr", archetype: "support", hp: 75, attack: 6, speed: 7, attacks: [T.poke, T.snipe], flavor: "Purrs at a frequency that calms allies.", specialPowerId: "calming_purr", imageUrl: "/cinderlings/whispurr.png" },
  { id: 63, name: "Wrecktor", archetype: "glass_cannon", hp: 58, attack: 16, speed: 4, attacks: [T.poke, T.slam], flavor: "Built to wreck. Nothing else. Just wreck.", specialPowerId: "wrecking_ball", imageUrl: "/cinderlings/wrecktor.png" },
  { id: 64, name: "Zipfang", archetype: "speedster", hp: 40, attack: 12, speed: 10, attacks: [T.poke, T.strike], flavor: "So fast it bites before you see it move.", specialPowerId: "blood_rush", imageUrl: "/cinderlings/zipfang.png" },
];

export const CINDERLING_LIBRARY: CinderlingTemplate[] = ALL_CINDERLINGS;
