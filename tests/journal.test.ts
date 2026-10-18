import { describe, expect, it } from "vitest";
import { initialState, stateSchema } from "../src/lib/state";
import { commandSchema } from "../src/lib/commands";
import {
  parseBackup,
  previewRestore,
  validateRestore,
} from "../src/lib/backup";
import { saveReflection, totalXp } from "../src/services/gamification";
import { restoreDemo } from "../src/services/restore-demo";

const now = new Date("2026-10-17T12:00:00.000Z");
const day = "2026-10-17";
const text = "A private thought about gratitude and growing in faith.";
function state() {
  const s = initialState(now);
  s.profile.timeZone = "UTC";
  return s;
}
describe("private journal categories", () => {
  it("changes categories without awarding additional XP and preserves them on legacy edits", () => {
    const first = saveReflection(state(), day, text, now, "prayer");
    const changed = saveReflection(first, day, text, now, "gratitude");
    const legacy = saveReflection(changed, day, text + " Edited.", now);
    expect(legacy.reflections[day].category).toBe("gratitude");
    expect(totalXp(first)).toBe(20);
    expect(totalXp(legacy)).toBe(20);
    expect(first.reflections[day].category).toBe("prayer");
  });
  it("rejects forged categories at the command, snapshot, demo and restore boundaries", () => {
    expect(
      commandSchema.safeParse({
        type: "reflect",
        date: day,
        text,
        category: "public",
      }).success,
    ).toBe(false);
    expect(
      commandSchema.safeParse({
        type: "reflect",
        date: day,
        text,
        category: "prayer",
        userId: "other",
      }).success,
    ).toBe(false);
    const forged = {
      ...state(),
      reflections: {
        [day]: { text, category: "public", updatedAt: now.toISOString() },
      },
    };
    expect(stateSchema.safeParse(forged).success).toBe(false);
    expect(() =>
      saveReflection(state(), day, text, now, "public" as "prayer"),
    ).toThrow();
    expect(() => parseBackup(JSON.stringify(forged), "UTC", now)).toThrow();
    expect(() =>
      validateRestore(
        {
          version: 1,
          timeZone: "UTC",
          chapters: {},
          attempts: {},
          reflections: { [day]: { text, category: null } },
        },
        "UTC",
        now,
      ),
    ).toThrow();
  });
  it("round-trips categories and detects category-only conflicts while existing entries win", () => {
    const prayer = saveReflection(state(), day, text, now, "prayer");
    const backup = parseBackup(JSON.stringify(prayer), "UTC", now);
    expect(restoreDemo(state(), backup, now).reflections[day].category).toBe(
      "prayer",
    );
    const existing = saveReflection(state(), day, text, now, "gratitude");
    expect(previewRestore(existing, backup).conflicts).toBe(1);
    expect(restoreDemo(existing, backup, now).reflections[day].category).toBe(
      "gratitude",
    );
  });
  it("accepts older category-free exports without changing their contents", () => {
    const legacy = saveReflection(state(), day, text, now);
    const backup = parseBackup(JSON.stringify(legacy), "UTC", now);
    expect(backup.reflections[day]).toEqual({ text });
    expect(restoreDemo(state(), backup, now).reflections[day].text).toBe(text);
    expect(
      commandSchema.safeParse({ type: "reflect", date: day, text }).success,
    ).toBe(true);
  });
  it("continues to allow new entries only today and preserves existing historical categories", () => {
    expect(() =>
      saveReflection(state(), "2026-10-16", text, now, "prayer"),
    ).toThrow();
    const old = state();
    old.reflections["2026-10-16"] = {
      text,
      category: "application",
      updatedAt: now.toISOString(),
    };
    expect(
      saveReflection(old, "2026-10-16", text + " Edited.", now).reflections[
        "2026-10-16"
      ].category,
    ).toBe("application");
  });
});
