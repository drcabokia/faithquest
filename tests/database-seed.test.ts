import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { PLAN } from "../src/services/reading-plan";
import { BOOKS } from "../src/data/books";

describe("database reference seed consistency", () => {
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
