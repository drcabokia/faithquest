import type { JourneyState } from "./state";
import { hasPlanActivity } from "@/services/select-reading-plan";

// Derive onboarding from confirmed saved content, not an account age or a
// browser-only dismissal flag. A resume location alone is not saved progress.
export function isFirstJourney(state: JourneyState) {
  return (
    !hasPlanActivity(state) &&
    [state.savedVerses, state.verseNotes, state.prayers].every(
      (entries) => Object.keys(entries ?? {}).length === 0,
    ) &&
    !state.fellowshipMemberships?.length &&
    !state.earnedAchievements?.length
  );
}
