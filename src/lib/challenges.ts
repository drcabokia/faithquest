import { z } from "zod";
import { addDays, dayDistance } from "./dates";

export const CHALLENGE_LIMIT = 1000;
export const challengeStartsSchema = z
  .array(z.iso.date())
  .max(CHALLENGE_LIMIT)
  .refine((starts) => {
    const sorted = [...starts].sort();
    return sorted.every(
      (date, i) => i === 0 || dayDistance(sorted[i - 1], date) >= 7,
    );
  }, "Challenge periods cannot overlap.");
export function mergeChallengeStarts(current: string[], incoming: string[]) {
  const result = challengeStartsSchema.safeParse(
    [...new Set([...current, ...incoming])].sort(),
  );
  if (!result.success)
    throw new Error(
      "Challenge periods overlap or exceed the 1,000-challenge limit. Your saved journey was not changed.",
    );
  return result.data;
}
export function challengeProgress(
  start: string,
  completionDates: string[],
  today: string,
) {
  const completed = new Set(completionDates.filter((date) => date <= today));
  const dates = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    return {
      date,
      status: completed.has(date)
        ? "done"
        : date < today
          ? "missed"
          : date === today
            ? "today"
            : "upcoming",
    } as const;
  });
  const count = dates.filter((d) => d.status === "done").length;
  const end = addDays(start, 6);
  return {
    start,
    end,
    dates,
    count,
    status: count === 7 ? "completed" : today > end ? "ended" : "active",
  } as const;
}
