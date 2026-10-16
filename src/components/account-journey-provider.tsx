"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { JourneyContext } from "./journey-context";
import { stateSchema, type JourneyState, type Profile } from "@/lib/state";
import type { JourneyCommand } from "@/lib/commands";
import type { BookId } from "@/data/books";
import { dateInZone } from "@/lib/dates";
import { totalXp } from "@/services/gamification-display";
import { browserSupabase } from "@/lib/supabase/browser";
const paths = new Set([
  "/dashboard",
  "/reading-plan",
  "/bible",
  "/quiz",
  "/journal",
  "/achievements",
  "/community",
  "/profile",
]);
async function requestState(command?: JourneyCommand) {
  const response = await fetch("/api/journey", {
    method: command ? "POST" : "GET",
    headers: command ? { "Content-Type": "application/json" } : undefined,
    body: command ? JSON.stringify(command) : undefined,
    cache: "no-store",
    credentials: "same-origin",
  });
  if (response.status === 401) {
    window.location.replace("/login");
    throw new Error("Please sign in again.");
  }
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.error ?? "Your journey could not be saved. Please retry.",
    );
  return stateSchema.parse(data.state);
}
export function AccountJourneyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname(),
    active = paths.has(pathname);
  const [state, setState] = useState<JourneyState | null>(null),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [clock, setClock] = useState(() => new Date());
  const latest = useRef<JourneyState | null>(null),
    queue = useRef<Promise<unknown>>(Promise.resolve());
  const apply = useCallback((next: JourneyState) => {
    latest.current = next;
    setState(next);
    setError(null);
  }, []);
  useEffect(() => {
    if (!active) return;
    let live = true;
    const initialize = async () => {
      try {
        const next = await requestState({
          type: "initialize",
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        });
        if (live) apply(next);
      } catch (error) {
        if (live)
          setError(
            error instanceof Error
              ? error.message
              : "Your journey could not be loaded.",
          );
      }
    };
    void initialize();
    const refresh = () => {
      queue.current = queue.current
        .catch(() => {})
        .then(async () => {
          try {
            const next = await requestState();
            if (live) apply(next);
          } catch (error) {
            if (live)
              setError(
                error instanceof Error
                  ? error.message
                  : "Could not refresh your journey.",
              );
          }
        });
    };
    const client = browserSupabase();
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        latest.current = null;
        setState(null);
        window.location.replace("/login");
      }
      if (event === "TOKEN_REFRESHED") setTimeout(refresh, 0);
    });
    window.addEventListener("focus", refresh);
    return () => {
      live = false;
      data.subscription.unsubscribe();
      window.removeEventListener("focus", refresh);
    };
  }, [active, apply]);
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const theme = state?.profile.theme;
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme:dark)");
    const change = () => {
      document.documentElement.dataset.theme =
        !theme || theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : theme;
    };
    change();
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, [theme]);
  const mutate = useCallback(
    (command: JourneyCommand, message: string | null) => {
      const result = queue.current
        .catch(() => {})
        .then(async () => {
          setBusy(true);
          try {
            const before = latest.current;
            const next = await requestState(command);
            apply(next);
            if (message) {
              const gained = before ? totalXp(next) - totalXp(before) : 0;
              setNotice(gained > 0 ? `${message} +${gained} XP` : message);
            }
            return true;
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Changes could not be saved.",
            );
            return false;
          } finally {
            setBusy(false);
          }
        });
      queue.current = result;
      return result;
    },
    [apply],
  );
  const remember = useCallback(
    async (book: BookId, chapter: number) => {
      if (
        latest.current?.resume?.book === book &&
        latest.current.resume.chapter === chapter
      )
        return;
      await mutate({ type: "remember", book, chapter }, null);
    },
    [mutate],
  );
  const complete = async (key: string) => {
    const [book, chapter] = key.split(".");
    await mutate(
      { type: "complete", book, chapter: Number(chapter) },
      "Chapter completed. Keep growing!",
    );
  };
  const answer = async (id: string, answer: number) => {
    await mutate({ type: "answer", id, answer }, "Answer recorded.");
  };
  const reflect = (date: string, text: string) =>
    mutate({ type: "reflect", date, text }, "Reflection saved.");
  const profile = (profile: Profile) =>
    mutate({ type: "profile", profile }, "Preferences saved.");
  return (
    <JourneyContext
      value={{
        mode: "supabase",
        state,
        error,
        notice,
        busy,
        today: dateInZone(state?.profile.timeZone ?? "UTC", clock),
        remember,
        complete,
        answer,
        reflect,
        profile,
      }}
    >
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {notice && <div className="toast">{notice}</div>}
      </div>
    </JourneyContext>
  );
}
