import { readProgressItem, writeProgressItem } from "./progress-storage";
import { parseDispatchPolicy } from "../supabase/functions/_shared/dispatch";
import type { DispatchPolicy } from "../supabase/functions/_shared/dispatch";

export * from "../supabase/functions/_shared/dispatch";

// Naming: `runShift` / `baselineShift` simulate the lookup mission's *replay week* (1,000 requests). Learners only see
// that name; "shift" in copy means the daily counter shift in lib/shifts. The identifiers stay to keep saves and the
// shared Supabase function stable.

/** True when a saved lookup design still answers a carrier timeout with "no match". */
export function timeoutsReadAsNoMatch(policy: DispatchPolicy | null) {
  return !!policy && (policy.contract === "baseline" || (policy.contract === "typed" && policy.routes.timeout === "noMatch"));
}

// Keep the original key so existing city saves survive the rename.
export const dispatchProgressKey = "simza.city-dispatch.v1";

export function readDispatch(): DispatchPolicy | null {
  try {
    return parseDispatchPolicy(JSON.parse(readProgressItem(dispatchProgressKey) ?? "null"));
  } catch {
    return null;
  }
}

export function saveDispatch(policy: DispatchPolicy) {
  try {
    return writeProgressItem(dispatchProgressKey, JSON.stringify(policy));
  } catch {
    return false;
  }
}
