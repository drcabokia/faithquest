import { z } from "zod";
import { addDays, dayDistance } from "./dates";
export const GRACE_GAP = 30;
export const GRACE_LIMIT = 1000;
export const graceDatesSchema = z
  .array(z.iso.date())
  .max(GRACE_LIMIT)
  .refine((dates) =>
    dates.every((d, i) => i === 0 || dayDistance(dates[i - 1], d) >= GRACE_GAP),
  );
export function mergeGraceDates(
  current: string[],
  incoming: string[],
): string[] {
  const merged = [...new Set([...current, ...incoming])].sort();
  if (!graceDatesSchema.safeParse(merged).success)
    throw new Error(
      "Grace dates must be at least 30 calendar days apart, with no more than 1,000 dates. The backup was not merged.",
    );
  return merged;
}
export const GRACE_ERRORS = {
  grace_invalid_day:
    "Grace can cover yesterday only. Check saved progress and reopen the grace confirmation for the current date.",
  grace_reading_exists:
    "Yesterday already has a completed reading mission. No grace is needed.",
  grace_no_prior_reading:
    "Grace protects an existing reading rhythm. It needs a completed mission on the date before the missed day.",
  grace_cooldown:
    "Grace dates must be at least 30 calendar days apart. Your saved reading is unchanged.",
  grace_limit: "The grace history limit has been reached.",
} as const;
export class GraceDayError extends Error {
  constructor(public readonly code: keyof typeof GRACE_ERRORS) {
    super(GRACE_ERRORS[code]);
  }
}
export function isGraceError(v: unknown): v is keyof typeof GRACE_ERRORS {
  return typeof v === "string" && Object.hasOwn(GRACE_ERRORS, v);
}
export function graceEligibility(
  days: Record<string, string>,
  graceDates: string[],
  today: string,
) {
  const date = addDays(today, -1),
    read = new Set(Object.values(days));
  const nextEligible = graceDates.length
    ? addDays(graceDates.at(-1)!, GRACE_GAP)
    : null;
  if (graceDates.includes(date))
    return {
      date,
      available: false,
      reason: "Grace is already saved for yesterday.",
      nextEligible,
    };
  const code: keyof typeof GRACE_ERRORS | undefined = read.has(date)
    ? "grace_reading_exists"
    : !read.has(addDays(date, -1))
      ? "grace_no_prior_reading"
      : graceDates.length >= GRACE_LIMIT
        ? "grace_limit"
        : graceDates.some((d) => Math.abs(dayDistance(d, date)) < GRACE_GAP)
          ? "grace_cooldown"
          : undefined;
  return {
    date,
    available: !code,
    reason: code ? GRACE_ERRORS[code] : null,
    code,
    nextEligible,
  };
}
export function readingRhythm(
  days: Record<string, string>,
  graceDates: string[],
  today: string,
) {
  const read = new Set(Object.values(days)),
    grace = new Set(graceDates);
  let date = read.has(today) ? today : addDays(today, -1),
    readingDays = 0,
    graceDays = 0;
  while (read.has(date) || grace.has(date)) {
    if (read.has(date)) readingDays++;
    else graceDays++;
    date = addDays(date, -1);
  }
  return { readingDays, graceDays };
}
