import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { stateSchema, type Profile } from "@/lib/state";
import type { BookId } from "@/data/books";
import type { ProductionJourneyRepository } from "./production-repository";
export class SupabaseJourneyRepository implements ProductionJourneyRepository {
  constructor(private client: SupabaseClient) {}
  private async call(name: string, args?: Record<string, unknown>) {
    const { data, error } = await this.client.rpc(name, args);
    if (error)
      throw new Error(
        "Your account changes could not be saved. Please try again.",
      );
    return stateSchema.parse(data);
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
  saveReflection(date: string, content: string) {
    return this.call("save_reflection", { p_date: date, p_content: content });
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
