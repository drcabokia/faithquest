import { test, expect } from "@playwright/test";
const KEY = "faithquest365.demo.v1";
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
