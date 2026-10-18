"use client";
import type { JournalCategory } from "@/lib/journal";
import { createContext, useContext } from "react";
import type { JourneyState, Profile } from "@/lib/state";
import type { BookId } from "@/data/books";
import type { RestoreData } from "@/lib/backup";
import type { PlanId } from "@/services/reading-plan";
export type JourneyContextValue = {
  mode: "demo" | "supabase";
  state: JourneyState | null;
  today: string;
  error: string | null;
  notice: string | null;
  busy: boolean;
  remember: (book: BookId, chapter: number) => Promise<void>;
  complete: (key: string) => Promise<void>;
  answer: (id: string, answer: number) => Promise<void>;
  reflect: (
    date: string,
    text: string,
    category?: JournalCategory,
  ) => Promise<boolean>;
  profile: (profile: Profile) => Promise<boolean>;
  refresh?: () => Promise<void>;
  joinChallenge: () => Promise<boolean>;
  selectPlan: (plan: PlanId) => Promise<boolean>;
  restore: (backup: RestoreData) => Promise<boolean>;
  saveNote: (
    book: BookId,
    chapter: number,
    verse: number,
    text: string | null,
    expectedText: string | null,
  ) => Promise<boolean>;
  saveVerse: (
    book: BookId,
    chapter: number,
    verse: number,
    saved: boolean,
  ) => Promise<boolean>;
};
export const JourneyContext = createContext<JourneyContextValue | null>(null);
export function useJourney() {
  const value = useContext(JourneyContext);
  if (!value) throw new Error("Journey provider is required.");
  return value;
}
export function JourneyLoading() {
  return (
    <div className="loading-state" role="status">
      <span className="loading-dot" />
      Opening your journey…
    </div>
  );
}
