import { test, expect } from "@playwright/test";
import { initialState } from "../../src/lib/state";
import { dateInZone } from "../../src/lib/dates";

export const journeyPaths = [
  "/bible",
  "/quiz",
  "/journal",
  "/study",
  "/community",
  "/prayers",
  "/challenges",
  "/achievements",
  "/profile",
  "/reading-plan",
];

export function emptyJourneyTest(mode: "demo" | "account") {
  test("all journey pages offer useful starting content without blank space", async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of journeyPaths) {
      await page.goto(path === "/quiz" ? "/quiz?day=365" : path);
      const main = page.locator("#main-content");
      if (path === "/bible")
        await expect(
          main.getByRole("heading", { name: "Genesis 1", exact: true }),
        ).toBeVisible();
      if (path === "/quiz") {
        await expect(
          main.getByRole("heading", {
            name: "A quiet day for discovery",
            exact: true,
          }),
        ).toBeVisible();
        await main.getByLabel("Reading day").selectOption("1");
        await expect(main.locator(".quiz-card").first()).toBeVisible();
      }
      if (path === "/journal")
        await expect(
          main.getByRole("heading", {
            name: "Your story begins here",
            exact: true,
          }),
        ).toBeVisible();
      if (path === "/study") {
        await expect(
          main.getByRole("heading", {
            name: "A place for the verses you want to remember",
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          main.getByRole("link", { name: "Find a verse", exact: true }),
        ).toHaveAttribute("href", "/bible");
      }
      if (path === "/community") {
        if (mode === "account")
          await expect(main.locator(".fellowship-empty")).toContainText(
            "You have not joined a group",
          );
        else
          await expect(
            main.getByRole("heading", {
              name: "Live groups require a signed-in account",
              exact: true,
            }),
          ).toBeVisible();
      }
      if (path === "/prayers")
        await expect(main.locator(".prayer-empty")).toContainText(
          "Add your first prayer request",
        );
      if (path === "/challenges") {
        await expect(
          main.getByRole("button", {
            name: "Start seven-day challenge",
            exact: true,
          }),
        ).toBeVisible();
        await expect(main.locator(".challenge-history")).toContainText(
          "Your past challenge periods will appear here",
        );
      }
      if (path === "/achievements")
        await expect(
          main.getByRole("link", {
            name: "Choose a reading mission",
            exact: true,
          }),
        ).toHaveAttribute("href", "/reading-plan");
      if (path === "/profile")
        await expect(
          main.getByLabel("Display name", { exact: true }),
        ).not.toHaveValue("");
      if (path === "/reading-plan") {
        await main
          .getByLabel("Search reading days or books", { exact: true })
          .fill("no matching synthetic book");
        await main.getByLabel("Completion status").selectOption("complete");
        await expect(
          main.getByRole("heading", { name: "No readings found", exact: true }),
        ).toBeVisible();
        await main
          .getByRole("button", { name: "Show all readings", exact: true })
          .click();
        await expect(
          main.getByLabel("Search reading days or books", { exact: true }),
        ).toHaveValue("");
        await expect(main.getByLabel("Completion status")).toHaveValue("all");
        await expect(main.locator(".plan-list .plan-row")).toHaveCount(14);
      }
      await expect(main.locator("h1")).toHaveCount(1);
      await expect(main.locator(".journey-loading")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  });
}

export function accountJourneyStateTests() {
  for (const path of journeyPaths) {
    test(`initial journey waiting and failure recover on ${path}`, async ({
      page,
    }) => {
      let stage: "hold" | "fail" | "ready" = "hold";
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route("**/api/journey", async (route) => {
        if (stage === "hold") await held;
        if (stage === "ready") await route.continue();
        else
          await route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({
              error:
                "Your account service is temporarily unavailable. Please retry.",
            }),
          });
      });
      try {
        await page.goto(path);
        const main = page.locator("#main-content");
        await expect(main.locator(".journey-loading")).toBeVisible();
        await expect(main.getByRole("status")).toContainText(
          "Opening your journey",
        );
        await expect(main.locator(".journey-skeleton")).toBeVisible();
        await expect(main.locator("h1")).toHaveCount(1);
        if (path === "/profile")
          await main.screenshot({ path: ".cache/journey-profile-loading.png" });
        stage = "fail";
        release();
        await expect(main.locator(".journey-load-error")).toBeVisible();
        await expect(main.locator(".error-banner")).toBeVisible();
        await expect(main.locator(".journey-loading")).toHaveCount(0);
        await expect(main.locator("h1")).toHaveCount(1);
        if (path === "/profile")
          await main.screenshot({ path: ".cache/journey-profile-error.png" });
        stage = "ready";
        await main
          .getByRole("button", { name: "Check saved progress", exact: true })
          .click();
        await expect(main.locator(".journey-load-error")).toHaveCount(0);
        await expect(main.locator(".journey-loading")).toHaveCount(0);
        await expect(main.locator("h1")).toHaveCount(1);
      } finally {
        stage = "ready";
        release();
      }
    });
  }
}

export function renderingRecoveryTest() {
  test("a rendering error hides raw details and retries the journey segment", async ({
    page,
  }) => {
    const seed = initialState();
    seed.profile.timeZone = "Asia/Kuala_Lumpur";
    seed.profile.startDate = dateInZone(seed.profile.timeZone);
    seed.chapters = { "GEN.1": seed.profile.startDate };
    await page.addInitScript((seed) => {
      localStorage.setItem("faithquest365.demo.v1", JSON.stringify(seed));
      const observer = window.ResizeObserver;
      (window as Window & { restoreObserver?: () => void }).restoreObserver =
        () => {
          window.ResizeObserver = observer;
        };
      window.ResizeObserver = class extends observer {
        constructor(callback: ResizeObserverCallback) {
          super(callback);
          throw new Error("SYNTHETIC_PRIVATE_ERROR_DETAIL");
        }
      };
    }, seed);
    await page.goto("/dashboard");
    const main = page.locator("#main-content");
    await expect(main.getByRole("heading", { level: 1 })).toHaveText(
      "A pause along the path.",
    );
    await expect(main).not.toContainText("SYNTHETIC_PRIVATE_ERROR_DETAIL");
    await page.evaluate(() =>
      (window as Window & { restoreObserver?: () => void }).restoreObserver?.(),
    );
    await main.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(main.getByRole("heading", { level: 1 })).toContainText(
      "Welcome back",
    );
    await expect(main.locator(".stats-grid")).toBeVisible();
  });
}
