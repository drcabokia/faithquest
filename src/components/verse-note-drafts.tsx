"use client";
import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type VerseNoteDraft = { text: string; baseText: string | null };
const Context = createContext<{
  drafts: Record<string, VerseNoteDraft>;
  put: (key: string, draft: VerseNoteDraft) => void;
  remove: (key: string, expected?: VerseNoteDraft) => void;
} | null>(null);

export function VerseNoteDraftProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [drafts, setDrafts] = useState<Record<string, VerseNoteDraft>>({});
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
        put: (key, draft) =>
          setDrafts((current) => ({ ...current, [key]: draft })),
        remove: (key, expected) =>
          setDrafts((current) => {
            if (expected && current[key] !== expected) return current;
            const next = { ...current };
            delete next[key];
            return next;
          }),
      }}
    >
      {count > 0 && pathname !== "/study" && (
        <p className="card journal-draft-banner" role="status">
          You have {count} unsaved verse {count === 1 ? "note" : "notes"} in
          this tab. <Link href="/study">Return to Study Tools</Link> to save or
          discard.
        </p>
      )}
      {children}
    </Context>
  );
}
export function useVerseNoteDrafts() {
  const value = useContext(Context);
  if (!value) throw new Error("Verse note draft provider required.");
  return value;
}
