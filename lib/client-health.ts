import { getSupabase } from "./supabase/client";

const consentKey = "certcity.diagnostics-consent.v1";
const build = process.env.NEXT_PUBLIC_CERTCITY_RELEASE || "development";
type HealthEvent = "sync-unavailable" | "sync-recovered" | "scene-ready" | "scene-fallback";
type Surface = "account" | "city" | "room" | "dispatch";

function consent(userId: string) {
  return consentKey + "." + userId;
}

export function diagnosticsEnabled(userId: string) {
  try { return window.localStorage.getItem(consent(userId)) === "true"; }
  catch { return false; }
}

export function setDiagnosticsEnabled(userId: string, enabled: boolean) {
  try {
    if (enabled) window.localStorage.setItem(consent(userId), "true");
    else window.localStorage.removeItem(consent(userId));
    return true;
  } catch { return false; }
}

export async function recordClientHealth(userId: string, event: HealthEvent, surface: Surface, elapsedMs?: number) {
  const client = getSupabase();
  if (!client || !diagnosticsEnabled(userId)) return;
  try {
    await client.from("client_health_events").insert({
      event_type: event,
      surface,
      release: /^[a-zA-Z0-9._-]{1,80}$/.test(build) ? build : "development",
      elapsed_ms: Number.isFinite(elapsedMs) ? Math.min(120_000, Math.max(0, Math.round(elapsedMs!))) : null,
    }).abortSignal(AbortSignal.timeout(3_000));
  } catch {
    // Diagnostic delivery must never affect study or syncing.
  }
}
