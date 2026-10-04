/**
 * Daily Quest catalog for cinderfell.
 *
 * 10 quest templates across 3 categories. Each day, 3 are randomly assigned
 * per player (seeded by userId + date for stability). Progress tracking and
 * reward claiming live in lib/questService.ts.
 */

export type QuestCategory = "battles" | "wins" | "performance";

export type DailyQuest = {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
  category: QuestCategory;
  /** Progress target — quest is complete when progress >= target */
  target: number;
  xpReward: number;
  creditsReward: number;
};

export const DAILY_QUESTS: DailyQuest[] = [
  // ─── Battles ─────────────────────────────────────────────────────────────
  {
    id: "play_1",
    name: "First Battle",
    description: "Play 1 match of any type.",
    icon: "⚔️",
    category: "battles",
    target: 1,
    xpReward: 50,
    creditsReward: 15,
  },
  {
    id: "play_3",
    name: "Battle Tested",
    description: "Play 3 matches of any type.",
    icon: "🗡️",
    category: "battles",
    target: 3,
    xpReward: 100,
    creditsReward: 25,
  },
  {
    id: "try_sparring",
    name: "Training Day",
    description: "Complete a sparring match against an AI opponent.",
    icon: "🤖",
    category: "battles",
    target: 1,
    xpReward: 50,
    creditsReward: 15,
  },
  {
    id: "ranked_match",
    name: "Step Into the Arena",
    description: "Play 1 ranked PvP match.",
    icon: "🏟️",
    category: "battles",
    target: 1,
    xpReward: 75,
    creditsReward: 20,
  },

  // ─── Wins ─────────────────────────────────────────────────────────────────
  {
    id: "win_1",
    name: "Taste of Victory",
    description: "Win 1 match of any type.",
    icon: "🏆",
    category: "wins",
    target: 1,
    xpReward: 75,
    creditsReward: 20,
  },
  {
    id: "win_2_ranked",
    name: "Ranked Grinder",
    description: "Win 2 ranked PvP matches.",
    icon: "🥇",
    category: "wins",
    target: 2,
    xpReward: 150,
    creditsReward: 40,
  },
  {
    id: "beat_hard_ai",
    name: "Machine Tamer",
    description: "Defeat a hard-difficulty AI opponent.",
    icon: "🔩",
    category: "wins",
    target: 1,
    xpReward: 100,
    creditsReward: 30,
  },

  // ─── Performance ─────────────────────────────────────────────────────────
  {
    id: "ko_5",
    name: "Knockout Artist",
    description: "Score 5 or more KOs in a single match.",
    icon: "💥",
    category: "performance",
    target: 1,
    xpReward: 100,
    creditsReward: 30,
  },
  {
    id: "perfect_win",
    name: "Flawless",
    description: "Win a match without losing any of your cinderling.",
    icon: "✨",
    category: "performance",
    target: 1,
    xpReward: 125,
    creditsReward: 35,
  },
  {
    id: "play_5",
    name: "Marathon Trainer",
    description: "Play 5 matches in a single day.",
    icon: "🔥",
    category: "performance",
    target: 5,
    xpReward: 150,
    creditsReward: 40,
  },
];

/** Total quests assigned per player per day */
export const QUESTS_PER_DAY = 3;

/** IDs grouped by category for random selection */
export const QUEST_IDS_BY_CATEGORY: Record<QuestCategory, string[]> = {
  battles: DAILY_QUESTS.filter((q) => q.category === "battles").map((q) => q.id),
  wins: DAILY_QUESTS.filter((q) => q.category === "wins").map((q) => q.id),
  performance: DAILY_QUESTS.filter((q) => q.category === "performance").map((q) => q.id),
};
