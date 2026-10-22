import { describe, it, expect } from "vitest";
import { initialState, stateSchema } from "../src/lib/state";
import {
  completeChapter,
  totalXp,
  submitAnswer,
  saveReflection,
  streak,
  achievements,
  levelInfo,
} from "../src/services/gamification";
import {
  PLAN,
  ALL_CHAPTERS,
  currentDay,
  getMission,
} from "../src/services/reading-plan";
import { dateInZone, addDays } from "../src/lib/dates";
import { BOOKS } from "../src/data/books";
import { readFileSync } from "node:fs";
const now = new Date("2026-10-16T12:00:00Z");
function fresh() {
  const state = initialState(now);
  state.profile.timeZone = "Asia/Kuala_Lumpur";
  return state;
}
describe("complete canonical plan", () => {
  it("distributes every chapter exactly once over 365 nonempty missions", () => {
    expect(PLAN).toHaveLength(365);
    expect(ALL_CHAPTERS).toHaveLength(1189);
    const keys = PLAN.flatMap((m) => m.chapters.map((c) => c.key));
    expect(new Set(keys).size).toBe(1189);
    expect(keys).toEqual(ALL_CHAPTERS.map((c) => c.key));
    expect(
      PLAN.every((m) => m.chapters.length === 3 || m.chapters.length === 4),
    ).toBe(true);
    expect(keys[0]).toBe("GEN.1");
    expect(keys.at(-1)).toBe("REV.22");
  });
  it("clamps the current reading day and rejects nonexistent missions", () => {
    expect(currentDay("2026-10-16", "2026-10-16")).toBe(1);
    expect(currentDay("2026-10-16", "2026-10-17")).toBe(2);
    expect(currentDay("2026-10-16", "2026-10-15")).toBe(1);
    expect(currentDay("2020-01-01", "2026-01-01")).toBe(365);
    expect(() => getMission(0)).toThrow();
    expect(() => getMission(366)).toThrow();
  });
  it("has verified local Scripture for all chapters with matching identifiers", () => {
    for (const book of BOOKS)
      for (let c = 1; c <= book.chapters; c++) {
        const content = JSON.parse(
          readFileSync(`public/bible/${book.id}/${c}.json`, "utf8"),
        );
        expect(content.book).toBe(book.id);
        expect(content.chapter).toBe(c);
        expect(content.verses.length).toBeGreaterThan(0);
        expect(content.verses[0].number).toBe(1);
        expect(
          content.verses.every(
            (v: { text: string }) =>
              !v.text.includes(String.fromCharCode(65533)),
          ),
        ).toBe(true);
      }
  });
});
describe("participation rewards", () => {
  it("awards daily XP only after all assigned chapters have been read", () => {
    let s = fresh();
    s = completeChapter(s, "GEN.1", now);
    expect(totalXp(s)).toBe(0);
    expect(s.days[1]).toBeUndefined();
    s = completeChapter(s, "GEN.2", now);
    expect(totalXp(s)).toBe(0);
    s = completeChapter(s, "GEN.3", now);
    expect(totalXp(s)).toBe(50);
    expect(s.days[1]).toBe("2026-10-16");
  });
  it("preserves the original state and makes duplicate completions idempotent", () => {
    const original = fresh();
    let s = original;
    for (const c of PLAN[0].chapters) s = completeChapter(s, c.key, now);
    const repeat = completeChapter(s, "GEN.3", new Date("2026-10-17T12:00Z"));
    expect(repeat).toBe(s);
    expect(totalXp(repeat)).toBe(50);
    expect(original.chapters).toEqual({});
    expect(() => completeChapter(s, "GEN.999", now)).toThrow();
  });
  it("awards a completed book exactly once", () => {
    let s = fresh();
    s = completeChapter(s, "PHM.1", now);
    expect(s.rewards["book:PHM"].amount).toBe(150);
    expect(totalXp(s)).toBe(150);
    expect(totalXp(completeChapter(s, "PHM.1", now))).toBe(150);
    expect(achievements(s).find((b) => b.id === "book")?.earned).toBe(true);
  });
  it("records a correct quiz answer once and rejects invalid options", () => {
    let s = submitAnswer(fresh(), "gen-light", 0, now);
    expect(totalXp(s)).toBe(10);
    expect(submitAnswer(s, "gen-light", 1, now)).toBe(s);
    s = submitAnswer(s, "gen-rest", 0, now);
    expect(totalXp(s)).toBe(10);
    expect(
      submitAnswer(s, "gen-rest", 2, now).attempts["gen-rest"].correct,
    ).toBe(false);
    expect(() => submitAnswer(s, "missing", 0, now)).toThrow();
    expect(() => submitAnswer(s, "gen-noah", 5, now)).toThrow();
  });
  it("awards 20 XP for a thoughtful daily reflection and does not re-award edits", () => {
    let s = saveReflection(
      fresh(),
      "2026-10-16",
      "I learned to make room for a quiet moment in Scripture.",
      now,
    );
    expect(totalXp(s)).toBe(20);
    s = saveReflection(
      s,
      "2026-10-16",
      "An edited reflection about listening and growing in patience.",
      new Date("2026-10-17T12:00Z"),
      undefined,
      s.reflections["2026-10-16"].revision!,
    );
    expect(totalXp(s)).toBe(20);
    expect(s.reflections["2026-10-16"].text).toContain("edited");
    expect(() =>
      saveReflection(
        s,
        "2026-10-18",
        "A future reflection should never earn an early reward.",
        now,
      ),
    ).toThrow();
    expect(() =>
      saveReflection(
        s,
        "2026-10-15",
        "Backdating a new entry should not be allowed in the demo.",
        now,
      ),
    ).toThrow();
    expect(() => saveReflection(s, "2026-10-16", "tiny", now)).toThrow();
  });
  it("unlocks the first-step and reflection achievements from completed activities", () => {
    let s = fresh();
    expect(achievements(s).every((a) => !a.earned)).toBe(true);
    for (const c of PLAN[0].chapters) s = completeChapter(s, c.key, now);
    expect(achievements(s).find((a) => a.id === "first")?.earned).toBe(true);
    expect(achievements(s).find((a) => a.id === "reflect")?.earned).toBe(false);
    s = saveReflection(
      s,
      "2026-10-16",
      "Today I am making space for gratitude and quiet reflection.",
      now,
    );
    expect(achievements(s).find((a) => a.id === "reflect")?.earned).toBe(true);
  });
  it("keeps XP when a reading streak is broken", () => {
    let s = fresh();
    for (const c of PLAN[0].chapters) s = completeChapter(s, c.key, now);
    expect(streak(Object.values(s.days), "2026-10-20")).toBe(0);
    expect(totalXp(s)).toBe(50);
  });
  it("uses defined level thresholds", () => {
    expect(levelInfo(0).number).toBe(1);
    expect(levelInfo(250).name).toBe("Faithful Explorer");
    expect(levelInfo(12000).number).toBe(7);
    expect(levelInfo(999999).progress).toBe(100);
  });
});
describe("calendar-day streaks", () => {
  it("deduplicates missions completed on the same date", () => {
    expect(
      streak(["2026-10-15", "2026-10-16", "2026-10-16"], "2026-10-16"),
    ).toBe(2);
  });
  it("keeps yesterday's streak while today's reading is pending", () => {
    expect(streak(["2026-10-14", "2026-10-15"], "2026-10-16")).toBe(2);
    expect(streak(["2026-10-14"], "2026-10-16")).toBe(0);
    expect(streak([], "2026-10-16")).toBe(0);
  });
  it("uses the configured timezone around midnight", () => {
    const instant = new Date("2026-10-16T17:00Z");
    expect(dateInZone("Asia/Kuala_Lumpur", instant)).toBe("2026-10-17");
    expect(dateInZone("America/New_York", instant)).toBe("2026-10-16");
  });
  it("uses calendar days across leap days and daylight-saving changes", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2024-02-29", 1)).toBe("2024-03-01");
    expect(
      streak(["2026-03-07", "2026-03-08", "2026-03-09"], "2026-03-09"),
    ).toBe(3);
  });
  it("retains an earned seven-day badge after the current streak ends", () => {
    const s = fresh();
    for (let i = 0; i < 7; i++) s.days[i + 1] = addDays("2026-10-01", i);
    expect(achievements(s).find((a) => a.id === "week")?.earned).toBe(true);
    expect(streak(Object.values(s.days), "2026-10-16")).toBe(0);
  });
});
describe("versioned demo validation", () => {
  it("round-trips saved activity with validation", () => {
    let s = fresh();
    s = completeChapter(s, "GEN.1", now);
    expect(stateSchema.parse(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
  it("rejects malformed dates, invalid chapter identifiers, versions, and timezone", () => {
    expect(stateSchema.safeParse({ ...fresh(), version: 99 }).success).toBe(
      false,
    );
    expect(
      stateSchema.safeParse({
        ...fresh(),
        chapters: { "GEN.999": "2026-10-16" },
      }).success,
    ).toBe(false);
    expect(
      stateSchema.safeParse({ ...fresh(), days: { "366": "2026-10-16" } })
        .success,
    ).toBe(false);
    expect(
      stateSchema.safeParse({
        ...fresh(),
        profile: { ...fresh().profile, timeZone: "Invalid/Zone" },
      }).success,
    ).toBe(false);
    expect(
      stateSchema.safeParse({ ...fresh(), days: { "1": "2026-02-30" } })
        .success,
    ).toBe(false);
  });
});
