import { describe, it, expect } from "vitest";
import { initialState, stateSchema } from "../src/lib/state";
import { addDays } from "../src/lib/dates";
import {
  graceDatesSchema,
  mergeGraceDates,
  readingRhythm,
  graceEligibility,
} from "../src/lib/grace-days";
import {
  claimGraceDay,
  nextUnfinishedMission,
  mergedGraceHistory,
} from "../src/services/reading-consistency";
import { achievements, streak } from "../src/services/gamification-display";
import { parseBackup, previewRestore } from "../src/lib/backup";
import { restoreDemo } from "../src/services/restore-demo";
import { commandSchema } from "../src/lib/commands";
const now = new Date("2026-10-18T04:00:00Z"),
  today = "2026-10-18",
  yesterday = "2026-10-17";
const initial = () => ({
  ...initialState(now),
  profile: {
    ...initialState(now).profile,
    startDate: "2026-10-01",
    timeZone: "UTC",
  },
});
describe("reading consistency and optional grace", () => {
  it("claims only yesterday and changes only grace history, with stable retries", () => {
    const s = { ...initial(), days: { "1": "2026-10-16" } };
    const next = claimGraceDay(s, yesterday, now);
    expect(next).toEqual({ ...s, graceDates: [yesterday] });
    expect(
      claimGraceDay(next, yesterday, new Date("2026-10-19T04:00:00Z")),
    ).toBe(next);
    for (const d of [today, "2026-10-16", "2099-01-01"])
      expect(() => claimGraceDay(s, d, now)).toThrow(/yesterday only/);
    expect(() => claimGraceDay(initial(), yesterday, now)).toThrow(
      /completed mission/,
    );
    expect(() =>
      claimGraceDay(
        { ...s, days: { ...s.days, "2": yesterday } },
        yesterday,
        now,
      ),
    ).toThrow(/already has/);
  });
  it("allows exactly 30 calendar days, rejects 29, duplicates and unsorted snapshot histories", () => {
    const s = {
      ...initial(),
      days: { "1": "2026-10-16" },
      graceDates: [addDays(yesterday, -29)],
    };
    expect(() => claimGraceDay(s, yesterday, now)).toThrow(/30 calendar/);
    expect(
      claimGraceDay(
        { ...s, graceDates: [addDays(yesterday, -30)] },
        yesterday,
        now,
      ).graceDates,
    ).toEqual([addDays(yesterday, -30), yesterday]);
    expect(graceDatesSchema.safeParse([yesterday, yesterday]).success).toBe(
      false,
    );
    expect(
      graceDatesSchema.safeParse([yesterday, addDays(yesterday, -30)]).success,
    ).toBe(false);
    expect(() =>
      mergeGraceDates([yesterday], [addDays(yesterday, -15)]),
    ).toThrow(/30 calendar/);
    expect(mergeGraceDates([yesterday], [yesterday])).toEqual([yesterday]);
    expect(
      graceDatesSchema.safeParse(
        Array.from({ length: 1001 }, (_, i) =>
          addDays(yesterday, -i * 30),
        ).sort(),
      ).success,
    ).toBe(false);
    expect(() =>
      claimGraceDay(
        {
          ...s,
          graceDates: Array.from({ length: 1000 }, (_, i) =>
            addDays(yesterday, -(i + 1) * 30),
          ).sort(),
        },
        yesterday,
        now,
      ),
    ).toThrow(/limit/);
  });
  it("counts actual reading days across a grace gap without badge or challenge credit", () => {
    const days = Object.fromEntries(
      Array.from({ length: 6 }, (_, i) => [
        String(i + 1),
        addDays(today, i - 7),
      ]),
    );
    const s = { ...initial(), days, graceDates: [yesterday] };
    expect(streak(Object.values(days), today)).toBe(0);
    expect(readingRhythm(days, [yesterday], today)).toEqual({
      readingDays: 6,
      graceDays: 1,
    });
    expect(achievements(s).find((b) => b.id === "week")!.earned).toBe(false);
    expect(readingRhythm(days, [yesterday], addDays(today, 1))).toEqual({
      readingDays: 0,
      graceDays: 0,
    });
    expect(
      readingRhythm({ ...days, "7": yesterday }, [yesterday], today),
    ).toEqual({ readingDays: 7, graceDays: 0 });
    expect(s.rewards).toEqual({});
  });
  it("uses the journey timezone across local midnight, DST and leap-day boundaries", () => {
    const instant = new Date("2026-10-18T00:30:00Z");
    const s = {
      ...initial(),
      profile: { ...initial().profile, timeZone: "America/Los_Angeles" },
      days: { "1": "2026-10-15" },
    };
    expect(claimGraceDay(s, "2026-10-16", instant).graceDates).toEqual([
      "2026-10-16",
    ]);
    expect(() => claimGraceDay(s, yesterday, instant)).toThrow(/yesterday/);
    for (const [zone, stamp, previous, target] of [
      ["America/New_York", "2026-03-09T04:30:00Z", "2026-03-07", "2026-03-08"],
      ["UTC", "2028-03-01T04:00:00Z", "2028-02-28", "2028-02-29"],
    ])
      expect(
        claimGraceDay(
          {
            ...s,
            profile: { ...s.profile, timeZone: zone },
            days: { "1": previous },
          },
          target,
          new Date(stamp),
        ).graceDates,
      ).toEqual([target]);
  });
  it("resumes the earliest unfinished mission's first unread chapter in either plan", () => {
    const s = { ...initial(), chapters: { "GEN.1": "2026-10-16" } };
    expect(nextUnfinishedMission(s, today).chapter?.key).toBe("GEN.2");
    expect(
      nextUnfinishedMission({ ...s, readingPlan: "balanced-v1" }, today).next
        ?.day,
    ).toBe(1);
    expect(
      nextUnfinishedMission({ ...s, readingPlan: "balanced-v1" }, today).chapter
        ?.key,
    ).toBe("GEN.2");
    const all = {
      ...s,
      days: Object.fromEntries(
        Array.from({ length: 365 }, (_, i) => [String(i + 1), today]),
      ),
    };
    expect(nextUnfinishedMission(all, today).next).toBeUndefined();
    expect(
      nextUnfinishedMission({ ...s, days: { "1": today } }, today).next?.day,
    ).toBe(2);
  });
  it("restores derived grace history, preserves duplicates and legacy files, and rejects invalid unions atomically", () => {
    const s = {
      ...initial(),
      chapters: {
        "GEN.1": "2026-10-16",
        "GEN.2": "2026-10-16",
        "GEN.3": "2026-10-16",
      },
      days: { "1": "2026-10-16" },
      graceDates: [yesterday],
    };
    const backup = parseBackup(JSON.stringify(s), "UTC", now);
    expect(previewRestore(initial(), backup).graceDates).toBe(1);
    const next = restoreDemo(initial(), backup, now);
    expect(next.graceDates).toEqual([yesterday]);
    expect(() =>
      mergedGraceHistory({ ...initial(), days: { "1": today } }, backup),
    ).toThrow(/completed mission/);

    expect(next.days).toEqual({ "1": "2026-10-16" });
    expect(Object.keys(next.rewards)).toEqual(["reading:1"]);
    expect(restoreDemo(next, backup, now)).toEqual(next);
    expect(
      restoreDemo(next, { ...backup, graceDates: undefined }, now).graceDates,
    ).toEqual([yesterday]);
    expect(() =>
      restoreDemo(
        { ...initial(), graceDates: [addDays(yesterday, -15)] },
        backup,
        now,
      ),
    ).toThrow(/30 calendar/);
    expect(() =>
      mergedGraceHistory(initial(), { chapters: {}, graceDates: [yesterday] }),
    ).toThrow(/completed mission/);
    expect(() =>
      parseBackup(JSON.stringify({ ...s, graceDates: [today] }), "UTC", now),
    ).toThrow(/before today/);
  });
  it("rejects forged credit and caller identities and keeps legacy snapshots compatible", () => {
    expect(stateSchema.safeParse(initial()).success).toBe(true);
    expect(
      commandSchema.safeParse({ type: "grace", date: yesterday }).success,
    ).toBe(true);
    for (const extra of [
      { user_id: "victim" },
      { xp: 50 },
      { graceDates: [yesterday] },
      { date: "2026-02-30" },
    ])
      expect(
        commandSchema.safeParse({ type: "grace", date: yesterday, ...extra })
          .success,
      ).toBe(false);
    expect(
      graceEligibility({ "1": "2026-10-16" }, [yesterday], today).available,
    ).toBe(false);
  });
});
