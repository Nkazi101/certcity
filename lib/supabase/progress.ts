import {
  accountSaveKeys, announceCloudProgress, guestSaves, isProgressKey, readAccountSave, storeAccountSave,
} from "../progress-storage";
import type { AccountSave } from "../progress-storage";
import { dispatchProgressKey, parseDispatchPolicy } from "../shift";
import { getSupabase } from "./client";

export type ProgressConflict = { key: string; cloudValue: string };

function encode(key: string, value: string) {
  return key === "certcity.city.active-assignment.v1" ? JSON.stringify(value) : value;
}

function decode(key: string, payload: string) {
  if (key !== "certcity.city.active-assignment.v1") return payload;
  const value: unknown = JSON.parse(payload);
  return typeof value === "string" ? value : "";
}

export function queueGuestProgress(userId: string) {
  let count = 0;
  for (const { key, value } of guestSaves()) {
    if (readAccountSave(userId, key)) continue;
    storeAccountSave(userId, key, { value, pending: { base: null } });
    announceCloudProgress(key);
    count++;
  }
  return count;
}

export function resolveProgressConflict(userId: string, conflict: ProgressConflict, keepDevice: boolean) {
  const entry = readAccountSave(userId, conflict.key);
  if (!entry?.pending) return;
  if (keepDevice) {
    storeAccountSave(userId, conflict.key, { value: entry.value, pending: { base: conflict.cloudValue } });
  } else {
    storeAccountSave(userId, conflict.key, { value: conflict.cloudValue });
    announceCloudProgress(conflict.key);
  }
}

export async function syncProgress(userId: string, signal: AbortSignal) {
  const client = getSupabase();
  if (!client) throw new Error("Supabase is unavailable.");

  async function synchronize() {
    signal.throwIfAborted();
    const readSignal = AbortSignal.any([signal, AbortSignal.timeout(8000)]);
    const dispatchRequest = client!.from("simulation_runs").select("policy")
      .eq("user_id", userId).eq("track_id", "architect-foundations").eq("mission_id", "dispatch-lookup")
      .order("passed", { ascending: false }).order("committed_at", { ascending: false }).order("id", { ascending: false })
      .limit(1).abortSignal(readSignal).maybeSingle();
    const progressRequest = client!.from("learner_progress").select("save_key, payload, revision")
      .eq("user_id", userId).abortSignal(readSignal);
    const [savedProgress, dispatch] = await Promise.all([progressRequest, dispatchRequest]);
    if (savedProgress.error) throw savedProgress.error;
    if (dispatch.error) throw dispatch.error;
    signal.throwIfAborted();
    const rows = new Map(savedProgress.data.filter(({ save_key }) => isProgressKey(save_key))
      .map((row) => [row.save_key, row]));
    const dispatchPolicy = parseDispatchPolicy(dispatch.data?.policy);
    const conflicts: ProgressConflict[] = [];
    let retry = false;

    const keys = new Set([...accountSaveKeys(userId), ...rows.keys()]);
    if (dispatchPolicy) keys.add(dispatchProgressKey);
    for (const key of keys) {
      signal.throwIfAborted();
      const entry = readAccountSave(userId, key);
      if (key === dispatchProgressKey && dispatchPolicy) {
        const value = JSON.stringify(dispatchPolicy);
        if (entry?.value !== value || entry.pending) storeAccountSave(userId, key, { value });
        if (entry?.value !== value) announceCloudProgress(key);
        continue;
      }
      const row = rows.get(key);
      const cloudValue = row ? decode(key, row.payload) : null;

      if (!entry?.pending) {
        if (cloudValue !== null && entry?.value !== cloudValue) {
          storeAccountSave(userId, key, { value: cloudValue });
          announceCloudProgress(key);
        }
        continue;
      }
      if (cloudValue === entry.value) {
        storeAccountSave(userId, key, { value: entry.value });
        continue;
      }
      if (cloudValue !== null && cloudValue !== entry.pending.base) {
        conflicts.push({ key, cloudValue });
        continue;
      }

      const payload = encode(key, entry.value);
      const timeout = AbortSignal.any([signal, AbortSignal.timeout(8000)]);
      const saved = row
        ? await client!.from("learner_progress").update({ payload, revision: row.revision + 1 })
          .eq("user_id", userId).eq("save_key", key).eq("revision", row.revision).select("revision").abortSignal(timeout)
        : await client!.from("learner_progress").insert({ user_id: userId, save_key: key, payload })
          .select("revision").abortSignal(timeout);
      signal.throwIfAborted();
      if (saved.error && saved.error.code !== "23505") throw saved.error;
      if (!saved.data?.length) {
        retry = true;
        continue;
      }
      const latest = readAccountSave(userId, key);
      if (latest?.pending?.base === entry.pending.base) {
        const next: AccountSave = latest.value === entry.value
          ? { value: entry.value }
          : { value: latest.value, pending: { base: entry.value } };
        storeAccountSave(userId, key, next);
        retry ||= !!next.pending;
      }
    }
    return { conflicts, retry };
  }

  return navigator.locks
    ? navigator.locks.request(`certcity-sync-${userId}`, { signal }, synchronize)
    : synchronize();
}
