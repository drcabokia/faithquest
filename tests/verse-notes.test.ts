import { describe, it, expect } from "vitest";
import { initialState, stateSchema } from "../src/lib/state";
import { setSavedVerse } from "../src/services/saved-verses";
import { setVerseNote } from "../src/services/verse-notes";
import { parseBackup, previewRestore, restoreSchema } from "../src/lib/backup";
import { restoreDemo } from "../src/services/restore-demo";
import { commandSchema } from "../src/lib/commands";
const now = new Date("2026-10-18T12:00:00Z");
const fresh = () => {
  const s = initialState(now);
  s.profile.timeZone = "UTC";
  return setSavedVerse(s, "JHN.3.16", true, now);
};

describe("private saved verse annotations", () => {
  it("saves and edits personal text without changing Scripture references, progress or XP", () => {
    const s = fresh();
    const next = setVerseNote(s, "JHN.3.16", " My private note. ", null, now);
    expect(next.verseNotes?.["JHN.3.16"]).toEqual({
      text: "My private note.",
      updatedAt: now.toISOString(),
    });
    expect(next.savedVerses).toEqual(s.savedVerses);
    expect(next.rewards).toEqual(s.rewards);
    expect(next.chapters).toEqual(s.chapters);
    expect(s.verseNotes).toBeUndefined();
    expect(setVerseNote(next, "JHN.3.16", "My private note.", null)).toBe(next);
    expect(
      setVerseNote(next, "JHN.3.16", "Edited", "My private note.", now)
        .verseNotes?.["JHN.3.16"].text,
    ).toBe("Edited");
  });
  it("rejects stale edits/deletes, unsaved references, blank and oversized notes", () => {
    const s = setVerseNote(fresh(), "JHN.3.16", "Current note", null, now);
    expect(() => setVerseNote(s, "JHN.3.16", "Stale", null)).toThrow(
      "changed elsewhere",
    );
    expect(() => setVerseNote(s, "JHN.3.16", null, "Old note")).toThrow(
      "changed elsewhere",
    );
    expect(() => setVerseNote(s, "GEN.1.1", "Not saved", null)).toThrow(
      "no longer saved",
    );
    for (const text of ["", " \n\u00a0\ufeff", "x".repeat(2001)])
      expect(() => setVerseNote(s, "JHN.3.16", text, "Current note")).toThrow();
  });
  it("counts Unicode characters consistently and preserves multiline personal text", () => {
    const text = "🙏".repeat(2000);
    const s = setVerseNote(fresh(), "JHN.3.16", text, null, now);
    expect(stateSchema.parse(s).verseNotes?.["JHN.3.16"].text).toBe(text);
    expect(() => setVerseNote(s, "JHN.3.16", text + "🙏", text)).toThrow();
    expect(
      setVerseNote(fresh(), "JHN.3.16", "Line one\nLine two", null, now)
        .verseNotes?.["JHN.3.16"].text,
    ).toBe("Line one\nLine two");
  });
  it("requires explicit note deletion before verse removal", () => {
    const s = setVerseNote(
      fresh(),
      "JHN.3.16",
      "Keep until deleted",
      null,
      now,
    );
    expect(() => setSavedVerse(s, "JHN.3.16", false)).toThrow(
      "Delete the private note",
    );
    const deleted = setVerseNote(
      s,
      "JHN.3.16",
      null,
      "Keep until deleted",
      now,
    );
    expect(deleted.savedVerses).toEqual(s.savedVerses);
    expect(setSavedVerse(deleted, "JHN.3.16", false).savedVerses).toEqual({});
  });
  it("strips imported timestamps and keeps destination note conflicts during previewed restore", () => {
    let source = setVerseNote(
      fresh(),
      "JHN.3.16",
      "Imported note",
      null,
      new Date("2099-01-01"),
    );
    source = setSavedVerse(source, "GEN.1.1", true, now);
    source = setVerseNote(source, "GEN.1.1", "Missing note", null, now);
    const backup = parseBackup(JSON.stringify(source), "UTC", now);
    expect(backup.verseNotes).toEqual({
      "JHN.3.16": "Imported note",
      "GEN.1.1": "Missing note",
    });
    const current = setVerseNote(
      fresh(),
      "JHN.3.16",
      "Keep destination",
      null,
      now,
    );
    expect(previewRestore(current, backup)).toMatchObject({
      verseNotes: 1,
      noteConflicts: 1,
    });
    const restored = restoreDemo(current, backup, now);
    expect(restored.verseNotes?.["JHN.3.16"].text).toBe("Keep destination");
    expect(restored.verseNotes?.["GEN.1.1"].updatedAt).toBe(now.toISOString());
    expect(restoreDemo(restored, backup, now)).toEqual(restored);
  });
  it("accepts legacy snapshots/backups while rejecting orphaned notes and forged command fields", () => {
    const s = fresh();
    expect(stateSchema.safeParse(s).success).toBe(true);
    expect(
      parseBackup(JSON.stringify(s), "UTC", now).verseNotes,
    ).toBeUndefined();
    expect(
      stateSchema.safeParse({
        ...s,
        verseNotes: {
          "GEN.1.1": { text: "Orphan", updatedAt: now.toISOString() },
        },
      }).success,
    ).toBe(false);
    const b = parseBackup(JSON.stringify(s), "UTC", now);
    expect(
      restoreSchema.safeParse({ ...b, verseNotes: { "GEN.1.1": "Orphan" } })
        .success,
    ).toBe(false);
    const command = {
      type: "verseNote",
      book: "JHN",
      chapter: 3,
      verse: 16,
      text: "A note",
      expectedText: null,
    };
    expect(commandSchema.safeParse(command).success).toBe(true);
    for (const invalid of [
      { ...command, userId: "other" },
      { ...command, xp: 10 },
      { ...command, verse: 99 },
      { ...command, expectedText: undefined },
    ])
      expect(commandSchema.safeParse(invalid).success).toBe(false);
  });
});
