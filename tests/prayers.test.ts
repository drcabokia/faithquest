import { describe, it, expect } from "vitest";
import { initialState, stateSchema } from "../src/lib/state";
import { changePrayer } from "../src/services/prayers";
import {
  prayerDetailsSchema,
  prayerContent,
  PRAYER_LIMIT,
  type PrayerChange,
} from "../src/lib/prayers";
import { commandSchema } from "../src/lib/commands";
import { parseBackup, previewRestore, restoreSchema } from "../src/lib/backup";
import { restoreDemo } from "../src/services/restore-demo";
const now = new Date("2026-10-18T04:00:00Z"),
  id = crypto.randomUUID(),
  noteId = crypto.randomUUID();
const details = {
  title: "A synthetic request",
  text: "A private concern recorded for testing.",
  status: "ongoing" as const,
};
const save: PrayerChange = { action: "save", value: details };
const initial = () => ({
  ...initialState(now),
  profile: { ...initialState(now).profile, timeZone: "UTC" },
});
describe("private prayer requests", () => {
  it("keeps multiple requests separate from journal, rewards and reading progress", () => {
    const s = changePrayer(
      changePrayer(initial(), id, save, null, now),
      crypto.randomUUID(),
      save,
      null,
      now,
    );
    expect(Object.keys(s.prayers!)).toHaveLength(2);
    expect(s.reflections).toEqual({});
    expect(s.rewards).toEqual({});
    expect(s.chapters).toEqual({});
    expect(stateSchema.safeParse(s).success).toBe(true);
  });
  it("checks versions for status changes and deletions while making identical intent idempotent", () => {
    const s = changePrayer(initial(), id, save, null, now);
    const rev = s.prayers![id].revision;
    expect(changePrayer(s, id, save, null, now)).toBe(s);
    const answered = changePrayer(
      s,
      id,
      { action: "save", value: { ...details, status: "answered" } },
      rev,
      now,
    );
    expect(() =>
      changePrayer(
        answered,
        id,
        { action: "save", value: { ...details, status: "archived" } },
        rev,
        now,
      ),
    ).toThrow(/changed elsewhere/);
    expect(() =>
      changePrayer(answered, id, { action: "delete", value: {} }, rev, now),
    ).toThrow(/changed elsewhere/);
    const gone = changePrayer(
      answered,
      id,
      { action: "delete", value: {} },
      answered.prayers![id].revision,
      now,
    );
    expect(gone.prayers).toEqual({});
    expect(
      changePrayer(gone, id, { action: "delete", value: {} }, rev, now),
    ).toBe(gone);
    expect(() => changePrayer(gone, id, save, rev, now)).toThrow(
      /deleted elsewhere/,
    );
  });
  it("appends dated notes once and rejects stale, reused, future and impossible note dates", () => {
    const s = changePrayer(initial(), id, save, null, now);
    const rev = s.prayers![id].revision;
    const follow = {
      action: "followUp" as const,
      value: { id: noteId, text: "A synthetic follow-up", date: "2026-10-18" },
    };
    const next = changePrayer(s, id, follow, rev, now);
    expect(changePrayer(next, id, follow, rev, now)).toBe(next);
    expect(() =>
      changePrayer(
        next,
        id,
        {
          action: "followUp",
          value: { ...follow.value, text: "Changed note" },
        },
        next.prayers![id].revision,
        now,
      ),
    ).toThrow(/changed elsewhere/);
    for (const date of ["2026-10-19", "2026-02-30"])
      expect(() =>
        changePrayer(
          s,
          id,
          { action: "followUp", value: { ...follow.value, date } },
          rev,
          now,
        ),
      ).toThrow();
    expect(next.prayers![id].followUps[noteId].text).toBe(
      "A synthetic follow-up",
    );
  });
  it("validates Unicode limits, ownership-free commands, legacy state and request caps", () => {
    expect(
      prayerDetailsSchema.safeParse({ ...details, text: "🙏".repeat(2000) })
        .success,
    ).toBe(true);
    expect(
      prayerDetailsSchema.safeParse({ ...details, text: "🙏".repeat(2001) })
        .success,
    ).toBe(false);
    for (const value of [
      { ...details, status: "automatic" },
      { ...details, title: "  " },
      { ...details, title: "a".repeat(121) },
    ])
      expect(prayerDetailsSchema.safeParse(value).success).toBe(false);
    expect(
      commandSchema.safeParse({
        type: "prayer",
        id,
        change: save,
        expectedRevision: null,
        user_id: crypto.randomUUID(),
      }).success,
    ).toBe(false);
    expect(
      commandSchema.safeParse({
        type: "prayer",
        id,
        change: {
          ...save,
          value: { ...details, revision: crypto.randomUUID() },
        },
        expectedRevision: null,
      }).success,
    ).toBe(false);
    expect(stateSchema.safeParse(initial()).success).toBe(true);
    const s = changePrayer(initial(), id, save, null, now);
    s.prayers = Object.fromEntries(
      Array.from({ length: PRAYER_LIMIT }, () => [
        crypto.randomUUID(),
        s.prayers![id],
      ]),
    );
    expect(() => changePrayer(s, id, save, null, now)).toThrow(/200/);
  });
  it("normalizes backups, previews note-only requests, preserves destination requests and excludes trusted timestamps", () => {
    let s = changePrayer(initial(), id, save, null, now);
    s = changePrayer(
      s,
      id,
      {
        action: "followUp",
        value: { id: noteId, text: "A dated follow-up", date: "2026-10-17" },
      },
      s.prayers![id].revision,
      now,
    );
    const backup = parseBackup(JSON.stringify(s), "UTC", now);
    expect(backup.prayers![id]).toEqual(prayerContent(s.prayers![id]));
    expect(
      restoreSchema.safeParse({ ...backup, prayers: { [id]: s.prayers![id] } })
        .success,
    ).toBe(false);
    expect(previewRestore(initial(), backup).prayers).toBe(1);
    const merged = restoreDemo(
      initial(),
      backup,
      new Date("2026-10-18T06:00:00Z"),
    );
    expect(merged.prayers![id].revision).not.toBe(s.prayers![id].revision);
    expect(merged.prayers![id].createdAt).toBe("2026-10-18T06:00:00.000Z");
    const existing = changePrayer(
      s,
      id,
      { action: "save", value: { ...details, status: "answered" } },
      s.prayers![id].revision,
      now,
    );
    expect(previewRestore(existing, backup).prayerConflicts).toBe(1);
    expect(restoreDemo(existing, backup, now).prayers).toEqual(
      existing.prayers,
    );
    expect(restoreDemo(merged, backup, now).prayers).toEqual(merged.prayers);
    expect(merged.rewards).toEqual({});
  });
  it("rejects future dates and oversized merged collections before all restore writes", () => {
    const s = changePrayer(initial(), id, save, null, now);
    const b = parseBackup(JSON.stringify(s), "UTC", now);
    expect(() =>
      restoreDemo(
        initial(),
        {
          ...b,
          prayers: {
            [id]: {
              ...b.prayers![id],
              followUps: { [noteId]: { text: "Future", date: "2099-01-01" } },
            },
          },
        },
        now,
      ),
    ).toThrow(/after today/);
    const full = {
      ...initial(),
      prayers: Object.fromEntries(
        Array.from({ length: PRAYER_LIMIT }, () => [
          crypto.randomUUID(),
          s.prayers![id],
        ]),
      ),
    };
    expect(previewRestore(full, b).challengeError).toMatch(/200/);
    expect(() => restoreDemo(full, b, now)).toThrow(/200/);
    expect(Object.keys(full.prayers)).toHaveLength(PRAYER_LIMIT);
  });
});
