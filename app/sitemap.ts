import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/watch`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/agent`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/login`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
