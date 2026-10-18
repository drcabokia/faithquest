import { z } from "zod";
import index from "../data/verse-index.json";
import { bookName } from "../services/reading-plan";
const limits: Record<string, number> = index.chapters;
const empty = new Set(index.empty);
export const SAVED_VERSE_LIMIT = 1000;
export function isVerseKey(key: string): boolean {
  const match = /^([A-Z0-9]{3})\.([1-9]\d{0,2})\.([1-9]\d{0,2})$/.exec(key);
  if (!match) return false;
  const chapterKey = `${match[1]}.${match[2]}`;
  return (
    Object.hasOwn(limits, chapterKey) &&
    Number(match[3]) <= limits[chapterKey] &&
    !empty.has(key)
  );
}
export const verseKeySchema = z.string().refine(isVerseKey);
export const verseReferenceSchema = z
  .object({
    book: z.string(),
    chapter: z.number().int().positive(),
    verse: z.number().int().positive(),
  })
  .strict()
  .refine((ref) => isVerseKey(`${ref.book}.${ref.chapter}.${ref.verse}`));
export function verseReference(key: string) {
  const [book, chapter, verse] = key.split(".");
  return { book, chapter: Number(chapter), verse: Number(verse) };
}
export function verseLabel(key: string) {
  const { book, chapter, verse } = verseReference(key);
  return `${bookName(book)} ${chapter}:${verse}`;
}
