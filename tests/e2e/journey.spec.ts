import { readingRhythmUiTest } from "../support/reading-rhythm-ui";
import { journalConflictTests } from "../support/journal-conflicts";
import { prayerListFlowTest } from "../support/prayer-list-flow";
import { readingComfortTests } from "../support/reading-comfort";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { addDays, dateInZone } from "../../src/lib/dates";
import { PLAN } from "../../src/services/reading-plan";
const KEY = "faithquest365.demo.v1";
test("parallel demo grace claims preserve only one explicit date and no reading credit", async ({
  page,
  context,
}) => {
  const today = dateInZone("Asia/Kuala_Lumpur"),
    date = addDays(today, -1),
    prior = addDays(today, -2);
  await page.addInitScript(
    ({ prior }) => {
      localStorage.setItem(
        "faithquest365.demo.v1",
        JSON.stringify({
          version: 1,
          profile: {
            name: "Synthetic grace",
            startDate: prior,
            timeZone: "Asia/Kuala_Lumpur",
            theme: "light",
          },
          chapters: { "GEN.1": prior, "GEN.2": prior, "GEN.3": prior },
          days: { "1": prior },
          rewards: { "reading:1": { amount: 50, date: prior } },
          attempts: {},
          reflections: {},
        }),
      );
    },
    { prior },
  );
  await page.goto("/dashboard");
  await page.locator(".rhythm-disclosure > summary").click();
  const other = await context.newPage();
  await other.goto("/dashboard");
  await other.locator(".rhythm-disclosure > summary").click();
  await page
    .getByRole("button", { name: "Use grace for yesterday", exact: true })
    .click();
  await other
    .getByRole("button", { name: "Use grace for yesterday", exact: true })
    .click();
  const releaseWriteLock = await other.evaluateHandle(async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await new Promise<void>((acquired) => {
      void navigator.locks.request("faithquest365-demo-write", async () => {
        acquired();
        await held;
      });
    });
    return release;
  });
  try {
    await Promise.all([
      page
        .getByRole("button", { name: "Confirm grace day", exact: true })
        .click(),
      other
        .getByRole("button", { name: "Confirm grace day", exact: true })
        .click(),
    ]);
  } finally {
    await releaseWriteLock.evaluate((release) => release());
    await releaseWriteLock.dispose();
  }
  await expect(page.locator(".grace-history li")).toHaveCount(1);
  await expect(other.locator(".grace-history li")).toHaveCount(1);
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("faithquest365.demo.v1")!),
  );
  expect(stored.graceDates).toEqual([date]);
  expect(stored.days).toEqual({ "1": prior });
  expect(stored.rewards).toEqual({ "reading:1": { amount: 50, date: prior } });
  await other.reload();
  await other.locator(".rhythm-disclosure > summary").click();
  await expect(other.locator(".grace-history li")).toHaveCount(1);
});
test("grace history uses bounded pages and actual reading remains separate on a phone", async ({
  page,
}) => {
  const today = dateInZone("Asia/Kuala_Lumpur"),
    dates = Array.from({ length: 12 }, (_, i) =>
      addDays(today, -1 - i * 30),
    ).sort();
  await page.addInitScript(
    ({ dates, today }) => {
      localStorage.setItem(
        "faithquest365.demo.v1",
        JSON.stringify({
          version: 1,
          profile: {
            name: "Synthetic",
            startDate: today,
            timeZone: "Asia/Kuala_Lumpur",
            theme: "light",
          },
          chapters: {},
          days: {},
          rewards: {},
          attempts: {},
          reflections: {},
          graceDates: dates,
        }),
      );
    },
    { dates, today },
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await page.locator(".rhythm-disclosure > summary").click();
  await expect(page.locator(".grace-history li")).toHaveCount(10);
  await page
    .getByRole("button", { name: "Next grace page", exact: true })
    .click();
  await expect(page.locator(".grace-history li")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Use grace for yesterday", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("demo prayers keep drafts private and persist explicit requests, statuses and follow-ups", async ({
  page,
}) => {
  await page.goto("/prayers");
  await page
    .getByRole("button", { name: "New prayer request", exact: true })
    .click();
  await page
    .getByLabel("Prayer title", { exact: true })
    .fill("Synthetic demo prayer");
  await page
    .getByLabel("Your prayer request", { exact: true })
    .fill("Private demo concern for testing.");
  expect(
    await page.evaluate(() => localStorage.getItem("faithquest365.demo.v1")),
  ).toBeNull();
  await page.getByRole("link", { name: "Study Tools", exact: true }).click();
  await page
    .getByRole("link", { name: "Return to Prayer Requests", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Continue Synthetic demo prayer",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("Your prayer request", { exact: true }),
  ).toHaveValue("Private demo concern for testing.");
  await page
    .getByRole("button", { name: "Save prayer request", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Add follow-up", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Add follow-up", exact: true })
    .click();
  await page
    .getByLabel("Your follow-up", { exact: true })
    .fill("A synthetic demo follow-up.");
  await page
    .getByRole("button", { name: "Save follow-up", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit prayer request", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Edit prayer request", exact: true })
    .click();
  await page
    .getByLabel("Prayer status", { exact: true })
    .selectOption("archived");
  await page
    .getByRole("button", { name: "Save prayer request", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Prayer editor", exact: true })
      .getByText("Archived", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", {
      name: "Open prayer: Synthetic demo prayer",
      exact: true,
    })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Prayer editor", exact: true })
      .getByText("A synthetic demo follow-up.", { exact: true }),
  ).toBeVisible();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("faithquest365.demo.v1")!),
  );
  expect(state.rewards).toEqual({});
  expect(state.reflections).toEqual({});
});
test("parallel demo prayer editors preserve drafts until the latest version is explicitly reviewed", async ({
  page,
  context,
}) => {
  await page.goto("/prayers");
  await page
    .getByRole("button", { name: "New prayer request", exact: true })
    .click();
  await page
    .getByLabel("Prayer title", { exact: true })
    .fill("Parallel synthetic prayer");
  await page
    .getByLabel("Your prayer request", { exact: true })
    .fill("The initial synthetic prayer.");
  await page
    .getByRole("button", { name: "Save prayer request", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit prayer request", exact: true }),
  ).toBeEnabled();
  const other = await context.newPage();
  await other.goto("/prayers");
  await other
    .getByRole("button", {
      name: "Open prayer: Parallel synthetic prayer",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Edit prayer request", exact: true })
    .click();
  await other
    .getByRole("button", { name: "Edit prayer request", exact: true })
    .click();
  await page
    .getByLabel("Your prayer request", { exact: true })
    .fill("The first tab's newer synthetic text.");
  await other
    .getByLabel("Your prayer request", { exact: true })
    .fill("The other tab's retained synthetic draft.");
  await page
    .getByRole("button", { name: "Save prayer request", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit prayer request", exact: true }),
  ).toBeEnabled();
  await expect(
    other.getByRole("button", { name: "Save prayer request", exact: true }),
  ).toBeDisabled();
  await expect(
    other.getByLabel("Your prayer request", { exact: true }),
  ).toHaveValue("The other tab's retained synthetic draft.");
  await other
    .getByRole("button", {
      name: "Keep my draft against this version",
      exact: true,
    })
    .click();
  await other
    .getByRole("button", { name: "Save prayer request", exact: true })
    .click();
  await expect(
    other.getByRole("button", { name: "Edit prayer request", exact: true }),
  ).toBeEnabled();
  const s = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("faithquest365.demo.v1")!),
  );
  expect(
    Object.values(s.prayers).map((p) => (p as { text: string }).text),
  ).toEqual(["The other tab's retained synthetic draft."]);
  expect(s.rewards).toEqual({});
});
test("demo prayer search and status filters use bounded pages and fit a phone", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "faithquest365.demo.v1",
      JSON.stringify({
        version: 1,
        profile: {
          name: "Synthetic",
          startDate: "2026-10-18",
          timeZone: "UTC",
          theme: "light",
        },
        chapters: {},
        days: {},
        rewards: {},
        attempts: {},
        reflections: {},
        prayers: Object.fromEntries(
          Array.from({ length: 12 }, (_, i) => [
            crypto.randomUUID(),
            {
              title: "Request " + (i + 1),
              text: "Synthetic concern",
              status: i === 11 ? "answered" : "ongoing",
              revision: crypto.randomUUID(),
              createdAt: "2026-10-18T01:00:00.000Z",
              updatedAt: "2026-10-18T01:00:00.000Z",
              followUps: {},
            },
          ]),
        ),
      }),
    );
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/prayers");
  await expect(
    page
      .getByRole("list", { name: "Prayer requests", exact: true })
      .getByRole("listitem"),
  ).toHaveCount(10);
  await page
    .getByRole("button", { name: "Next prayer page", exact: true })
    .click();
  await expect(
    page
      .getByRole("list", { name: "Prayer requests", exact: true })
      .getByRole("listitem"),
  ).toHaveCount(2);
  await page
    .getByLabel("Filter by prayer status", { exact: true })
    .selectOption("answered");
  await expect(
    page
      .getByRole("list", { name: "Prayer requests", exact: true })
      .getByRole("listitem"),
  ).toHaveCount(1);
  await page
    .getByLabel("Search prayer requests", { exact: true })
    .fill("NO MATCH");
  await expect(
    page
      .getByRole("list", { name: "Prayer requests", exact: true })
      .getByRole("listitem"),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("demo verse notes keep drafts private and persist only explicit saves", async ({
  page,
}) => {
  await page.goto("/bible?book=JHN&chapter=3");
  await page.getByLabel("Verse", { exact: true }).selectOption("16");
  await page.getByRole("button", { name: "Save verse", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove saved verse", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("link", { name: "My saved verses", exact: true })
    .click();
  const card = page.getByRole("article", { name: "John 3:16", exact: true });
  await card
    .getByRole("button", { name: "Add private note", exact: true })
    .click();
  const text = "A synthetic demo note about the saved verse.";
  await card
    .getByLabel("Private note for John 3:16", { exact: true })
    .fill(text);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), KEY),
  ).not.toContain(text);
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page
    .getByRole("link", { name: "Return to Study Tools", exact: true })
    .click();
  await expect(
    card.getByLabel("Private note for John 3:16", { exact: true }),
  ).toHaveValue(text);
  await card
    .getByRole("button", { name: "Save private note", exact: true })
    .click();
  await expect(card.locator(".personal-note-text")).toHaveText(text);
  await page.reload();
  await expect(card.locator(".personal-note-text")).toHaveText(text);
  await expect(
    card.getByRole("button", { name: "Remove", exact: true }),
  ).toBeDisabled();
  const state = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    KEY,
  );
  expect(state.verseNotes["JHN.3.16"].text).toBe(text);
  expect(state.rewards).toEqual({});
  expect(state.chapters).toEqual({});
  await card
    .getByRole("button", { name: "Delete private note", exact: true })
    .click();
  await card
    .getByRole("button", { name: "Delete note permanently", exact: true })
    .click();
  await expect(
    card.getByRole("button", { name: "Remove", exact: true }),
  ).toBeEnabled();
  await page.goto("/profile");
  await page.getByLabel("Backup file", { exact: true }).setInputFiles({
    name: "demo-notes.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
  await expect(page.getByText(/1 missing verse notes/)).toBeVisible();
  await page
    .getByRole("checkbox", { name: /This backup belongs to me/ })
    .check();
  await page
    .getByRole("button", { name: "Confirm merge", exact: true })
    .click();
  await expect(
    page.getByText("Backup merged. Existing entries were kept.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/study");
  await expect(card.locator(".personal-note-text")).toHaveText(text);
});

test("parallel demo note editors require review before replacing another tab's save", async ({
  page,
  context,
}) => {
  await page.goto("/bible?book=JHN&chapter=3");
  await page.getByLabel("Verse", { exact: true }).selectOption("16");
  await page.getByRole("button", { name: "Save verse", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove saved verse", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("link", { name: "My saved verses", exact: true })
    .click();
  const other = await context.newPage();
  await other.goto("/study");
  for (const p of [page, other])
    await p
      .getByRole("button", { name: "Add private note", exact: true })
      .click();
  await page
    .getByLabel("Private note for John 3:16", { exact: true })
    .fill("First tab's synthetic note.");
  await other
    .getByLabel("Private note for John 3:16", { exact: true })
    .fill("Second tab's synthetic note.");
  await page
    .getByRole("button", { name: "Save private note", exact: true })
    .click();
  await expect(page.locator(".personal-note-text")).toHaveText(
    "First tab's synthetic note.",
  );
  await expect(
    other.getByRole("button", { name: "Save private note", exact: true }),
  ).toBeDisabled();
  await expect(
    other.getByText(
      "The saved note changed while you were writing. Review it before saving your draft.",
      { exact: true },
    ),
  ).toBeVisible();
  await other
    .getByRole("button", {
      name: "Keep my draft against this version",
      exact: true,
    })
    .click();
  await other
    .getByRole("button", { name: "Save private note", exact: true })
    .click();
  await expect(other.locator(".personal-note-text")).toHaveText(
    "Second tab's synthetic note.",
  );
  await expect(page.locator(".personal-note-text")).toHaveText(
    "Second tab's synthetic note.",
  );
  expect(
    (await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), KEY))
      .rewards,
  ).toEqual({});
});

async function seedPracticeVerses(page: import("@playwright/test").Page) {
  await page.addInitScript(
    (key) =>
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          profile: {
            name: "Practice fixture",
            startDate: "2026-10-16",
            timeZone: "Asia/Kuala_Lumpur",
            theme: "light",
          },
          chapters: {},
          days: {},
          rewards: {},
          attempts: {},
          reflections: {},
          savedVerses: Object.fromEntries(
            [
              ...Array.from({ length: 12 }, (_, i) => `GEN.1.${i + 1}`),
              "JHN.3.16",
            ].map((key) => [key, "2026-10-17T03:00:00.000Z"]),
          ),
        }),
      ),
    KEY,
  );
  await page.goto("/study");
  await expect(page.locator(".saved-verse-card")).toHaveCount(12);
}

test("guided demo recall respects filters and discards typing without changing stored progress", async ({
  page,
}) => {
  await seedPracticeVerses(page);
  await page.getByLabel("Book", { exact: true }).selectOption("JHN");
  const baseline = await page.evaluate((key) => localStorage.getItem(key), KEY);
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  const practice = page.getByRole("region", {
    name: "Guided memory practice",
    exact: true,
  });
  await expect(practice).toContainText("VERSE 1 OF 1");
  await expect(
    practice.getByRole("heading", { name: "John 3:16", exact: true }),
  ).toBeVisible();
  await practice
    .getByRole("button", { name: "Hide and recall", exact: true })
    .click();
  const recall = "Temporary synthetic demo recall that must not be stored.";
  await practice
    .getByLabel("Your recall (optional)", { exact: true })
    .fill(recall);
  await practice
    .getByRole("button", { name: "Compare wording", exact: true })
    .click();
  await expect(practice.getByRole("status")).toContainText("Some words differ");
  await practice
    .getByRole("button", { name: "End practice", exact: true })
    .click();
  await expect(page.getByLabel("Book", { exact: true })).toHaveValue("JHN");
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(
    baseline,
  );
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await practice
    .getByRole("button", { name: "Hide and recall", exact: true })
    .click();
  await expect(
    practice.getByLabel("Your recall (optional)", { exact: true }),
  ).toHaveValue("");
  await practice
    .getByRole("button", { name: "Finish practice", exact: true })
    .click();
  await expect(
    practice.getByRole("heading", { name: "Practice finished", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(
    baseline,
  );
  await practice
    .getByRole("button", { name: "Return to saved verses", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await practice
    .getByRole("button", { name: "Hide and recall", exact: true })
    .click();
  await practice
    .getByLabel("Your recall (optional)", { exact: true })
    .fill(recall);
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/study$/);
  await expect(practice).toHaveCount(0);
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await practice
    .getByRole("button", { name: "Hide and recall", exact: true })
    .click();
  await expect(
    practice.getByLabel("Your recall (optional)", { exact: true }),
  ).toHaveValue("");
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(
    baseline,
  );
});

test("guided queues use the first five sorted matches across collection pages and disable empty starts", async ({
  page,
}) => {
  await seedPracticeVerses(page);
  await page.getByLabel("Order", { exact: true }).selectOption("bible");
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.locator(".saved-verse-card h2")).toHaveText("John 3:16");
  await page
    .getByLabel("Verses per practice", { exact: true })
    .selectOption("5");
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  const practice = page.getByRole("region", {
    name: "Guided memory practice",
    exact: true,
  });
  for (let verse = 1; verse <= 5; verse++) {
    await expect(
      practice.getByRole("heading", {
        name: `Genesis 1:${verse}`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(practice).toContainText(`VERSE ${verse} OF 5`);
    await practice
      .getByRole("button", {
        name: verse === 5 ? "Finish practice" : "Next verse",
        exact: true,
      })
      .click();
  }
  await expect(
    practice.getByRole("heading", { name: "Practice finished", exact: true }),
  ).toBeVisible();
  await practice
    .getByRole("button", { name: "Return to saved verses", exact: true })
    .click();
  await page
    .getByLabel("Find a reference", { exact: true })
    .fill("no such reference");
  await expect(
    page.getByRole("button", { name: "Start practice", exact: true }),
  ).toBeDisabled();
  const state = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    KEY,
  );
  expect(state.rewards).toEqual({});
  expect(state.chapters).toEqual({});
  expect(Object.keys(state.savedVerses)).toHaveLength(13);
});

test("new day 30 demo quizzes preserve correct and incorrect first attempts after reload", async ({
  page,
}) => {
  await page.goto("/quiz?day=30");
  const fire = page
    .locator(".quiz-card")
    .filter({ hasText: "What was to keep burning continually on the altar?" });
  await fire.getByRole("radio", { name: /Fire/ }).check();
  await fire
    .getByRole("button", { name: "Check my answer", exact: true })
    .click();
  await expect(fire.getByRole("status")).toContainText("10 XP awarded once");
  const offering = page.locator(".quiz-card").filter({
    hasText: "when was the meat of the thanksgiving peace offering",
  });
  await offering.getByRole("radio").first().check();
  await offering
    .getByRole("button", { name: "Check my answer", exact: true })
    .click();
  await expect(offering.getByRole("status")).toContainText("No XP awarded");
  await page.reload();
  await expect(fire.getByRole("radio").first()).toBeDisabled();
  await expect(offering.getByRole("radio").last()).toBeDisabled();
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    KEY,
  );
  expect(saved.rewards["quiz:lev-altar-fire"].amount).toBe(10);
  expect(saved.rewards["quiz:lev-thanksgiving-day"]).toBeUndefined();
  expect(saved.attempts["lev-thanksgiving-day"].correct).toBe(false);
});
test("chronological demo previews show placement notes and every week without creating journey activity", async ({
  page,
}) => {
  await page.goto("/reading-plan#plan-catalogue");
  const catalogue = page.locator("#plan-catalogue");
  await expect(catalogue.getByRole("checkbox")).toBeVisible();
  const before = await page.evaluate((key) => localStorage.getItem(key), KEY);
  await catalogue
    .getByRole("button", { name: "Preview Chronological Journey", exact: true })
    .click();
  await expect(catalogue).toContainText("Genesis 10–11 · Job 1–2");
  await catalogue.locator(".placement-notes summary").click();
  await expect(catalogue).toContainText("Job's placement is uncertain");
  await catalogue
    .getByLabel("Preview week", { exact: true })
    .selectOption("52");
  await expect(catalogue).toContainText("Day 365");
  await expect(catalogue).toContainText("Revelation 19–22");
  await expect(catalogue.getByRole("button", { name: /^Use / })).toHaveCount(0);
  await expect(catalogue.getByRole("checkbox")).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(
    before,
  );
  await catalogue
    .getByRole("button", {
      name: "Preview Balanced Daily Journey",
      exact: true,
    })
    .click();
  await expect(catalogue.getByRole("checkbox")).toBeVisible();
  await expect(
    catalogue.getByLabel("Preview week", { exact: true }),
  ).toHaveValue("0");
  await expect(page.locator(".plan-overview .eyebrow")).toHaveText(
    "Canonical Journey",
  );
});
test("balanced demo selection, preview and passage quizzes survive reload without changing canonical history", async ({
  page,
}) => {
  await page.goto("/reading-plan#plan-catalogue");
  const catalogue = page.locator("#plan-catalogue");
  await catalogue.getByRole("checkbox").check();
  await catalogue
    .getByRole("button", { name: "Use Balanced Daily Journey", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".plan-overview .eyebrow")).toHaveText(
    "Balanced Daily Journey",
  );
  await page.goto("/quiz?day=3");
  await expect(
    page.getByRole("heading", {
      name: "Who was told to build an ark?",
      exact: true,
    }),
  ).toBeVisible();
  for (const [book, chapter] of [
    ["GEN", 1],
    ["GEN", 2],
    ["MAT", 1],
    ["PSA", 1],
  ]) {
    await page.goto(`/bible?day=1&book=${book}&chapter=${chapter}`);
    await page
      .getByRole("button", { name: "Mark chapter as read", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Chapter completed", exact: true }),
    ).toBeVisible();
  }
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    KEY,
  );
  expect(saved.readingPlan).toBe("balanced-v1");
  expect(saved.rewards["reading:balanced-v1:1"].amount).toBe(50);
  expect(saved.rewards["reading:1"]).toBeUndefined();
  await page.goto("/reading-plan#plan-catalogue");
  await catalogue
    .getByRole("button", { name: "Preview Canonical Journey", exact: true })
    .click();
  await expect(
    catalogue.getByRole("heading", {
      name: "Canonical Journey · Schedule preview",
      exact: true,
    }),
  ).toBeVisible();
  await expect(catalogue).toContainText("fixed after your first activity");
  await expect(page.locator(".plan-overview .eyebrow")).toHaveText(
    "Balanced Daily Journey",
  );
});
test("demo fellowship clearly requires account mode and creates no fake groups or sharing requests", async ({
  page,
}) => {
  let groupRequests = 0;
  page.on("request", (req) => {
    if (req.url().includes("/api/fellowship")) groupRequests++;
  });
  await page.goto("/community");
  await expect(
    page.getByRole("heading", {
      name: "Live groups require a signed-in account",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create group", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Group invitation code", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Continue your personal journey", exact: true })
    .click();
  await expect(page).toHaveURL(/\/reading-plan$/);
  expect(groupRequests).toBe(0);
});
test("a demo challenge joins from the dashboard, counts a completed mission once and fits a phone", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await page
    .getByRole("link", { name: /Start a seven-day reading challenge/ })
    .click();
  await page
    .getByRole("button", { name: "Start seven-day challenge", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Current reading challenge" }),
  ).toContainText("0 of 7 dates completed");
  for (let chapter = 1; chapter <= 3; chapter++) {
    await page.goto(`/bible?book=GEN&chapter=${chapter}&day=1`);
    await page
      .getByRole("button", { name: "Mark chapter as read", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Chapter completed", exact: true }),
    ).toBeVisible();
  }
  await page
    .getByRole("link", { name: "Reading Challenges", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Current reading challenge" }),
  ).toContainText("1 of 7 dates completed");
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Current reading challenge" }),
  ).toContainText("1 of 7 dates completed");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".cache/challenges-mobile.png",
    fullPage: true,
  });
  const s = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    KEY,
  );
  expect(s.challengeStarts).toHaveLength(1);
  expect(Object.keys(s.rewards)).not.toContain(
    `challenge:${s.challengeStarts[0]}`,
  );
});

test("a demo challenge earns exactly one bonus on its seventh distinct mission date", async ({
  page,
}) => {
  const today = dateInZone("Asia/Kuala_Lumpur");
  const start = addDays(today, -6);
  const seed = {
    version: 1,
    profile: {
      name: "Challenge fixture",
      startDate: start,
      timeZone: "Asia/Kuala_Lumpur",
      theme: "light",
    },
    chapters: Object.fromEntries(
      PLAN.slice(0, 6).flatMap((m, i) =>
        m.chapters.map((c) => [c.key, addDays(start, i)]),
      ),
    ),
    days: Object.fromEntries(
      Array.from({ length: 6 }, (_, i) => [String(i + 1), addDays(start, i)]),
    ),
    rewards: Object.fromEntries(
      Array.from({ length: 6 }, (_, i) => [
        `reading:${i + 1}`,
        { amount: 50, date: addDays(start, i) },
      ]),
    ),
    attempts: {},
    reflections: {},
    challengeStarts: [start],
  };
  await page.addInitScript(
    ({ key, seed }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(seed));
    },
    { key: KEY, seed },
  );
  await page.goto("/challenges");
  await expect(
    page.getByRole("region", { name: "Current reading challenge" }),
  ).toContainText("6 of 7 dates completed");
  for (const c of PLAN[6].chapters) {
    await page.goto(`/bible?book=${c.book}&chapter=${c.chapter}&day=7`);
    await page
      .getByRole("button", { name: "Mark chapter as read", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Chapter completed", exact: true }),
    ).toBeVisible();
  }
  await page.goto("/challenges");
  await expect(
    page.getByRole("region", { name: "Current reading challenge" }),
  ).toContainText("7 of 7 dates completed");
  await expect(page.locator(".challenge-celebration")).toContainText(
    "100 challenge XP awarded",
  );
  await page.reload();
  await expect(page.locator(".challenge-celebration")).toBeVisible();
  const s = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    KEY,
  );
  expect(s.rewards[`challenge:${start}`]).toEqual({ amount: 100, date: today });
  expect(
    Object.values(s.rewards).reduce(
      (sum: number, r) => sum + (r as { amount: number }).amount,
      0,
    ),
  ).toBe(450);
});

test("ended challenge periods stay visible with bounded history and allow a new period", async ({
  page,
}) => {
  const today = dateInZone("Asia/Kuala_Lumpur");
  const starts = Array.from({ length: 21 }, (_, i) =>
    addDays(today, -7 * (i + 1)),
  ).sort();
  const seed = {
    version: 1,
    profile: {
      name: "Challenge history",
      startDate: starts[0],
      timeZone: "Asia/Kuala_Lumpur",
      theme: "light",
    },
    chapters: {},
    days: {},
    rewards: {},
    attempts: {},
    reflections: {},
    challengeStarts: starts,
  };
  await page.addInitScript(
    ({ key, seed }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(seed));
    },
    { key: KEY, seed },
  );
  await page.goto("/challenges");
  await expect(page.locator(".challenge-history li")).toHaveCount(10);
  await expect(page.locator(".challenge-history li").first()).toContainText(
    "0 of 7 dates · Period ended",
  );
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".challenge-history li")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Start seven-day challenge", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Current reading challenge" }),
  ).toContainText("0 of 7 dates completed");
});
test("journal history supports legacy entries, category/search filters and bounded pages on a phone", async ({
  page,
}) => {
  await page.addInitScript(
    ({ key }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          profile: {
            name: "Journal fixture",
            startDate: "2026-10-01",
            timeZone: "Asia/Kuala_Lumpur",
            theme: "light",
          },
          chapters: {},
          days: {},
          rewards: {},
          attempts: {},
          reflections: Object.fromEntries(
            Array.from({ length: 12 }, (_, i) => {
              const day = `2026-10-${String(i + 1).padStart(2, "0")}`;
              return [
                day,
                {
                  text: `A synthetic journal entry ${i + 1} about patience and faith.`,
                  updatedAt: `${day}T12:00:00.000Z`,
                  ...(i % 3 === 0 ? { category: "prayer" } : {}),
                },
              ];
            }),
          ),
        }),
      );
    },
    { key: KEY },
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/journal");
  await expect(page.locator(".entry-list .entry-preview")).toHaveCount(10);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".entry-list .entry-preview")).toHaveCount(2);
  await page
    .getByLabel("Filter by category", { exact: true })
    .selectOption("prayer");
  await expect(page.locator(".entry-list .entry-preview")).toHaveCount(4);
  await expect(
    page.getByRole("navigation", { name: "Reflection pages" }),
  ).toHaveCount(0);
  await page
    .getByLabel("Search reflections", { exact: true })
    .fill("2026-10-04");
  await expect(page.locator(".entry-list .entry-preview")).toHaveCount(1);
  await page.locator(".entry-list .entry-preview").click();
  await expect(page.getByLabel("Entry category", { exact: true })).toHaveValue(
    "prayer",
  );
  await page
    .getByLabel("Filter by category", { exact: true })
    .selectOption("reflection");
  await page.getByLabel("Search reflections", { exact: true }).fill("");
  await expect(page.locator(".entry-list .entry-preview")).toHaveCount(8);
  await page.locator(".entry-list .entry-preview").first().click();
  await expect(page.getByLabel("Entry category", { exact: true })).toHaveValue(
    "reflection",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: ".cache/journal-mobile.png", fullPage: true });
});

test("demo journal drafts survive internal navigation and save categories only on demand", async ({
  page,
}) => {
  await page.goto("/journal");
  const text = "A synthetic private prayer kept in memory until I save it.";
  await page
    .getByLabel("Entry category", { exact: true })
    .selectOption("prayer");
  await page.getByLabel("Your reflection", { exact: true }).fill(text);
  await page.getByRole("link", { name: "Study Tools", exact: true }).click();
  await expect(page.locator(".journal-draft-banner")).toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key) ?? "", KEY),
  ).not.toContain(text);
  await page.getByRole("link", { name: "Return to journal" }).click();
  await expect(page.getByLabel("Your reflection", { exact: true })).toHaveValue(
    text,
  );
  await expect(page.getByLabel("Entry category", { exact: true })).toHaveValue(
    "prayer",
  );
  await page
    .getByRole("button", { name: "Save reflection", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Your reflection", { exact: true })).toHaveValue(
    text,
  );
  await expect(page.getByLabel("Entry category", { exact: true })).toHaveValue(
    "prayer",
  );
});
test("saved verse pages and book filters remain consistent after the last matching verse is removed", async ({
  page,
}) => {
  const stamp = "2026-10-16T12:00:00.000Z";
  await page.addInitScript(
    ({ key, stamp }) =>
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          profile: {
            name: "Study fixture",
            startDate: "2026-10-16",
            timeZone: "Asia/Kuala_Lumpur",
            theme: "light",
          },
          chapters: {},
          days: {},
          rewards: {},
          attempts: {},
          reflections: {},
          savedVerses: {
            ...Object.fromEntries(
              Array.from({ length: 12 }, (_, i) => [`GEN.1.${i + 1}`, stamp]),
            ),
            "JHN.3.16": "2026-10-17T03:00:00.000Z",
          },
        }),
      ),
    { key: KEY, stamp },
  );
  await page.goto("/study");
  await expect(page.locator(".saved-verse-card")).toHaveCount(12);
  await expect(page.locator(".saved-verse-card h2").first()).toHaveText(
    "John 3:16",
  );
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.locator(".saved-verse-card")).toHaveCount(1);
  await page.getByLabel("Order", { exact: true }).selectOption("bible");
  await expect(page.locator(".saved-verse-card h2").first()).toHaveText(
    "Genesis 1:1",
  );
  await page.getByLabel("Book", { exact: true }).selectOption("JHN");
  await expect(page.locator(".saved-verse-card")).toHaveCount(1);
  await page
    .getByRole("article", { name: "John 3:16", exact: true })
    .getByRole("button", { name: "Remove", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "No matching saved verses" }),
  ).toBeVisible();
  await expect(page.getByLabel("Book", { exact: true })).toHaveValue("JHN");
  await page.getByLabel("Book", { exact: true }).selectOption("");
  await expect(page.locator(".saved-verse-card")).toHaveCount(12);
});
test("saved verses offer private memory practice, reference filtering and mobile removal", async ({
  page,
}) => {
  await page.goto("/bible?book=JHN&chapter=3");
  await page.getByLabel("Verse", { exact: true }).selectOption("16");
  await page.getByRole("button", { name: "Save verse", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove saved verse", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("link", { name: "My saved verses", exact: true })
    .click();
  const card = page.getByRole("article", { name: "John 3:16", exact: true });
  await expect(card.locator("blockquote")).toContainText(
    "For God so loved the world",
  );
  await card.getByRole("button", { name: "Hide verse to practise" }).click();
  await expect(card.locator("blockquote")).toHaveCount(0);
  await card.getByRole("button", { name: "Show verse" }).click();
  await page.getByLabel("Find a reference", { exact: true }).fill("Genesis");
  await expect(
    page.getByRole("heading", { name: "No matching saved verses" }),
  ).toBeVisible();
  await page.getByLabel("Find a reference", { exact: true }).fill("John 3:16");
  await expect(card.locator("blockquote")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.screenshot({
    path: ".cache/study-tools-mobile.png",
    fullPage: true,
  });
  await page.reload();
  await expect(card.locator("blockquote")).toBeVisible();
  expect(
    (await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), KEY))
      .rewards,
  ).toEqual({});
  await card.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "A place for the verses you want to remember",
    }),
  ).toBeVisible();
});
test("parallel tabs merge saved verses and preserve the other verse on removal", async ({
  context,
}) => {
  const a = await context.newPage(),
    b = await context.newPage();
  await Promise.all([
    a.goto("/bible?book=GEN&chapter=1"),
    b.goto("/bible?book=GEN&chapter=1"),
  ]);
  await a.getByLabel("Verse", { exact: true }).selectOption("1");
  await b.getByLabel("Verse", { exact: true }).selectOption("2");
  await Promise.all([
    a.getByRole("button", { name: "Save verse", exact: true }).click(),
    b.getByRole("button", { name: "Save verse", exact: true }).click(),
  ]);
  await expect(
    a.getByRole("button", { name: "Remove saved verse", exact: true }),
  ).toBeEnabled();
  await expect(
    b.getByRole("button", { name: "Remove saved verse", exact: true }),
  ).toBeEnabled();
  let state = await a.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    KEY,
  );
  expect(Object.keys(state.savedVerses).sort()).toEqual(["GEN.1.1", "GEN.1.2"]);
  // Hold the shared write lock so removal cannot finish during click().
  // This reproduces CI's read-before-commit race without timing assumptions.
  const releaseWriteLock = await b.evaluateHandle(async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await new Promise<void>((acquired) => {
      void navigator.locks.request("faithquest365-demo-write", async () => {
        acquired();
        await held;
      });
    });
    return release;
  });
  try {
    await a
      .getByRole("button", { name: "Remove saved verse", exact: true })
      .click();
    await expect(
      a.getByRole("button", { name: "Remove saved verse", exact: true }),
    ).toBeDisabled();
    state = await a.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      KEY,
    );
    expect(Object.keys(state.savedVerses).sort()).toEqual([
      "GEN.1.1",
      "GEN.1.2",
    ]);
  } finally {
    await releaseWriteLock.evaluate((release) => release());
    await releaseWriteLock.dispose();
  }
  // click() waits for event dispatch, not the asynchronous locked write.
  await expect(
    a.getByRole("button", { name: "Save verse", exact: true }),
  ).toBeEnabled();
  state = await a.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    KEY,
  );
  expect(Object.keys(state.savedVerses)).toEqual(["GEN.1.2"]);
  await expect(
    b.getByRole("button", { name: "Remove saved verse", exact: true }),
  ).toBeEnabled();
  expect(state.rewards).toEqual({});
});
test("a demo backup merges missing history and recalculates rewards without replacing preferences", async ({
  page,
}) => {
  await page.goto("/profile");
  const zone = await page
    .getByLabel("Journey timezone", { exact: true })
    .inputValue();
  const date = await page
    .getByLabel("Journey start date", { exact: true })
    .inputValue();
  const name = await page
    .getByLabel("Display name", { exact: true })
    .inputValue();
  const backup = {
    version: 1,
    profile: {
      name: "Backup name is not applied",
      startDate: date,
      timeZone: zone,
      theme: "light",
    },
    chapters: { "GEN.1": date, "GEN.2": date, "GEN.3": date },
    days: { 365: date },
    rewards: { forged: { amount: 150, date } },
    attempts: {
      "gen-rest": { answer: 0, correct: true, date },
      "gen-babel": { answer: 1, correct: false, date },
    },
    reflections: {
      [date]: {
        text: "A synthetic reflection recovered in the local demo.",
        updatedAt: new Date().toISOString(),
      },
    },
  };
  await page.getByLabel("Backup file", { exact: true }).setInputFiles({
    name: "demo-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(
    page.getByRole("heading", { name: "Backup preview" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page
    .locator(".backup-card")
    .filter({
      has: page.getByRole("heading", { name: "Restore a backup", exact: true }),
    })
    .screenshot({ path: ".cache/restore-preview.png" });
  await page
    .getByRole("checkbox", { name: /This backup belongs to me/ })
    .check();
  await page.getByRole("button", { name: "Confirm merge" }).click();
  await expect(
    page.getByText("Backup merged. Existing entries were kept.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(
    name,
  );
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    KEY,
  );
  expect(
    Object.values(saved.rewards).reduce(
      (sum: number, r) => sum + (r as { amount: number }).amount,
      0,
    ),
  ).toBe(80);
  expect(saved.rewards).not.toHaveProperty("forged");
  expect(saved.days).toEqual({ 1: date });
  expect(saved.attempts["gen-rest"].correct).toBe(false);
  expect(saved.attempts["gen-babel"].correct).toBe(true);
});
test("complete a mission, earn rewards once, save/edit a reflection, and retain progress after refresh", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "A year in the Word.",
  );
  await page.getByRole("link", { name: "Begin your journey" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Welcome back",
  );
  await page
    .getByRole("link", { name: "Continue reading", exact: true })
    .click();
  for (let chapter = 1; chapter <= 3; chapter++) {
    await expect(page.locator(".reader-title h2")).toHaveText(
      `Genesis ${chapter}`,
    );
    await page
      .getByRole("button", { name: "Mark chapter as read", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Chapter completed", exact: true }),
    ).toBeDisabled();
    if (chapter < 3)
      await page
        .getByRole("link", { name: "Next chapter", exact: true })
        .click();
  }
  await expect(page.locator(".mission-done")).toContainText("50 XP awarded");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Chapter completed", exact: true }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Daily Quiz", exact: true }).click();
  await page
    .locator(".quiz-card")
    .first()
    .getByText("Day", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Check my answer", exact: true })
    .first()
    .click();
  await expect(page.locator(".answer-explanation").first()).toContainText(
    "10 XP awarded once",
  );
  await page
    .getByRole("link", { name: "Reflection Journal", exact: true })
    .click();
  const text =
    "Today I noticed the goodness of creation and want to make room for gratitude.";
  await page.getByLabel("Your reflection", { exact: true }).fill(text);
  await page
    .getByRole("button", { name: "Save reflection", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Your reflection", { exact: true })).toHaveValue(
    text,
  );
  await page
    .getByLabel("Your reflection", { exact: true })
    .fill(text + " An edited thought.");
  await page
    .getByRole("button", { name: "Save reflection", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
  const state = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    KEY,
  );
  expect(
    Object.values(state.rewards).reduce(
      (sum: number, r: unknown) => sum + (r as { amount: number }).amount,
      0,
    ),
  ).toBe(80);
  expect(Object.keys(state.days)).toEqual(["1"]);
  expect(state.resume).toEqual({ book: "GEN", chapter: 3 });
  await page.getByRole("link", { name: "Bible Reader", exact: true }).click();
  await expect(page.locator(".reader-title h2")).toHaveText("Genesis 3");
  await page.getByRole("link", { name: "Achievements", exact: true }).click();
  await expect(page.locator(".badge-card.earned")).toHaveCount(3);
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page.locator(".stat-card").nth(1)).toContainText("80");
  await page.screenshot({
    path: ".cache/qa/dashboard-desktop.png",
    fullPage: true,
  });
  await page.goto("/profile");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export demo backup" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("faithquest365-demo-backup.json");
  const exported = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(exported.reflections).toEqual(
    expect.objectContaining({
      [state.profile.startDate]: expect.objectContaining({
        text: text + " An edited thought.",
      }),
    }),
  );
  expect(exported.rewards).toEqual(state.rewards);
  expect(errors).toEqual([]);
});
test("mobile navigation, all feature routes, and persistent dark theme", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Welcome back",
  );
  for (const label of [
    "My Reading Plan",
    "Bible Reader",
    "Daily Quiz",
    "Reflection Journal",
    "Achievements",
    "Community",
  ]) {
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(page.locator("#main-content h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page
    .getByRole("button", { name: "Toggle color theme", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Welcome back",
  );
  await page.screenshot({
    path: ".cache/qa/dashboard-mobile-dark.png",
    fullPage: true,
  });
});
test("Scripture loading failures remain honest and cannot mark an unread chapter", async ({
  page,
}) => {
  await page.route("**/bible/GEN/1.json", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.goto("/bible?day=1&book=GEN&chapter=1");
  await expect(
    page.getByRole("heading", { name: "Scripture is unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mark chapter as read", exact: true }),
  ).toBeDisabled();
  await page.unroute("**/bible/GEN/1.json");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Mark chapter as read", exact: true }),
  ).toBeEnabled();
});
test("storage failures do not falsely report saved progress", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Demo storage is full", "QuotaExceededError");
    };
  });
  await page.goto("/bible?day=1&book=GEN&chapter=1");
  await page
    .getByRole("button", { name: "Mark chapter as read", exact: true })
    .click();
  await expect(page.locator(".error-banner")).toContainText(
    "Demo storage is full",
  );
  await expect(
    page.getByRole("button", { name: "Mark chapter as read", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Chapter completed", exact: true }),
  ).toHaveCount(0);
});
test("parallel browser tabs merge chapter writes instead of dropping progress", async ({
  context,
}) => {
  const a = await context.newPage(),
    b = await context.newPage();
  await Promise.all([
    a.goto("/bible?day=1&book=GEN&chapter=1"),
    b.goto("/bible?day=1&book=GEN&chapter=2"),
  ]);
  await Promise.all([
    a
      .getByRole("button", { name: "Mark chapter as read", exact: true })
      .click(),
    b
      .getByRole("button", { name: "Mark chapter as read", exact: true })
      .click(),
  ]);
  await expect(
    a.getByRole("button", { name: "Chapter completed", exact: true }),
  ).toBeDisabled();
  await expect(
    b.getByRole("button", { name: "Chapter completed", exact: true }),
  ).toBeDisabled();
  const state = await a.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    KEY,
  );
  expect(Object.keys(state.chapters).sort()).toEqual(["GEN.1", "GEN.2"]);
});

readingComfortTests();

prayerListFlowTest("demo");

journalConflictTests("demo");

readingRhythmUiTest("demo");
