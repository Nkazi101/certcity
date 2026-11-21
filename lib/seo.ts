import type { Metadata } from "next";
import type { TrackId } from "./claude/blueprints";

export const siteName = "CertCity";
export const siteOrigin = new URL(process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.certcity.org").origin;

export const homePage = {
  path: "/",
  title: "CertCity · Hands-On Claude Certification Practice",
  description: "Practice for Claude certifications in a 3D St. Louis. Solve city assignments, work through practical cases, and take timed exam rehearsals with CertCity.",
};

export const certificationCatalog = {
  path: "/certifications",
  title: "Claude Certification Exam Practice",
  description: "Compare four Claude certification study paths. Practice with city assignments, original questions by exam domain, practical cases, and timed mock exams.",
};

export const helpPage = {
  path: "/help",
  title: "Study Help and Progress Recovery",
  description: "Get CertCity study support, back up or recover your practice progress, report a question, and find keyboard controls for city assignments.",
};

export const decemberGuidePage = {
  path: "/certifications/december-2026-exam-changes",
  title: "Claude Certification Exam Changes on December 7, 2026",
  description: "Compare the revised Claude Associate Foundations, Developer Foundations, and Architect Professional exam guides, formats, domains, and study options.",
};

export const dispatchCasePage = {
  path: "/certifications/architect-foundations/city-dispatch-case",
  title: "City Dispatch Case Study on Claude Tool Reliability",
  description: "Work through an original CCAR-F practice case. Diagnose a shipment lookup timeout, design a typed tool response, and compare simulated recovery outcomes.",
};

export const methodologyPage = {
  path: "/certifications/methodology",
  title: "Claude Certification Objective Map and Practice Methodology",
  description: "See how CertCity maps exam guide objectives to city missions, writes original practice questions, and checks coverage for four Claude certification pathways.",
};

export const trackDescriptions = {
  "associate-foundations": "Prepare for CCAO-F with Claude prompting, source verification, and workflow design cases. Practice by exam domain or take a full-length timed rehearsal.",
  "developer-foundations": "Prepare for CCDV-F with Claude API, Claude Code, agent workflows, and MCP cases. Review domain questions and take full-length timed exam rehearsals.",
  "architect-foundations": "Prepare for CCAR-F with agent orchestration, MCP tool design, Claude Code, and reliability cases. Take full-length timed Architect Foundations practice exams.",
  "architect-professional": "Prepare for CCAR-P with enterprise Claude architecture, evaluation, integration, and governance cases. Practice by domain or take a timed mock exam.",
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
