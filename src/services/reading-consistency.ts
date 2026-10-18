import type { JourneyState } from "../lib/state";
import { getPlan, planId, currentDay } from "./reading-plan";
import { dateInZone, addDays } from "../lib/dates";
import {
  GraceDayError,
  graceEligibility,
  graceDatesSchema,
  mergeGraceDates,
} from "../lib/grace-days";
export function nextUnfinishedMission(state: JourneyState, today: string) {
  const schedule = getPlan(planId(state)),
    dueDay = currentDay(state.profile.startDate, today);
  const next = schedule.find((m) => !state.days[m.day]);
  const overdue = schedule.filter(
    (m) => m.day < dueDay && !state.days[m.day],
  ).length;
  const due = schedule.filter(
    (m) => m.day <= dueDay && !state.days[m.day],
  ).length;
  const chapter =
    next?.chapters.find((c) => !state.chapters[c.key]) ?? next?.chapters[0];
  return { next, chapter, dueDay, overdue, due };
}
export function claimGraceDay(
  state: JourneyState,
  date: string,
  now = new Date(),
): JourneyState {
  const dates = state.graceDates ?? [];
  if (dates.includes(date)) return state;
  const today = dateInZone(state.profile.timeZone, now);
  if (date !== addDays(today, -1)) throw new GraceDayError("grace_invalid_day");
  const eligibility = graceEligibility(state.days, dates, today);
  if (eligibility.code) throw new GraceDayError(eligibility.code);
  return {
    ...state,
    graceDates: graceDatesSchema.parse([...dates, date].sort()),
  };
}
export function mergedGraceHistory(
  current: JourneyState,
  backup: { chapters: Record<string, string>; graceDates?: string[] },
): string[] {
  const dates = mergeGraceDates(
    current.graceDates ?? [],
    backup.graceDates ?? [],
  );
  const chapters = { ...backup.chapters, ...current.chapters };
  const missionDates = new Set(Object.values(current.days));
  for (const m of getPlan(planId(current)))
    if (!current.days[m.day] && m.chapters.every((c) => chapters[c.key]))
      missionDates.add(
        m.chapters
          .map((c) => chapters[c.key])
          .sort()
          .at(-1)!,
      );
  for (const d of backup.graceDates ?? [])
    if (!missionDates.has(addDays(d, -1)))
      throw new Error(
        "Each restored grace date needs a completed mission on the previous date in the merged reading history.",
      );
  return dates;
}
