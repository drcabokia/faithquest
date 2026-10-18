import { describe, expect, it } from "vitest";
import { initialState, stateSchema } from "../src/lib/state";
import { commandSchema } from "../src/lib/commands";
import {
  ALL_CHAPTERS,
  BALANCED_PLAN,
  getPlan,
  planId,
  PLAN,
  PLAN_IDS,
} from "../src/services/reading-plan";
import { selectReadingPlan } from "../src/services/select-reading-plan";
import { completeChapter, totalXp } from "../src/services/gamification";
import { restoreDemo } from "../src/services/restore-demo";
import { parseBackup, previewRestore } from "../src/lib/backup";
import { QUIZ_PROMPTS } from "../src/data/quiz-prompts";
import { quizChapter, quizDay } from "../src/services/plan-quizzes";
const now = new Date("2026-10-18T12:00:00Z");
function fresh() {
  const s = initialState(now);
  s.profile.timeZone = "UTC";
  return s;
}

describe("versioned reading journeys", () => {
  it.each(PLAN_IDS)("covers every chapter exactly once in %s", (id) => {
    const schedule = getPlan(id);
    expect(schedule.map((m) => m.day)).toEqual(
      Array.from({ length: 365 }, (_, i) => i + 1),
    );
    expect(
      schedule.every((m) => m.chapters.length >= 2 && m.chapters.length <= 5),
    ).toBe(true);
    const keys = schedule.flatMap((m) => m.chapters.map((c) => c.key));
    expect(keys.sort()).toEqual(ALL_CHAPTERS.map((c) => c.key).sort());
    expect(new Set(keys).size).toBe(1189);
  });
  it("preserves chapter order in each balanced stream and gives an honest daily mix", () => {
    const keys = BALANCED_PLAN.flatMap((m) => m.chapters.map((c) => c.key));
    for (const book of new Set(ALL_CHAPTERS.map((c) => c.book))) {
      expect(keys.filter((k) => k.startsWith(`${book}.`))).toEqual(
        ALL_CHAPTERS.filter((c) => c.book === book).map((c) => c.key),
      );
    }
    expect(BALANCED_PLAN[0].label).toBe("Genesis 1–2 · Matthew 1 · Psalms 1");
    expect(BALANCED_PLAN.at(-1)!.label).toBe("Malachi 2–4");
    expect(
      BALANCED_PLAN.filter((m) => m.chapters.some((c) => c.book === "MAT")),
    ).toHaveLength(28);
  });
  it("defaults legacy records to canonical and rejects unknown or draft IDs", () => {
    expect(planId(stateSchema.parse(fresh()))).toBe("canonical-v1");
    for (const id of [
      "chronological-v1",
      "chronological-draft-v1",
      "balanced-v2",
      "unknown",
    ]) {
      expect(
        commandSchema.safeParse({ type: "selectPlan", plan: id }).success,
      ).toBe(false);
      expect(
        stateSchema.safeParse({ ...fresh(), readingPlan: id }).success,
      ).toBe(false);
    }
    expect(PLAN[0].label).toBe("Genesis 1–3");
  });
  it("allows explicit selection before activity while preserving private study data", () => {
    const s = fresh();
    s.savedVerses = { "JHN.3.16": now.toISOString() };
    const next = selectReadingPlan(s, "balanced-v1");
    expect(next.savedVerses).toEqual(s.savedVerses);
    expect(totalXp(next)).toBe(0);
    expect(planId(selectReadingPlan(next, "canonical-v1"))).toBe(
      "canonical-v1",
    );
    for (const occupied of [
      { ...s, chapters: { "GEN.1": "2026-10-18" } },
      { ...s, days: { "1": "2026-10-18" } },
      { ...s, challengeStarts: ["2026-10-18"] },
      {
        ...s,
        rewards: {
          "reflection:2026-10-18": { amount: 20, date: "2026-10-18" },
        },
      },
    ])
      expect(() => selectReadingPlan(occupied, "balanced-v1")).toThrow(/fixed/);
  });
  it("awards only the selected mission, with one plan-specific reward on retries", () => {
    let s = selectReadingPlan(fresh(), "balanced-v1");
    for (const key of ["GEN.1", "GEN.2", "GEN.3"])
      s = completeChapter(s, key, now);
    expect(s.days).toEqual({});
    expect(totalXp(s)).toBe(0);
    for (const key of ["MAT.1", "PSA.1"]) s = completeChapter(s, key, now);
    expect(s.rewards["reading:balanced-v1:1"]?.amount).toBe(50);
    expect(s.rewards["reading:1"]).toBeUndefined();
    expect(completeChapter(s, "PSA.1", now)).toEqual(s);
    expect(() => selectReadingPlan(s, "canonical-v1")).toThrow(/fixed/);
  });
  it("moves quiz days with the source chapter and retains immutable question identities", () => {
    for (const id of PLAN_IDS)
      for (const q of QUIZ_PROMPTS) {
        const ref = quizChapter(q);
        expect(
          getPlan(id)[quizDay(q, id) - 1].chapters.some(
            (c) => c.book === ref.book && c.chapter === ref.chapter,
          ),
        ).toBe(true);
        if (id === "canonical-v1") expect(quizDay(q, id)).toBe(q.day);
      }
    expect(
      quizDay(
        QUIZ_PROMPTS.find((q) => q.id === "gen-noah")!,
        "balanced-v1",
      ),
    ).toBe(3);
  });
  it("round-trips balanced backups and rejects cross-plan restores before merging", () => {
    let s = selectReadingPlan(fresh(), "balanced-v1");
    for (const c of BALANCED_PLAN[0].chapters)
      s = completeChapter(s, c.key, now);
    const backup = parseBackup(JSON.stringify(s), "UTC", now, "balanced-v1");
    const restored = restoreDemo(
      selectReadingPlan(fresh(), "balanced-v1"),
      backup,
      now,
    );
    expect(restored.days).toEqual(s.days);
    expect(restored.rewards).toEqual(s.rewards);
    expect(restoreDemo(restored, backup, now)).toEqual(restored);
    expect(() => restoreDemo(fresh(), backup, now)).toThrow(/reading plan/);
    expect(previewRestore(fresh(), backup).challengeError).toMatch(
      /reading plan/,
    );
    const legacy = parseBackup(JSON.stringify(fresh()), "UTC", now);
    expect(() => restoreDemo(restored, legacy, now)).toThrow(/reading plan/);
    expect(planId(restoreDemo(fresh(), legacy, now))).toBe("canonical-v1");
  });
});
