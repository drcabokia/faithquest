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
export const PLAN_IDS = ["canonical-v1", "balanced-v1"] as const;
export type PlanId = (typeof PLAN_IDS)[number];
export const PLAN_DETAILS = {
  "canonical-v1": {
    name: "Canonical Journey",
    description: "Read from Genesis to Revelation in Bible book order.",
  },
  "balanced-v1": {
    name: "Balanced Daily Journey",
    description:
      "Explore the Old Testament, New Testament and Psalms/Proverbs across the year. The daily mix varies.",
  },
} as const;
export function makeMission(day: number, chapters: ChapterRef[]): Mission {
  const groups: string[] = [];
  for (let i = 0; i < chapters.length;) {
    const first = chapters[i];
    let end = i;
    while (
      end + 1 < chapters.length &&
      chapters[end + 1].book === first.book &&
      chapters[end + 1].chapter === chapters[end].chapter + 1
    )
      end++;
    groups.push(
      `${bookName(first.book)} ${first.chapter}${end > i ? `–${chapters[end].chapter}` : ""}`,
    );
    i = end + 1;
  }
  return { day, chapters, label: groups.join(" · ") };
}
export const PLAN: Mission[] = Array.from({ length: 365 }, (_, i) =>
  makeMission(
    i + 1,
    ALL_CHAPTERS.slice(
      Math.floor((i * 1189) / 365),
      Math.floor(((i + 1) * 1189) / 365),
    ),
  ),
);
const wisdom = ALL_CHAPTERS.filter((c) => c.book === "PSA" || c.book === "PRO");
const ntBooks = new Set<BookId>(
  BOOKS.filter((b) => b.testament === "NT").map((b) => b.id),
);
const nt = ALL_CHAPTERS.filter((c) => ntBooks.has(c.book));
const ot = ALL_CHAPTERS.filter(
  (c) => !ntBooks.has(c.book) && c.book !== "PSA" && c.book !== "PRO",
);
export const BALANCED_PLAN: Mission[] = Array.from({ length: 365 }, (_, i) => {
  const portion = (stream: ChapterRef[], round: (n: number) => number) =>
    stream.slice(
      round((i * stream.length) / 365),
      round(((i + 1) * stream.length) / 365),
    );
  return makeMission(i + 1, [
    ...portion(ot, Math.floor),
    ...portion(nt, Math.ceil),
    ...portion(wisdom, Math.ceil),
  ]);
});
export function planId(state: { readingPlan?: PlanId }): PlanId {
  return state.readingPlan ?? "canonical-v1";
}
export function getPlan(id: PlanId = "canonical-v1"): Mission[] {
  if (id === "canonical-v1") return PLAN;
  if (id === "balanced-v1") return BALANCED_PLAN;
  throw new Error("Choose an available reading plan.");
}
export function readingRewardKey(id: PlanId, day: number) {
  return id === "canonical-v1" ? `reading:${day}` : `reading:${id}:${day}`;
}
export function currentDay(startDate: string, today: string): number {
  return Math.min(365, Math.max(1, dayDistance(startDate, today) + 1));
}
export function getMission(day: number, id: PlanId = "canonical-v1"): Mission {
  if (!Number.isInteger(day) || day < 1 || day > 365)
    throw new Error("Choose a reading day from 1 to 365.");
  return getPlan(id)[day - 1];
}
export function bookName(id: string): string {
  return BOOKS.find((b) => b.id === id)?.name ?? id;
}
