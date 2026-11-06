import { describe, expect, it } from "vitest";
import { initialState, type JourneyState } from "../src/lib/state";
import { isFirstJourney } from "../src/lib/first-run";

const date = "2026-11-06";
const instant = `${date}T00:00:00.000Z`;
describe("first journey guidance", () => {
  it("welcomes an empty account regardless of age or profile customization", () => {
    const state = initialState(new Date(instant));
    state.profile = {
      ...state.profile,
      name: "Synthetic Reader",
      startDate: "2020-01-01",
      theme: "dark",
    };
    state.readingPlan = "balanced-v1";
    state.resume = { book: "GEN", chapter: 1 };
    expect(isFirstJourney(state)).toBe(true);
  });
  const activity: [string, Partial<JourneyState>][] = [
    ["chapter", { chapters: { "GEN.1": date } }],
    ["mission", { days: { "1": date } }],
    ["reward", { rewards: { "reading:1": { amount: 50, date } } }],
    [
      "quiz",
      { attempts: { "gen-light": { answer: 0, correct: false, date } } },
    ],
    [
      "journal",
      {
        reflections: {
          [date]: { text: "A synthetic saved reflection.", updatedAt: instant },
        },
      },
    ],
    ["challenge", { challengeStarts: [date] }],
    ["grace", { graceDates: [date] }],
    ["saved verse", { savedVerses: { "JHN.3.16": instant } }],
    [
      "private note",
      {
        verseNotes: {
          "JHN.3.16": { text: "Synthetic note", updatedAt: instant },
        },
      },
    ],
    [
      "prayer",
      {
        prayers: {
          "30000000-0000-4000-8000-000000000001": {
            title: "Synthetic prayer",
            text: "Private synthetic request",
            status: "ongoing",
            revision: "40000000-0000-4000-8000-000000000001",
            createdAt: instant,
            updatedAt: instant,
            followUps: {},
          },
        },
      },
    ],
    [
      "group",
      {
        fellowshipMemberships: [
          {
            groupId: "30000000-0000-4000-8000-000000000001",
            name: "Synthetic group",
            role: "member",
            joinedAt: instant,
          },
        ],
      },
    ],
    ["achievement", { earnedAchievements: ["first-step"] }],
  ];
  it.each(activity)(
    "shows the regular dashboard after a saved %s",
    (_name, saved) => {
      expect(
        isFirstJourney({ ...initialState(new Date(instant)), ...saved }),
      ).toBe(false);
    },
  );
});
