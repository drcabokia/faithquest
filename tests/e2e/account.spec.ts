import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { addDays, dateInZone } from "../../src/lib/dates";

const control = "http://127.0.0.1:43191/__control";
async function graceFixture(
  request: import("@playwright/test").APIRequestContext,
) {
  const today = dateInZone("Asia/Kuala_Lumpur"),
    prior = addDays(today, -2),
    date = addDays(today, -1);
  const { state } = await (
    await request.post(control, {
      data: {
        startDate: addDays(today, -8),
        days: { "1": prior },
        chapters: { "GEN.1": prior, "GEN.2": prior, "GEN.3": prior },
        rewards: { "reading:1": { amount: 50, date: prior } },
      },
    })
  ).json();
  return { state, date, today };
}
test("grace confirmation persists, exports and restores without XP or challenge credit", async ({
  page,
  request,
}) => {
  const { state, date, today } = await graceFixture(request);
  await page.goto("/dashboard");
  const rhythm = page.getByRole("region", {
    name: "Reading rhythm and catch-up",
    exact: true,
  });
  await rhythm
    .getByRole("button", { name: "Use grace for yesterday", exact: true })
    .click();
  await rhythm
    .getByRole("button", { name: "Cancel grace", exact: true })
    .click();
  expect(
    (await (await request.post(control, { data: {} })).json()).state.graceDates,
  ).toEqual([]);
  // Another device may earn XP after the loaded snapshot. A grace claim must
  // display its own outcome without attributing that unrelated XP to grace.
  state.rewards["reflection:" + today] = { amount: 20, date: today };
  state.reflections[today] = {
    text: "A synthetic reflection saved on another device.",
    category: "reflection",
    updatedAt: new Date().toISOString(),
  };
  await request.post(control, {
    data: { rewards: state.rewards, reflections: state.reflections },
  });

  await rhythm
    .getByRole("button", { name: "Use grace for yesterday", exact: true })
    .click();
  await rhythm
    .getByRole("button", { name: "Confirm grace day", exact: true })
    .click();
  await expect(rhythm.locator(".grace-history li")).toHaveCount(1);
  await expect(page.locator(".toast")).toHaveText("Grace day saved.");

  const saved = (await (await request.post(control, { data: {} })).json())
    .state;
  expect(saved.graceDates).toEqual([date]);
  expect(saved.rewards).toEqual(state.rewards);
  expect(saved.days).toEqual(state.days);
  expect(saved.earnedAchievements).toEqual(state.earnedAchievements);
  await page.reload();
  await expect(rhythm.locator(".grace-history li")).toHaveCount(1);
  await page.goto("/profile");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export account data", exact: true })
    .click();
  const buffer = await readFile((await (await download).path())!);
  expect(JSON.parse(buffer.toString()).graceDates).toEqual([date]);
  await request.post(control, { data: { graceDates: [] } });
  await page.reload();
  await page.getByLabel("Backup file", { exact: true }).setInputFiles({
    name: "grace.json",
    mimeType: "application/json",
    buffer,
  });
  await expect(page.getByText(/1 missing grace dates/)).toBeVisible();
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
  await page.goto("/dashboard");
  await expect(rhythm.locator(".grace-history li")).toHaveCount(1);
  expect(
    (await (await request.post(control, { data: {} })).json()).state.rewards,
  ).toEqual(state.rewards);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await rhythm.screenshot({ path: ".cache/reading-rhythm-mobile.png" });
});
test("an uncertain grace claim recovers by reading and never replays its write", async ({
  page,
  request,
}) => {
  const { date } = await graceFixture(request);
  await page.goto("/dashboard");
  let writes = 0;
  await page.route("**/api/journey", async (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().postDataJSON().type === "grace"
    ) {
      writes++;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Use grace for yesterday", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm grace day", exact: true })
    .click();
  await expect(page.locator(".error-banner")).toBeVisible();
  await page
    .getByRole("button", { name: "Check saved progress", exact: true })
    .click();
  await expect(page.locator(".grace-history li")).toHaveCount(1);
  expect(writes).toBe(1);
  expect(
    (await (await request.post(control, { data: {} })).json()).state.graceDates,
  ).toEqual([date]);
  await expect(
    page.getByRole("button", { name: "Confirm grace day", exact: true }),
  ).toBeDisabled();
});
test("stale grace eligibility and overlapping backup histories preserve current progress", async ({
  page,
  request,
}) => {
  const { state, date } = await graceFixture(request);
  await page.goto("/dashboard");
  await page
    .getByRole("button", { name: "Use grace for yesterday", exact: true })
    .click();
  const existing = addDays(date, -15);
  await request.post(control, { data: { graceDates: [existing] } });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("button", { name: "Confirm grace day", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cancel grace", exact: true }).click();
  const stale = await page.request.post("/api/journey", {
    headers: { origin: "http://127.0.0.1:3191" },
    data: { type: "grace", date },
  });
  expect(stale.status()).toBe(409);
  await page.goto("/profile");
  await page.getByLabel("Backup file", { exact: true }).setInputFiles({
    name: "overlap.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...state, graceDates: [date] })),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: /30 calendar/ }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: /This backup belongs to me/ })
    .check();
  await expect(
    page.getByRole("button", { name: "Confirm merge", exact: true }),
  ).toBeDisabled();
  const saved = await (await request.post(control, { data: {} })).json();
  expect(saved.restoreCalls).toBe(0);
  expect(saved.state.graceDates).toEqual([existing]);
  expect(saved.state.rewards).toEqual(state.rewards);
});
test("catch-up links resume the first unread chapter in Canonical and Balanced", async ({
  page,
  request,
}) => {
  for (const balanced of [false, true]) {
    await request.post(control, { data: { reset: true } });
    if (balanced) {
      const selected = await page.request.post("/api/journey", {
        headers: { origin: "http://127.0.0.1:3191" },
        data: { type: "selectPlan", plan: "balanced-v1" },
      });
      expect(selected.ok()).toBe(true);
    }
    const today = dateInZone("Asia/Kuala_Lumpur");
    await request.post(control, {
      data: {
        startDate: addDays(today, -8),
        chapters: { "GEN.1": addDays(today, -2) },
      },
    });
    await page.goto("/dashboard");
    const rhythm = page.getByRole("region", {
      name: "Reading rhythm and catch-up",
      exact: true,
    });
    await expect(
      rhythm.getByText(/8 earlier unfinished missions/),
    ).toBeVisible();
    await rhythm
      .getByRole("link", {
        name: "Continue next unfinished mission",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/day=1&book=GEN&chapter=2/);
    await expect(
      page.getByRole("heading", { name: "Genesis 2", exact: true }),
    ).toBeVisible();
  }
});
async function createPrayer(
  page: import("@playwright/test").Page,
  title = "Synthetic prayer",
) {
  await page.goto("/prayers");
  await page
    .getByRole("button", { name: "New prayer request", exact: true })
    .click();
  await page.getByLabel("Prayer title", { exact: true }).fill(title);
  await page
    .getByLabel("Your prayer request", { exact: true })
    .fill("A synthetic private concern for browser verification.");
  await page
    .getByRole("button", { name: "Save prayer request", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit prayer request", exact: true }),
  ).toBeEnabled();
}
test("prayer requests support statuses, dated follow-ups, export, deletion and request-only restore", async ({
  page,
  request,
}) => {
  await createPrayer(page);
  const editor = page.getByRole("region", {
    name: "Prayer editor",
    exact: true,
  });
  await editor
    .getByRole("button", { name: "Add follow-up", exact: true })
    .click();
  await page
    .getByLabel("Your follow-up", { exact: true })
    .fill("Synthetic progress recorded in a private follow-up.");
  await page
    .getByRole("button", { name: "Save follow-up", exact: true })
    .click();
  await expect(
    editor.getByText("Synthetic progress recorded in a private follow-up.", {
      exact: true,
    }),
  ).toBeVisible();
  await editor
    .getByRole("button", { name: "Edit prayer request", exact: true })
    .click();
  await page
    .getByLabel("Prayer status", { exact: true })
    .selectOption("answered");
  await page
    .getByRole("button", { name: "Save prayer request", exact: true })
    .click();
  await expect(
    page
      .getByRole("article", { name: "Synthetic prayer", exact: true })
      .getByText("Answered", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Filter by prayer status", { exact: true })
    .selectOption("ongoing");
  await expect(page.getByRole("article")).toHaveCount(0);
  await page
    .getByLabel("Filter by prayer status", { exact: true })
    .selectOption("all");
  await page
    .getByLabel("Search prayer requests", { exact: true })
    .fill("PRIVATE FOLLOW-UP");
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.reload();
  await expect(
    page.getByRole("article", { name: "Synthetic prayer", exact: true }),
  ).toBeVisible();
  const actual = (await (await request.post(control, { data: {} })).json())
    .state;
  expect(actual.rewards).toEqual({});
  expect(actual.reflections).toEqual({});
  await page.goto("/profile");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export account data", exact: true })
    .click();
  const buffer = await readFile((await (await download).path())!);
  expect(JSON.parse(buffer.toString()).prayers).toEqual(actual.prayers);
  await page.goto("/prayers");
  await page.getByRole("button", { name: "Open prayer", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete prayer request", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep prayer", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Delete prayer request", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete prayer permanently", exact: true })
    .click();
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.goto("/profile");
  await page.getByLabel("Backup file", { exact: true }).setInputFiles({
    name: "prayers.json",
    mimeType: "application/json",
    buffer,
  });
  await expect(page.getByText(/1 missing prayer requests/)).toBeVisible();
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
  await page.goto("/prayers");
  await page.getByRole("button", { name: "Open prayer", exact: true }).click();
  await expect(
    editor.getByText("Synthetic progress recorded in a private follow-up.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(
    (await (await request.post(control, { data: {} })).json()).state.rewards,
  ).toEqual({});
});
test("prayer drafts survive navigation, reject stale edits, and recover a remotely deleted request", async ({
  page,
  request,
}) => {
  await createPrayer(page);
  await page
    .getByRole("button", { name: "Edit prayer request", exact: true })
    .click();
  await page
    .getByLabel("Your prayer request", { exact: true })
    .fill("An unsaved synthetic prayer draft.");
  await page
    .getByRole("link", { name: "Reflection Journal", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Pause. Reflect. Grow.", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Return to Prayer Requests", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Continue Synthetic prayer", exact: true })
    .click();
  await expect(
    page.getByLabel("Your prayer request", { exact: true }),
  ).toHaveValue("An unsaved synthetic prayer draft.");
  const { state } = await (await request.post(control, { data: {} })).json();
  const [id] = Object.keys(state.prayers);
  const newer = {
    ...state.prayers,
    [id]: {
      ...state.prayers[id],
      text: "A newer synthetic saved version.",
      revision: crypto.randomUUID(),
    },
  };
  await request.post(control, { data: { prayers: newer } });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("button", { name: "Save prayer request", exact: true }),
  ).toBeDisabled();
  await page.getByText("Review saved prayer", { exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Prayer editor", exact: true })
      .getByText("A newer synthetic saved version.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Keep my draft against this version",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Save prayer request", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit prayer request", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Edit prayer request", exact: true })
    .click();
  await page
    .getByLabel("Your prayer request", { exact: true })
    .fill("Recover this synthetic draft after remote deletion.");
  await request.post(control, { data: { prayers: {} } });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByText(
      "This prayer was deleted elsewhere. Your draft is still here.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save as a new prayer", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save prayer request", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit prayer request", exact: true }),
  ).toBeEnabled();
  const restored = (await (await request.post(control, { data: {} })).json())
    .state.prayers;
  expect(Object.keys(restored)).toHaveLength(1);
  expect(Object.keys(restored)[0]).not.toBe(id);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: ".cache/prayer-mobile.png", fullPage: true });
});
test("an uncertain prayer save retains newer typing and recovers the committed request without replay", async ({
  page,
  request,
}) => {
  await page.goto("/prayers");
  await page
    .getByRole("button", { name: "New prayer request", exact: true })
    .click();
  await page
    .getByLabel("Prayer title", { exact: true })
    .fill("Uncertain synthetic prayer");
  await page
    .getByLabel("Your prayer request", { exact: true })
    .fill("The first synthetic saved prayer.");
  let commits = 0,
    release!: () => void,
    signal!: () => void;
  const gate = new Promise<void>((r) => (release = r)),
    committed = new Promise<void>((r) => (signal = r));
  await page.route("**/api/journey", async (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().postDataJSON().type === "prayer"
    ) {
      commits++;
      await route.fetch();
      signal();
      await gate;
      await route.abort("failed");
    } else await route.continue();
  });
  try {
    await page
      .getByRole("button", { name: "Save prayer request", exact: true })
      .click();
    await committed;
    await page
      .getByLabel("Your prayer request", { exact: true })
      .fill("Newer synthetic typing must survive the old response.");
  } finally {
    release();
  }
  await expect(page.locator(".error-banner")).toBeVisible();
  await page
    .getByRole("button", { name: "Check saved progress", exact: true })
    .click();
  await expect(
    page.getByLabel("Your prayer request", { exact: true }),
  ).toHaveValue("Newer synthetic typing must survive the old response.");
  expect(commits).toBe(1);
  const stored = (await (await request.post(control, { data: {} })).json())
    .state.prayers;
  expect(
    Object.values(stored).map((p) => (p as { text: string }).text),
  ).toEqual(["The first synthetic saved prayer."]);
  const storage = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
  }));
  expect(JSON.stringify(storage)).not.toContain("Newer synthetic typing");
  await page.unroute("**/api/journey");
  await page
    .getByRole("button", {
      name: "Keep my draft against this version",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Save prayer request", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit prayer request", exact: true }),
  ).toBeEnabled();
  expect(
    Object.keys(
      (await (await request.post(control, { data: {} })).json()).state.prayers,
    ),
  ).toHaveLength(1);
});
test("a late successful prayer reply preserves newer edits and discard requires confirmation", async ({
  page,
}) => {
  await page.goto("/prayers");
  await page
    .getByRole("button", { name: "New prayer request", exact: true })
    .click();
  await page
    .getByLabel("Prayer title", { exact: true })
    .fill("Delayed synthetic prayer");
  await page
    .getByLabel("Your prayer request", { exact: true })
    .fill("The submitted synthetic request.");
  let release!: () => void, signal!: () => void;
  const gate = new Promise<void>((r) => (release = r)),
    committed = new Promise<void>((r) => (signal = r));
  await page.route("**/api/journey", async (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().postDataJSON().type === "prayer"
    ) {
      const response = await route.fetch();
      signal();
      await gate;
      await route.fulfill({ response });
    } else await route.continue();
  });
  try {
    await page
      .getByRole("button", { name: "Save prayer request", exact: true })
      .click();
    await committed;
    await page.getByLabel("Your prayer request", { exact: true }).fill("");
  } finally {
    release();
  }
  await expect(
    page.getByRole("button", {
      name: "Keep my draft against this version",
      exact: true,
    }),
  ).toBeEnabled();
  await expect(
    page.getByLabel("Your prayer request", { exact: true }),
  ).toHaveValue("");
  await page
    .getByRole("button", { name: "Discard prayer draft", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep writing", exact: true }).click();
  await expect(
    page.getByLabel("Your prayer request", { exact: true }),
  ).toHaveValue("");
  await page
    .getByRole("button", { name: "Discard prayer draft", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Discard prayer changes", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Prayer editor", exact: true })
      .getByText("The submitted synthetic request.", { exact: true }),
  ).toBeVisible();
});
test("follow-up drafts warn before reload, survive navigation, and recover after remote deletion", async ({
  page,
  request,
}) => {
  await createPrayer(page, "Follow-up synthetic prayer");
  await page
    .getByRole("button", { name: "Add follow-up", exact: true })
    .click();
  const text = "A synthetic follow-up draft retained in this tab.";
  await page.getByLabel("Your follow-up", { exact: true }).fill(text);
  const warning = page.waitForEvent("dialog");
  await page.evaluate(() => {
    setTimeout(() => window.location.reload(), 0);
  });
  await (await warning).dismiss();
  await expect(page.getByLabel("Your follow-up", { exact: true })).toHaveValue(
    text,
  );
  await page.getByRole("link", { name: "Study Tools", exact: true }).click();
  await page
    .getByRole("link", { name: "Return to Prayer Requests", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Continue follow-up for Follow-up synthetic prayer",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Your follow-up", { exact: true })).toHaveValue(
    text,
  );
  const { state } = await (await request.post(control, { data: {} })).json();
  const [id] = Object.keys(state.prayers);
  await request.post(control, {
    data: {
      prayers: {
        [id]: {
          ...state.prayers[id],
          status: "answered",
          revision: crypto.randomUUID(),
        },
      },
    },
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("button", { name: "Save follow-up", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", {
      name: "Keep my draft against this version",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Save follow-up", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Add follow-up", exact: true }),
  ).toBeEnabled();
  const saved = (await (await request.post(control, { data: {} })).json()).state
    .prayers[id];
  expect(saved.status).toBe("answered");
  expect(Object.keys(saved.followUps)).toHaveLength(1);
  await page
    .getByRole("button", { name: "Add follow-up", exact: true })
    .click();
  await page
    .getByLabel("Your follow-up", { exact: true })
    .fill("Recover this orphaned follow-up as a new request.");
  await request.post(control, { data: { prayers: {} } });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page
    .getByRole("button", { name: "Recover as a new prayer", exact: true })
    .click();
  await expect(
    page.getByLabel("Your prayer request", { exact: true }),
  ).toHaveValue("Recover this orphaned follow-up as a new request.");
  await page
    .getByRole("button", { name: "Save prayer request", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit prayer request", exact: true }),
  ).toBeEnabled();
});
test("a lost follow-up response is recovered with the same note identity and no duplicate", async ({
  page,
  request,
}) => {
  await createPrayer(page, "Synthetic retry prayer");
  await page
    .getByRole("button", { name: "Add follow-up", exact: true })
    .click();
  await page
    .getByLabel("Your follow-up", { exact: true })
    .fill("A synthetic note with an uncertain reply.");
  let writes = 0;
  await page.route("**/api/journey", async (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().postDataJSON().type === "prayer"
    ) {
      writes++;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Save follow-up", exact: true })
    .click();
  await expect(page.locator(".error-banner")).toBeVisible();
  await page
    .getByRole("button", { name: "Check saved progress", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Keep my draft against this version",
      exact: true,
    }),
  ).toBeEnabled();
  const stored = (await (await request.post(control, { data: {} })).json())
    .state.prayers;
  const [id] = Object.keys(stored);
  const noteIds = Object.keys(stored[id].followUps);
  expect(noteIds).toHaveLength(1);
  expect(writes).toBe(1);
  await page.unroute("**/api/journey");
  await page
    .getByRole("button", {
      name: "Keep my draft against this version",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Save follow-up", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Add follow-up", exact: true }),
  ).toBeEnabled();
  const recovered = (await (await request.post(control, { data: {} })).json())
    .state.prayers;
  expect(Object.keys(recovered[id].followUps)).toEqual(noteIds);
});
test("private verse notes save, export, delete and restore without changing Scripture or XP", async ({
  page,
  request,
}) => {
  await saveJohnVerse(page);
  await page
    .getByRole("link", { name: "My saved verses", exact: true })
    .click();
  const card = page.getByRole("article", { name: "John 3:16", exact: true });
  const source = await card.locator("blockquote").textContent();
  const text = "A synthetic private thought about this verse.\nA second line.";
  await card
    .getByRole("button", { name: "Add private note", exact: true })
    .click();
  await card
    .getByLabel("Private note for John 3:16", { exact: true })
    .fill(text);
  expect(
    (await (await request.post(control, { data: {} })).json()).state.verseNotes,
  ).toEqual({});
  await card
    .getByRole("button", { name: "Save private note", exact: true })
    .click();
  await expect(card.locator(".personal-note-text")).toHaveText(text);
  await expect(
    card.getByRole("button", { name: "Remove", exact: true }),
  ).toBeDisabled();
  await expect(card.locator("blockquote")).toHaveText(source!);
  await page.reload();
  await expect(card.locator(".personal-note-text")).toHaveText(text);
  await page.goto("/profile");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export account data", exact: true })
    .click();
  const buffer = await readFile((await (await download).path())!);
  expect(JSON.parse(buffer.toString()).verseNotes["JHN.3.16"].text).toBe(text);
  await page.goto("/study");
  await card
    .getByRole("button", { name: "Delete private note", exact: true })
    .click();
  await card.getByRole("button", { name: "Keep note", exact: true }).click();
  await expect(card.locator(".personal-note-text")).toHaveText(text);
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
    name: "notes.json",
    mimeType: "application/json",
    buffer,
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
  await expect(card.locator("blockquote")).toHaveText(source!);
  await page.goto("/bible?book=JHN&chapter=3");
  await page.getByLabel("Verse", { exact: true }).selectOption("16");
  await expect(
    page.getByRole("button", { name: "Remove saved verse", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText(
      "Manage your private note in Study Tools before removing this saved verse.",
      { exact: true },
    ),
  ).toBeVisible();
  const denied = await page.request.post("/api/journey", {
    headers: { origin: "http://127.0.0.1:3191" },
    data: {
      type: "saveVerse",
      book: "JHN",
      chapter: 3,
      verse: 16,
      saved: false,
    },
  });
  expect(denied.status()).toBe(409);
  const { state } = await (await request.post(control, { data: {} })).json();
  expect(state.verseNotes["JHN.3.16"].text).toBe(text);
  expect(state.rewards).toEqual({});
  expect(state.chapters).toEqual({});
  expect(state.days).toEqual({});
});

test("private note drafts survive app navigation and reject stale concurrent edits", async ({
  page,
  request,
}) => {
  await saveJohnVerse(page);
  await page
    .getByRole("link", { name: "My saved verses", exact: true })
    .click();
  const card = page.getByRole("article", { name: "John 3:16", exact: true });
  await card
    .getByRole("button", { name: "Add private note", exact: true })
    .click();
  const text = "A synthetic private verse note draft that is not yet saved.";
  await card
    .getByLabel("Private note for John 3:16", { exact: true })
    .fill(text);
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15000 });
  await expect(page.getByText(/1 unsaved verse note/)).toBeVisible();
  expect(
    await (await page.request.get("/api/account/export")).text(),
  ).not.toContain(text);
  expect(
    await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    ),
  ).not.toContain(text);
  await page
    .getByRole("link", { name: "Return to Study Tools", exact: true })
    .click();
  await page.getByLabel("Find a reference", { exact: true }).fill("Genesis");
  await expect(card).toHaveCount(0);
  await page
    .getByRole("button", { name: "Continue note: John 3:16", exact: true })
    .click();
  await expect(
    card.getByLabel("Private note for John 3:16", { exact: true }),
  ).toHaveValue(text);
  const dialog = page.waitForEvent("dialog");
  await page.evaluate(() => setTimeout(() => window.location.reload(), 0));
  const warning = await dialog;
  expect(warning.type()).toBe("beforeunload");
  await warning.dismiss();
  const remote = "A synthetic note saved in another browser.";
  await request.post(control, {
    data: {
      verseNotes: {
        "JHN.3.16": { text: remote, updatedAt: new Date().toISOString() },
      },
    },
  });
  // The UI has not refreshed: the actual command must still reject this stale base.
  await card
    .getByRole("button", { name: "Save private note", exact: true })
    .click();
  await expect(page.locator(".error-banner")).toContainText(
    "changed elsewhere",
  );
  await expect(
    card.getByLabel("Private note for John 3:16", { exact: true }),
  ).toHaveValue(text);
  await page
    .getByRole("button", { name: "Check saved progress", exact: true })
    .click();
  await expect(
    card.getByRole("button", { name: "Save private note", exact: true }),
  ).toBeDisabled();
  await card.locator("summary").click();
  await expect(card.locator(".personal-note-text")).toHaveText(remote);
  await card
    .getByRole("button", {
      name: "Keep my draft against this version",
      exact: true,
    })
    .click();
  await card
    .getByRole("button", { name: "Save private note", exact: true })
    .click();
  await expect(card.locator(".personal-note-text")).toHaveText(text);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: ".cache/verse-notes-mobile.png",
    fullPage: true,
  });
});

test("an uncertain note save keeps newer typing and recovers committed text without replay", async ({
  page,
  request,
}) => {
  await saveJohnVerse(page);
  await page
    .getByRole("link", { name: "My saved verses", exact: true })
    .click();
  const card = page.getByRole("article", { name: "John 3:16", exact: true });
  await card
    .getByRole("button", { name: "Add private note", exact: true })
    .click();
  const first = "The first synthetic note sent to the server.";
  const newer = "Newer synthetic typing while the earlier save is in flight.";
  await card
    .getByLabel("Private note for John 3:16", { exact: true })
    .fill(first);
  let commits = 0;
  let release!: () => void;
  let signalCommit!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const committed = new Promise<void>((resolve) => {
    signalCommit = resolve;
  });
  await page.route("**/api/journey", async (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().postDataJSON().type === "verseNote"
    ) {
      commits++;
      await route.fetch();
      signalCommit();
      await gate;
      await route.abort("failed");
    } else await route.continue();
  });
  try {
    await card
      .getByRole("button", { name: "Save private note", exact: true })
      .click();
    await committed;
    await card
      .getByLabel("Private note for John 3:16", { exact: true })
      .fill(newer);
  } finally {
    release();
  }
  await expect(page.locator(".error-banner")).toBeVisible();
  await page
    .getByRole("button", { name: "Check saved progress", exact: true })
    .click();
  await expect(
    card.getByLabel("Private note for John 3:16", { exact: true }),
  ).toHaveValue(newer);
  expect(commits).toBe(1);
  expect(
    (await (await request.post(control, { data: {} })).json()).state.verseNotes[
      "JHN.3.16"
    ].text,
  ).toBe(first);
  await card
    .getByRole("button", { name: "Discard note draft", exact: true })
    .click();
  await card.getByRole("button", { name: "Keep writing", exact: true }).click();
  await expect(
    card.getByLabel("Private note for John 3:16", { exact: true }),
  ).toHaveValue(newer);
  await card
    .getByRole("button", { name: "Discard note draft", exact: true })
    .click();
  await card
    .getByRole("button", { name: "Discard note changes", exact: true })
    .click();
  await expect(card.locator(".personal-note-text")).toHaveText(first);
  expect(commits).toBe(1);
});

test("a successful earlier private note save cannot erase newer clearing", async ({
  page,
}) => {
  await saveJohnVerse(page);
  await page
    .getByRole("link", { name: "My saved verses", exact: true })
    .click();
  const card = page.getByRole("article", { name: "John 3:16", exact: true });
  await card
    .getByRole("button", { name: "Add private note", exact: true })
    .click();
  await card
    .getByLabel("Private note for John 3:16", { exact: true })
    .fill("Earlier synthetic note.");
  let release!: () => void;
  let signal!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const committed = new Promise<void>((resolve) => {
    signal = resolve;
  });
  await page.route("**/api/journey", async (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().postDataJSON().type === "verseNote"
    ) {
      const response = await route.fetch();
      signal();
      await gate;
      await route.fulfill({ response });
    } else await route.continue();
  });
  try {
    await card
      .getByRole("button", { name: "Save private note", exact: true })
      .click();
    await committed;
    await card
      .getByLabel("Private note for John 3:16", { exact: true })
      .fill("");
  } finally {
    release();
  }
  await expect(
    card.getByText(
      "The saved note changed while you were writing. Review it before saving your draft.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    card.getByLabel("Private note for John 3:16", { exact: true }),
  ).toHaveValue("");
  await card
    .getByRole("button", { name: "Discard note draft", exact: true })
    .click();
  await card
    .getByRole("button", { name: "Discard note changes", exact: true })
    .click();
  await expect(card.locator(".personal-note-text")).toHaveText(
    "Earlier synthetic note.",
  );
});

test("a removed saved reference leaves its unsaved note draft recoverable", async ({
  page,
  request,
}) => {
  await saveJohnVerse(page);
  await page
    .getByRole("link", { name: "My saved verses", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add private note", exact: true })
    .click();
  const text =
    "An unsaved synthetic note retained when a verse is removed elsewhere.";
  await page
    .getByLabel("Private note for John 3:16", { exact: true })
    .fill(text);
  await request.post(control, { data: { savedVerses: {} } });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const drafts = page.getByRole("region", {
    name: "Unsaved verse notes",
    exact: true,
  });
  await expect(drafts).toContainText("This verse is no longer saved");
  await expect(
    drafts.getByLabel("Private note for John 3:16", { exact: true }),
  ).toHaveValue(text);
  await drafts
    .getByRole("button", { name: "Save verse again", exact: true })
    .click();
  // The reader can also re-save a removed reference without uploading its draft.
  await expect(
    page.getByRole("article", { name: "John 3:16", exact: true }),
  ).toBeVisible();
  await request.post(control, { data: { savedVerses: {} } });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    drafts.getByRole("button", { name: "Save verse again", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Bible Reader", exact: true }).click();
  await page.getByRole("combobox", { name: /^Book/ }).selectOption("JHN");
  await expect(page).toHaveURL(/book=JHN&chapter=1/);
  await page.getByRole("combobox", { name: /^Chapter/ }).selectOption("3");
  await expect(page).toHaveURL(/book=JHN&chapter=3/);
  await page.getByLabel("Verse", { exact: true }).selectOption("16");
  await expect(
    page.getByRole("button", { name: "Save verse", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Save verse", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove saved verse", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("link", { name: "My saved verses", exact: true })
    .click();
  const card = page.getByRole("article", { name: "John 3:16", exact: true });
  await expect(
    card.getByLabel("Private note for John 3:16", { exact: true }),
  ).toHaveValue(text);
  await card
    .getByRole("button", { name: "Save private note", exact: true })
    .click();
  await expect(card.locator(".personal-note-text")).toHaveText(text);
});

test("guided account recall uses exact Scripture and clears typing between verses without saving", async ({
  page,
  request,
}) => {
  await saveJohnVerse(page);
  await page.getByLabel("Verse", { exact: true }).selectOption("17");
  await page.getByRole("button", { name: "Save verse", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove saved verse", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("link", { name: "My saved verses", exact: true })
    .click();
  await page.getByLabel("Order", { exact: true }).selectOption("bible");
  const baseline = (await (await request.post(control, { data: {} })).json())
    .state;
  const posts: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") posts.push(r.url() + (r.postData() ?? ""));
  });
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  const practice = page.getByRole("region", {
    name: "Guided memory practice",
    exact: true,
  });
  await expect(
    practice.getByRole("heading", { name: "John 3:16", exact: true }),
  ).toBeFocused();
  const source = JSON.parse(
    await readFile("public/bible/JHN/3.json", "utf8"),
  ).verses.find((v: { number: number }) => v.number === 16).text;
  await expect(practice.locator("blockquote")).toHaveText(source);
  await practice
    .getByRole("button", { name: "Hide and recall", exact: true })
    .click();
  await expect(practice.locator("blockquote")).toHaveCount(0);
  await expect(
    practice.getByRole("button", { name: "Compare wording", exact: true }),
  ).toBeDisabled();
  await practice
    .getByRole("button", { name: "Show first-letter hints", exact: true })
    .click();
  await expect(practice.locator(".practice-hints")).toContainText(
    "F__ G__ s_ l____ t__ w____",
  );
  const typed = "A synthetic private recall that should never leave this page.";
  await practice
    .getByLabel("Your recall (optional)", { exact: true })
    .fill(typed);
  await practice
    .getByRole("button", { name: "Compare wording", exact: true })
    .click();
  await expect(practice.getByRole("status")).toContainText("Some words differ");
  await expect(practice.locator("blockquote")).toHaveText(source);
  await practice
    .getByLabel("Your recall (optional)", { exact: true })
    .fill(source.toUpperCase());
  await expect(practice.getByRole("status")).toHaveCount(0);
  await practice
    .getByRole("button", { name: "Compare wording", exact: true })
    .click();
  await expect(practice.getByRole("status")).toHaveText(
    "The words match the WEB verse in order.",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator(".skip-link")).not.toBeInViewport();
  await page.screenshot({
    path: ".cache/guided-memory-mobile.png",
    fullPage: true,
  });
  await practice
    .getByRole("button", { name: "Next verse", exact: true })
    .click();
  await expect(
    practice.getByRole("heading", { name: "John 3:17", exact: true }),
  ).toBeFocused();
  await practice
    .getByRole("button", { name: "Hide and recall", exact: true })
    .click();
  await expect(
    practice.getByLabel("Your recall (optional)", { exact: true }),
  ).toHaveValue("");
  await expect(practice.locator(".practice-hints")).toHaveCount(0);
  await practice
    .getByRole("button", { name: "Reveal verse", exact: true })
    .click();
  await expect(practice.locator("blockquote")).toContainText(
    "For God didn’t send",
  );
  await practice
    .getByRole("button", { name: "Try recall again", exact: true })
    .click();
  await expect(practice.locator("blockquote")).toHaveCount(0);
  await practice
    .getByRole("button", { name: "Finish practice", exact: true })
    .click();
  await expect(
    practice.getByRole("heading", { name: "Practice finished", exact: true }),
  ).toBeVisible();
  await practice
    .getByRole("button", { name: "Return to saved verses", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start practice", exact: true }),
  ).toBeFocused();
  expect(posts).toEqual([]);
  expect(
    (await (await request.post(control, { data: {} })).json()).state,
  ).toEqual(baseline);
  expect(
    await page.evaluate(
      () =>
        JSON.stringify({ ...localStorage }) +
        JSON.stringify({ ...sessionStorage }),
    ),
  ).not.toContain(typed);
});

test("guided practice recovers Scripture failures and reload discards temporary recall", async ({
  page,
}) => {
  await saveJohnVerse(page);
  await page
    .getByRole("link", { name: "My saved verses", exact: true })
    .click();
  await expect(page.locator(".saved-verse-card blockquote")).toBeVisible();
  let unavailable = true;
  await page.route("**/bible/JHN/3.json", (route) =>
    unavailable
      ? route.fulfill({ status: 503, body: "Unavailable" })
      : route.continue(),
  );
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  const practice = page.getByRole("region", {
    name: "Guided memory practice",
    exact: true,
  });
  await expect(practice.getByRole("alert")).toContainText(
    "Scripture could not be loaded",
  );
  await expect(practice.locator("blockquote")).toHaveCount(0);
  await expect(
    practice.getByRole("button", { name: "Compare wording", exact: true }),
  ).toHaveCount(0);
  unavailable = false;
  await practice
    .getByRole("button", { name: "Try again", exact: true })
    .click();
  await expect(practice.locator("blockquote")).toContainText(
    "For God so loved the world",
  );
  await practice
    .getByRole("button", { name: "Hide and recall", exact: true })
    .click();
  await practice
    .getByLabel("Your recall (optional)", { exact: true })
    .fill("Temporary synthetic recall before reload.");
  await page.reload();
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
  await practice
    .getByLabel("Your recall (optional)", { exact: true })
    .fill("Synthetic recall before navigation.");
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(practice).toHaveCount(0);
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
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("link", { name: "Study Tools", exact: true }).click();
  await expect(practice).toHaveCount(0);
});

test("an account collection refresh stops practice for a removed queued verse", async ({
  page,
}) => {
  await saveJohnVerse(page);
  await page.getByLabel("Verse", { exact: true }).selectOption("17");
  await page.getByRole("button", { name: "Save verse", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove saved verse", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("link", { name: "My saved verses", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  const practice = page.getByRole("region", {
    name: "Guided memory practice",
    exact: true,
  });
  await practice
    .getByRole("button", { name: "Hide and recall", exact: true })
    .click();
  await practice
    .getByLabel("Your recall (optional)", { exact: true })
    .fill("Synthetic recall before removal.");
  const removed = await page.request.post("/api/journey", {
    headers: { origin: "http://127.0.0.1:3191" },
    data: {
      type: "saveVerse",
      book: "JHN",
      chapter: 3,
      verse: 16,
      saved: false,
    },
  });
  expect(removed.status()).toBe(200);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    practice.getByRole("heading", {
      name: "Your saved collection changed",
      exact: true,
    }),
  ).toBeVisible();
  await expect(practice.getByRole("textbox")).toHaveCount(0);
  await practice
    .getByRole("button", { name: "Return to saved verses", exact: true })
    .click();
  await expect(page.locator(".saved-verse-card")).toHaveCount(1);
});

test("day 30 quiz feedback stays private until submission and first answers remain immutable", async ({
  page,
  request,
}) => {
  await page.goto("/quiz?day=30");
  await expect(page.locator(".quiz-intro")).toContainText(
    "60 passage-checked questions cover 30 reading days",
  );
  await expect(page.locator(".answer-explanation")).toHaveCount(0);
  const fire = page
    .locator(".quiz-card")
    .filter({ hasText: "What was to keep burning continually on the altar?" });
  await fire.getByRole("radio", { name: /Fire/ }).check();
  await fire
    .getByRole("button", { name: "Check my answer", exact: true })
    .click();
  await expect(fire.getByRole("status")).toContainText("10 XP awarded once");
  await expect(
    fire.getByRole("link", { name: /Leviticus 6:13/ }),
  ).toHaveAttribute("href", "/bible?day=30&book=LEV&chapter=6");
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
  const retry = await page.request.post("/api/journey", {
    headers: { origin: "http://127.0.0.1:3191" },
    data: { type: "answer", id: "lev-thanksgiving-day", answer: 3 },
  });
  expect(retry.status()).toBe(200);
  const { state } = await (await request.post(control, { data: {} })).json();
  expect(state.attempts["lev-thanksgiving-day"].correct).toBe(false);
  expect(state.rewards["quiz:lev-thanksgiving-day"]).toBeUndefined();
  expect(
    Object.values(state.rewards).reduce(
      (n: number, r: unknown) => n + (r as { amount: number }).amount,
      0,
    ),
  ).toBe(10);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".cache/quiz-days-15-30-mobile.png",
    fullPage: true,
  });
});
test("Balanced places new Leviticus questions with their source chapters", async ({
  page,
}) => {
  await page.goto("/reading-plan#plan-catalogue");
  await page.locator("#plan-catalogue").getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Use Balanced Daily Journey", exact: true })
    .click();
  await expect(page.locator(".plan-overview .eyebrow")).toHaveText(
    "Balanced Daily Journey",
  );
  await page.goto("/quiz?day=47");
  const fire = page
    .locator(".quiz-card")
    .filter({ hasText: "What was to keep burning continually on the altar?" });
  await fire.getByRole("radio", { name: /Fire/ }).check();
  await fire
    .getByRole("button", { name: "Check my answer", exact: true })
    .click();
  await expect(
    fire.getByRole("link", { name: /Leviticus 6:13/ }),
  ).toHaveAttribute("href", "/bible?day=47&book=LEV&chapter=6");
  await page.reload();
  await expect(fire.getByRole("status")).toContainText("10 XP awarded once");
  await page.goto("/quiz?day=48");
  await expect(
    page.getByRole("heading", {
      name: /when was the meat of the thanksgiving peace offering/,
    }),
  ).toBeVisible();
});
test("expanded quiz backups are previewed locally and rewards are rederived without trusting imported feedback", async ({
  page,
  request,
}) => {
  const { state } = await (await request.post(control, { data: {} })).json();
  const day = dateInZone("Asia/Kuala_Lumpur");
  state.attempts = {
    "lev-altar-fire": {
      answer: 2,
      correct: false,
      correctOption: 0,
      explanation: "Untrusted file feedback",
      date: day,
    },
  };
  state.rewards = { forged: { amount: 150, date: day } };
  const file = {
    name: "expanded-quiz-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  };
  await page.goto("/profile");
  await page.getByLabel("Backup file", { exact: true }).setInputFiles(file);
  await expect(
    page.getByRole("heading", { name: "Backup preview", exact: true }),
  ).toBeVisible();
  expect(
    (await (await request.post(control, { data: {} })).json()).restoreCalls,
  ).toBe(0);
  await page
    .getByRole("checkbox", { name: /This backup belongs to me/ })
    .check();
  await page
    .getByRole("button", { name: "Confirm merge", exact: true })
    .click();
  await expect(page.locator(".backup-card [role=status]")).toContainText(
    "Backup merged",
  );
  await page.goto("/quiz?day=30");
  await expect(
    page
      .locator(".quiz-card")
      .filter({ hasText: "What was to keep burning" })
      .getByRole("status"),
  ).toContainText("10 XP awarded once");
  await expect(
    page.getByText("Untrusted file feedback", { exact: true }),
  ).toHaveCount(0);
  const saved = await (await request.post(control, { data: {} })).json();
  expect(saved.state.attempts["lev-altar-fire"].correct).toBe(true);
  expect(saved.state.rewards).toEqual({
    [`quiz:lev-altar-fire`]: { amount: 10, date: day },
  });
});
test("chronological account previews and review downloads cannot activate a draft or restore it as personal data", async ({
  page,
  request,
}) => {
  await page.goto("/reading-plan#plan-catalogue");
  const catalogue = page.locator("#plan-catalogue");
  await expect(catalogue.getByRole("checkbox")).toBeVisible();
  const baseline = await (await page.request.get("/api/journey")).json();
  let selectionWrites = 0;
  page.on("request", (r) => {
    if (
      r.url().endsWith("/api/journey") &&
      r.method() === "POST" &&
      r.postDataJSON()?.type === "selectPlan"
    )
      selectionWrites++;
  });
  await catalogue
    .getByRole("button", { name: "Preview Chronological Journey", exact: true })
    .click();
  await expect(
    catalogue.getByRole("heading", {
      name: "Chronological Journey · Schedule preview",
      exact: true,
    }),
  ).toBeVisible();
  await expect(catalogue).toContainText("Genesis 10–11 · Job 1–2");
  await expect(catalogue.getByRole("checkbox")).toHaveCount(0);
  await expect(catalogue.getByRole("button", { name: /^Use / })).toHaveCount(0);
  await catalogue.locator(".placement-notes summary").click();
  await expect(
    catalogue.getByRole("heading", {
      name: "Job's placement is uncertain",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    catalogue.getByRole("link", { name: "Job 1:1 · Read source", exact: true }),
  ).toHaveAttribute("href", "/bible?book=JOB&chapter=1#verse-1");
  await catalogue
    .getByLabel("Preview week", { exact: true })
    .selectOption("52");
  await expect(catalogue).toContainText("Day 365");
  await expect(catalogue).toContainText("Revelation 19–22");
  await expect(
    catalogue.getByRole("button", { name: "Next preview week", exact: true }),
  ).toBeDisabled();
  await expect(
    catalogue.getByRole("heading", {
      name: "Revelation concludes with visions of hope",
      exact: true,
    }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await catalogue
    .getByRole("button", { name: "Download draft schedule", exact: true })
    .click();
  const artifact = await download;
  const buffer = await readFile((await artifact.path())!);
  const exported = JSON.parse(buffer.toString("utf8"));
  expect(artifact.suggestedFilename()).toBe(
    "faithquest365-chronological-draft-v1.json",
  );
  expect(exported).toMatchObject({
    kind: "faithquest-reading-plan-draft",
    status: "preview-only",
    independentEditorialReview: "pending",
  });
  expect(exported.days).toHaveLength(365);
  expect(exported.profile).toBeUndefined();
  expect(exported.rewards).toBeUndefined();
  expect(exported.reflections).toBeUndefined();
  await expect(page.locator(".plan-overview .eyebrow")).toHaveText(
    "Canonical Journey",
  );
  const after = await (await page.request.get("/api/journey")).json();
  expect(after).toEqual(baseline);
  expect(selectionWrites).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await catalogue.screenshot({ path: ".cache/chronological-mobile.png" });
  await page.goto("/profile");
  await page.getByLabel("Backup file", { exact: true }).setInputFiles({
    name: artifact.suggestedFilename(),
    mimeType: "application/json",
    buffer,
  });
  await expect(page.locator(".backup-card [role=alert]")).toContainText(
    "supported FaithQuest version 1 backup",
  );
  const fixture = await (await request.post(control, { data: {} })).json();
  expect(fixture.restoreCalls).toBe(0);
});
test("a new account selects Balanced, keeps it after reload and completes its own day-one mission", async ({
  page,
}) => {
  await page.goto("/reading-plan#plan-catalogue");
  const catalogue = page.locator("#plan-catalogue");
  await expect(
    catalogue.getByRole("heading", {
      name: "Balanced Daily Journey · Schedule preview",
      exact: true,
    }),
  ).toBeVisible();
  const choose = catalogue.getByRole("button", {
    name: "Use Balanced Daily Journey",
    exact: true,
  });
  await expect(choose).toBeDisabled();
  await catalogue.getByRole("checkbox").check();
  await choose.click();
  await expect(page.locator(".plan-overview .eyebrow")).toHaveText(
    "Balanced Daily Journey",
  );
  await page.reload();
  await expect(page.locator(".plan-overview .eyebrow")).toHaveText(
    "Balanced Daily Journey",
  );
  for (const [book, chapter] of [
    ["GEN", 1],
    ["GEN", 2],
    ["MAT", 1],
    ["PSA", 1],
  ]) {
    await page.goto(`/bible?day=1&book=${book}&chapter=${chapter}`);
    if (book === "GEN" && chapter === 2)
      await expect(
        page.getByRole("link", { name: "Next chapter", exact: true }),
      ).toHaveAttribute("href", "/bible?day=1&book=MAT&chapter=1");
    await page
      .getByRole("button", { name: "Mark chapter as read", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Chapter completed", exact: true }),
    ).toBeVisible();
  }
  await expect(page.locator(".mission-done")).toContainText("50 XP awarded");
  await page.goto("/reading-plan#plan-catalogue");
  await expect(catalogue).toContainText(
    "Your reading plan is fixed after your first activity",
  );
  await expect(catalogue.getByRole("button", { name: /^Use / })).toHaveCount(0);
  await page.goto("/profile");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export account data" }).click();
  const exported = JSON.parse(
    await readFile((await (await download).path())!, "utf8"),
  );
  expect(exported.readingPlan).toBe("balanced-v1");
  expect(exported.rewards["reading:balanced-v1:1"].amount).toBe(50);
  expect(exported.rewards["reading:1"]).toBeUndefined();
});
test("plan previews preserve an existing account and the server rejects a stale selection", async ({
  page,
  request,
}) => {
  await page.goto("/reading-plan#plan-catalogue");
  const catalogue = page.locator("#plan-catalogue");
  // Another device records activity after this tab's snapshot loaded.
  await expect(catalogue.getByRole("checkbox")).toBeVisible();
  await request.post(control, {
    data: {
      days: { "1": dateInZone("Asia/Kuala_Lumpur") },
      rewards: {
        "reading:1": { amount: 50, date: dateInZone("Asia/Kuala_Lumpur") },
      },
    },
  });
  await catalogue.getByRole("checkbox").check();
  await catalogue
    .getByRole("button", { name: "Use Balanced Daily Journey", exact: true })
    .click();
  await expect(page.locator(".error-banner")).toContainText(
    "reading plan is fixed",
  );
  await page.reload();
  await expect(page.locator(".plan-overview .eyebrow")).toHaveText(
    "Canonical Journey",
  );
  await catalogue
    .getByRole("button", {
      name: "Preview Balanced Daily Journey",
      exact: true,
    })
    .click();
  await catalogue
    .getByRole("button", { name: "Next preview week", exact: true })
    .click();
  await expect(catalogue).toContainText("Day 8");
  await expect(page.locator(".plan-overview")).toContainText(
    "1 days completed",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".cache/reading-plans-mobile.png",
    fullPage: true,
  });
});
test("a balanced account rejects a legacy canonical backup without a restore request", async ({
  page,
  request,
}) => {
  await page.goto("/reading-plan#plan-catalogue");
  await page.locator("#plan-catalogue").getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Use Balanced Daily Journey", exact: true })
    .click();
  await expect(page.locator(".plan-overview .eyebrow")).toHaveText(
    "Balanced Daily Journey",
  );
  await page.goto("/profile");
  const raw = {
    version: 1,
    profile: {
      name: "Legacy fixture",
      startDate: dateInZone("Asia/Kuala_Lumpur"),
      timeZone: "Asia/Kuala_Lumpur",
      theme: "light",
    },
    chapters: {},
    days: {},
    rewards: {},
    attempts: {},
    reflections: {},
  };
  await page.getByLabel("Backup file", { exact: true }).setInputFiles({
    name: "legacy.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(raw)),
  });
  await expect(page.locator(".backup-card [role=alert]")).toContainText(
    "backup reading plan must match",
  );
  const fixture = await (await request.post(control, { data: {} })).json();
  expect(fixture.restoreCalls).toBe(0);
});
async function createFixtureGroup(
  page: import("@playwright/test").Page,
  name = "Fellowship fixture",
) {
  const form = page.locator(".fellowship-forms > section").first();
  await form.getByLabel("New group name", { exact: true }).fill(name);
  await expect(
    form.getByRole("button", { name: "Create group", exact: true }),
  ).toBeDisabled();
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: "Create group", exact: true }).click();
  await expect(page.getByRole("article", { name, exact: true })).toBeVisible();
}
test("private groups require consent, support owner controls and export only own memberships", async ({
  page,
  request,
}) => {
  await page.goto("/community");
  await createFixtureGroup(page);
  const group = page.locator(".fellowship-group");
  await expect(group).toContainText("Fixture Reader (you)");
  await expect(group).toContainText("0% of the plan recorded");
  await group
    .getByRole("button", { name: "Show invitation code", exact: true })
    .click();
  const oldCode = await group
    .getByLabel("Invitation code", { exact: true })
    .inputValue();
  expect(oldCode).toMatch(/^[0-9a-f]{32}$/);
  await group
    .getByRole("button", { name: "Rotate invitation code", exact: true })
    .click();
  await group
    .getByRole("button", { name: "Cancel group action", exact: true })
    .click();
  await expect(
    group.getByLabel("Invitation code", { exact: true }),
  ).toHaveValue(oldCode);
  await group
    .getByRole("button", { name: "Rotate invitation code", exact: true })
    .click();
  await group
    .getByRole("button", { name: "Confirm rotation", exact: true })
    .click();
  await expect(
    group.getByLabel("Invitation code", { exact: true }),
  ).not.toHaveValue(oldCode);
  await group
    .getByLabel("Group name", { exact: true })
    .fill("Renamed fellowship fixture");
  await group
    .getByRole("button", { name: "Save group name", exact: true })
    .click();
  await expect(
    group.getByRole("heading", { name: "Renamed fellowship fixture" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    group.getByRole("heading", { name: "Renamed fellowship fixture" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Profile & Settings", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export account data" }).click();
  const exported = JSON.parse(
    await readFile((await (await download).path())!, "utf8"),
  );
  expect(exported.fellowshipMemberships).toHaveLength(1);
  expect(exported.fellowshipMemberships[0]).toMatchObject({
    name: "Renamed fellowship fixture",
    role: "owner",
  });
  expect(JSON.stringify(exported)).not.toContain("inviteCode");
  expect(JSON.stringify(exported)).not.toContain("creationRequestId");
  await page.getByRole("link", { name: "Community", exact: true }).click();
  await group.getByRole("button", { name: "Close group", exact: true }).click();
  await expect(
    group.getByRole("button", { name: "Confirm close", exact: true }),
  ).toBeDisabled();
  await group
    .getByLabel("Close group confirmation", { exact: true })
    .fill("CLOSE GROUP");
  await group
    .getByRole("button", { name: "Confirm close", exact: true })
    .click();
  await expect(group).toHaveCount(0);
  expect(
    (await (await request.post(control, { data: {} })).json()).state.rewards,
  ).toEqual({});
});

test("invited members share only participation and can leave with confirmation", async ({
  page,
}) => {
  await page.goto("/community");
  const form = page.locator(".fellowship-forms > section").nth(1);
  await form
    .getByLabel("Group invitation code", { exact: true })
    .fill("a".repeat(32));
  await expect(
    form.getByRole("button", { name: "Join group", exact: true }),
  ).toBeDisabled();
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: "Join group", exact: true }).click();
  const group = page.getByRole("article", {
    name: "Invited fixture group",
    exact: true,
  });
  await expect(group).toContainText("Fixture friend");
  await expect(group).toContainText("10% of the plan recorded");
  await expect(
    group.getByRole("button", { name: "Show invitation code", exact: true }),
  ).toHaveCount(0);
  await expect(
    group.getByRole("button", { name: "Close group", exact: true }),
  ).toHaveCount(0);
  expect(page.url()).not.toContain("a".repeat(32));
  expect(
    await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    ),
  ).not.toContain("a".repeat(32));
  await group.getByRole("button", { name: "Leave group", exact: true }).click();
  await group
    .getByRole("button", { name: "Cancel group action", exact: true })
    .click();
  await expect(group).toBeVisible();
  await group.getByRole("button", { name: "Leave group", exact: true }).click();
  await group
    .getByRole("button", { name: "Confirm leave", exact: true })
    .click();
  await expect(group).toHaveCount(0);
});

test("group outages and a committed create with lost response recover without duplication", async ({
  page,
  request,
}) => {
  await request.post(control, { data: { fellowshipUnavailable: true } });
  await page.goto("/community");
  await expect(page.locator("main [role=alert]")).toContainText(
    "Check saved groups",
  );
  await request.post(control, { data: { fellowshipUnavailable: false } });
  await page
    .getByRole("button", { name: "Check saved groups", exact: true })
    .click();
  const form = page.locator(".fellowship-forms > section").first();
  await form
    .getByLabel("New group name", { exact: true })
    .fill("Interrupted fixture");
  await form.getByRole("checkbox").check();
  let commits = 0;
  await page.route("**/api/fellowship", async (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().postDataJSON().type === "create"
    ) {
      commits++;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await form.getByRole("button", { name: "Create group", exact: true }).click();
  await expect(page.locator("main [role=alert]")).toContainText(
    "Check saved groups",
  );
  await expect(
    form.getByLabel("New group name", { exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Check saved groups", exact: true })
    .click();
  await expect(
    page.getByRole("article", { name: "Interrupted fixture", exact: true }),
  ).toBeVisible();
  await expect(form.getByLabel("New group name", { exact: true })).toHaveValue(
    "",
  );
  expect(commits).toBe(1);
  expect(
    (await (await request.post(control, { data: {} })).json()).fellowshipState
      .groups,
  ).toHaveLength(1);
});

test("invalid invitations and shared write limits retain the join input for explicit recovery", async ({
  page,
  request,
}) => {
  await page.goto("/community");
  const form = page.locator(".fellowship-forms > section").nth(1);
  await form
    .getByLabel("Group invitation code", { exact: true })
    .fill("f".repeat(32));
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: "Join group", exact: true }).click();
  await expect(page.locator("main [role=alert]")).toContainText(
    "invitation is unavailable",
  );
  await expect(page.locator(".fellowship-group")).toHaveCount(0);
  await request.post(control, { data: { limits: { write: 30 } } });
  await form
    .getByLabel("Group invitation code", { exact: true })
    .fill("a".repeat(32));
  await form.getByRole("button", { name: "Join group", exact: true }).click();
  await expect(page.locator("main [role=alert]")).toContainText("Please wait");
  await expect(
    form.getByLabel("Group invitation code", { exact: true }),
  ).toHaveValue("a".repeat(32));
  await request.post(control, { data: { limits: {} } });
  await page
    .getByRole("button", { name: "Check saved groups", exact: true })
    .click();
  await form.getByRole("button", { name: "Join group", exact: true }).click();
  await expect(
    page.getByRole("article", { name: "Invited fixture group", exact: true }),
  ).toBeVisible();
});

test("owner removal confirms its scope, rotates invitations and fits a phone", async ({
  page,
  request,
}) => {
  const group = {
    id: "50000000-0000-4000-8000-000000000001",
    name: "Phone fellowship fixture",
    owner: true,
    inviteCode: "a".repeat(32),
    members: [
      {
        name: "Fixture friend",
        participationPercent: 10,
        isYou: false,
        memberId: "30000000-0000-4000-8000-000000000002",
      },
      {
        name: "Fixture Reader",
        participationPercent: 0,
        isYou: true,
        memberId: "30000000-0000-4000-8000-000000000001",
      },
    ],
  };
  await request.post(control, {
    data: { fellowshipState: { groups: [group] } },
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/community");
  const card = page.getByRole("article", { name: group.name, exact: true });
  await expect(card).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".cache/fellowship-mobile.png",
    fullPage: true,
  });
  await card
    .getByRole("button", { name: "Remove Fixture friend", exact: true })
    .click();
  await expect(
    card.getByRole("group", { name: "Confirm group action" }),
  ).toContainText("invitation code will also change");
  await card
    .getByRole("button", { name: "Cancel group action", exact: true })
    .click();
  await expect(
    card.getByRole("button", { name: "Remove Fixture friend", exact: true }),
  ).toBeVisible();
  await card
    .getByRole("button", { name: "Remove Fixture friend", exact: true })
    .click();
  await card
    .getByRole("button", { name: "Confirm removal", exact: true })
    .click();
  await expect(
    card.getByRole("button", { name: "Remove Fixture friend", exact: true }),
  ).toHaveCount(0);
  const data = await (await request.post(control, { data: {} })).json();
  expect(data.fellowshipState.groups[0].inviteCode).not.toBe(group.inviteCode);
  expect(data.state.rewards).toEqual({});
});

test("refresh removes closed groups and revoked sessions cannot fetch group data", async ({
  page,
  request,
}) => {
  await page.goto("/community");
  await createFixtureGroup(page, "Closing elsewhere fixture");
  await request.post(control, { data: { fellowshipState: { groups: [] } } });
  await page
    .getByRole("button", { name: "Check saved groups", exact: true })
    .click();
  await expect(page.locator(".fellowship-group")).toHaveCount(0);
  await request.post(control, { data: { sessionRevoked: true } });
  const denied = await page.request.get("/api/fellowship");
  expect(denied.status()).toBe(401);
  expect(await denied.text()).not.toContain("Closing elsewhere fixture");
});
test("challenge enrollment is explicit, private, persistent and exported without joining XP", async ({
  page,
  request,
}) => {
  await page.goto("/challenges");
  await expect(
    page.getByRole("heading", { name: "Seven days in the Word." }),
  ).toBeVisible();
  let data = await (await request.post(control, { data: {} })).json();
  expect(data.state.challengeStarts).toEqual([]);
  await page
    .getByRole("button", { name: "Start seven-day challenge", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Current reading challenge" }),
  ).toContainText("0 of 7 dates completed");
  await expect(
    page.getByRole("button", {
      name: "Start seven-day challenge",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Current reading challenge" }),
  ).toBeVisible();
  data = await (await request.post(control, { data: {} })).json();
  expect(data.state.challengeStarts).toEqual([data.state.profile.startDate]);
  expect(data.state.rewards).toEqual({});
  expect(
    await page.evaluate(() => localStorage.getItem("faithquest365.demo.v1")),
  ).toBeNull();
  await page
    .getByRole("link", { name: "Profile & Settings", exact: true })
    .click();
  await expect(
    page.getByLabel("Journey timezone", { exact: true }),
  ).toBeDisabled();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export account data" }).click();
  expect(
    JSON.parse(await readFile((await (await download).path())!, "utf8"))
      .challengeStarts,
  ).toEqual(data.state.challengeStarts);
});

test("a failed or limited challenge join retains a retry path without inventing enrollment", async ({
  page,
  request,
}) => {
  await page.goto("/challenges");
  await expect(
    page.getByRole("button", {
      name: "Start seven-day challenge",
      exact: true,
    }),
  ).toBeEnabled();
  await request.post(control, { data: { rpcUnavailable: true } });
  await page
    .getByRole("button", { name: "Start seven-day challenge", exact: true })
    .click();
  await expect(page.locator(".error-banner")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Current reading challenge" }),
  ).toHaveCount(0);
  await request.post(control, {
    data: { rpcUnavailable: false, limits: { write: 30 } },
  });
  await page.getByRole("button", { name: "Check saved progress" }).click();
  await page
    .getByRole("button", { name: "Start seven-day challenge", exact: true })
    .click();
  await expect(page.locator(".error-banner")).toContainText("wait");
  expect(
    (await (await request.post(control, { data: {} })).json()).state
      .challengeStarts,
  ).toEqual([]);
  await request.post(control, { data: { limits: {} } });
  await page.getByRole("button", { name: "Check saved progress" }).click();
  await page
    .getByRole("button", { name: "Start seven-day challenge", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Current reading challenge" }),
  ).toBeVisible();
});

test("a committed challenge join with a lost response is recovered without replay", async ({
  page,
  request,
}) => {
  await page.goto("/challenges");
  let commits = 0;
  await page.route("**/api/journey", async (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().postDataJSON().type === "joinChallenge"
    ) {
      commits++;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Start seven-day challenge", exact: true })
    .click();
  await expect(page.locator(".error-banner")).toBeVisible();
  await page.getByRole("button", { name: "Check saved progress" }).click();
  await expect(
    page.getByRole("region", { name: "Current reading challenge" }),
  ).toBeVisible();
  expect(commits).toBe(1);
  expect(
    (await (await request.post(control, { data: {} })).json()).state
      .challengeStarts,
  ).toHaveLength(1);
});

test("the seventh mission date updates challenge progress and shows one confirmed bonus", async ({
  page,
  request,
}) => {
  const today = dateInZone("Asia/Kuala_Lumpur");
  const start = addDays(today, -6);
  await request.post(control, {
    data: {
      challengeStarts: [start],
      days: Object.fromEntries(
        Array.from({ length: 6 }, (_, i) => [String(i + 2), addDays(start, i)]),
      ),
    },
  });
  await page.goto("/challenges");
  await expect(
    page.getByRole("region", { name: "Current reading challenge" }),
  ).toContainText("6 of 7 dates completed");
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
  ).toContainText("7 of 7 dates completed");
  await expect(page.locator(".challenge-celebration")).toContainText(
    "100 challenge XP awarded",
  );
  await page.reload();
  await expect(page.locator(".challenge-celebration")).toBeVisible();
  const { state } = await (await request.post(control, { data: {} })).json();
  expect(state.rewards[`challenge:${start}`]).toEqual({
    amount: 100,
    date: today,
  });
});

test("a backup with overlapping challenge periods is blocked before upload", async ({
  page,
  request,
}) => {
  await page.goto("/challenges");
  await page
    .getByRole("button", { name: "Start seven-day challenge", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Current reading challenge" }),
  ).toBeVisible();
  const { state } = await (await request.post(control, { data: {} })).json();
  const backup = {
    ...state,
    challengeStarts: [addDays(state.challengeStarts[0], -1)],
    chapters: { "GEN.1": state.profile.startDate },
  };
  await page.goto("/profile");
  let uploads = 0;
  page.on("request", (req) => {
    if (req.url().endsWith("/api/account/restore")) uploads++;
  });
  await page.getByLabel("Backup file", { exact: true }).setInputFiles({
    name: "overlap.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.locator(".backup-card [role=alert]")).toContainText(
    "overlap",
  );
  await page
    .getByRole("checkbox", { name: /This backup belongs to me/ })
    .check();
  await expect(
    page.getByRole("button", { name: "Confirm merge", exact: true }),
  ).toBeDisabled();
  expect(uploads).toBe(0);
  expect(
    (await (await request.post(control, { data: {} })).json()).state.chapters,
  ).toEqual({});
});
test.beforeEach(async ({ context, request }) => {
  const response = await request.post(control, { data: { reset: true } });
  const { cookie } = await response.json();
  await context.addCookies([
    {
      name: "sb-127-auth-token",
      value: cookie,
      url: "http://127.0.0.1:3191",
      sameSite: "Lax",
    },
  ]);
});

async function saveJohnVerse(page: import("@playwright/test").Page) {
  await page.goto("/bible?book=JHN&chapter=3");
  await page.getByLabel("Verse", { exact: true }).selectOption("16");
  await page.getByRole("button", { name: "Save verse", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove saved verse", exact: true }),
  ).toBeEnabled();
}
test("journal categories, private search and exports survive reload without extra XP", async ({
  page,
  request,
}) => {
  await page.goto("/journal");
  const text = "A synthetic prayer about patience and gratitude today.";
  await page
    .getByLabel("Entry category", { exact: true })
    .selectOption("prayer");
  await page.getByLabel("Your reflection", { exact: true }).fill(text);
  await page
    .getByRole("button", { name: "Save reflection", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
  const calls = (await (await request.post(control, { data: {} })).json())
    .rpcCalls;
  await page.getByLabel("Search reflections", { exact: true }).fill("PATIENCE");
  await page
    .getByLabel("Filter by category", { exact: true })
    .selectOption("prayer");
  await expect(page.locator(".entry-list .entry-preview")).toHaveCount(1);
  await page
    .getByLabel("Filter by category", { exact: true })
    .selectOption("gratitude");
  await expect(
    page.getByRole("heading", { name: "No matching reflections" }),
  ).toBeVisible();
  expect(
    (await (await request.post(control, { data: {} })).json()).rpcCalls,
  ).toBe(calls);
  expect(page.url()).not.toContain("PATIENCE");
  await page
    .getByLabel("Entry category", { exact: true })
    .selectOption("gratitude");
  await page
    .getByRole("button", { name: "Save reflection", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Entry category", { exact: true })).toHaveValue(
    "gratitude",
  );
  const { state } = await (await request.post(control, { data: {} })).json();
  expect(Object.values(state.rewards)).toEqual([
    { amount: 20, date: state.profile.startDate },
  ]);
  await page
    .getByRole("link", { name: /Profile & Settings/ })
    .first()
    .click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export account data" }).click();
  const exported = JSON.parse(
    await readFile((await (await downloaded).path())!, "utf8"),
  );
  expect(Object.values(exported.reflections)[0]).toMatchObject({
    text,
    category: "gratitude",
  });
});

test("journal drafts survive date and app navigation, stay out of storage and warn before reload", async ({
  page,
  request,
}) => {
  await request.post(control, {
    data: {
      reflections: {
        "2026-10-15": {
          text: "An older synthetic saved reflection about kindness.",
          updatedAt: "2026-10-15T12:00:00.000Z",
        },
      },
    },
  });
  await page.goto("/journal");
  const draft = "A synthetic unsaved prayer that stays in this tab.";
  await page.getByLabel("Your reflection", { exact: true }).fill(draft);
  await page
    .getByLabel("Entry category", { exact: true })
    .selectOption("prayer");
  await page.locator(".entry-list .entry-preview").first().click();
  await expect(
    page.getByLabel("Your reflection", { exact: true }),
  ).not.toHaveValue(draft);
  await page.getByRole("button", { name: /Today’s page/ }).click();
  await expect(page.getByLabel("Your reflection", { exact: true })).toHaveValue(
    draft,
  );
  await page.getByRole("link", { name: "Study Tools", exact: true }).click();
  await expect(page.locator(".journal-draft-banner")).toContainText(
    "1 unsaved journal draft",
  );
  await page.getByRole("link", { name: "Return to journal" }).click();
  await expect(page.getByLabel("Your reflection", { exact: true })).toHaveValue(
    draft,
  );
  const dialog = page.waitForEvent("dialog");
  await page.evaluate(() => {
    setTimeout(() => window.location.reload(), 0);
  });
  const warning = await dialog;
  expect(warning.type()).toBe("beforeunload");
  await warning.dismiss();
  await expect(page.getByLabel("Your reflection", { exact: true })).toHaveValue(
    draft,
  );
  expect(
    await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    ),
  ).not.toContain(draft);
  const { state } = await (await request.post(control, { data: {} })).json();
  expect(Object.values(state.reflections)).not.toContainEqual(
    expect.objectContaining({ text: draft }),
  );
  await page
    .getByRole("button", { name: "Discard draft", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep writing", exact: true }).click();
  await expect(page.getByLabel("Your reflection", { exact: true })).toHaveValue(
    draft,
  );
  await page
    .getByRole("button", { name: "Discard draft", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(page.getByLabel("Your reflection", { exact: true })).toHaveValue(
    "",
  );
  await expect(page.getByLabel("Entry category", { exact: true })).toHaveValue(
    "reflection",
  );
});

test("journal outages and remote updates preserve a draft until an explicit replacement", async ({
  page,
  request,
}) => {
  await page.goto("/journal");
  const draft = "A synthetic local draft retained through connection trouble.";
  await page.getByLabel("Your reflection", { exact: true }).fill(draft);
  await page
    .getByLabel("Entry category", { exact: true })
    .selectOption("prayer");
  await request.post(control, { data: { rpcUnavailable: true } });
  await page
    .getByRole("button", { name: "Save reflection", exact: true })
    .click();
  await expect(page.locator(".error-banner")).toBeVisible();
  await expect(page.getByLabel("Your reflection", { exact: true })).toHaveValue(
    draft,
  );
  const remote = "A synthetic saved entry changed in another browser.";
  const { state } = await (await request.post(control, { data: {} })).json();
  await request.post(control, {
    data: {
      rpcUnavailable: false,
      reflections: {
        [state.profile.startDate]: {
          text: remote,
          category: "gratitude",
          updatedAt: new Date().toISOString(),
        },
      },
    },
  });
  await page.getByRole("button", { name: "Check saved progress" }).click();
  await expect(page.locator(".journal-warning")).toContainText(
    "saved entry changed",
  );
  await expect(page.getByLabel("Your reflection", { exact: true })).toHaveValue(
    draft,
  );
  await page.getByText("Review the saved entry", { exact: true }).click();
  await expect(page.locator(".journal-saved-text")).toHaveText(remote);
  await page
    .getByRole("button", { name: "Replace saved reflection", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".journal-warning")).toHaveCount(0);
});

test("typing during an in-flight journal save retains the newer draft", async ({
  page,
  request,
}) => {
  await page.goto("/journal");
  const first = "The first synthetic reflection sent to the server.";
  const second = "A newer synthetic draft typed while the save was in flight.";
  await page.getByLabel("Your reflection", { exact: true }).fill(first);
  let release: (() => void) | undefined;
  await page.route("**/api/journey", async (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().postDataJSON().type === "reflect"
    ) {
      const response = await route.fetch();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      await route.fulfill({ response });
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Save reflection", exact: true })
    .click();
  await expect.poll(() => Boolean(release)).toBe(true);
  await page.getByLabel("Your reflection", { exact: true }).fill(second);
  release!();
  await expect(
    page.getByRole("button", { name: "Saving…", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Your reflection", { exact: true })).toHaveValue(
    second,
  );
  await expect(page.locator(".journal-draft-actions")).toContainText(
    "Unsaved draft",
  );
  const { state } = await (await request.post(control, { data: {} })).json();
  expect(Object.values(state.reflections)[0]).toMatchObject({ text: first });
  await page.unroute("**/api/journey");
  await page
    .getByRole("button", { name: "Discard draft", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(page.getByLabel("Your reflection", { exact: true })).toHaveValue(
    first,
  );
});
test("saved verses support exact-text memory practice, export, removal and restore without XP", async ({
  page,
  request,
}) => {
  await saveJohnVerse(page);
  await page
    .getByRole("link", { name: "My saved verses", exact: true })
    .click();
  const card = page.getByRole("article", { name: "John 3:16", exact: true });
  const source = JSON.parse(
    await readFile("public/bible/JHN/3.json", "utf8"),
  ).verses.find((v: { number: number }) => v.number === 16).text;
  await expect(card.locator("blockquote")).toHaveText(source);
  await card.getByRole("button", { name: "Hide verse to practise" }).click();
  await expect(card.locator("blockquote")).toHaveCount(0);
  await card.getByRole("button", { name: "Show verse" }).click();
  await expect(card.locator("blockquote")).toHaveText(source);
  await page.reload();
  await expect(card.locator("blockquote")).toHaveText(source);
  await page.goto("/profile");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export account data" }).click();
  const download = await downloadPromise;
  const buffer = await readFile((await download.path())!);
  expect(Object.keys(JSON.parse(buffer.toString()).savedVerses)).toContain(
    "JHN.3.16",
  );
  await page.goto("/study");
  await card.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "A place for the verses you want to remember",
    }),
  ).toBeVisible();
  await page.goto("/profile");
  await page.getByLabel("Backup file", { exact: true }).setInputFiles({
    name: "saved-verses.json",
    mimeType: "application/json",
    buffer,
  });
  await expect(page.getByText(/1 missing saved verses/)).toBeVisible();
  await page
    .getByRole("checkbox", { name: /This backup belongs to me/ })
    .check();
  await page.getByRole("button", { name: "Confirm merge" }).click();
  await expect(
    page.getByText("Backup merged. Existing entries were kept.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/study");
  await expect(card.locator("blockquote")).toHaveText(source);
  const { state } = await (await request.post(control, { data: {} })).json();
  expect(Object.keys(state.savedVerses)).toEqual(["JHN.3.16"]);
  expect(state.rewards).toEqual({});
  expect(state.chapters).toEqual({});
  expect(state.days).toEqual({});
  expect(
    await page.evaluate(() => localStorage.getItem("faithquest365.demo.v1")),
  ).toBeNull();
});
test("an unavailable save does not invent a saved verse and can be retried explicitly", async ({
  page,
  request,
}) => {
  await page.goto("/bible?book=JHN&chapter=3");
  await page.getByLabel("Verse", { exact: true }).selectOption("16");
  await expect(
    page.getByRole("button", { name: "Save verse", exact: true }),
  ).toBeEnabled();
  await request.post(control, { data: { rpcUnavailable: true } });
  await page.getByRole("button", { name: "Save verse", exact: true }).click();
  await expect(page.locator(".error-banner")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save verse", exact: true }),
  ).toBeEnabled();
  expect(
    (await (await request.post(control, { data: {} })).json()).state
      .savedVerses,
  ).toEqual({});
  await request.post(control, { data: { rpcUnavailable: false } });
  await page.getByRole("button", { name: "Save verse", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove saved verse", exact: true }),
  ).toBeEnabled();
});
test("saved-verse Scripture failures are visible and retry without invented text", async ({
  page,
}) => {
  await saveJohnVerse(page);
  let scriptureUnavailable = true;
  await page.route("**/bible/JHN/3.json", async (route) =>
    scriptureUnavailable
      ? route.fulfill({ status: 503, body: "Unavailable" })
      : route.continue(),
  );
  await page
    .getByRole("link", { name: "My saved verses", exact: true })
    .click();
  const card = page.getByRole("article", { name: "John 3:16", exact: true });
  await expect(card.getByRole("alert")).toContainText(
    "Scripture could not be loaded",
  );
  await expect(card.locator("blockquote")).toHaveCount(0);
  scriptureUnavailable = false;
  await card.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(card.locator("blockquote")).toContainText(
    "For God so loved the world",
  );
});
test("a committed saved verse with a lost response is recovered without toggling or replay", async ({
  page,
  request,
}) => {
  await page.goto("/bible?book=JHN&chapter=3");
  await page.getByLabel("Verse", { exact: true }).selectOption("16");
  await expect(
    page.getByRole("button", { name: "Save verse", exact: true }),
  ).toBeEnabled();
  let commits = 0;
  await page.route("**/api/journey", async (route) => {
    const body = route.request().postDataJSON();
    if (body?.type === "saveVerse" && commits === 0) {
      commits++;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Save verse", exact: true }).click();
  await expect(page.locator(".error-banner")).toBeVisible();
  await page.getByRole("button", { name: "Check saved progress" }).click();
  await expect(
    page.getByRole("button", { name: "Remove saved verse", exact: true }),
  ).toBeEnabled();
  expect(commits).toBe(1);
  const { state } = await (await request.post(control, { data: {} })).json();
  expect(Object.keys(state.savedVerses)).toEqual(["JHN.3.16"]);
  expect(state.rewards).toEqual({});
});

async function restoreFile(
  request: import("@playwright/test").APIRequestContext,
) {
  const { state } = await (await request.post(control, { data: {} })).json();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  state.reflections[yesterday] = {
    text: "Synthetic reflection recovered from a private backup.",
    updatedAt: new Date().toISOString(),
  };
  return {
    name: "fixture-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  };
}
test("backup preview stays local until confirmed and restored reflections survive reload", async ({
  page,
  request,
}) => {
  await page.goto("/profile");
  await expect(page.locator(".profile-card h2")).toHaveText("Fixture Reader");
  const file = await restoreFile(request);
  let uploads = 0;
  page.on("request", (req) => {
    if (req.url().endsWith("/api/account/restore")) uploads++;
  });
  await page.getByLabel("Backup file", { exact: true }).setInputFiles(file);
  await expect(
    page.getByRole("heading", { name: "Backup preview" }),
  ).toBeVisible();
  expect(uploads).toBe(0);
  await expect(
    page.getByRole("button", { name: "Confirm merge" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cancel restore" }).click();
  expect(uploads).toBe(0);
  await page.getByLabel("Backup file", { exact: true }).setInputFiles(file);
  await page
    .getByRole("checkbox", { name: /This backup belongs to me/ })
    .check();
  await page.getByRole("button", { name: "Confirm merge" }).click();
  await expect(page.locator(".backup-card [role=status]")).toContainText(
    "Backup merged",
  );
  expect(uploads).toBe(1);
  expect(
    await page.evaluate(() => localStorage.getItem("faithquest365.demo.v1")),
  ).toBeNull();
  await page.reload();
  await page.getByLabel("Backup file", { exact: true }).setInputFiles(file);
  await expect(
    page.getByText("There are no missing entries to restore."),
  ).toBeVisible();
  const { restoreCalls, state } = await (
    await request.post(control, { data: {} })
  ).json();
  expect(restoreCalls).toBe(1);
  expect(Object.values(state.rewards)).toEqual([
    { amount: 20, date: Object.keys(state.reflections)[0] },
  ]);
});
test("invalid backup files are rejected before any upload", async ({
  page,
  request,
}) => {
  await page.goto("/profile");
  await expect(page.locator(".profile-card h2")).toHaveText("Fixture Reader");
  await page.getByLabel("Backup file", { exact: true }).setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":999}'),
  });
  await expect(page.locator(".backup-card [role=alert]")).toContainText(
    "supported FaithQuest",
  );
  expect(
    (await (await request.post(control, { data: {} })).json()).restoreCalls,
  ).toBe(0);
  await expect(page.getByRole("button", { name: "Confirm merge" })).toHaveCount(
    0,
  );
});
test("a lost restore response is recovered by reading saved progress without replay", async ({
  page,
  request,
}) => {
  await page.goto("/profile");
  await expect(page.locator(".profile-card h2")).toHaveText("Fixture Reader");
  await page
    .getByLabel("Backup file", { exact: true })
    .setInputFiles(await restoreFile(request));
  await page
    .getByRole("checkbox", { name: /This backup belongs to me/ })
    .check();
  await page.route(
    "**/api/account/restore",
    async (route) => {
      await route.fetch();
      await route.abort("failed");
    },
    { times: 1 },
  );
  await page.getByRole("button", { name: "Confirm merge" }).click();
  await expect(page.locator(".error-banner")).toContainText(
    "Check saved progress",
  );
  await page.getByRole("button", { name: "Check saved progress" }).click();
  await expect(
    page.getByText("There are no missing entries to restore."),
  ).toBeVisible();
  expect(
    (await (await request.post(control, { data: {} })).json()).restoreCalls,
  ).toBe(1);
});
test("day 14 reviewed quizzes submit once and retain feedback after reload", async ({
  page,
  request,
}) => {
  await page.goto("/quiz?day=14");
  await expect(page.getByRole("option", { name: /Day 14/ })).toHaveCount(1);
  const question = page
    .locator(".quiz-card")
    .filter({ hasText: "Who did Joseph say he was" });
  await question
    .getByRole("radio", { name: /Their brother whom they sold/ })
    .check();
  await question.getByRole("button", { name: "Check my answer" }).click();
  await expect(question.getByRole("status")).toContainText(
    "10 XP awarded once",
  );
  await page.reload();
  await expect(question.getByRole("status")).toContainText(
    "Joseph identified himself",
  );
  await expect(question.getByRole("radio").first()).toBeDisabled();
  const { state } = await (await request.post(control, { data: {} })).json();
  expect(state.rewards["quiz:gen-joseph-revealed"].amount).toBe(10);
});

test("an initial account load failure can be retried without a full page reload", async ({
  page,
  request,
}) => {
  await request.post(control, { data: { rpcUnavailable: true } });
  await page.goto("/profile");
  await expect(page.locator(".error-banner")).toBeVisible();
  await request.post(control, { data: { rpcUnavailable: false } });
  await page.getByRole("button", { name: "Check saved progress" }).click();
  await expect(page.locator(".profile-card h2")).toHaveText("Fixture Reader");
  await expect(page.locator(".error-banner")).toHaveCount(0);
  await expect(page).toHaveURL(/\/profile$/);
});

test("account export uses the newest server snapshot and keeps it out of browser storage", async ({
  page,
  request,
}) => {
  await page.goto("/profile");
  await expect(page.locator(".profile-card h2")).toHaveText("Fixture Reader");
  await request.post(control, { data: { name: "Updated in another browser" } });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export account data" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    "faithquest365-account-export.json",
  );
  const exported = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(exported.profile.name).toBe("Updated in another browser");
  expect(exported).not.toHaveProperty("access_token");
  expect(
    await page.evaluate(() => localStorage.getItem("faithquest365.demo.v1")),
  ).toBeNull();
  await expect(page.getByRole("status")).toContainText("Your export is ready");
});

test("a failed export stays on the account screen and produces no download", async ({
  page,
  request,
}) => {
  await page.goto("/profile");
  await expect(page.locator(".profile-card h2")).toHaveText("Fixture Reader");
  await request.post(control, { data: { failRpc: 1 } });
  let downloads = 0;
  page.on("download", () => downloads++);
  await page.getByRole("button", { name: "Export account data" }).click();
  await expect(page.locator(".backup-card [role=alert]")).toContainText(
    "could not be prepared",
  );
  expect(downloads).toBe(0);
  await expect(page).toHaveURL(/\/profile$/);
  await expect(
    page.getByRole("button", { name: "Export account data" }),
  ).toBeEnabled();
});

test("an identity-service outage preserves the session and allows a later export", async ({
  page,
  request,
  context,
}) => {
  await page.goto("/profile");
  await expect(page.locator(".profile-card h2")).toHaveText("Fixture Reader");
  await request.post(control, { data: { authUnavailable: true } });
  await page.getByRole("button", { name: "Export account data" }).click();
  await expect(page.locator(".backup-card [role=alert]")).toContainText(
    "temporarily unavailable",
  );
  await expect(page).toHaveURL(/\/profile$/);
  const denied = await page.request.get("/dashboard");
  expect(denied.status()).toBe(503);
  expect(denied.headers().location).toBeUndefined();
  expect(await denied.text()).not.toContain("Fixture Reader");
  expect(
    (await context.cookies()).some(
      (cookie) => cookie.name === "sb-127-auth-token",
    ),
  ).toBe(true);
  await request.post(control, { data: { authUnavailable: false } });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export account data" }).click();
  expect((await download).suggestedFilename()).toBe(
    "faithquest365-account-export.json",
  );
});

test("a committed save with a lost response is recovered without another reward", async ({
  page,
  request,
}) => {
  await page.goto("/journal");
  const text = "Synthetic reflection saved before its response is interrupted.";
  await page.getByLabel("Your reflection", { exact: true }).fill(text);
  await page.route("**/api/journey", async (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().postDataJSON().type === "reflect"
    ) {
      await route.fetch(); // Let the actual app handler finish its fixture-backed commit.
      await route.abort("failed");
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Save reflection", exact: true })
    .click();
  await expect(page.locator(".error-banner")).toContainText(
    "Check your connection",
  );
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Check saved progress" }).click();
  await expect(page.locator(".error-banner")).toHaveCount(0);
  await expect(page.getByLabel("Your reflection", { exact: true })).toHaveValue(
    text,
  );
  await page.unroute("**/api/journey");
  await page
    .getByRole("button", { name: "Save reflection", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
  const { state } = await (await request.post(control, { data: {} })).json();
  expect(Object.keys(state.reflections)).toHaveLength(1);
  expect(Object.values(state.rewards)).toEqual([
    { amount: 20, date: state.profile.startDate },
  ]);
});

test("revoked sessions with unexpired tokens cannot read, export, or save", async ({
  page,
  request,
}) => {
  await page.goto("/profile");
  await expect(page.locator(".profile-card h2")).toHaveText("Fixture Reader");
  const before = await (await request.post(control, { data: {} })).json();
  await request.post(control, { data: { sessionRevoked: true } });
  expect((await page.request.get("/api/journey")).status()).toBe(401);
  const exported = await page.request.get("/api/account/export");
  expect(exported.status()).toBe(401);
  expect(exported.headers()["content-disposition"]).toBeUndefined();
  expect(
    (
      await page.request.post("/api/journey", {
        headers: { origin: "http://127.0.0.1:3191" },
        data: { type: "complete", book: "GEN", chapter: 1 },
      })
    ).status(),
  ).toBe(401);
  const after = await (await request.post(control, { data: {} })).json();
  expect(after.rpcCalls).toBe(before.rpcCalls);
  expect(after.state).toEqual(before.state);
  await page.getByRole("button", { name: "Export account data" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/journal");
  await expect(page).toHaveURL(/\/login$/);
});

test("sign out everywhere requires confirmation and invalidates another browser", async ({
  page,
  context,
  browser,
  request,
}) => {
  await page.goto("/profile");
  await expect(page.locator(".profile-card h2")).toHaveText("Fixture Reader");
  const other = await browser.newContext();
  await other.addCookies(await context.cookies());
  const otherPage = await other.newPage();
  const opened = await otherPage.goto("http://127.0.0.1:3191/dashboard");
  expect(opened?.status()).toBe(200);
  const before = await (await request.post(control, { data: {} })).json();
  await page
    .getByRole("button", { name: "Sign out of all devices", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    (await (await request.post(control, { data: {} })).json()).lastSignoutScope,
  ).toBeNull();
  await page
    .getByRole("button", { name: "Sign out of all devices", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm sign out everywhere" })
    .click();
  await expect(page).toHaveURL(/\/login\?signedOut=all$/);
  await expect(page.getByRole("status")).toContainText(
    "Signed out of all devices",
  );
  expect(
    (await otherPage.request.get("http://127.0.0.1:3191/api/journey")).status(),
  ).toBe(401);
  await otherPage.reload();
  await expect(otherPage).toHaveURL(/\/login$/);
  const after = await (await request.post(control, { data: {} })).json();
  expect(after.lastSignoutScope).toBe("global");
  expect(after.state).toEqual(before.state);
  await other.close();
});

test("account deletion is explicit, cancellable and removes only synthetic data", async ({
  page,
  request,
}) => {
  await page.goto("/profile");
  await expect(page.locator(".profile-card h2")).toHaveText("Fixture Reader");
  await page.getByRole("button", { name: "Review account deletion" }).click();
  const confirm = page.getByRole("button", {
    name: "Delete my account permanently",
  });
  await expect(confirm).toBeDisabled();
  await page.getByLabel("Type DELETE MY ACCOUNT to confirm").fill("wrong");
  await expect(confirm).toBeDisabled();
  await page.getByRole("button", { name: "Cancel deletion" }).click();
  let state = await (await request.post(control, { data: {} })).json();
  expect(state.deletionCalls).toBe(0);
  await page.getByRole("button", { name: "Review account deletion" }).click();
  await expect(
    page.getByLabel("Type DELETE MY ACCOUNT to confirm"),
  ).toHaveValue("");
  await page
    .getByLabel("Type DELETE MY ACCOUNT to confirm")
    .fill("DELETE MY ACCOUNT");
  await confirm.click();
  await expect(page).toHaveURL(/\/login\?deleted=1$/);
  await expect(page.getByRole("status")).toContainText("account was deleted");
  state = await (await request.post(control, { data: {} })).json();
  expect(state.deletionCalls).toBe(1);
  expect(state.accountDeleted).toBe(true);
  expect((await page.request.get("/api/journey")).status()).toBe(401);
});

test("deletion reauthentication and outages stay visible without false success", async ({
  page,
  request,
}) => {
  await page.goto("/profile");
  await expect(page.locator(".profile-card h2")).toHaveText("Fixture Reader");
  await page.getByRole("button", { name: "Review account deletion" }).click();
  await page
    .getByLabel("Type DELETE MY ACCOUNT to confirm")
    .fill("DELETE MY ACCOUNT");
  await request.post(control, { data: { deletionNeedsReauth: true } });
  await page
    .getByRole("button", { name: "Delete my account permanently" })
    .click();
  await expect(page.locator(".account-deletion [role=alert]")).toContainText(
    "within 10 minutes",
  );
  await expect(page).toHaveURL(/\/profile$/);
  await request.post(control, {
    data: { deletionNeedsReauth: false, deletionFailure: true },
  });
  await page
    .getByRole("button", { name: "Delete my account permanently" })
    .click();
  await expect(page.locator(".account-deletion [role=alert]")).toContainText(
    "could not be confirmed",
  );
  await expect(
    page.getByRole("button", { name: "Delete my account permanently" }),
  ).toBeEnabled();
  const state = await (await request.post(control, { data: {} })).json();
  expect(state.accountDeleted).toBe(false);
  expect(state.lastSignoutScope).toBeNull();
  expect(state.state.profile.name).toBe("Fixture Reader");
});

test("a lost deletion response shows uncertainty without replaying the request", async ({
  page,
  request,
}) => {
  await page.goto("/profile");
  await expect(page.locator(".profile-card h2")).toHaveText("Fixture Reader");
  await page.getByRole("button", { name: "Review account deletion" }).click();
  await page
    .getByLabel("Type DELETE MY ACCOUNT to confirm")
    .fill("DELETE MY ACCOUNT");
  await page.route("**/api/account/delete", async (route) => {
    await route.fetch(); // Commit only the local fixture's deletion, then lose its response.
    await route.abort("failed");
  });
  await page
    .getByRole("button", { name: "Delete my account permanently" })
    .click();
  await expect(page.locator(".account-deletion [role=alert]")).toContainText(
    "could not be confirmed",
  );
  await expect(page).toHaveURL(/\/profile$/);
  const fixture = await (await request.post(control, { data: {} })).json();
  expect(fixture.accountDeleted).toBe(true);
  expect(fixture.deletionCalls).toBe(1);
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
});

test("a limited save preserves the draft and allows an independent progress check", async ({
  page,
  request,
}) => {
  await page.goto("/journal");
  const text =
    "A synthetic reflection to verify request-limit recovery safely.";
  await page.getByLabel("Your reflection", { exact: true }).fill(text);
  await request.post(control, { data: { limits: { write: 60 } } });
  await page
    .getByRole("button", { name: "Save reflection", exact: true })
    .click();
  await expect(page.locator(".error-banner")).toContainText("wait 60 seconds");
  await expect(page.getByLabel("Your reflection", { exact: true })).toHaveValue(
    text,
  );
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toHaveCount(0);
  const before = await (await request.post(control, { data: {} })).json();
  expect(before.state.reflections).toEqual({});
  await page.getByRole("button", { name: "Check saved progress" }).click();
  await expect(page.locator(".error-banner")).toHaveCount(0);
  await request.post(control, { data: { limits: {} } });
  await page.getByLabel("Your reflection", { exact: true }).fill(text);
  await page
    .getByRole("button", { name: "Save reflection", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
  const after = await (await request.post(control, { data: {} })).json();
  expect(Object.values(after.state.rewards)).toEqual([
    { amount: 20, date: after.state.profile.startDate },
  ]);
});

test("an export limit starts a visible cooldown and recovers without signing out", async ({
  page,
  request,
}) => {
  await page.clock.install();
  await page.goto("/profile");
  await expect(page.locator(".profile-card h2")).toHaveText("Fixture Reader");
  await request.post(control, { data: { limits: { export: 60 } } });
  let downloads = 0;
  page.on("download", () => downloads++);
  await page.getByRole("button", { name: "Export account data" }).click();
  await expect(page.locator(".backup-card [role=alert]")).toContainText(
    "wait 60 seconds",
  );
  await expect(
    page.getByRole("button", { name: /Try export in/ }),
  ).toBeDisabled();
  expect(downloads).toBe(0);
  await expect(page).toHaveURL(/\/profile$/);
  await request.post(control, { data: { limits: {} } });
  await page.clock.fastForward(61000);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export account data" }).click();
  expect((await download).suggestedFilename()).toBe(
    "faithquest365-account-export.json",
  );
});

test("a deletion limit blocks repeated clicks before sign-out or data removal", async ({
  page,
  request,
}) => {
  await page.goto("/profile");
  await expect(page.locator(".profile-card h2")).toHaveText("Fixture Reader");
  await page.getByRole("button", { name: "Review account deletion" }).click();
  await page
    .getByLabel("Type DELETE MY ACCOUNT to confirm")
    .fill("DELETE MY ACCOUNT");
  await request.post(control, { data: { limits: { delete: 300 } } });
  await page
    .getByRole("button", { name: "Delete my account permanently" })
    .click();
  await expect(page.locator(".account-deletion [role=alert]")).toContainText(
    "wait 300 seconds",
  );
  await expect(
    page.getByRole("button", { name: /Try deletion in/ }),
  ).toBeDisabled();
  const fixture = await (await request.post(control, { data: {} })).json();
  expect(fixture.deletionCalls).toBe(1);
  expect(fixture.accountDeleted).toBe(false);
  expect(fixture.lastSignoutScope).toBeNull();
  await expect(page).toHaveURL(/\/profile$/);
});

test("account connection checks distinguish success, outages and cooldowns", async ({
  page,
  request,
}) => {
  await page.goto("/profile");
  await expect(page.locator(".profile-card h2")).toHaveText("Fixture Reader");
  await page.getByRole("button", { name: "Check account connection" }).click();
  await expect(page.locator(".account-connection [role=status]")).toContainText(
    "connection is working",
  );
  await request.post(control, { data: { authUnavailable: true } });
  await page.getByRole("button", { name: "Check account connection" }).click();
  await expect(page.locator(".account-connection [role=alert]")).toContainText(
    "temporarily unavailable",
  );
  await expect(page.locator(".account-connection [role=alert]")).toContainText(
    "Reference:",
  );
  await expect(page).toHaveURL(/\/profile$/);
  await request.post(control, {
    data: { authUnavailable: false, limits: { health: 30 } },
  });
  await page.getByRole("button", { name: "Check account connection" }).click();
  await expect(page.locator(".account-connection [role=alert]")).toContainText(
    "wait 30 seconds",
  );
  await expect(
    page.getByRole("button", { name: /Try connection check in/ }),
  ).toBeDisabled();
});
