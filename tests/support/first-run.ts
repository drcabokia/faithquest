import { test, expect } from "@playwright/test";

export function firstRunTest() {
  test("a first journey offers three starting actions instead of zero stats and returns to progress after reading", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Welcome to FaithQuest365.",
    );
    await expect(page.locator(".stats-grid")).toHaveCount(0);
    const welcome = page.locator(".first-journey");
    await expect(welcome.getByRole("link")).toHaveCount(3);
    await expect(
      welcome.getByRole("link", { name: "Take first quiz", exact: true }),
    ).toHaveAttribute("href", "/quiz?day=1");
    await expect(
      welcome.getByRole("link", {
        name: "Write first journal entry",
        exact: true,
      }),
    ).toHaveAttribute("href", "/journal");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await welcome
      .getByRole("link", { name: "Start reading plan", exact: true })
      .click();
    await expect(page).toHaveURL(/\/reading-plan$/);
    await page
      .getByRole("link", { name: "Open next mission", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Mark chapter as read", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Chapter completed", exact: true }),
    ).toBeVisible();
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Welcome back",
    );
    await expect(page.locator(".stats-grid")).toBeVisible();
    await expect(welcome).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Welcome back",
    );
  });
}
