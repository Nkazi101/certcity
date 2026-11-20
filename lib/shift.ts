import { readProgressItem, writeProgressItem } from "./progress-storage";
import { parseDispatchPolicy } from "../supabase/functions/_shared/dispatch";
import type { DispatchPolicy } from "../supabase/functions/_shared/dispatch";

export * from "../supabase/functions/_shared/dispatch";

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
