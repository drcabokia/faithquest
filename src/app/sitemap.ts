import type { MetadataRoute } from "next";
import site from "@/content/site.json";
import { publicPaths } from "@/lib/public-metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPaths.map((path) => ({
    url: new URL(path, site.appOrigin).toString(),
  }));
}
