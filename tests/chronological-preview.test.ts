import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { BOOKS } from "../src/data/books";
import { CHRONOLOGICAL_SEGMENTS } from "../src/data/chronological-draft";
import {
  CHRONOLOGICAL_DRAFT,
  CHRONOLOGICAL_DRAFT_ID,
  CHRONOLOGICAL_NOTES,
  draftScheduleExport,
  previewPlan,
} from "../src/services/chronological-preview";
import {
  ALL_CHAPTERS,
  getPlan,
  type PlanId,
} from "../src/services/reading-plan";
import { selectReadingPlan } from "../src/services/select-reading-plan";
import { initialState, stateSchema } from "../src/lib/state";
import { commandSchema } from "../src/lib/commands";
import { parseBackup, restoreSchema } from "../src/lib/backup";

describe("preview-only chronological editorial draft", () => {
  it("assigns every chapter exactly once to 365 nonempty whole-chapter readings", () => {
    expect(CHRONOLOGICAL_DRAFT.map((m) => m.day)).toEqual(
      Array.from({ length: 365 }, (_, i) => i + 1),
    );
    const keys = CHRONOLOGICAL_DRAFT.flatMap((m) =>
      m.chapters.map((c) => c.key),
    );
    expect(keys.toSorted()).toEqual(ALL_CHAPTERS.map((c) => c.key).sort());
    expect(new Set(keys).size).toBe(1189);
    expect(
      CHRONOLOGICAL_DRAFT.every(
        (m) => m.chapters.length >= 3 && m.chapters.length <= 4,
      ),
    ).toBe(true);
    expect(CHRONOLOGICAL_DRAFT[0].label).toBe("Genesis 1–3");
    expect(CHRONOLOGICAL_DRAFT[3].label).toBe("Genesis 10–11 · Job 1–2");
    expect(CHRONOLOGICAL_DRAFT.at(-1)!.label).toBe("Revelation 19–22");
  });
  it("keeps each book's chapter order while placing contextual blocks explicitly", () => {
    const keys = CHRONOLOGICAL_DRAFT.flatMap((m) =>
      m.chapters.map((c) => c.key),
    );
    for (const b of BOOKS)
      expect(keys.filter((k) => k.startsWith(`${b.id}.`))).toEqual(
        Array.from({ length: b.chapters }, (_, i) => `${b.id}.${i + 1}`),
      );
    for (const [before, after] of [
      ["GEN.11", "JOB.1"],
      ["JOB.42", "GEN.12"],
      ["2KI.14", "JON.1"],
      ["HAG.2", "EZR.5"],
      ["ZEC.14", "EZR.5"],
      ["ACT.14", "GAL.1"],
      ["GAL.6", "ACT.15"],
      ["ACT.19", "1CO.1"],
      ["1CO.16", "ACT.20"],
    ])
      expect(keys.indexOf(before)).toBeLessThan(keys.indexOf(after));
  });
  it("attaches reachable notes and valid public sources to the proposed placements", () => {
    const ids = new Set(CHRONOLOGICAL_NOTES.map((n) => n.id));
    expect(ids.size).toBe(CHRONOLOGICAL_NOTES.length);
    expect(new Set(CHRONOLOGICAL_SEGMENTS.map((s) => s.id)).size).toBe(
      CHRONOLOGICAL_SEGMENTS.length,
    );
    expect(new Set(CHRONOLOGICAL_DRAFT.flatMap((m) => m.noteIds))).toEqual(ids);
    for (const m of CHRONOLOGICAL_DRAFT) {
      expect(m.contexts.length).toBeGreaterThan(0);
      for (const id of m.noteIds) expect(ids.has(id)).toBe(true);
    }
    expect(CHRONOLOGICAL_DRAFT[3].noteIds).toContain("job-setting");
    for (const note of CHRONOLOGICAL_NOTES) {
      expect(note.text.length).toBeGreaterThan(40);
      expect(note.sources.length).toBeGreaterThan(0);
      for (const source of note.sources) {
        if (source.kind === "guide")
          expect(new URL(source.href).origin).toBe("https://bibleproject.com");
        else {
          const chapter = JSON.parse(
            readFileSync(
              `public/bible/${source.book}/${source.chapter}.json`,
              "utf8",
            ),
          );
          for (const verse of source.verses)
            expect(
              chapter.verses
                .find(
                  (v: { number: number; text: string }) => v.number === verse,
                )
                ?.text?.trim().length,
            ).toBeGreaterThan(0);
        }
      }
    }
  });
  it("pins key historical-context evidence to the unchanged bundled Scripture", () => {
    for (const [book, chapter, verse, phrase] of [
      ["RUT", 1, 1, "judges"],
      ["PRO", 25, 1, "Hezekiah"],
      ["PSA", 137, 1, "Babylon"],
      ["ISA", 44, 28, "Cyrus"],
      ["DAN", 7, 1, "Belshazzar"],
      ["EZR", 5, 1, "Haggai"],
      ["1CO", 16, 8, "Ephesus"],
    ] as const) {
      const text = JSON.parse(
        readFileSync(`public/bible/${book}/${chapter}.json`, "utf8"),
      );
      expect(
        text.verses.find(
          (v: { number: number; text: string }) => v.number === verse,
        ).text,
      ).toContain(phrase);
    }
  });
  it("keeps both chronological IDs outside commands, saved state and active schedule lookup", () => {
    const current = initialState();
    for (const id of [CHRONOLOGICAL_DRAFT_ID, "chronological-v1"]) {
      expect(
        commandSchema.safeParse({ type: "selectPlan", plan: id }).success,
      ).toBe(false);
      expect(
        stateSchema.safeParse({ ...current, readingPlan: id }).success,
      ).toBe(false);
      expect(() => selectReadingPlan(current, id as PlanId)).toThrow();
      expect(() => getPlan(id as PlanId)).toThrow();
      expect(
        restoreSchema.safeParse({
          version: 1,
          readingPlan: id,
          timeZone: current.profile.timeZone,
          chapters: {},
          attempts: {},
          reflections: {},
        }).success,
      ).toBe(false);
    }
    expect(current.readingPlan).toBeUndefined();
  });
  it("exports public review references with explicit status, never a personal backup", () => {
    const exported = draftScheduleExport();
    expect(exported).toMatchObject({
      kind: "faithquest-reading-plan-draft",
      draftId: CHRONOLOGICAL_DRAFT_ID,
      status: "preview-only",
      independentEditorialReview: "pending",
    });
    expect(exported.days).toHaveLength(365);
    expect(Object.keys(exported).sort()).toEqual(
      [
        "kind",
        "draftId",
        "status",
        "independentEditorialReview",
        "authoredOn",
        "scope",
        "method",
        "scripture",
        "reuse",
        "segments",
        "placementNotes",
        "days",
      ].sort(),
    );
    expect(() => parseBackup(JSON.stringify(exported), "UTC")).toThrow(
      /supported/,
    );
    expect(restoreSchema.safeParse(exported).success).toBe(false);
  });
  it("allows repeatable previews without modifying active schedule or rewards", () => {
    const original = structuredClone(getPlan("canonical-v1"));
    expect(previewPlan(CHRONOLOGICAL_DRAFT_ID)).toEqual(CHRONOLOGICAL_DRAFT);
    expect(previewPlan("balanced-v1")).toEqual(getPlan("balanced-v1"));
    expect(getPlan("canonical-v1")).toEqual(original);
    expect(draftScheduleExport()).toEqual(draftScheduleExport());
  });
});
