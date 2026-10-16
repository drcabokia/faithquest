import type { BookId } from "../data/books";
import type { JourneyState, Profile } from "../lib/state";
/** Authenticated command contract. Never accept a browser-minted XP ledger.
 * Each command verifies auth and ownership server-side, then returns server-derived state.
 * Quiz responses expose explanations only after the protected submission transaction.
 */
export interface ProductionJourneyRepository {
  getJourney(): Promise<JourneyState>;
  completeChapter(book: BookId, chapter: number): Promise<JourneyState>;
  submitQuiz(questionId: string, selectedOption: number): Promise<JourneyState>;
  saveReflection(date: string, content: string): Promise<JourneyState>;
  updatePreferences(profile: Profile): Promise<JourneyState>;
}
