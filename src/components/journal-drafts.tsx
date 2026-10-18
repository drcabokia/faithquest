"use client";
import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { JournalCategory } from "@/lib/journal";

export type JournalDraft = {
  text: string;
  category: JournalCategory;
  baseText: string;
  baseCategory: JournalCategory;
};
const Context = createContext<{
  drafts: Record<string, JournalDraft>;
  put: (date: string, draft: JournalDraft) => void;
  remove: (date: string, expected?: JournalDraft) => void;
} | null>(null);

// The journey layout keeps this memory across internal navigation and destroys
// it on leaving the signed-in/demo area. Never persist drafts in web storage.
export function JournalDraftProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [drafts, setDrafts] = useState<Record<string, JournalDraft>>({});
  const pathname = usePathname();
  const count = Object.keys(drafts).length;
  useEffect(() => {
    if (!count) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [count]);
  return (
    <Context
      value={{
        drafts,
        put: (date, draft) =>
          setDrafts((current) => ({ ...current, [date]: draft })),
        remove: (date, expected) =>
          setDrafts((current) => {
            if (expected && current[date] !== expected) return current;
            const next = { ...current };
            delete next[date];
            return next;
          }),
      }}
    >
      {count > 0 && pathname !== "/journal" && (
        <p className="card journal-draft-banner" role="status">
          You have {count} unsaved journal {count === 1 ? "draft" : "drafts"} in
          this tab. <Link href="/journal">Return to journal</Link> to save or
          discard.
        </p>
      )}
      {children}
    </Context>
  );
}
export function useJournalDrafts() {
  const value = useContext(Context);
  if (!value) throw new Error("Journal draft provider required.");
  return value;
}
