import { track } from "@vercel/analytics";
import { trackHref, tracks } from "./claude/blueprints";
import type { TrackId } from "./claude/blueprints";
import { certificationCatalog, decemberGuidePage, dispatchCasePage, helpPage, homePage, methodologyPage } from "./seo";

export const webAnalyticsEnabled = process.env.NEXT_PUBLIC_CERTCITY_WEB_ANALYTICS === "1";
export const speedInsightsEnabled = process.env.NEXT_PUBLIC_CERTCITY_SPEED_INSIGHTS === "1";
const practiceEventsEnabled = webAnalyticsEnabled && process.env.NEXT_PUBLIC_CERTCITY_PRACTICE_EVENTS === "1";
const sessionKey = "certcity.practice-measurement.v1";

type Source = "organic-search" | "paid-search" | "other";
type Milestone = "started" | "completed";
type Session = { landing: string; source: Source; started?: true; completed?: true };
let session: Session | undefined;
const knownLandings = new Set([homePage.path, certificationCatalog.path, ...tracks.map(trackHref), helpPage.path, dispatchCasePage.path, decemberGuidePage.path, methodologyPage.path]);
const sources: Source[] = ["organic-search", "paid-search", "other"];

function cleanPath(path: string) {
  return path.replace(/\/$/, "") || "/";
}

export function cleanMeasurementUrl(url: string) {
  const parsed = new URL(url, window.location.origin);
  const path = cleanPath(parsed.pathname);
  return parsed.origin === window.location.origin && knownLandings.has(path) ? `${parsed.origin}${path}` : null;
}

export function allowsMeasurement() {
  return navigator.doNotTrack !== "1" && !(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
}

function sourceFor(url: URL): Source {
  if (url.searchParams.has("gclid") || url.searchParams.has("msclkid") || /^(cpc|ppc|paid(?:[-_ ]search)?)$/i.test(url.searchParams.get("utm_medium") ?? "")) return "paid-search";
  if (!document.referrer) return "other";
  const referrer = new URL(document.referrer);
  if (referrer.origin === url.origin) return "other";
  const host = referrer.hostname.toLowerCase().replace(/^www\./, "");
  return /^(?:google\.(?:com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})|bing\.com|duckduckgo\.com|(?:[a-z]{2}\.)?search\.yahoo\.com|search\.brave\.com|ecosia\.org)$/.test(host)
    ? "organic-search" : "other";
}

export function capturePracticeLanding() {
  if (!practiceEventsEnabled || !allowsMeasurement() || session) return;
  try {
    const stored: Session | null = JSON.parse(sessionStorage.getItem(sessionKey) ?? "null");
    if (stored && (knownLandings.has(stored.landing) || stored.landing === "other") && sources.includes(stored.source)) {
      session = { landing: stored.landing, source: stored.source, started: stored.started === true || undefined, completed: stored.completed === true || undefined };
    }
  } catch {
    // Use in-memory session data when browser storage is unavailable.
  }
  if (session) return;
  const url = new URL(window.location.href);
  const path = cleanPath(url.pathname);
  const landing = knownLandings.has(path) ? path : "other";
  session = { landing, source: sourceFor(url) };
  rememberPracticeSession();
}

function rememberPracticeSession() {
  try {
    sessionStorage.setItem(sessionKey, JSON.stringify(session));
  } catch {
    // The current page can still deduplicate events in memory.
  }
}

export function recordPracticeMilestone(milestone: Milestone, trackId: TrackId, surface: "academy" | "city") {
  capturePracticeLanding();
  if (!session || !allowsMeasurement() || session[milestone]) return;
  session[milestone] = true;
  rememberPracticeSession();
  track(milestone === "started" ? "First Practice Started" : "First Practice Completed", {
    landing: session.landing,
    source: session.source,
    track: trackId,
    surface,
  });
}
