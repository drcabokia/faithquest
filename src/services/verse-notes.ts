import type { JourneyState } from "../lib/state";
import { isVerseKey } from "../lib/verses";
import { noteTextSchema, VerseNoteError } from "../lib/verse-notes";

export function setVerseNote(
  state: JourneyState,
  key: string,
  text: string | null,
  expectedText: string | null,
  now = new Date(),
): JourneyState {
  if (!isVerseKey(key))
    throw new Error("Choose a verse available in the bundled Bible.");
  if (!Object.hasOwn(state.savedVerses ?? {}, key))
    throw new VerseNoteError("verse_not_saved");
  const value = text === null ? null : noteTextSchema.parse(text);
  const current = state.verseNotes?.[key]?.text ?? null;
  if (current === value) return state;
  if (current !== expectedText) throw new VerseNoteError("note_conflict");
  const verseNotes = { ...state.verseNotes };
  if (value === null) delete verseNotes[key];
  else verseNotes[key] = { text: value, updatedAt: now.toISOString() };
  return { ...state, verseNotes };
}
