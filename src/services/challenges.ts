import type { JourneyState } from "../lib/state";
import { dateInZone } from "../lib/dates";
import { challengeProgress, mergeChallengeStarts } from "../lib/challenges";

// Called only by explicit commands, never by a snapshot read or component render.
export function awardChallenges(state: JourneyState, today: string) {
  for (const start of state.challengeStarts ?? []) {
    const progress = challengeProgress(start, Object.values(state.days), today);
    const key = `challenge:${start}`;
    if (progress.count === 7 && !state.rewards[key])
      state.rewards[key] = { amount: 100, date: progress.end };
  }
}
export function joinChallenge(
  state: JourneyState,
  now = new Date(),
): JourneyState {
  const today = dateInZone(state.profile.timeZone, now);
  const starts = state.challengeStarts ?? [];
  if (
    starts.some(
      (start) =>
        start <= today && challengeProgress(start, [], today).end >= today,
    )
  )
    return state;
  if (
    365 -
      Object.keys(state.days).length +
      (Object.values(state.days).includes(today) ? 1 : 0) <
    7
  )
    throw new Error(
      "There are not enough unfinished missions for a new seven-day challenge.",
    );
  const next = structuredClone(state);
  next.challengeStarts = mergeChallengeStarts(starts, [today]);
  return next;
}
