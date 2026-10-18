import { describe, expect, it } from "vitest";
import { initialState } from "../src/lib/state";
import {
  parseBackup,
  previewRestore,
  validateRestore,
} from "../src/lib/backup";
import { restoreDemo } from "../src/services/restore-demo";
import { totalXp, achievements } from "../src/services/gamification-display";
import { ALL_CHAPTERS } from "../src/services/reading-plan";
const now = new Date("2026-10-16T12:00:00Z");
function fresh() {
  const s = initialState(now);
  s.profile.timeZone = "UTC";
  return s;
}
function file() {
  const s = fresh();
  s.chapters = {
    "GEN.1": "2026-10-10",
    "GEN.2": "2026-10-11",
    "GEN.3": "2026-10-12",
  };
  s.attempts = {
    "gen-light": { answer: 0, correct: false, date: "2026-10-10" },
    "gen-rest": { answer: 0, correct: true, date: "2026-10-11" },
  };
  s.reflections = {
    "2026-10-10": {
      text: "A synthetic private reflection for backup testing.",
      updatedAt: now.toISOString(),
    },
  };
  s.rewards = { forged: { amount: 150, date: "2026-10-10" } };
  s.days = { "365": "2026-10-10" };
  s.earnedAchievements = ["year"];
  return s;
}
describe("explicit backup merges", () => {
  it("round trips version 1 exports while ignoring rewards and answer flags", () => {
    const b = parseBackup(JSON.stringify(file()), "UTC", now);
    expect(b).not.toHaveProperty("rewards");
    expect(b.attempts["gen-rest"]).not.toHaveProperty("correct");
    const merged = restoreDemo(fresh(), b, now);
    expect(totalXp(merged)).toBe(80);
    expect(merged.days).toEqual({ 1: "2026-10-12" });
    expect(merged.attempts["gen-rest"].correct).toBe(false);
    expect(merged.attempts["gen-light"].correct).toBe(true);
    expect(achievements(merged).find((a) => a.id === "year")?.earned).toBe(
      false,
    );
    expect(restoreDemo(merged, b, now)).toEqual(merged);
  });
  it("keeps current preferences, overlapping entries and immutable quiz answers", () => {
    const current = fresh(),
      imported = file();
    current.profile.name = "Current reader";
    current.chapters["GEN.1"] = "2026-10-01";
    current.attempts["gen-light"] = {
      answer: 1,
      correct: false,
      date: "2026-10-01",
    };
    current.reflections["2026-10-10"] = {
      text: "The existing reflection must remain unchanged.",
      updatedAt: now.toISOString(),
    };
    const b = parseBackup(JSON.stringify(imported), "UTC", now);
    expect(previewRestore(current, b)).toEqual({
      verseNotes: 0,
      noteConflicts: 0,
      chapters: 2,
      attempts: 1,
      reflections: 0,
      conflicts: 1,
      savedVerses: 0,
      challenges: 0,
    });
    const merged = restoreDemo(current, b, now);
    expect(merged.profile).toEqual(current.profile);
    expect(merged.chapters["GEN.1"]).toBe("2026-10-01");
    expect(merged.reflections).toEqual(current.reflections);
    expect(merged.attempts["gen-light"]).toEqual(current.attempts["gen-light"]);
    expect(merged.rewards).not.toHaveProperty("quiz:gen-light");
  });
  it.each([
    "not json",
    "{}",
    JSON.stringify({ ...file(), version: 2 }),
    JSON.stringify({ ...file(), chapters: { "GEN.999": "2026-10-10" } }),
    JSON.stringify({
      ...file(),
      attempts: { unknown: { answer: 0, correct: true, date: "2026-10-10" } },
    }),
  ])("rejects malformed or unsupported files", (text) => {
    expect(() => parseBackup(text, "UTC", now)).toThrow();
  });
  it("rejects mismatched timezones and future activity without mutating the current journey", () => {
    const current = fresh(),
      b = parseBackup(JSON.stringify(file()), "UTC", now);
    expect(() =>
      parseBackup(JSON.stringify(file()), "Asia/Kuala_Lumpur", now),
    ).toThrow("timezone");
    expect(() =>
      restoreDemo(current, { ...b, chapters: { "GEN.1": "2099-01-01" } }, now),
    ).toThrow("after today");
    expect(current.chapters).toEqual({});
    expect(() =>
      validateRestore({ ...b, userId: "someone-else" }, "UTC", now),
    ).toThrow();
  });
  it("reconstructs a full canonical year and book awards from chapters alone", () => {
    const b = parseBackup(
      JSON.stringify({
        ...fresh(),
        chapters: Object.fromEntries(
          ALL_CHAPTERS.map((c) => [c.key, "2026-10-10"]),
        ),
      }),
      "UTC",
      now,
    );
    const merged = restoreDemo(fresh(), b, now);
    expect(Object.keys(merged.days)).toHaveLength(365);
    expect(totalXp(merged)).toBe(365 * 50 + 66 * 150);
    expect(totalXp(restoreDemo(merged, b, now))).toBe(totalXp(merged));
  });
});
