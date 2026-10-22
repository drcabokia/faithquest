import { test, expect, type Page } from "@playwright/test";
import type { JourneyState } from "../../src/lib/state";

const reflection = (page: Page) =>
  page.getByLabel("Your reflection", { exact: true });
const category = (page: Page) =>
  page.getByLabel("Entry category", { exact: true });
const save = (page: Page) =>
  page.getByRole("button", { name: "Save reflection", exact: true });
const replace = (page: Page) =>
  page.getByRole("button", { name: "Replace saved reflection", exact: true });
async function snapshot(
  page: Page,
  mode: "demo" | "account",
): Promise<JourneyState> {
  if (mode === "demo")
    return page.evaluate(() =>
      JSON.parse(localStorage.getItem("faithquest365.demo.v1")!),
    );
  return (await (await page.request.get("/api/journey")).json()).state;
}

export function journalConflictTests(mode: "demo" | "account") {
  test("journal rejects a stale first save and rechecks an explicitly reviewed replacement", async ({
    page,
    context,
  }) => {
    await page.goto("/journal");
    await expect(reflection(page)).toBeVisible();
    // Persist a profile-only demo state so both tabs start with the same journey.
    if (mode === "demo")
      await page.evaluate(() => {
        const key = "faithquest365.demo.v1";
        if (!localStorage.getItem(key))
          localStorage.setItem(
            key,
            JSON.stringify({
              version: 1,
              profile: {
                name: "Synthetic journal",
                startDate: new Date().toISOString().slice(0, 10),
                timeZone: "Asia/Kuala_Lumpur",
                theme: "light",
              },
              chapters: {},
              days: {},
              rewards: {},
              attempts: {},
              reflections: {},
            }),
          );
      });
    const other = await context.newPage();
    if (mode === "demo")
      await other.addInitScript(() => {
        // Deliberately miss storage notifications. The write lock must still compare
        // against storage, rather than trusting this tab's stale loaded snapshot.
        window.addEventListener(
          "storage",
          (event) => event.stopImmediatePropagation(),
          { capture: true },
        );
      });
    await other.goto("/journal");
    await expect(reflection(other)).toBeVisible();
    let frozen = await snapshot(other, mode);
    let refreshAfterWrite = false;
    if (mode === "account")
      await other.route("**/api/journey", async (route) => {
        if (route.request().method() === "GET" && !refreshAfterWrite)
          await route.fulfill({ json: { state: frozen } });
        else {
          if (
            route.request().method() === "POST" &&
            route.request().postDataJSON().type === "reflect"
          )
            refreshAfterWrite = true;
          await route.continue();
        }
      });
    const first = "A synthetic prayer saved from the first tab.";
    const draft = "A competing synthetic journal draft in the second tab.";
    await reflection(page).fill(first);
    await category(page).selectOption("prayer");
    await reflection(other).fill(draft);
    await category(other).selectOption("application");
    await save(page).click();
    await expect(
      page.getByRole("button", { name: "Saved", exact: true }),
    ).toBeVisible();
    await expect(other.locator(".journal-warning")).toHaveCount(0);
    await save(other).click();
    await expect(other.locator(".journal-warning")).toContainText(
      "saved entry changed",
    );
    await expect(reflection(other)).toHaveValue(draft);
    await expect(replace(other)).toBeDisabled();
    await other.getByText("Review the saved entry", { exact: true }).click();
    await expect(other.locator(".journal-saved-text")).toHaveText(first);
    await expect(replace(other)).toBeEnabled();
    // A category-only edit after the review must invalidate that reviewed token.
    frozen = await snapshot(other, mode);
    refreshAfterWrite = false;
    await category(page).selectOption("gratitude");
    await save(page).click();
    await expect(
      page.getByRole("button", { name: "Saved", exact: true }),
    ).toBeVisible();
    await replace(other).click();
    await expect(replace(other)).toBeDisabled();
    await expect(reflection(other)).toHaveValue(draft);
    await other.getByText("Review the saved entry", { exact: true }).click();
    await expect(other.locator(".journal-warning")).toContainText("Gratitude");
    await replace(other).click();
    await expect(
      other.getByRole("button", { name: "Saved", exact: true }),
    ).toBeVisible();
    const state = await snapshot(other, mode);
    expect(Object.values(state.reflections)).toHaveLength(1);
    expect(Object.values(state.reflections)[0]).toMatchObject({
      text: draft,
      category: "application",
    });
    expect(Object.values(state.rewards)).toEqual([
      { amount: 20, date: Object.keys(state.reflections)[0] },
    ]);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    if (mode === "demo")
      await page.evaluate(() =>
        window.dispatchEvent(
          new StorageEvent("storage", { key: "faithquest365.demo.v1" }),
        ),
      );
    await expect(reflection(page)).toHaveValue(draft);
    await expect(category(page)).toHaveValue("application");
    await other.close();
  });
}
