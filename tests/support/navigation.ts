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
