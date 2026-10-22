import type { PrayerChange } from "@/lib/prayers";
import type { JournalCategory } from "@/lib/journal";
import type { BookId } from "../data/books";
import type { JourneyState, Profile } from "../lib/state";
import type { PlanId } from "./reading-plan";
/** Authenticated command contract. Never accept a browser-minted XP ledger.
 * Each command verifies auth and ownership server-side, then returns server-derived state.
 * Quiz responses expose explanations only after the protected submission transaction.
 */
export interface ProductionJourneyRepository {
  changePrayer(
    id: string,
    change: PrayerChange,
    expectedRevision: string | null,
  ): Promise<JourneyState>;
  selectPlan(plan: PlanId): Promise<JourneyState>;
  claimGrace(date: string): Promise<JourneyState>;
  joinChallenge(): Promise<JourneyState>;
  getJourney(): Promise<JourneyState>;
  completeChapter(book: BookId, chapter: number): Promise<JourneyState>;
  submitQuiz(questionId: string, selectedOption: number): Promise<JourneyState>;
  saveReflection(
    date: string,
    content: string,
    category: JournalCategory,
    expectedRevision: string | null,
  ): Promise<JourneyState>;
  setVerseNote(
    book: BookId,
    chapter: number,
    verse: number,
    text: string | null,
    expectedText: string | null,
  ): Promise<JourneyState>;
  setSavedVerse(
    book: BookId,
    chapter: number,
    verse: number,
    saved: boolean,
  ): Promise<JourneyState>;
  updatePreferences(profile: Profile): Promise<JourneyState>;
}
