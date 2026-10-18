"use client";
import { changePrayer } from "@/services/prayers";
import { setVerseNote } from "@/services/verse-notes";
import type { JournalCategory } from "@/lib/journal";
import { joinChallenge } from "@/services/challenges";
import { selectReadingPlan } from "@/services/select-reading-plan";
import { restoreDemo } from "@/services/restore-demo";
import { setSavedVerse } from "@/services/saved-verses";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { DemoJourneyRepository, STORAGE_KEY } from "@/lib/repository";
import {
  initialState,
  profileSchema,
  type JourneyState,
  type Profile,
} from "@/lib/state";
import { CHAPTER_KEYS } from "@/services/reading-plan";
import type { BookId } from "@/data/books";
import { dateInZone } from "@/lib/dates";
import {
  completeChapter,
  saveReflection,
  submitAnswer,
  totalXp,
} from "@/services/gamification";
import { JourneyContext as Context } from "./journey-context";
import { QUESTIONS } from "@/data/quizzes";
function withFeedback(state: JourneyState): JourneyState {
  return {
    ...state,
    attempts: Object.fromEntries(
      Object.entries(state.attempts).map(([id, attempt]) => {
        const question = QUESTIONS.find((q) => q.id === id);
        return [
          id,
          question
            ? {
                ...attempt,
                correctOption: question.correct,
                explanation: question.explanation,
              }
            : attempt,
        ];
      }),
    ),
  };
}
type Snapshot = {
  state: JourneyState | null;
  error: string | null;
  blocked: boolean;
};
const server: Snapshot = { state: null, error: null, blocked: false };
let snapshot = server;
let initialized = false;
const listeners = new Set<() => void>();
const repository = new DemoJourneyRepository();
function publish(value: Snapshot) {
  snapshot = value;
  listeners.forEach((fn) => fn());
}
function load() {
  try {
    publish({
      state: withFeedback(repository.load() ?? initialState()),
      error: null,
      blocked: false,
    });
  } catch {
    publish({
      state: initialState(),
      error:
        "Your saved demo could not be read. Existing data has been left untouched. Check this browser’s storage settings before continuing.",
      blocked: true,
    });
  }
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  if (!initialized) {
    initialized = true;
    load();
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY || e.key === null) load();
    });
  }
  return () => {
    listeners.delete(fn);
  };
}
export function DemoJourneyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const data = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => server,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const theme = data.state?.profile.theme;
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" || !theme
          ? media.matches
            ? "dark"
            : "light"
          : theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  const mutate = useCallback(
    async (
      change: (state: JourneyState) => JourneyState,
      message: string | null,
    ) => {
      if (snapshot.blocked) {
        return false;
      }
      setBusy(true);
      const commit = () => {
        try {
          const before = withFeedback(
            repository.load() ?? snapshot.state ?? initialState(),
          );
          const next = change(before);
          repository.save(next);
          publish({ state: next, error: null, blocked: false });
          const earned = totalXp(next) - totalXp(before);
          if (message)
            setNotice(earned > 0 ? `${message} +${earned} XP` : message);
          return true;
        } catch (error) {
          publish({
            ...snapshot,
            error:
              error instanceof Error
                ? error.message
                : "Changes could not be saved. Please try again.",
          });
          return false;
        }
      };
      try {
        return navigator.locks
          ? await navigator.locks.request("faithquest365-demo-write", commit)
          : commit();
      } finally {
        setBusy(false);
      }
    },
    [],
  );
  const remember = useCallback(
    async (book: BookId, chapter: number) => {
      await mutate((s) => {
        if (!CHAPTER_KEYS.has(`${book}.${chapter}`))
          throw new Error("Unknown chapter.");
        if (s.resume?.book === book && s.resume.chapter === chapter) return s;
        return { ...s, resume: { book, chapter } };
      }, null);
    },
    [mutate],
  );
  const complete = async (key: string) => {
    await mutate(
      (s) => completeChapter(s, key),
      "Chapter completed. Keep growing!",
    );
  };
  const answer = async (id: string, answer: number) => {
    await mutate((s) => submitAnswer(s, id, answer), "Answer recorded.");
  };
  const reflect = (date: string, text: string, category?: JournalCategory) =>
    mutate(
      (s) => saveReflection(s, date, text, new Date(), category),
      "Reflection saved.",
    );
  const profile = (profile: Profile) =>
    mutate((s) => {
      const parsed = profileSchema.parse(profile);
      if (parsed.startDate > dateInZone(parsed.timeZone))
        throw new Error("Choose a start date of today or earlier.");
      if (
        Object.keys(s.rewards).length ||
        Object.keys(s.chapters).length ||
        Object.keys(s.attempts).length ||
        (s.challengeStarts?.length ?? 0)
      ) {
        if (parsed.timeZone !== s.profile.timeZone)
          throw new Error(
            "Your journey timezone is fixed after your first activity.",
          );
      }
      return { ...s, profile: parsed };
    }, "Preferences saved.");
  return (
    <Context
      value={{
        mode: "demo",
        state: data.state,
        today: dateInZone(data.state?.profile.timeZone ?? "UTC", clock),
        error: data.error,
        notice,
        busy,
        remember,
        complete,
        answer,
        reflect,
        joinChallenge: () =>
          mutate((s) => joinChallenge(s), "Seven-day challenge started."),
        profile,
        selectPlan: (plan) =>
          mutate((s) => selectReadingPlan(s, plan), "Reading plan selected."),
        saveNote: (book, chapter, verse, text, expectedText) =>
          mutate(
            (s) =>
              setVerseNote(
                s,
                `${book}.${chapter}.${verse}`,
                text,
                expectedText,
              ),
            text === null ? "Private note deleted." : "Private note saved.",
          ),
        changePrayer: (id, change, expectedRevision) =>
          mutate(
            (s) => changePrayer(s, id, change, expectedRevision),
            "Prayer changes saved.",
          ),
        saveVerse: (book, chapter, verse, saved) =>
          mutate(
            (s) => setSavedVerse(s, `${book}.${chapter}.${verse}`, saved),
            saved ? "Verse saved." : "Verse removed from saved verses.",
          ),
        restore: (backup) =>
          mutate(
            (s) => restoreDemo(s, backup),
            "Backup merged. Your existing entries were kept.",
          ),
      }}
    >
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {notice && (
          <div className="toast">
            <span className="toast-spark">✦</span>
            {notice}
          </div>
        )}
      </div>
    </Context>
  );
}
