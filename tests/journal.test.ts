import { journalRevision, JournalConflictError } from "../src/lib/journal";
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
    const changed = saveReflection(
      first,
      day,
      text,
      now,
      "gratitude",
      journalRevision(first.reflections[day]),
    );
    const legacy = saveReflection(
      changed,
      day,
      text + " Edited.",
      now,
      undefined,
      journalRevision(changed.reflections[day]),
    );
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
      commandSchema.safeParse({
        type: "reflect",
        date: day,
        text,
        category: "reflection",
        expectedRevision: null,
      }).success,
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
      saveReflection(
        old,
        "2026-10-16",
        text + " Edited.",
        now,
        undefined,
        journalRevision(old.reflections["2026-10-16"]),
      ).reflections["2026-10-16"].category,
    ).toBe("application");
  });
});

describe("journal save conflicts", () => {
  it("rejects competing creates, stale edits and category-only conflicts without mutating state or XP", () => {
    const first = saveReflection(state(), day, text, now, "prayer");
    const base = journalRevision(first.reflections[day]);
    const latest = saveReflection(first, day, text, now, "gratitude", base);
    const snapshot = structuredClone(latest);
    for (const token of [null, base]) {
      expect(() =>
        saveReflection(
          latest,
          day,
          text + " A local draft.",
          now,
          "prayer",
          token,
        ),
      ).toThrow(JournalConflictError);
    }
    expect(latest).toEqual(snapshot);
    expect(totalXp(latest)).toBe(20);
    const replaced = saveReflection(
      latest,
      day,
      text + " Reviewed replacement.",
      now,
      "application",
      journalRevision(latest.reflections[day]),
    );
    expect(replaced.reflections[day].category).toBe("application");
    expect(totalXp(replaced)).toBe(20);
  });
  it("does not reuse a revision when text or category changes back within one timestamp", () => {
    const first = saveReflection(state(), day, text, now, "prayer");
    const second = saveReflection(
      first,
      day,
      text,
      now,
      "gratitude",
      journalRevision(first.reflections[day]),
    );
    const third = saveReflection(
      second,
      day,
      text,
      now,
      "prayer",
      journalRevision(second.reflections[day]),
    );
    expect(
      new Set([first, second, third].map((s) => s.reflections[day].revision))
        .size,
    ).toBe(3);
    expect(() =>
      saveReflection(
        third,
        day,
        text + " Stale edit.",
        now,
        "prayer",
        journalRevision(first.reflections[day]),
      ),
    ).toThrow(JournalConflictError);
  });
  it("acknowledges identical committed content after a lost response without changing the revision or reward", () => {
    const first = saveReflection(state(), day, text, now, "prayer");
    expect(
      saveReflection(
        first,
        day,
        text,
        new Date(now.getTime() + 1000),
        "prayer",
        null,
      ),
    ).toBe(first);
  });
  it("mints fresh revisions for imported entries and preserves destination revisions", () => {
    const source = saveReflection(state(), day, text, now, "prayer");
    const backup = parseBackup(JSON.stringify(source), "UTC", now);
    expect(backup.reflections[day]).not.toHaveProperty("revision");
    const restored = restoreDemo(state(), backup, now);
    expect(restored.reflections[day].revision).toBeTruthy();
    expect(restored.reflections[day].revision).not.toBe(
      source.reflections[day].revision,
    );
    const latest = saveReflection(
      restored,
      day,
      text,
      now,
      "gratitude",
      journalRevision(restored.reflections[day]),
    );
    expect(restoreDemo(latest, backup, now).reflections[day]).toEqual(
      latest.reflections[day],
    );
  });
  it("requires an explicit nullable revision token and a category at the command boundary", () => {
    const command = {
      type: "reflect",
      date: day,
      text,
      category: "prayer",
      expectedRevision: null,
    };
    expect(commandSchema.safeParse(command).success).toBe(true);
    for (const token of [undefined, "bad", 12, {}, { text }]) {
      expect(
        commandSchema.safeParse({ ...command, expectedRevision: token })
          .success,
      ).toBe(false);
    }
  });
});
