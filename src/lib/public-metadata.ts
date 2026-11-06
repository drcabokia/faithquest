import type { Metadata } from "next";
import site from "@/content/site.json";

export const publicPaths = ["/", "/login", "/privacy", "/terms"] as const;
export const siteDescription =
  "A welcoming 365-day Bible reading journey. Read Scripture, reflect, and grow in faith, one day at a time.";

export function publicMetadata(
  path: (typeof publicPaths)[number],
  title: string,
  description = siteDescription,
): Metadata {
  const url = new URL(path, site.appOrigin).toString();
  const image = {
    url: new URL("/brand/faithquest365-social.png", site.appOrigin).toString(),
    width: 1200,
    height: 630,
    alt: "FaithQuest365 — Read. Discover. Grow in Faith.",
  };
  const socialTitle = `${title} | ${site.name}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: site.name,
      title: socialTitle,
      description,
      url,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [image],
    },
  };
}
