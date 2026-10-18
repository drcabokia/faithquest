import { VerseNoteDraftProvider } from "@/components/verse-note-drafts";
import { AppShell } from "@/components/layout/app-shell";
import { JournalDraftProvider } from "@/components/journal-drafts";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <JournalDraftProvider>
        <VerseNoteDraftProvider>{children}</VerseNoteDraftProvider>
      </JournalDraftProvider>
    </AppShell>
  );
}
