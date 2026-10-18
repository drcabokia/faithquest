"use client";
import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PrayerStatus } from "@/lib/prayers";
export type PrayerDraft = { id: string; baseRevision: string | null } & (
  | { kind: "request"; title: string; text: string; status: PrayerStatus }
  | { kind: "followUp"; followUpId: string; text: string; date: string }
);
const Context = createContext<{
  drafts: Record<string, PrayerDraft>;
  put: (key: string, draft: PrayerDraft) => void;
  remove: (key: string, expected?: PrayerDraft) => void;
} | null>(null);
export function PrayerDraftProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [drafts, setDrafts] = useState<Record<string, PrayerDraft>>({});
  const pathname = usePathname();
  const count = Object.keys(drafts).length;
  useEffect(() => {
    if (!count) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [count]);
  return (
    <Context
      value={{
        drafts,
        put: (key, draft) => setDrafts((d) => ({ ...d, [key]: draft })),
        remove: (key, expected) =>
          setDrafts((d) => {
            if (expected && d[key] !== expected) return d;
            const next = { ...d };
            delete next[key];
            return next;
          }),
      }}
    >
      {count > 0 && pathname !== "/prayers" && (
        <p className="card journal-draft-banner" role="status">
          You have {count} unsaved prayer {count === 1 ? "draft" : "drafts"} in
          this tab. <Link href="/prayers">Return to Prayer Requests</Link> to
          save or discard.
        </p>
      )}
      {children}
    </Context>
  );
}
export function usePrayerDrafts() {
  const value = useContext(Context);
  if (!value) throw new Error("Prayer draft provider required.");
  return value;
}
