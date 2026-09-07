import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: "https://www.anjalisaputra.site/sitemap.xml",
    host: "https://www.anjalisaputra.site",
  };
}
