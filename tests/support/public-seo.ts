import { test, expect } from "@playwright/test";

export function publicSeoTest() {
  test("public metadata and sitemap use the app domain without listing private routes", async ({
    page,
    request,
  }) => {
    for (const path of ["/", "/login", "/privacy", "/terms"]) {
      await page.goto(path);
      // Next normalizes the root canonical URL without its trailing slash.
      const expected =
        path === "/"
          ? /^https:\/\/faithquest365\.app\/?$/
          : `https://faithquest365.app${path}`;
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        expected,
      );
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
        "content",
        expected,
      );
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        "content",
        "https://faithquest365.app/brand/faithquest365-social.png",
      );
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
        "content",
        "summary_large_image",
      );
    }
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    const xml = await sitemap.text();
    expect((xml.match(/<loc>/g) ?? []).length).toBe(4);
    expect(xml).not.toMatch(/dashboard|journal|auth|api|vercel\.app/);
    const robots = await request.get("/robots.txt");
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toContain("Disallow: /");
    expect(await robots.text()).toContain(
      "https://faithquest365.app/sitemap.xml",
    );
    const image = await request.get("/brand/faithquest365-social.png");
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toContain("image/png");
    await page.goto("/journal");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
  });
}
