import { awardChallenges } from "./challenges";
import type { JourneyState } from "../lib/state";
import { BOOKS } from "../data/books";
import { QUESTIONS } from "../data/quizzes";
import { dateInZone } from "../lib/dates";
import {
  CHAPTER_KEYS,
  getPlan,
  planId,
  readingRewardKey,
} from "./reading-plan";
import { XP } from "./gamification-display";
export * from "./gamification-display";
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
  for (const mission of getPlan(planId(state))) {
    if (
      !next.days[mission.day] &&
      mission.chapters.every((c) => next.chapters[c.key])
    ) {
      next.days[mission.day] = date;
      award(
        next,
        readingRewardKey(planId(state), mission.day),
        XP.reading,
        date,
      );
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
  awardChallenges(next, date);
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
  next.attempts[id] = {
    answer,
    correct,
    date,
    correctOption: question.correct,
    explanation: question.explanation,
  };
  if (correct) award(next, `quiz:${id}`, XP.quiz, date);
  return next;
}
import {
  journalCategorySchema,
  journalExpectedRevisionSchema,
  journalRevision,
  JournalConflictError,
  type JournalCategory,
} from "@/lib/journal";
export function saveReflection(
  state: JourneyState,
  date: string,
  text: string,
  now = new Date(),
  category?: JournalCategory,
  expectedRevision: string | null = null,
): JourneyState {
  if (category !== undefined) journalCategorySchema.parse(category);
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
  journalExpectedRevisionSchema.nullable().parse(expectedRevision);
  const current = state.reflections[date];
  const desiredCategory = category ?? current?.category ?? "reflection";
  if (
    current?.text === content &&
    (current.category ?? "reflection") === desiredCategory
  )
    return state;
  if (journalRevision(current) !== expectedRevision)
    throw new JournalConflictError();
  const next = structuredClone(state);
  next.reflections[date] = {
    revision: crypto.randomUUID(),
    text: content,
    updatedAt: now.toISOString(),
    ...((category ?? state.reflections[date]?.category)
      ? { category: category ?? state.reflections[date]?.category }
      : {}),
  };
  award(next, `reflection:${date}`, XP.reflection, today);
  return next;
}
