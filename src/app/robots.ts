import type { MetadataRoute } from "next";
import site from "@/content/site.json";
import { publicPaths } from "@/lib/public-metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [...publicPaths.map((path) => `${path}$`), "/brand/"],
      disallow: "/",
    },
    sitemap: new URL("/sitemap.xml", site.appOrigin).toString(),
  };
}
