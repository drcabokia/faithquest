import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import robots from "../src/app/robots";
import sitemap from "../src/app/sitemap";
import { publicMetadata } from "../src/lib/public-metadata";

describe("public search and sharing metadata", () => {
  it("lists exactly the four public routes on the custom domain", () => {
    expect(sitemap().map(({ url }) => url)).toEqual([
      "https://faithquest365.app/",
      "https://faithquest365.app/login",
      "https://faithquest365.app/privacy",
      "https://faithquest365.app/terms",
    ]);
    expect(robots()).toMatchObject({
      rules: {
        disallow: "/",
        allow: ["/$", "/login$", "/privacy$", "/terms$", "/brand/"],
      },
      sitemap: "https://faithquest365.app/sitemap.xml",
    });
  });
  it("uses canonical app URLs and a real wide social image", async () => {
    const metadata = publicMetadata(
      "/privacy",
      "Privacy Policy",
      "How information is handled.",
    );
    expect(metadata.alternates?.canonical).toBe(
      "https://faithquest365.app/privacy",
    );
    expect(metadata.openGraph).toMatchObject({
      url: "https://faithquest365.app/privacy",
      siteName: "FaithQuest365",
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      images: [
        { url: "https://faithquest365.app/brand/faithquest365-social.png" },
      ],
    });
    const image = await readFile("public/brand/faithquest365-social.png");
    expect(image.subarray(1, 4).toString()).toBe("PNG");
    expect([image.readUInt32BE(16), image.readUInt32BE(20)]).toEqual([
      1200, 630,
    ]);
  });
});
