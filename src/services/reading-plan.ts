import { BOOKS, type BookId } from "../data/books";
import { dayDistance } from "../lib/dates";
export type ChapterRef = { book: BookId; chapter: number; key: string };
export type Mission = { day: number; chapters: ChapterRef[]; label: string };
export const ALL_CHAPTERS: ChapterRef[] = BOOKS.flatMap((book) =>
  Array.from({ length: book.chapters }, (_, i) => ({
    book: book.id,
    chapter: i + 1,
    key: `${book.id}.${i + 1}`,
  })),
);
export const CHAPTER_KEYS = new Set(ALL_CHAPTERS.map((c) => c.key));
export const PLAN: Mission[] = Array.from({ length: 365 }, (_, i) => {
  const chapters = ALL_CHAPTERS.slice(
    Math.floor((i * 1189) / 365),
    Math.floor(((i + 1) * 1189) / 365),
  );
  const groups: string[] = [];
  for (const book of BOOKS) {
    const selected = chapters.filter((c) => c.book === book.id);
    if (selected.length)
      groups.push(
        `${book.name} ${selected[0].chapter}${selected.length > 1 ? `–${selected.at(-1)!.chapter}` : ""}`,
      );
  }
  return { day: i + 1, chapters, label: groups.join(" · ") };
});
export function currentDay(startDate: string, today: string): number {
  return Math.min(365, Math.max(1, dayDistance(startDate, today) + 1));
}
export function getMission(day: number): Mission {
  if (!Number.isInteger(day) || day < 1 || day > 365)
    throw new Error("Choose a reading day from 1 to 365.");
  return PLAN[day - 1];
}
export function bookName(id: string): string {
  return BOOKS.find((b) => b.id === id)?.name ?? id;
}
