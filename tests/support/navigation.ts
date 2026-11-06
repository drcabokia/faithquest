import { test, expect } from "@playwright/test";

export function quizBadgeTest() {
  test("the quiz NEW badge belongs to the quiz link without changing its accessible name", async ({
    page,
  }) => {
    await page.goto("/quiz");
    const navigation = page.getByRole("navigation", {
      name: "Main navigation",
      exact: true,
    });
    const quiz = navigation.getByRole("link", {
      name: "Daily Quiz",
      exact: true,
    });
    await expect(quiz).toHaveAttribute("href", "/quiz");
    await expect(quiz.locator(".nav-new")).toHaveText("NEW");
    await expect(navigation.locator(".nav-new")).toHaveCount(1);
  });
}

export function mobileNavigationTest() {
  test("phone navigation groups destinations, traps drawer focus and keeps the skip link", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/journal");
    const quick = page.getByRole("navigation", {
      name: "Quick navigation",
      exact: true,
    });
    await expect(quick).toBeVisible();
    await expect(quick.getByRole("link")).toHaveCount(4);
    await expect(
      quick.getByRole("link", { name: "Journal", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    const more = quick.getByRole("button", {
      name: "More navigation",
      exact: true,
    });
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await more.click();
    const drawer = page.getByRole("dialog", {
      name: "Journey navigation",
      exact: true,
    });
    await expect(drawer).toBeVisible();
    await expect(drawer.locator(".mobile-close")).toBeFocused();
    const navigation = drawer.getByRole("navigation", {
      name: "Main navigation",
      exact: true,
    });
    await expect(navigation.getByRole("link")).toHaveCount(10);
    for (const name of ["Daily walk", "Reflect & study", "Encouragement"])
      await expect(
        navigation.getByRole("group", { name, exact: true }),
      ).toBeVisible();
    await expect(
      navigation.getByRole("link", { name: "Reflection Journal", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await drawer.locator(".sidebar-profile a").focus();
    await page.keyboard.press("Tab");
    await expect(
      drawer.getByRole("link", { name: "FaithQuest365 home", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(drawer.locator(".sidebar-profile a")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(more).toBeFocused();
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(".sidebar")).toHaveAttribute("inert", "");
    await quick.getByRole("link", { name: "Read", exact: true }).click();
    await expect(page).toHaveURL(/\/bible$/);
    await expect(page.locator("#main-content h1")).toHaveCount(1);
    await expect(
      quick.getByRole("link", { name: "Read", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await page
      .getByRole("link", { name: "Skip to content", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: ".cache/mobile-navigation.png" });
    await page.setViewportSize({ width: 767, height: 900 });
    await expect(quick).toBeVisible();
    await page.setViewportSize({ width: 768, height: 900 });
    await expect(quick).toBeHidden();
    await expect(
      page.getByRole("navigation", { name: "Main navigation", exact: true }),
    ).toBeVisible();
  });
}
