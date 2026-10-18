import { z } from "zod";
import { verseKeySchema, SAVED_VERSE_LIMIT } from "./verses";

export const VERSE_NOTE_LIMIT = 2000;
export const noteLength = (text: string) => Array.from(text).length;
export const noteTextSchema = z
  .string()
  .trim()
  .min(1)
  .refine((v) => noteLength(v) <= VERSE_NOTE_LIMIT);
export const verseNotesSchema = z
  .record(
    verseKeySchema,
    z.object({ text: noteTextSchema, updatedAt: z.iso.datetime() }),
  )
  .refine((notes) => Object.keys(notes).length <= SAVED_VERSE_LIMIT);
export const restoredVerseNotesSchema = z
  .record(verseKeySchema, noteTextSchema)
  .refine((notes) => Object.keys(notes).length <= SAVED_VERSE_LIMIT);

export const NOTE_ERRORS = {
  note_conflict:
    "This note changed elsewhere. Check saved progress and review the saved note before trying again. Your draft is still here.",
  verse_not_saved:
    "This verse is no longer saved. Your draft is still here. Save the verse again before saving its note.",
  verse_has_note: "Delete the private note before removing this saved verse.",
} as const;
export class VerseNoteError extends Error {
  constructor(public readonly code: keyof typeof NOTE_ERRORS) {
    super(NOTE_ERRORS[code]);
  }
}
export function isNoteError(value: unknown): value is keyof typeof NOTE_ERRORS {
  return typeof value === "string" && Object.hasOwn(NOTE_ERRORS, value);
}
