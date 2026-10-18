import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { BOOKS } from "../src/data/books";
import index from "../src/data/verse-index.json";
import { isVerseKey, verseLabel, SAVED_VERSE_LIMIT } from "../src/lib/verses";
import { initialState, stateSchema } from "../src/lib/state";
import { setSavedVerse } from "../src/services/saved-verses";
import { parseBackup, previewRestore } from "../src/lib/backup";
import { restoreDemo } from "../src/services/restore-demo";
import { commandSchema } from "../src/lib/commands";
const now = new Date("2026-10-17T03:00:00Z");
function fresh() {
  const s = initialState(now);
  s.profile.timeZone = "UTC";
  return s;
}
describe("private saved verses", () => {
  it("matches every bundled verse number and excludes all empty placeholders", () => {
    expect(Object.keys(index.chapters)).toHaveLength(1189);
    const empties: string[] = [];
    for (const book of BOOKS)
      for (let chapter = 1; chapter <= book.chapters; chapter++) {
        const data = JSON.parse(
          readFileSync(`public/bible/${book.id}/${chapter}.json`, "utf8"),
        );
        const limit = (index.chapters as Record<string, number>)[
          `${book.id}.${chapter}`
        ];
        expect(data.verses.map((v: { number: number }) => v.number)).toEqual(
          Array.from({ length: limit }, (_, i) => i + 1),
        );
        for (const v of data.verses) {
          const key = `${book.id}.${chapter}.${v.number}`;
          expect(isVerseKey(key)).toBe(!!v.text);
          if (!v.text) empties.push(key);
        }
        expect(isVerseKey(`${book.id}.${chapter}.${limit + 1}`)).toBe(false);
      }
    expect(empties.sort()).toEqual([...index.empty].sort());
  });
  it.each([
    "GEN.1.0",
    "GEN.1.32",
    "GEN.0.1",
    "GEN.51.1",
    "XXX.1.1",
    "LUK.17.36",
    "ACT.8.37",
    "JHN.03.16",
    "__proto__",
  ])("rejects unavailable references %s", (key) => {
    expect(isVerseKey(key)).toBe(false);
    expect(() => setSavedVerse(fresh(), key, true, now)).toThrow();
  });
  it("saves/removes idempotently without changing rewards, reading or preferences", () => {
    const s = fresh(),
      saved = setSavedVerse(s, "JHN.3.16", true, now);
    expect(saved.savedVerses).toEqual({ "JHN.3.16": now.toISOString() });
    expect(verseLabel("JHN.3.16")).toBe("John 3:16");
    expect(saved.rewards).toEqual({});
    expect(saved.chapters).toEqual({});
    expect(saved.profile).toEqual(s.profile);
    expect(s.savedVerses).toBeUndefined();
    expect(
      setSavedVerse(saved, "JHN.3.16", true, new Date("2026-10-18T03:00:00Z")),
    ).toBe(saved);
    const removed = setSavedVerse(saved, "JHN.3.16", false, now);
    expect(removed.savedVerses).toEqual({});
    expect(setSavedVerse(removed, "JHN.3.16", false, now)).toBe(removed);
  });
  it("caps collections while allowing repeat saves and removals", () => {
    const s = fresh();
    const keys = Object.entries(index.chapters)
      .flatMap(([key, count]) =>
        Array.from({ length: count }, (_, i) => `${key}.${i + 1}`),
      )
      .filter(isVerseKey);
    s.savedVerses = Object.fromEntries(
      keys.slice(0, SAVED_VERSE_LIMIT).map((key) => [key, now.toISOString()]),
    );
    expect(setSavedVerse(s, keys[0], true, now)).toBe(s);
    expect(() => setSavedVerse(s, keys[SAVED_VERSE_LIMIT], true, now)).toThrow(
      "1,000",
    );
    expect(
      Object.keys(setSavedVerse(s, keys[0], false, now).savedVerses!),
    ).toHaveLength(999);
  });
  it("restores saved references with new trusted timestamps and keeps existing saves", () => {
    const s = fresh();
    s.savedVerses = { "GEN.1.1": "2026-10-15T12:00:00.000Z" };
    const backupState = fresh();
    backupState.savedVerses = {
      "GEN.1.1": "2099-01-01T12:00:00.000Z",
      "JHN.3.16": "2099-01-01T12:00:00.000Z",
    };
    const backup = parseBackup(JSON.stringify(backupState), "UTC", now);
    expect(backup.savedVerses).toEqual(["GEN.1.1", "JHN.3.16"]);
    expect(previewRestore(s, backup).savedVerses).toBe(1);
    const restored = restoreDemo(s, backup, now);
    expect(restored.savedVerses).toEqual({
      ...s.savedVerses,
      "JHN.3.16": now.toISOString(),
    });
    expect(restored.rewards).toEqual({});
    expect(restoreDemo(restored, backup, now)).toEqual(restored);
    expect(
      restoreDemo(
        restored,
        parseBackup(JSON.stringify(fresh()), "UTC", now),
        now,
      ).savedVerses,
    ).toEqual(restored.savedVerses);
    expect(
      stateSchema.safeParse({
        ...s,
        savedVerses: { "GEN.1.999": now.toISOString() },
      }).success,
    ).toBe(false);
  });
  it("validates explicit boolean commands and rejects forged owners, text and scores", () => {
    const command = {
      type: "saveVerse",
      book: "JHN",
      chapter: 3,
      verse: 16,
      saved: true,
    };
    expect(commandSchema.safeParse(command).success).toBe(true);
    for (const extra of [
      { userId: "other" },
      { xp: 50 },
      { text: "Made-up Scripture" },
      { saved: "true" },
      { verse: 999 },
    ])
      expect(commandSchema.safeParse({ ...command, ...extra }).success).toBe(
        false,
      );
  });
});
