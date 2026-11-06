import { PrayerDraftProvider } from "@/components/prayer-drafts";
import { VerseNoteDraftProvider } from "@/components/verse-note-drafts";
import { AppShell } from "@/components/layout/app-shell";
import { JournalDraftProvider } from "@/components/journal-drafts";
import type { Metadata } from "next";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <JournalDraftProvider>
        <VerseNoteDraftProvider>
          <PrayerDraftProvider>{children}</PrayerDraftProvider>
        </VerseNoteDraftProvider>
      </JournalDraftProvider>
    </AppShell>
  );
}
