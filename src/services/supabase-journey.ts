import type { JournalCategory } from "@/lib/journal";
import "server-only";
import { isPrayerError, PrayerError, type PrayerChange } from "../lib/prayers";
import { isNoteError, VerseNoteError } from "../lib/verse-notes";
import type { SupabaseClient } from "@supabase/supabase-js";
import { stateSchema, type Profile } from "@/lib/state";
import type { BookId } from "@/data/books";
import type { ProductionJourneyRepository } from "./production-repository";
import { databaseRateLimit } from "../../supabase/functions/_shared/operations";
import type { PlanId } from "./reading-plan";
import { ReadingPlanSelectionError } from "./select-reading-plan";
export class SupabaseJourneyRepository implements ProductionJourneyRepository {
  constructor(private client: SupabaseClient) {}
  private async call(name: string, args?: Record<string, unknown>) {
    const { data, error } = await this.client.rpc(name, args);
    if (error) {
      const limit = databaseRateLimit(error);
      if (limit) throw limit;
      throw new Error(
        "Your account changes could not be saved. Please try again.",
      );
    }
    if (name === "select_reading_plan" && data?.error === "plan_locked")
      throw new ReadingPlanSelectionError();
    if (
      (name === "set_verse_note" || name === "set_saved_verse") &&
      isNoteError(data?.error)
    )
      throw new VerseNoteError(data.error);
    if (name === "mutate_prayer" && isPrayerError(data?.error))
      throw new PrayerError(data.error);
    return stateSchema.parse(data);
  }
  changePrayer(
    id: string,
    change: PrayerChange,
    expectedRevision: string | null,
  ) {
    return this.call("mutate_prayer", {
      p_id: id,
      p_action: change.action,
      p_value: change.value,
      p_expected_revision: expectedRevision,
    });
  }
  joinChallenge() {
    return this.call("join_reading_challenge");
  }
  selectPlan(plan: PlanId) {
    return this.call("select_reading_plan", { p_plan: plan });
  }
  getJourney() {
    return this.call("get_journey");
  }
  initialize(name: string, timeZone: string) {
    return this.call("ensure_journey", { p_name: name, p_timezone: timeZone });
  }
  completeChapter(book: BookId, chapter: number) {
    return this.call("complete_chapter", { p_book: book, p_chapter: chapter });
  }
  rememberChapter(book: BookId, chapter: number) {
    return this.call("remember_chapter", { p_book: book, p_chapter: chapter });
  }
  submitQuiz(questionId: string, selectedOption: number) {
    return this.call("submit_quiz", {
      p_question: questionId,
      p_option: selectedOption,
    });
  }
  saveReflection(date: string, content: string, category?: JournalCategory) {
    return category === undefined
      ? this.call("save_reflection", { p_date: date, p_content: content })
      : this.call("save_categorized_reflection", {
          p_date: date,
          p_content: content,
          p_category: category,
        });
  }
  setVerseNote(
    book: BookId,
    chapter: number,
    verse: number,
    text: string | null,
    expectedText: string | null,
  ) {
    return this.call("set_verse_note", {
      p_book: book,
      p_chapter: chapter,
      p_verse: verse,
      p_text: text,
      p_expected_text: expectedText,
    });
  }
  setSavedVerse(book: BookId, chapter: number, verse: number, saved: boolean) {
    return this.call("set_saved_verse", {
      p_book: book,
      p_chapter: chapter,
      p_verse: verse,
      p_saved: saved,
    });
  }
  updatePreferences(profile: Profile) {
    return this.call("update_journey_preferences", {
      p_name: profile.name,
      p_start_date: profile.startDate,
      p_timezone: profile.timeZone,
      p_theme: profile.theme,
    });
  }
}
