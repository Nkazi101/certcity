import type { MetadataRoute } from "next";
import { trackHref, tracks } from "../lib/claude/blueprints";
import { certificationCatalog, decemberGuidePage, dispatchCasePage, helpPage, homePage, methodologyPage, siteUrl } from "../lib/seo";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [homePage.path, certificationCatalog.path, ...tracks.map(trackHref), helpPage.path, decemberGuidePage.path, dispatchCasePage.path, methodologyPage.path]
    .map((path) => ({ url: siteUrl(path) }));
}
