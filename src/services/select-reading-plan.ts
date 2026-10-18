import { z } from "zod";
import type { JourneyState } from "../lib/state";
import { PLAN_IDS, planId, type PlanId } from "./reading-plan";
export class ReadingPlanSelectionError extends Error {
  constructor() {
    super(
      "Your reading plan is fixed after your first activity. You can still preview other plans.",
    );
  }
}

export function hasPlanActivity(state: JourneyState): boolean {
  return (
    [
      state.chapters,
      state.days,
      state.rewards,
      state.attempts,
      state.reflections,
    ].some((v) => Object.keys(v).length > 0) || !!state.challengeStarts?.length
  );
}
export function selectReadingPlan(
  state: JourneyState,
  id: PlanId,
): JourneyState {
  z.enum(PLAN_IDS).parse(id);
  if (planId(state) === id) return state;
  if (hasPlanActivity(state)) throw new ReadingPlanSelectionError();
  return { ...state, readingPlan: id };
}
