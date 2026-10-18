import { describe, expect, it } from "vitest";
import { initialState, stateSchema } from "../src/lib/state";
import { commandSchema } from "../src/lib/commands";
import { addDays } from "../src/lib/dates";
import {
  challengeProgress,
  challengeStartsSchema,
  mergeChallengeStarts,
} from "../src/lib/challenges";
import { joinChallenge } from "../src/services/challenges";
import { completeChapter, totalXp } from "../src/services/gamification";
import { PLAN } from "../src/services/reading-plan";
import {
  parseBackup,
  previewRestore,
  validateRestore,
} from "../src/lib/backup";
import { restoreDemo } from "../src/services/restore-demo";

const start = "2026-10-11";
const clock = (day: string) => new Date(`${day}T12:00:00.000Z`);
function fresh() {
  const s = initialState(clock(start));
  s.profile.timeZone = "UTC";
  return s;
}
function completedWeek() {
  let s = joinChallenge(fresh(), clock(start));
  for (let i = 0; i < 7; i++)
    for (const chapter of PLAN[i].chapters)
      s = completeChapter(s, chapter.key, clock(addDays(start, i)));
  return s;
}
describe("seven-day reading challenges", () => {
  it("joins today in the journey timezone and returns the same active enrollment on retries", () => {
    const s = fresh();
    s.profile.timeZone = "Asia/Kuala_Lumpur";
    const joined = joinChallenge(s, new Date("2026-10-11T17:00:00.000Z"));
    expect(joined.challengeStarts).toEqual(["2026-10-12"]);
    expect(joinChallenge(joined, clock("2026-10-17"))).toBe(joined);
    expect(joined.rewards).toEqual({});
    expect(s.challengeStarts).toBeUndefined();
    expect(joinChallenge(joined, clock("2026-10-19")).challengeStarts).toEqual([
      "2026-10-12",
      "2026-10-19",
    ]);
  });
  it("awards exactly 100 bonus XP after seven distinct mission dates, including a mission completed before joining", () => {
    const s = completedWeek();
    expect(s.rewards[`challenge:${start}`]).toEqual({
      amount: 100,
      date: "2026-10-17",
    });
    expect(totalXp(s)).toBe(450);
    expect(
      completeChapter(s, PLAN[6].chapters[0].key, clock("2026-10-17")),
    ).toBe(s);
    expect(joinChallenge(s, clock("2026-10-17"))).toBe(s);
    let before = fresh();
    for (const chapter of PLAN[0].chapters)
      before = completeChapter(before, chapter.key, clock(start));
    const joined = joinChallenge(before, clock(start));
    expect(
      challengeProgress(start, Object.values(joined.days), start).count,
    ).toBe(1);
  });
  it("counts several missions on one date only once, excludes chapter/quiz/journal activity and future dates", () => {
    let s = joinChallenge(fresh(), clock(start));
    for (let i = 0; i < 7; i++)
      for (const chapter of PLAN[i].chapters)
        s = completeChapter(s, chapter.key, clock(start));
    expect(
      challengeProgress(start, Object.values(s.days), "2026-10-17").count,
    ).toBe(1);
    expect(s.rewards[`challenge:${start}`]).toBeUndefined();
    expect(
      challengeProgress(start, [start, start, "2026-10-12"], start).count,
    ).toBe(1);
    expect(challengeProgress(start, [], start).count).toBe(0);
  });
  it("shows missed dates without shifting the window and handles month/year and DST boundaries by calendar date", () => {
    const p = challengeProgress(
      "2026-12-29",
      ["2026-12-29", "2026-12-31"],
      "2027-01-05",
    );
    expect(p.end).toBe("2027-01-04");
    expect(p.count).toBe(2);
    expect(p.status).toBe("ended");
    expect(p.dates[1].status).toBe("missed");
    const s = fresh();
    s.profile.timeZone = "America/New_York";
    const joined = joinChallenge(s, new Date("2026-11-01T04:30:00.000Z"));
    expect(joined.challengeStarts).toEqual(["2026-11-01"]);
    expect(challengeProgress("2026-11-01", [], "2026-11-07").end).toBe(
      "2026-11-07",
    );
  });
  it("reconstructs bonus rewards from imported chapters and enrollments, ignoring claimed rewards and dates", () => {
    const s = completedWeek();
    s.rewards[`challenge:${start}`] = { amount: 150, date: "2026-10-11" };
    const now = clock("2026-10-17");
    const backup = parseBackup(JSON.stringify(s), "UTC", now);
    const restored = restoreDemo(fresh(), backup, now);
    expect(restored.rewards[`challenge:${start}`]).toEqual({
      amount: 100,
      date: "2026-10-17",
    });
    expect(restoreDemo(restored, backup, now)).toEqual(restored);
    expect(previewRestore(fresh(), backup).challenges).toBe(1);
    const legacy = { ...backup };
    delete legacy.challengeStarts;
    expect(restoreDemo(restored, legacy, now).challengeStarts).toEqual([start]);
    const noEnrollment = restoreDemo(fresh(), legacy, now);
    expect(noEnrollment.rewards[`challenge:${start}`]).toBeUndefined();
  });
  it("rejects duplicate, overlapping, future or oversized periods and preserves the destination on conflicting merges", () => {
    expect(challengeStartsSchema.safeParse([start, start]).success).toBe(false);
    expect(challengeStartsSchema.safeParse([start, "2026-10-17"]).success).toBe(
      false,
    );
    expect(mergeChallengeStarts([start], [start, "2026-10-18"])).toEqual([
      start,
      "2026-10-18",
    ]);
    expect(
      challengeStartsSchema.safeParse(
        Array.from({ length: 1001 }, (_, i) => addDays("2000-01-01", i * 7)),
      ).success,
    ).toBe(false);
    const s = joinChallenge(fresh(), clock(start));
    const backup = {
      version: 1 as const,
      timeZone: "UTC",
      chapters: {},
      attempts: {},
      reflections: {},
      challengeStarts: ["2026-10-12"],
    };
    expect(previewRestore(s, backup).challengeError).toContain("overlap");
    expect(() => restoreDemo(s, backup, clock("2026-10-17"))).toThrow(
      "overlap",
    );
    expect(s.challengeStarts).toEqual([start]);
    expect(() =>
      validateRestore(
        { ...backup, challengeStarts: ["2099-01-01"] },
        "UTC",
        clock(start),
      ),
    ).toThrow("after today");
    expect(
      stateSchema.safeParse({ ...fresh(), challengeStarts: ["not-a-date"] })
        .success,
    ).toBe(false);
  });
  it("accepts no caller-selected clock, identity, enrollment or reward on the join command", () => {
    expect(commandSchema.safeParse({ type: "joinChallenge" }).success).toBe(
      true,
    );
    for (const extra of [
      { startDate: start },
      { user_id: "other" },
      { xp: 100 },
      { complete: true },
    ])
      expect(
        commandSchema.safeParse({ type: "joinChallenge", ...extra }).success,
      ).toBe(false);
  });
  it("does not offer a challenge with too few unfinished missions", () => {
    const s = fresh();
    s.days = Object.fromEntries(
      Array.from({ length: 360 }, (_, i) => [String(i + 1), "2026-10-10"]),
    );
    expect(() => joinChallenge(s, clock(start))).toThrow("not enough");
  });
});
