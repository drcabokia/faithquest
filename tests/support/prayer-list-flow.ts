import { test, expect } from "@playwright/test";
import { initialState } from "../../src/lib/state";

export function prayerListFlowTest(mode: "demo" | "account") {
  test("prayer list has one action per request, retains navigation and resumes drafts without duplicates", async ({
    page,
    request,
  }) => {
    const prayers = Object.fromEntries(
      Array.from({ length: 12 }, (_, index) => [
        crypto.randomUUID(),
        {
          title: "Prayer " + String(index + 1).padStart(2, "0"),
          text: "A synthetic concern for simple list navigation.",
          status: index % 4 === 0 ? "answered" : "ongoing",
          revision: crypto.randomUUID(),
          createdAt: new Date(Date.now() - index * 60000).toISOString(),
          updatedAt: new Date(Date.now() - index * 60000).toISOString(),
          followUps:
            index === 0
              ? {
                  [crypto.randomUUID()]: {
                    text: "A synthetic note for the list count.",
                    date: new Date(Date.now() - 86400000)
                      .toISOString()
                      .slice(0, 10),
                  },
                }
              : {},
        },
      ]),
    );
    if (mode === "account") {
      await request.post("http://127.0.0.1:43191/__control", {
        data: { prayers },
      });
    } else {
      await page.addInitScript(
        (value) =>
          localStorage.setItem("faithquest365.demo.v1", JSON.stringify(value)),
        { ...initialState(), prayers },
      );
    }
    await page.goto("/prayers");
    const list = page.getByRole("list", {
      name: "Prayer requests",
      exact: true,
    });
    const rows = list.getByRole("listitem");
    const back = page.getByRole("button", {
      name: "Back to prayer requests",
      exact: true,
    });
    const search = page.getByLabel("Search prayer requests", { exact: true });
    const status = page.getByLabel("Filter by prayer status", { exact: true });
    const editor = page.getByRole("region", {
      name: "Prayer editor",
      exact: true,
    });
    await expect(rows).toHaveCount(10);
    await expect(list.getByRole("button")).toHaveCount(10);
    await expect(list.getByText("1 follow-up", { exact: true })).toBeVisible();
    await expect(list.getByText("0 follow-ups", { exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByRole("article")).toHaveCount(0);
    const baseline =
      mode === "account"
        ? (
            await (
              await request.post("http://127.0.0.1:43191/__control", {
                data: {},
              })
            ).json()
          ).state
        : await page.evaluate(() =>
            JSON.parse(localStorage.getItem("faithquest365.demo.v1")!),
          );
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") posts.push(request.url());
    });
    const first = page.getByRole("button", {
      name: "Open prayer: Prayer 01",
      exact: true,
    });
    await first.focus();
    await first.press("Enter");
    await expect(
      editor.getByRole("heading", { name: "Prayer 01", exact: true }),
    ).toBeFocused();
    await expect(list).toHaveCount(0);
    await expect(search).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "New prayer request", exact: true }),
    ).toHaveCount(0);
    await expect(back).toHaveCount(1);
    await back.click();
    await expect(first).toBeFocused();
    await page
      .getByRole("button", { name: "Next prayer page", exact: true })
      .click();
    await expect(rows).toHaveCount(2);
    const secondPagePrayer = list.getByRole("button").first();
    const secondPageName = await secondPagePrayer.getAttribute("aria-label");
    await secondPagePrayer.click();
    await back.click();
    await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: secondPageName!, exact: true }),
    ).toBeFocused();

    await search.fill("Prayer 01");
    await status.selectOption("answered");
    await first.click();
    await back.click();
    await expect(search).toHaveValue("Prayer 01");
    await expect(status).toHaveValue("answered");
    await first.click();
    await page
      .getByRole("button", { name: "Edit prayer request", exact: true })
      .click();
    await expect(
      page.getByLabel("Prayer title", { exact: true }),
    ).toBeFocused();
    await page
      .getByLabel("Your prayer request", { exact: true })
      .fill("An unsaved hope that stays in this tab.");
    await back.click();
    await expect(rows).toHaveCount(1);
    await expect(list.getByRole("button")).toHaveCount(1);
    await expect(
      list.getByText("Unsaved changes", { exact: true }),
    ).toBeVisible();
    await status.selectOption("drafts");
    await page
      .getByRole("button", { name: "Continue Prayer 01", exact: true })
      .click();
    await expect(
      page.getByLabel("Your prayer request", { exact: true }),
    ).toHaveValue("An unsaved hope that stays in this tab.");
    const discard = page.getByRole("button", {
      name: "Discard prayer draft",
      exact: true,
    });
    await discard.click();
    await page
      .getByRole("button", { name: "Keep writing", exact: true })
      .click();
    await expect(discard).toBeFocused();
    await discard.click();
    await page
      .getByRole("button", { name: "Discard prayer changes", exact: true })
      .click();
    await back.click();
    await expect(rows).toHaveCount(0);
    await page
      .getByRole("button", { name: "Clear filters", exact: true })
      .click();
    await expect(search).toBeFocused();
    await expect(rows).toHaveCount(10);
    const unchanged =
      mode === "account"
        ? (
            await (
              await request.post("http://127.0.0.1:43191/__control", {
                data: {},
              })
            ).json()
          ).state
        : await page.evaluate(() =>
            JSON.parse(localStorage.getItem("faithquest365.demo.v1")!),
          );
    expect(unchanged).toEqual(baseline);
    expect(posts).toEqual([]);

    await page
      .getByRole("button", { name: "New prayer request", exact: true })
      .click();
    await page
      .getByLabel("Prayer title", { exact: true })
      .fill("New unsaved prayer");
    await back.click();
    await search.fill("New unsaved prayer");
    await status.selectOption("drafts");
    await expect(rows).toHaveCount(1);
    await page
      .getByRole("button", { name: "Continue New unsaved prayer", exact: true })
      .click();
    await expect(page.getByLabel("Prayer title", { exact: true })).toHaveValue(
      "New unsaved prayer",
    );
    await discard.click();
    await page
      .getByRole("button", { name: "Discard prayer changes", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Prayer request list", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Clear filters", exact: true })
      .click();
    await page.screenshot({
      path: ".cache/prayer-list-" + mode + "-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 320, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(list).toHaveCSS("display", "block");
    await page.screenshot({
      path: ".cache/prayer-list-" + mode + "-mobile.png",
      fullPage: true,
    });
  });
}
