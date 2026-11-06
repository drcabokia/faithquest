import { test, expect } from "@playwright/test";

export function brandingTest() {
  test("FaithQuest365 branding stays complete on public pages and in mobile navigation", async ({
    page,
  }) => {
    for (const route of ["/", "/login"]) {
      await page.goto(route);
      await expect(
        page.getByRole("link", { name: "FaithQuest365 home" }).first(),
      ).toContainText("FaithQuest365");
    }
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto("/journal");
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
    const logo = page.locator(".sidebar .brand");
    await expect(logo).toBeVisible();
    await expect(logo).toContainText("FaithQuest365");
    const bounds = await logo.boundingBox();
    const close = await page.locator(".mobile-close").boundingBox();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(close!.x);
  });
}
