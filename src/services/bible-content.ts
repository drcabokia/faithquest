import { z } from "zod";
import type { BookId } from "../data/books";
const chapterSchema = z.object({
  book: z.string(),
  chapter: z.number().int().positive(),
  translation: z.literal("WEB"),
  verses: z
    .array(z.object({ number: z.number().int().positive(), text: z.string() }))
    .min(1),
});
export type BibleChapter = z.infer<typeof chapterSchema>;
export interface BibleContentProvider {
  getChapter(
    book: BookId,
    chapter: number,
    signal?: AbortSignal,
  ): Promise<BibleChapter>;
}
export class BundledWebProvider implements BibleContentProvider {
  async getChapter(book: BookId, chapter: number, signal?: AbortSignal) {
    const response = await fetch(`/bible/${book}/${chapter}.json`, { signal });
    if (!response.ok)
      throw new Error("Scripture could not be loaded. Please try again.");
    const result = chapterSchema.parse(await response.json());
    if (result.book !== book || result.chapter !== chapter)
      throw new Error("Scripture reference does not match.");
    return result;
  }
}
export const bibleContent: BibleContentProvider = new BundledWebProvider();
