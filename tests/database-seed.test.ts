import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { PLAN } from "../src/services/reading-plan";
import { BOOKS } from "../src/data/books";
import { QUESTIONS } from "../src/data/quizzes";
import { QUIZ_PROMPTS } from "../src/data/quiz-prompts";
import review from "./fixtures/quiz-review-days-4-14.json";
import expansion from "./fixtures/quiz-review-days-15-30.json";
import { PLAN_IDS, getPlan } from "../src/services/reading-plan";
import { quizDay } from "../src/services/plan-quizzes";

describe("database reference seed consistency", () => {
  it("checks the new question references against assigned chapters and recorded source evidence", () => {
    expect(review).toHaveLength(22);
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(60);
    expect(QUIZ_PROMPTS).toEqual(
      QUESTIONS.map(({ id, day, question, options, reference }) => ({
        id,
        day,
        question,
        options,
        reference,
      })),
    );
    expect([...new Set(QUESTIONS.map((q) => q.day))]).toEqual(
      Array.from({ length: 30 }, (_, i) => i + 1),
    );
    for (const entry of review) {
      const q = QUESTIONS.find((q) => q.id === entry.id)!;
      expect(q.day).toBe(entry.day);
      expect(q.reference).toBe(`Genesis ${entry.chapter}:${entry.verse}`);
      expect(
        PLAN[entry.day - 1].chapters.some(
          (c) => c.book === entry.book && c.chapter === entry.chapter,
        ),
      ).toBe(true);
      const source = JSON.parse(
        readFileSync(
          `public/bible/${entry.book}/${entry.chapter}.json`,
          "utf8",
        ),
      );
      expect(
        source.verses.find((v: { number: number }) => v.number === entry.verse)
          ?.text,
      ).toBe(entry.evidence);
      expect(new Set(q.options).size).toBe(4);
      expect(q.correct).toBeGreaterThanOrEqual(0);
      expect(q.correct).toBeLessThan(4);
    }
  });
  it("pins all days 15–30 questions to WEB evidence and both active schedules", () => {
    expect(expansion).toHaveLength(32);
    expect(QUESTIONS.filter((q) => q.day >= 15)).toHaveLength(32);
    for (let day = 15; day <= 30; day++)
      expect(expansion.filter((e) => e.day === day)).toHaveLength(2);
    for (const evidence of expansion) {
      const q = QUESTIONS.find((q) => q.id === evidence.id)!;
      expect(q.day).toBe(evidence.day);
      expect(q.reference).toBe(
        `${BOOKS.find((b) => b.id === evidence.book)!.name} ${evidence.chapter}:${evidence.verse}`,
      );
      expect(
        new Set(q.options.map((option) => option.toLowerCase())).size,
      ).toBe(4);
      expect(q.correct).toBeGreaterThanOrEqual(0);
      expect(q.correct).toBeLessThan(4);
      const chapter = JSON.parse(
        readFileSync(
          `public/bible/${evidence.book}/${evidence.chapter}.json`,
          "utf8",
        ),
      );
      expect(
        chapter.verses.find(
          (v: { number: number; text: string }) => v.number === evidence.verse,
        )?.text,
      ).toBe(evidence.evidence);
      expect(evidence.evidence).toContain(evidence.supportingPhrase);
      for (const plan of PLAN_IDS)
        expect(
          getPlan(plan)[quizDay(q, plan) - 1].chapters.some(
            (c) => c.book === evidence.book && c.chapter === evidence.chapter,
          ),
        ).toBe(true);
      expect(quizDay(q, "canonical-v1")).toBe(evidence.day);
    }
  });
  it("matches all runtime chapter assignments and all 365 days", () => {
    const sql = readFileSync(
      "supabase/migrations/202610160002_reference_data.sql",
      "utf8",
    );
    const dayRows = [
      ...sql.matchAll(
        /insert into public\.reading_plan_days\(plan_id,day\) values \('[^']+',(\d+)\);/g,
      ),
    ];
    expect(dayRows.map((row) => Number(row[1]))).toEqual(
      PLAN.map((mission) => mission.day),
    );
    const assignments = [
      ...sql.matchAll(
        /insert into public\.reading_plan_day_chapters\(plan_id,day,book_id,chapter,position\) values \('[^']+',(\d+),'([^']+)',(\d+),(\d+)\);/g,
      ),
    ];
    expect(
      assignments.map((row) => ({
        day: Number(row[1]),
        key: `${row[2]}.${row[3]}`,
        position: Number(row[4]),
      })),
    ).toEqual(
      PLAN.flatMap((mission) =>
        mission.chapters.map((chapter, index) => ({
          day: mission.day,
          key: chapter.key,
          position: index + 1,
        })),
      ),
    );
  });
  it("preserves precisely the five empty verse-number placeholders in the publisher source", () => {
    const empty: string[] = [];
    for (const book of BOOKS)
      for (let c = 1; c <= book.chapters; c++) {
        const content = JSON.parse(
          readFileSync(`public/bible/${book.id}/${c}.json`, "utf8"),
        );
        for (const verse of content.verses)
          if (!verse.text) empty.push(`${book.id}.${c}.${verse.number}`);
      }
    expect(empty.sort()).toEqual(
      ["LUK.17.36", "ACT.8.37", "ACT.15.34", "ACT.24.7", "ROM.16.25"].sort(),
    );
  });
});
