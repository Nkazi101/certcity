import type { Metadata } from "next";
import type { TrackId } from "./claude/blueprints";

export const siteName = "CertCity";
export const siteOrigin = new URL(process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.certcity.org").origin;

export const homePage = {
  path: "/",
  title: "CertCity: Claude certification practice in a 3D city",
  description: "AI certification practice in a 3D St. Louis, starting with the five Claude exams. Read a lesson per exam objective, take on missions at city buildings, and take timed practice exams.",
};

export const certificationCatalog = {
  path: "/certifications",
  title: "Claude certification exam practice",
  description: "Study guides and practice for five Claude certifications: a lesson per exam objective, city missions, original questions by domain, a hands-on lab checked against test cases, and timed practice exams.",
};

export const helpPage = {
  path: "/help",
  title: "Study help and progress backup",
  description: "Get CertCity study support, back up or recover your practice progress, report a question, and find keyboard controls for city assignments.",
};

export const decemberGuidePage = {
  path: "/certifications/december-2026-exam-changes",
  title: "Claude certification exam changes on December 7, 2026",
  description: "Compare the revised Claude Associate Foundations, Developer Foundations, and Architect Professional exam guides, formats, domains, and study options.",
};

export const dispatchCasePage = {
  path: "/certifications/architect-foundations/city-dispatch-case",
  title: "City Dispatch mission: Claude tool reliability walkthrough",
  description: "Work through an original CCAR-F practice mission. Diagnose a shipment lookup timeout, design a typed tool response, and compare simulated recovery outcomes.",
};

export const methodologyPage = {
  path: "/certifications/methodology",
  title: "Claude certification objective map and practice methodology",
  description: "See how CertCity maps exam guide objectives to city missions, writes original practice questions, and checks coverage for five Claude certifications.",
};

export const trackDescriptions = {
  "associate-foundations": "Prepare for CCAO-F with Claude prompting, source verification, and workflow design missions. Practice by exam domain or take a timed practice exam.",
  "developer-foundations": "Prepare for CCDV-F with Claude API, Claude Code, agent workflows, and MCP missions. Review domain questions and take timed practice exams.",
  "architect-foundations": "Prepare for CCAR-F with agent orchestration, MCP tool design, Claude Code, and reliability missions. Take full-length timed Architect Foundations practice exams.",
  "architect-professional": "Prepare for CCAR-P with enterprise Claude architecture, evaluation, integration, and governance missions. Practice by domain or take a timed practice exam.",
  "developer-professional": "Prepare for CCDV-P with production Claude missions: fallbacks and rate limits, evaluation gates, tracing, cost, guardrails, and coding-agent fleets. Take timed practice exams.",
} satisfies Record<TrackId, string>;

export function siteUrl(path: string) {
  return new URL(path, siteOrigin).href;
}

export function pageMetadata({ path, title, description }: typeof homePage): Metadata {
  const url = siteUrl(path);
  const image = {
    url: siteUrl("/opengraph-image.png"),
    width: 1200,
    height: 630,
    type: "image/png",
    alt: "CertCity. A world where learning happens by doing.",
  };
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", siteName, locale: "en_US", url, images: [image] },
    twitter: { card: "summary_large_image", images: [image] },
  };
}
