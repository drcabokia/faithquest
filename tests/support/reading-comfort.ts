import { expect, test } from "@playwright/test";

const KEY = "faithquest365.reader-preferences.v1";

// Run the same browser behavior against both production demo and isolated accounts.
export function readingComfortTests() {
  test("reading comfort persists, responds to keyboard and synchronizes tabs without saving progress", async ({
    page,
    context,
  }) => {
    await page.goto("/bible?day=1&book=GEN&chapter=1");
    await expect(
      page.getByRole("button", { name: "Mark chapter as read", exact: true }),
    ).toBeEnabled();
    const comfort = page.getByRole("region", {
      name: "Reading comfort",
      exact: true,
    });
    const size = comfort.getByLabel("Scripture text size", { exact: true });
    const spacing = comfort.getByLabel("Line spacing", { exact: true });
    const source = await page.locator("#verse-1").innerText();
    const baseline = await page.evaluate(() =>
      localStorage.getItem("faithquest365.demo.v1"),
    );
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") posts.push(request.url());
    });
    await expect(page.locator(".scripture-text")).toHaveCSS(
      "font-size",
      "22px",
    );
    await size.focus();
    await expect(size).toBeFocused();
    await expect(size).toHaveCSS("outline-style", "solid");
    await size.press("End");
    await size.press("Enter");
    await expect(size).toHaveValue("extra-large");
    await spacing.selectOption("relaxed");
    await expect(page.locator(".scripture-text")).toHaveCSS(
      "font-size",
      "30px",
    );
    // The inline verse paragraph previously fixed its own line height. Check the text itself.
    await expect(page.locator("#verse-1")).toHaveCSS("line-height", "67.5px");
    await expect(page.locator("#verse-1")).toHaveText(source);
    expect(posts).toEqual([]);
    expect(
      await page.evaluate(() => localStorage.getItem("faithquest365.demo.v1")),
    ).toBe(baseline);

    await page.getByRole("link", { name: "Next chapter", exact: true }).click();
    await expect(page.locator(".reader-title h2")).toHaveText("Genesis 2");
    await expect(page.locator(".scripture-text")).toHaveCSS(
      "font-size",
      "30px",
    );
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "My Reading Plan", exact: true })
      .click();
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Bible Reader", exact: true })
      .click();
    await expect(size).toHaveValue("extra-large");
    await page.reload();
    await expect(size).toHaveValue("extra-large");
    await expect(spacing).toHaveValue("relaxed");

    const other = await context.newPage();
    await other.goto("/bible?day=1&book=GEN&chapter=1");
    await expect(
      other.getByLabel("Scripture text size", { exact: true }),
    ).toHaveValue("extra-large");
    await other
      .getByRole("button", { name: "Reset reading settings", exact: true })
      .click();
    await expect(size).toHaveValue("standard");
    await expect(spacing).toHaveValue("comfortable");
    await other.close();
    expect(
      await page.evaluate((key) => localStorage.getItem(key), KEY),
    ).toBeNull();
    await size.selectOption("extra-large");
    await spacing.selectOption("relaxed");
    await page.setViewportSize({ width: 320, height: 844 });
    await expect(page.locator(".scripture-text")).toHaveCSS(
      "font-size",
      "30px",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await comfort.screenshot({ path: ".cache/reading-comfort-mobile.png" });
    await page
      .locator(".reader-title")
      .evaluate((element) =>
        element.scrollIntoView({ block: "start", behavior: "instant" }),
      );
    await page.screenshot({
      path: ".cache/reading-comfort-scripture-mobile.png",
    });
    await comfort
      .getByRole("button", { name: "Reset reading settings", exact: true })
      .click();
    await expect(page.locator("#verse-1")).toHaveCSS("line-height", "42.9px");
  });

  test("unavailable reading storage keeps choices during navigation and supports an explicit retry", async ({
    page,
  }) => {
    await page.addInitScript((key) => {
      const get = Storage.prototype.getItem;
      const set = Storage.prototype.setItem;
      const remove = Storage.prototype.removeItem;
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
    const comfort = page.getByRole("region", {
      name: "Reading comfort",
      exact: true,
    });
    await expect(comfort.getByRole("status")).toContainText(
      "could not remember",
    );
    await comfort
      .getByLabel("Scripture text size", { exact: true })
      .selectOption("large");
    await expect(page.locator(".scripture-text")).toHaveCSS(
      "font-size",
      "26px",
    );
    await page.getByRole("link", { name: "Next chapter", exact: true }).click();
    await expect(page.locator(".reader-title h2")).toHaveText("Genesis 2");
    await expect(
      comfort.getByLabel("Scripture text size", { exact: true }),
    ).toHaveValue("large");
    await expect(comfort.getByRole("status")).toContainText(
      "could not remember",
    );
    await comfort
      .getByRole("button", { name: "Reset reading settings", exact: true })
      .click();
    await expect(page.locator(".scripture-text")).toHaveCSS(
      "font-size",
      "22px",
    );
    await expect(comfort.getByRole("status")).toContainText(
      "could not remember",
    );
    await page.evaluate(() => {
      (
        window as typeof window & { blockReadingStorage: boolean }
      ).blockReadingStorage = false;
    });
    await comfort
      .getByLabel("Scripture text size", { exact: true })
      .selectOption("large");
    await expect(comfort.getByRole("status")).toHaveText(
      "Remembered in this browser on this device.",
    );
    expect(
      JSON.parse(
        (await page.evaluate((key) => localStorage.getItem(key), KEY))!,
      ),
    ).toEqual({ version: 1, textSize: "large", lineSpacing: "comfortable" });
  });

  test("invalid reading preferences use defaults without overwriting the stored value until a choice", async ({
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
    const comfort = page.getByRole("region", {
      name: "Reading comfort",
      exact: true,
    });
    await expect(comfort.getByRole("status")).toContainText(
      "could not be read",
    );
    await expect(page.locator(".scripture-text")).toHaveCSS(
      "font-size",
      "22px",
    );
    await expect(page.locator("#verse-1")).toHaveCSS("line-height", "42.9px");
    expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(
      invalid,
    );
    await comfort
      .getByRole("button", { name: "Reset reading settings", exact: true })
      .click();
    await expect(comfort.getByRole("status")).toHaveText(
      "Remembered in this browser on this device.",
    );
    expect(
      await page.evaluate((key) => localStorage.getItem(key), KEY),
    ).toBeNull();
  });
}
