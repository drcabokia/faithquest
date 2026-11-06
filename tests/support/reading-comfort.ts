import { expect, test, type Page } from "@playwright/test";

const KEY = "faithquest365.reader-preferences.v1";
const comfort = (page: Page) =>
  page.getByRole("region", { name: "Reading comfort", exact: true });
const size = (page: Page) =>
  comfort(page).getByLabel("Scripture text size", { exact: true });
const spacing = (page: Page) =>
  comfort(page).getByLabel("Line spacing", { exact: true });
const reset = (page: Page) =>
  comfort(page).getByRole("button", {
    name: "Reset reading settings",
    exact: true,
  });
const settings = async (page: Page) => {
  await page
    .getByRole("link", { name: "Reading settings", exact: true })
    .click();
  await expect(page).toHaveURL(/\/profile#reading-comfort$/);
};
const reader = async (page: Page) => {
  await comfort(page)
    .getByRole("link", { name: "Open Bible Reader", exact: true })
    .click();
  await expect(page).toHaveURL(/\/bible$/);
};

// The controls live only in Settings; Scripture still subscribes on the reader.
export function readingComfortTests() {
  test("reading comfort in settings persists, supports keyboard and synchronizes tabs without saving progress", async ({
    page,
    context,
  }) => {
    await page.goto("/bible?day=1&book=GEN&chapter=1");
    await expect(
      page.getByRole("button", { name: "Mark chapter as read", exact: true }),
    ).toBeEnabled();
    await expect(comfort(page)).toHaveCount(0);
    await expect(page.locator(".scripture-text")).toHaveCSS(
      "font-size",
      "22px",
    );
    const source = await page.locator("#verse-1").innerText();
    const baseline = await page.evaluate(() =>
      localStorage.getItem("faithquest365.demo.v1"),
    );
    await settings(page);
    await expect(page).toHaveURL(/\/profile#reading-comfort$/);
    await expect(comfort(page)).toBeInViewport();
    await expect(comfort(page)).toHaveCount(1);
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") posts.push(request.url());
    });
    await size(page).focus();
    await expect(size(page)).toBeFocused();
    await expect(size(page)).toHaveCSS("outline-style", "solid");
    await size(page).press("End");
    await size(page).press("Enter");
    await expect(size(page)).toHaveValue("extra-large");
    await spacing(page).selectOption("relaxed");
    expect(posts).toEqual([]);
    expect(
      await page.evaluate(() => localStorage.getItem("faithquest365.demo.v1")),
    ).toBe(baseline);
    await reader(page);
    await expect(comfort(page)).toHaveCount(0);
    await expect(page.locator(".reader-title h2")).toHaveText("Genesis 1");
    await expect(page.locator(".scripture-text")).toHaveCSS(
      "font-size",
      "30px",
    );
    await expect(page.locator("#verse-1")).toHaveCSS("line-height", "67.5px");
    await expect(page.locator("#verse-1")).toHaveText(source);
    await page.getByRole("link", { name: "Next chapter", exact: true }).click();
    await expect(page.locator(".reader-title h2")).toHaveText("Genesis 2");
    await expect(page.locator(".scripture-text")).toHaveCSS(
      "font-size",
      "30px",
    );
    await settings(page);
    await expect(size(page)).toHaveValue("extra-large");
    await page.reload();
    await expect(size(page)).toHaveValue("extra-large");
    await expect(spacing(page)).toHaveValue("relaxed");
    const other = await context.newPage();
    await other.goto("/bible?day=1&book=GEN&chapter=1");
    await expect(other.locator(".scripture-text")).toHaveCSS(
      "font-size",
      "30px",
    );
    await reset(page).click();
    await expect(other.locator(".scripture-text")).toHaveCSS(
      "font-size",
      "22px",
    );
    await expect(other.locator("#verse-1")).toHaveCSS("line-height", "42.9px");
    await other.goto("/profile#reading-comfort");
    await size(other).selectOption("large");
    await expect(size(page)).toHaveValue("large");
    await reset(other).click();
    await expect(size(page)).toHaveValue("standard");
    await expect(spacing(page)).toHaveValue("comfortable");
    await other.close();
    expect(
      await page.evaluate((key) => localStorage.getItem(key), KEY),
    ).toBeNull();
    await size(page).selectOption("extra-large");
    await spacing(page).selectOption("relaxed");
    await page.setViewportSize({ width: 320, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await comfort(page).screenshot({
      path: ".cache/reading-comfort-settings-mobile.png",
    });
    await reader(page);
    await expect(page.locator(".scripture-text")).toHaveCSS(
      "font-size",
      "30px",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .locator(".reader-title")
      .evaluate((el) =>
        el.scrollIntoView({ block: "start", behavior: "instant" }),
      );
    await page.screenshot({
      path: ".cache/reading-comfort-scripture-mobile.png",
    });
    await settings(page);
    await reset(page).click();
    await reader(page);
    await expect(page.locator("#verse-1")).toHaveCSS("line-height", "42.9px");
  });

  test("unavailable reading storage keeps settings choices during navigation and supports an explicit retry", async ({
    page,
  }) => {
    await page.addInitScript((key) => {
      const get = Storage.prototype.getItem,
        set = Storage.prototype.setItem,
        remove = Storage.prototype.removeItem;
      const win = window as typeof window & { blockReadingStorage: boolean };
      win.blockReadingStorage = true;
      Storage.prototype.getItem = function (name) {
        if (name === key && win.blockReadingStorage)
          throw new DOMException("Blocked", "SecurityError");
        return get.call(this, name);
      };
      Storage.prototype.setItem = function (name, value) {
        if (name === key && win.blockReadingStorage)
          throw new DOMException("Blocked", "QuotaExceededError");
        return set.call(this, name, value);
      };
      Storage.prototype.removeItem = function (name) {
        if (name === key && win.blockReadingStorage)
          throw new DOMException("Blocked", "SecurityError");
        return remove.call(this, name);
      };
    }, KEY);
    await page.goto("/bible?day=1&book=GEN&chapter=1");
    await settings(page);
    await expect(comfort(page).getByRole("status")).toContainText(
      "could not remember",
    );
    await size(page).selectOption("large");
    await reader(page);
    await expect(page.locator(".scripture-text")).toHaveCSS(
      "font-size",
      "26px",
    );
    await page.getByRole("link", { name: "Next chapter", exact: true }).click();
    await expect(page.locator(".reader-title h2")).toHaveText("Genesis 2");
    await settings(page);
    await expect(size(page)).toHaveValue("large");
    await expect(comfort(page).getByRole("status")).toContainText(
      "could not remember",
    );
    await reset(page).click();
    await reader(page);
    await expect(page.locator(".scripture-text")).toHaveCSS(
      "font-size",
      "22px",
    );
    await settings(page);
    await expect(comfort(page).getByRole("status")).toContainText(
      "could not remember",
    );
    await page.evaluate(() => {
      (
        window as typeof window & { blockReadingStorage: boolean }
      ).blockReadingStorage = false;
    });
    await size(page).selectOption("large");
    await expect(comfort(page).getByRole("status")).toHaveText(
      "Remembered in this browser on this device.",
    );
    expect(
      JSON.parse(
        (await page.evaluate((key) => localStorage.getItem(key), KEY))!,
      ),
    ).toEqual({ version: 1, textSize: "large", lineSpacing: "comfortable" });
  });

  test("invalid reading preferences use defaults without overwriting the stored value until a settings choice", async ({
    page,
  }) => {
    const invalid = JSON.stringify({
      version: 1,
      textSize: ["extra-large"],
      lineSpacing: "relaxed",
    });
    await page.addInitScript(
      ({ key, invalid }) => localStorage.setItem(key, invalid),
      { key: KEY, invalid },
    );
    await page.goto("/bible?day=1&book=GEN&chapter=1");
    await expect(page.locator(".scripture-text")).toHaveCSS(
      "font-size",
      "22px",
    );
    await expect(page.locator("#verse-1")).toHaveCSS("line-height", "42.9px");
    await settings(page);
    await expect(comfort(page).getByRole("status")).toContainText(
      "could not be read",
    );
    expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(
      invalid,
    );
    await reset(page).click();
    await expect(comfort(page).getByRole("status")).toHaveText(
      "Remembered in this browser on this device.",
    );
    expect(
      await page.evaluate((key) => localStorage.getItem(key), KEY),
    ).toBeNull();
    await reader(page);
    await expect(page.locator(".scripture-text")).toHaveCSS(
      "font-size",
      "22px",
    );
  });
}
