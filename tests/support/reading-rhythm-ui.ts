import { test, expect } from "@playwright/test";
import { initialState } from "../../src/lib/state";
import { addDays, dateInZone } from "../../src/lib/dates";

export function readingRhythmUiTest(mode: "demo" | "account") {
  test("reading rhythm starts compact, opens with the keyboard and cancels hidden confirmations without saving", async ({
    page,
    request,
  }) => {
    const today = dateInZone("Asia/Kuala_Lumpur"),
      prior = addDays(today, -2);
    const seed = initialState();
    seed.profile.timeZone = "Asia/Kuala_Lumpur";
    seed.profile.startDate = addDays(today, -8);
    seed.chapters = { "GEN.1": prior, "GEN.2": prior, "GEN.3": prior };
    seed.days = { "1": prior };
    seed.rewards = { "reading:1": { amount: 50, date: prior } };
    if (mode === "demo")
      await page.addInitScript(
        (seed) =>
          localStorage.setItem("faithquest365.demo.v1", JSON.stringify(seed)),
        seed,
      );
    else
      await request.post("http://127.0.0.1:43191/__control", {
        data: {
          startDate: seed.profile.startDate,
          chapters: seed.chapters,
          days: seed.days,
          rewards: seed.rewards,
        },
      });
    await page.goto("/dashboard");
    const rhythm = page.getByRole("region", {
      name: "Reading rhythm and catch-up",
      exact: true,
    });
    const summary = rhythm.locator("summary");
    await expect(summary).toContainText("Grace available");
    await expect(summary).toContainText("View details");
    await expect(rhythm.locator(".rhythm-calendar")).toBeHidden();
    await expect(
      rhythm.getByRole("button", {
        name: "Use grace for yesterday",
        exact: true,
      }),
    ).toBeHidden();
    expect((await rhythm.boundingBox())!.height).toBeLessThan(170);
    const before = await page.evaluate(() =>
      localStorage.getItem("faithquest365.demo.v1"),
    );
    let writes = 0;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().endsWith("/api/journey") &&
        request.postDataJSON().type !== "initialize"
      )
        writes++;
    });
    await summary.focus();
    await summary.press("Enter");
    await expect(summary).toBeFocused();
    await expect(rhythm.locator(".rhythm-calendar")).toBeVisible();
    await expect(rhythm.locator(".rhythm-calendar li")).toHaveCount(7);
    await expect(summary).toContainText("Hide details");
    await rhythm
      .getByRole("button", { name: "Use grace for yesterday", exact: true })
      .click();
    await expect(
      rhythm.getByRole("group", { name: "Confirm grace day", exact: true }),
    ).toBeVisible();
    await summary.focus();
    await summary.press("Enter");
    await expect(rhythm.locator(".rhythm-calendar")).toBeHidden();
    await summary.press("Enter");
    await expect(
      rhythm.getByRole("group", { name: "Confirm grace day", exact: true }),
    ).toHaveCount(0);
    await expect(
      rhythm.getByRole("button", {
        name: "Use grace for yesterday",
        exact: true,
      }),
    ).toBeVisible();
    await rhythm
      .getByRole("button", { name: "Use grace for yesterday", exact: true })
      .click();
    // Native toggle events can coalesce when a user closes and reopens quickly.
    await summary.evaluate((element) => {
      if (!(element instanceof HTMLElement))
        throw new Error("Expected summary");
      element.click();
      element.click();
    });
    await expect(rhythm.locator(".rhythm-calendar")).toBeVisible();
    await expect(
      rhythm.getByRole("group", { name: "Confirm grace day", exact: true }),
    ).toHaveCount(0);
    expect(writes).toBe(0);
    expect(
      await page.evaluate(() => localStorage.getItem("faithquest365.demo.v1")),
    ).toBe(before);
    await rhythm.screenshot({
      path: `.cache/reading-rhythm-${mode}-expanded.png`,
    });
    await summary.click();
    await page.screenshot({
      path: `.cache/dashboard-${mode}-compact.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 320, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await rhythm.screenshot({
      path: `.cache/reading-rhythm-${mode}-mobile.png`,
    });
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
    });
    await summary.click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await rhythm.screenshot({
      path: `.cache/reading-rhythm-${mode}-mobile-dark.png`,
    });
    // Another route starts compact again; the disclosure is tab-local UI state.
    await page.goto("/reading-plan");
    await expect(rhythm.locator(".rhythm-calendar")).toBeHidden();
  });
}
