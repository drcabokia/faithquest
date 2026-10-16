import type { JourneyState } from "../lib/state";
import { addDays } from "../lib/dates";
export const XP = {
  reading: 50,
  quiz: 10,
  reflection: 20,
  memory: 30,
  challenge: 100,
  book: 150,
} as const;
export const LEVELS = [
  { name: "Faith Beginner", xp: 0 },
  { name: "Faithful Explorer", xp: 250 },
  { name: "Scripture Seeker", xp: 750 },
  { name: "Wisdom Builder", xp: 1500 },
  { name: "Faith Champion", xp: 3000 },
  { name: "Bible Adventurer", xp: 6000 },
  { name: "Scripture Master", xp: 12000 },
];
export function totalXp(state: JourneyState): number {
  return Object.values(state.rewards).reduce((sum, r) => sum + r.amount, 0);
}
export function levelInfo(xp: number) {
  const index = Math.max(
    0,
    LEVELS.findLastIndex((l) => xp >= l.xp),
  );
  return {
    ...LEVELS[index],
    number: index + 1,
    next: LEVELS[index + 1],
    progress: LEVELS[index + 1]
      ? ((xp - LEVELS[index].xp) / (LEVELS[index + 1].xp - LEVELS[index].xp)) *
        100
      : 100,
  };
}
export function streak(dates: string[], today: string): number {
  const set = new Set(dates);
  let cursor = set.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (set.has(cursor)) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}
export function readingDates(state: JourneyState): string[] {
  return Object.values(state.days);
}
export function achievements(state: JourneyState) {
  const days = Object.keys(state.days).length;
  const dates = [...new Set(readingDates(state))].sort();
  let longest = 0,
    run = 0,
    prev = "";
  for (const d of dates) {
    run = addDays(d, -1) === prev ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  const badges = [
    {
      id: "first",
      name: "First steps",
      description: "Complete your first reading mission.",
      earned: days >= 1,
      icon: "footsteps",
    },
    {
      id: "week",
      name: "A faithful rhythm",
      description: "Read on 7 consecutive calendar days.",
      earned: longest >= 7,
      icon: "flame",
    },
    {
      id: "month",
      name: "Growing roots",
      description: "Complete 30 reading missions.",
      earned: days >= 30,
      icon: "tree",
    },
    {
      id: "reflect",
      name: "A listening heart",
      description: "Save your first thoughtful reflection.",
      earned: Object.keys(state.reflections).length >= 1,
      icon: "heart",
    },
    {
      id: "quiz",
      name: "Curious explorer",
      description: "Answer a Bible quiz question correctly.",
      earned: Object.values(state.attempts).some((a) => a.correct),
      icon: "sparkles",
    },
    {
      id: "book",
      name: "Chapter by chapter",
      description: "Finish every chapter of a Bible book.",
      earned: Object.keys(state.rewards).some((k) => k.startsWith("book:")),
      icon: "book",
    },
    {
      id: "hundred",
      name: "Steady on the path",
      description: "Complete 100 reading missions.",
      earned: days >= 100,
      icon: "mountain",
    },
    {
      id: "year",
      name: "A journey fulfilled",
      description: "Complete all 365 reading missions.",
      earned: days === 365,
      icon: "crown",
    },
  ];
  return state.earnedAchievements
    ? badges.map((badge) => ({
        ...badge,
        earned: state.earnedAchievements!.includes(badge.id),
      }))
    : badges;
}
