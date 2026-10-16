import type { JourneyState } from "../lib/state";
import { BOOKS } from "../data/books";
import { QUESTIONS } from "../data/quizzes";
import { addDays, dateInZone } from "../lib/dates";
import { CHAPTER_KEYS, PLAN } from "./reading-plan";
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
function award(state: JourneyState, key: string, amount: number, date: string) {
  if (!state.rewards[key]) state.rewards[key] = { amount, date };
}
export function completeChapter(
  state: JourneyState,
  key: string,
  now = new Date(),
): JourneyState {
  if (!CHAPTER_KEYS.has(key)) throw new Error("Unknown Bible chapter.");
  if (state.chapters[key]) return state;
  const next = structuredClone(state);
  const date = dateInZone(state.profile.timeZone, now);
  next.chapters[key] = date;
  for (const mission of PLAN) {
    if (
      !next.days[mission.day] &&
      mission.chapters.every((c) => next.chapters[c.key])
    ) {
      next.days[mission.day] = date;
      award(next, `reading:${mission.day}`, XP.reading, date);
    }
  }
  for (const book of BOOKS) {
    if (
      Array.from(
        { length: book.chapters },
        (_, i) => `${book.id}.${i + 1}`,
      ).every((k) => next.chapters[k])
    )
      award(next, `book:${book.id}`, XP.book, date);
  }
  return next;
}
export function submitAnswer(
  state: JourneyState,
  id: string,
  answer: number,
  now = new Date(),
): JourneyState {
  const question = QUESTIONS.find((q) => q.id === id);
  if (!question || !Number.isInteger(answer) || answer < 0 || answer > 3)
    throw new Error("Choose a valid quiz answer.");
  if (state.attempts[id]) return state;
  const next = structuredClone(state);
  const date = dateInZone(state.profile.timeZone, now);
  const correct = answer === question.correct;
  next.attempts[id] = { answer, correct, date };
  if (correct) award(next, `quiz:${id}`, XP.quiz, date);
  return next;
}
export function saveReflection(
  state: JourneyState,
  date: string,
  text: string,
  now = new Date(),
): JourneyState {
  const content = text.trim();
  if (content.length < 20 || content.length > 10000)
    throw new Error("Write between 20 and 10,000 characters for a reflection.");
  const today = dateInZone(state.profile.timeZone, now);
  if (
    date > today ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    (!state.reflections[date] && date !== today)
  )
    throw new Error(
      "New reflections can be saved for today. Existing entries can be edited.",
    );
  const next = structuredClone(state);
  next.reflections[date] = { text: content, updatedAt: now.toISOString() };
  award(next, `reflection:${date}`, XP.reflection, today);
  return next;
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
  return [
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
}
