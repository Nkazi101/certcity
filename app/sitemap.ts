import type { MetadataRoute } from "next";
import { trackHref, tracks } from "../lib/claude/blueprints";
import { lessonSets } from "../lib/claude/lessons";
import { lessonHref, studyHref } from "../lib/claude/lessons/paths";
import { certificationCatalog, decemberGuidePage, dispatchCasePage, helpPage, homePage, methodologyPage, siteUrl } from "../lib/seo";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const study = tracks.flatMap((track) => [studyHref(track), ...lessonSets[track.id].lessons.map(({ objective }) => lessonHref(track, objective))]);
  return [homePage.path, certificationCatalog.path, ...tracks.map(trackHref), ...study, helpPage.path, decemberGuidePage.path, dispatchCasePage.path, methodologyPage.path]
    .map((path) => ({ url: siteUrl(path) }));
}
