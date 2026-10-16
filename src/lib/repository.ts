import { stateSchema, type JourneyState } from "./state";
export const STORAGE_KEY = "faithquest365.demo.v1";
export interface JourneyRepository {
  load(): JourneyState | null;
  save(state: JourneyState): void;
}
export class DemoJourneyRepository implements JourneyRepository {
  load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return stateSchema.parse(JSON.parse(raw));
  }
  save(state: JourneyState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateSchema.parse(state)));
  }
}
// Production must implement authenticated server operations, not trust browser snapshots or demo XP.
