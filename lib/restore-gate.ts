/**
 * CertCity is a static export, so every page's HTML is the same for everyone: a first-time guest. A returning learner's
 * state (saved progress, a Supabase session, a deep link into a case or practice session) only exists in this browser,
 * and it can't be read until React hydrates and the account settles. Rendering the guest HTML and then swapping it out
 * is the "flash on reload" this module prevents.
 *
 * A pre-paint inline script (see `restoreScript`) marks `<html data-restoring="…">` with the kinds of state this
 * browser is about to restore. CSS then hides anything marked `data-restore` / `data-restore-replace` for those
 * scopes and shows any `data-restore-status` placeholder. Components that restore that state call `useRestoreGate`
 * (components/restore-gate.ts), which lifts each scope once every restorer for it has settled. First-time visitors
 * get no marker, so they still see the prerendered page immediately.
 *
 * Scopes:
 * - "progress": this browser has saved CertCity progress or a session, so personal UI (current exam, next case,
 *   studied lessons, account label) isn't known yet.
 * - "route": the URL deep-links into a different view than the prerendered one (a case or shift in the city, or the
 *   practice workspace on a track page).
 */
export type RestoreScope = "progress" | "route";

export const restoreAttribute = "data-restoring";

/** How long a veil may stay up if the restorers never report back (blocked scripts, a hung auth check). */
export const restoreTimeoutMs = 10000;

/**
 * Returns the space-separated scopes this browser will restore on the current page.
 *
 * It is serialized verbatim into the pre-paint script, so it must stay self-contained: no imports, no references to
 * anything outside its body, and syntax every supported browser parses without transpiling.
 */
export function expectedRestores(): string {
  var scopes: string[] = [];
  try {
    var location = window.location;
    var params = new URLSearchParams(location.search);
    var path = location.pathname.replace(/\/+$/, "") || "/";
    var route = false;
    if (path === "/") {
      route = params.has("pathway") || params.has("mission") || params.has("assignment") || params.get("shift") === "dispatch";
    } else if (/^\/certifications\/[a-z]+-(foundations|professional)$/.test(path)) {
      var guide = params.get("guide");
      route = params.get("practice") === "1" || guide === "july-2026" || guide === "december-2026" ||
        params.has("domain") || params.has("objective") ||
        /^#(assignment|entry-bridge|guide-skills|domain-title|track-practicals|rehearsal|practice-followup|practice-controls|readiness)$/.test(location.hash);
    }
    if (route) scopes.push("route");
    // An auth redirect (?code=) is about to sign in; any saved CertCity key or Supabase session means a returning learner.
    var saved = params.has("code");
    var storage = window.localStorage;
    for (var index = 0; !saved && index < storage.length; index++) {
      var key = storage.key(index) || "";
      saved = /^(certcity|simza)\./.test(key) || /^sb-.+-auth-token$/.test(key);
    }
    if (saved) scopes.push("progress");
  } catch (error) {
    // Storage or URL APIs unavailable: render the prerendered page as is.
  }
  return scopes.join(" ");
}

/** Runs during HTML parsing, before first paint. Lifts the veil on its own if nothing restores in time. */
export const restoreScript = `(function(){try{var s=(${expectedRestores.toString()})();if(!s)return;` +
  `var h=document.documentElement;h.setAttribute(${JSON.stringify(restoreAttribute)},s);` +
  `setTimeout(function(){h.removeAttribute(${JSON.stringify(restoreAttribute)})},${restoreTimeoutMs})}catch(e){}})()`;
