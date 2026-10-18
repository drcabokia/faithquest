import { VerseNoteError } from "../lib/verse-notes";
import type { JourneyState } from "../lib/state";
import { isVerseKey, SAVED_VERSE_LIMIT } from "../lib/verses";
export function setSavedVerse(
  state: JourneyState,
  key: string,
  saved: boolean,
  now = new Date(),
): JourneyState {
  if (!isVerseKey(key))
    throw new Error("Choose a verse available in the bundled Bible.");
  const current = state.savedVerses ?? {};
  if (!saved && Object.hasOwn(state.verseNotes ?? {}, key))
    throw new VerseNoteError("verse_has_note");
  if (Object.hasOwn(current, key) === saved) return state;
  if (saved && Object.keys(current).length >= SAVED_VERSE_LIMIT)
    throw new Error(
      "You can keep up to 1,000 saved verses. Remove one before adding another.",
    );
  const savedVerses = { ...current };
  if (saved) savedVerses[key] = now.toISOString();
  else delete savedVerses[key];
  return { ...state, savedVerses };
}
