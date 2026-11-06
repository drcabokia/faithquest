import { test, expect, type Page } from "@playwright/test";
import { initialState } from "../../src/lib/state";

export async function openSavedVerse(page: Page, label = "John 3:16") {
  const row = page.getByRole("article", { name: label, exact: true });
  await expect(row).toBeVisible();
  const details = row.locator(".saved-verse-details");
  if (
    !(await details.evaluate((element) => (element as HTMLDetailsElement).open))
  )
    await row.locator(".saved-verse-details > summary").click();
  await expect(details).toHaveAttribute("open", "");
  return row;
}

export async function selectPracticeVerses(page: Page, ...labels: string[]) {
  for (const label of labels)
    await page
      .getByRole("checkbox", {
        name: `Select ${label} for practice`,
        exact: true,
      })
      .check();
}

export function studyListFlowTests(mode: "demo" | "account") {
  async function seed(
    page: Page,
    request: import("@playwright/test").APIRequestContext,
  ) {
    const state = initialState();
    state.savedVerses = Object.fromEntries(
      [
        ...Array.from({ length: 13 }, (_, i) => `GEN.1.${i + 1}`),
        "JHN.3.16",
      ].map((key) => [key, "2026-10-17T03:00:00.000Z"]),
    );
    state.verseNotes = {
      "JHN.3.16": {
        text: "A synthetic saved note.",
        updatedAt: "2026-10-17T03:00:00.000Z",
      },
    };
    if (mode === "demo")
      await page.addInitScript((seed) => {
        if (!localStorage.getItem("faithquest365.demo.v1"))
          localStorage.setItem("faithquest365.demo.v1", JSON.stringify(seed));
      }, state);
    else
      await request.post("http://127.0.0.1:43191/__control", {
        data: { savedVerses: state.savedVerses, verseNotes: state.verseNotes },
      });
    await page.goto("/study");
    await page.getByLabel("Order", { exact: true }).selectOption("bible");
  }

  test("saved verse list preserves chosen queue, page and protected drafts through practice", async ({
    page,
    request,
  }) => {
    await seed(page, request);
    const list = page.getByRole("list", { name: "Saved verses", exact: true });
    await expect(list.getByRole("listitem")).toHaveCount(12);
    await expect(list.locator("blockquote")).toHaveCount(0);
    await expect(list.locator(".saved-verse-preview").first()).toContainText(
      "In the beginning",
    );
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      await page.screenshot({
        path: `.cache/study-list-${mode}-${theme}-desktop.png`,
        fullPage: true,
      });
    }
    expect(
      (await list.getByRole("article").first().boundingBox())!.height,
    ).toBeLessThan(110);
    await expect(
      page.getByRole("button", { name: "Start practice", exact: true }),
    ).toBeDisabled();
    const snapshot =
      mode === "demo"
        ? await page.evaluate(() =>
            localStorage.getItem("faithquest365.demo.v1"),
          )
        : JSON.stringify(
            (
              await (
                await request.post("http://127.0.0.1:43191/__control", {
                  data: {},
                })
              ).json()
            ).state,
          );
    const writes: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().endsWith("/api/journey"))
        writes.push(r.postData() ?? "");
    });
    await selectPracticeVerses(page, "Genesis 1:2");
    await page.getByRole("button", { name: "Next page", exact: true }).click();
    const john = page.getByRole("article", { name: "John 3:16", exact: true });
    await expect(john.locator(".saved-verse-note-status")).toHaveText(
      "Private note",
    );
    await expect(john.locator("summary")).toHaveAccessibleDescription(
      "Private note",
    );
    await selectPracticeVerses(page, "John 3:16", "Genesis 1:13");
    const row = page.getByRole("article", {
      name: "Genesis 1:13",
      exact: true,
    });
    const summary = row.locator("summary");
    await summary.focus();
    await summary.press("Space");
    await expect(row.locator("blockquote")).toBeVisible();
    await row
      .getByRole("button", { name: "Add private note", exact: true })
      .click();
    const draft =
      "An unsaved synthetic note retained through practice and filters.";
    await row
      .getByLabel("Private note for Genesis 1:13", { exact: true })
      .fill(draft);
    await expect(
      row.getByRole("button", { name: "Remove", exact: true }),
    ).toBeDisabled();
    await summary.click();
    await expect(row.locator(".saved-verse-note-status")).toHaveText(
      "Unsaved note draft",
    );
    await page
      .getByRole("button", { name: "Continue note: Genesis 1:13", exact: true })
      .click();
    await expect(
      row.getByLabel("Private note for Genesis 1:13", { exact: true }),
    ).toBeFocused();
    // Restore the collection view and second page before starting the queue.
    await page.getByLabel("Find a reference", { exact: true }).fill("");
    await page.getByRole("button", { name: "Next page", exact: true }).click();
    await page
      .getByRole("button", { name: "Start practice", exact: true })
      .click();
    const practice = page.getByRole("region", {
      name: "Guided memory practice",
      exact: true,
    });
    for (const [index, label] of [
      "Genesis 1:2",
      "John 3:16",
      "Genesis 1:13",
    ].entries()) {
      await expect(
        practice.getByRole("heading", { name: label, exact: true }),
      ).toBeFocused();
      await expect(practice).toContainText(`VERSE ${index + 1} OF 3`);
      await practice
        .getByRole("button", {
          name: index === 2 ? "Finish practice" : "Next verse",
          exact: true,
        })
        .click();
    }
    await practice
      .getByRole("button", { name: "Return to saved verses", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Start practice", exact: true }),
    ).toBeFocused();
    await expect(
      page.getByRole("navigation", { name: "Saved verses pages" }),
    ).toContainText("Page 2 of 2");
    await expect(page.getByLabel("Order", { exact: true })).toHaveValue(
      "bible",
    );
    await expect(
      row.getByLabel("Private note for Genesis 1:13", { exact: true }),
    ).toHaveValue(draft);
    await page.getByLabel("Find a reference", { exact: true }).fill("No match");
    await expect(
      page
        .getByRole("list", { name: "Selected practice verses", exact: true })
        .getByRole("listitem"),
    ).toHaveCount(3);
    await expect(
      page.getByRole("button", { name: "Start practice", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Continue note: Genesis 1:13", exact: true })
      .click();
    await expect(
      row.getByLabel("Private note for Genesis 1:13", { exact: true }),
    ).toHaveValue(draft);
    expect(writes).toEqual([]);
    const after =
      mode === "demo"
        ? await page.evaluate(() =>
            localStorage.getItem("faithquest365.demo.v1"),
          )
        : JSON.stringify(
            (
              await (
                await request.post("http://127.0.0.1:43191/__control", {
                  data: {},
                })
              ).json()
            ).state,
          );
    expect(after).toBe(snapshot);
    expect(
      await page.evaluate(() =>
        JSON.stringify({ ...localStorage, ...sessionStorage }),
      ),
    ).not.toContain(draft);
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width: 320, height: 800 });
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );
      await page.screenshot({
        path: `.cache/study-list-${mode}-${theme}-mobile.png`,
        fullPage: true,
      });
    }
    await row
      .getByRole("button", { name: "Discard note draft", exact: true })
      .click();
    await row
      .getByRole("button", { name: "Discard note changes", exact: true })
      .click();
  });

  test("practice selection is bounded, visible across filters and cleared when leaving the page", async ({
    page,
    request,
  }) => {
    await seed(page, request);
    await selectPracticeVerses(
      page,
      ...Array.from({ length: 5 }, (_, i) => `Genesis 1:${i + 1}`),
    );
    await expect(
      page.getByRole("checkbox", {
        name: "Select Genesis 1:6 for practice",
        exact: true,
      }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Deselect Genesis 1:2", exact: true })
      .click();
    await expect(
      page.getByRole("checkbox", {
        name: "Select Genesis 1:6 for practice",
        exact: true,
      }),
    ).toBeEnabled();
    await page.getByLabel("Book", { exact: true }).selectOption("JHN");
    await selectPracticeVerses(page, "John 3:16");
    await expect(
      page
        .getByRole("list", { name: "Selected practice verses", exact: true })
        .getByRole("listitem"),
    ).toHaveCount(5);
    await page
      .getByRole("button", { name: "Clear selection", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Start practice", exact: true }),
    ).toBeDisabled();
    await selectPracticeVerses(page, "John 3:16");
    await page
      .getByRole("button", { name: "Start practice", exact: true })
      .click();
    await page.getByRole("link", { name: "Dashboard", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/study$/);
    await expect(
      page.getByRole("region", { name: "Guided memory practice", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Start practice", exact: true }),
    ).toBeDisabled();
    // Back may reconstruct the route rather than retain its filter controls.
    // Selection must be empty in either case; choose the book before resuming.
    await page.getByLabel("Book", { exact: true }).selectOption("JHN");
    await selectPracticeVerses(page, "John 3:16");
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Start practice", exact: true }),
    ).toBeDisabled();
  });
}
