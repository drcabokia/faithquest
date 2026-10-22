import { mergedGraceHistory } from "./reading-consistency";
import { PRAYER_LIMIT } from "../lib/prayers";
import { awardChallenges } from "./challenges";
import { mergeChallengeStarts } from "../lib/challenges";
import { dateInZone } from "../lib/dates";
import { type JourneyState } from "../lib/state";
import { validateRestore, type RestoreData } from "../lib/backup";
import { getPlan, planId, readingRewardKey } from "./reading-plan";
import { BOOKS } from "../data/books";
import { QUESTIONS } from "../data/quizzes";
import { setSavedVerse } from "./saved-verses";

export function restoreDemo(
  current: JourneyState,
  input: RestoreData,
  now = new Date(),
): JourneyState {
  const backup = validateRestore(
    input,
    current.profile.timeZone,
    now,
    planId(current),
  );
  const starts = mergeChallengeStarts(
    current.challengeStarts ?? [],
    backup.challengeStarts ?? [],
  );
  if (
    new Set([
      ...Object.keys(current.prayers ?? {}),
      ...Object.keys(backup.prayers ?? {}),
    ]).size > PRAYER_LIMIT
  )
    throw new Error("The merged backup exceeds the 200 prayer request limit.");
  const graceDates = mergedGraceHistory(current, backup);
  let next = structuredClone(current);
  if (current.graceDates || backup.graceDates) next.graceDates = graceDates;
  for (const [id, p] of Object.entries(backup.prayers ?? {})) {
    if (!Object.hasOwn(next.prayers ?? {}, id))
      next.prayers = {
        ...next.prayers,
        [id]: {
          ...p,
          revision: crypto.randomUUID(),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      };
  }
  if (current.challengeStarts || backup.challengeStarts)
    next.challengeStarts = starts;
  for (const key of backup.savedVerses ?? [])
    next = setSavedVerse(next, key, true, now);
  for (const [key, text] of Object.entries(backup.verseNotes ?? {})) {
    if (!Object.hasOwn(next.verseNotes ?? {}, key)) {
      next.verseNotes = {
        ...next.verseNotes,
        [key]: { text, updatedAt: now.toISOString() },
      };
    }
  }
  for (const [key, date] of Object.entries(backup.chapters))
    if (!Object.hasOwn(next.chapters, key)) next.chapters[key] = date;
  for (const [id, a] of Object.entries(backup.attempts)) {
    if (Object.hasOwn(next.attempts, id)) continue;
    const q = QUESTIONS.find((q) => q.id === id)!;
    next.attempts[id] = {
      ...a,
      correct: a.answer === q.correct,
      correctOption: q.correct,
      explanation: q.explanation,
    };
  }
  for (const [day, reflection] of Object.entries(backup.reflections))
    if (!Object.hasOwn(next.reflections, day))
      next.reflections[day] = {
        revision: crypto.randomUUID(),
        ...reflection,
        updatedAt: now.toISOString(),
      };
  const award = (key: string, amount: number, date: string) => {
    if (!Object.hasOwn(next.rewards, key)) next.rewards[key] = { amount, date };
  };
  for (const mission of getPlan(planId(current))) {
    if (mission.chapters.every((c) => next.chapters[c.key])) {
      const date = mission.chapters
        .map((c) => next.chapters[c.key])
        .sort()
        .at(-1)!;
      if (!next.days[mission.day]) next.days[mission.day] = date;
      award(
        readingRewardKey(planId(current), mission.day),
        50,
        next.days[mission.day],
      );
    }
  }
  for (const book of BOOKS) {
    const dates = Array.from(
      { length: book.chapters },
      (_, i) => next.chapters[`${book.id}.${i + 1}`],
    );
    if (dates.every(Boolean))
      award(`book:${book.id}`, 150, dates.sort().at(-1)!);
  }
  for (const [id, a] of Object.entries(next.attempts))
    if (a.correct) award(`quiz:${id}`, 10, a.date);
  for (const day of Object.keys(next.reflections))
    award(`reflection:${day}`, 20, day);
  awardChallenges(next, dateInZone(next.profile.timeZone, now));
  return next;
}
