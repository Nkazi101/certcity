// Optional "Try it with real Claude" for labs. After the deterministic checks run, a signed-in learner can send their
// artifact to the lab-live Edge Function, which builds the request server-side from the lab's own fixture and calls a
// real Claude model. Grading never reads the reply: it is for seeing how the real model behaves, not for scoring.
import { FunctionsHttpError } from "@supabase/supabase-js";
import { getSupabase, supabaseConfigured } from "../supabase/client";
import type { AnyLabMission, LabFiles } from "./types";

/**
 * Labs that support live runs, and which of their artifacts are sent. Mirrors supabase/functions/lab-live/labs.ts,
 * which refuses any other lab or file. Only prompt- and instruction-shaped artifacts qualify:
 * - permit-agent: request.json is a Messages request; real Claude answers the follow-up turn it builds.
 * - vendor-batch-api: prompt.json is a system prompt with few-shot examples (batch.json supplies max_tokens).
 * - printworks-ci: ci/criteria.md instructs a reviewer (ci/review-schema.json shapes the reply).
 * Not live: enrollment-replies (a checklist people apply), community-handoff and repair-shop-tools (settings, hooks and
 * MCP config that the simulator executes; a model reply would not show what they do).
 */
export const liveLabArtifacts: Readonly<Record<string, readonly string[]>> = {
  "permit-agent": ["request"],
  "vendor-batch-api": ["prompt", "batch"],
  "printworks-ci": ["criteria", "schema"],
};

export type LiveReply =
  | { label: string; kind: "reply"; text: string; toolCalls: readonly { name: string; input: unknown }[]; stopReason: string | null; refusalCategory: string | null }
  /** The Messages API refused the request itself (for example a tool_use with no tool_result). A real outcome, not an outage. */
  | { label: string; kind: "rejected"; status: number; message: string };
export type LiveUsage = { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number };
export type LiveResult =
  | { ok: true; model: string; replies: readonly LiveReply[]; usage: LiveUsage; notes: readonly string[]; remaining: number; limit: number }
  | { ok: false; error: string; signedOut?: boolean; retryable?: boolean; remaining?: number; limit?: number };
export type LiveStatus = { enabled: boolean; limit: number; remaining: number; model: string };

export function liveSupported(lab: AnyLabMission | string) {
  return Object.hasOwn(liveLabArtifacts, typeof lab === "string" ? lab : lab.id);
}

/** Only the allowlisted artifacts of a lab, so nothing else the learner wrote leaves the browser. */
export function liveFiles(labId: string, files: LabFiles): Record<string, string> {
  const ids = Object.hasOwn(liveLabArtifacts, labId) ? liveLabArtifacts[labId] : [];
  return Object.fromEntries(ids.filter((id) => typeof files[id] === "string").map((id) => [id, files[id]]));
}

/** Supabase is configured and a signed-in (non-anonymous) learner has a session in this browser. */
export async function liveAvailable() {
  const client = getSupabase();
  if (!supabaseConfigured || !client) return false;
  try {
    const { data } = await client.auth.getSession();
    return !!data.session?.user && !data.session.user.is_anonymous;
  } catch {
    return false;
  }
}

const isObj = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const count = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;

async function failure(error: unknown, fallback: string): Promise<Extract<LiveResult, { ok: false }>> {
  if (error instanceof FunctionsHttpError) {
    const response: Response = error.context;
    const body: unknown = await response.json().catch(() => null);
    if (isObj(body) && typeof body.error === "string") {
      return {
        ok: false, error: body.error,
        ...(response.status === 401 && { signedOut: true }),
        ...(body.retryable === true && { retryable: true }),
        ...(typeof body.remaining === "number" && { remaining: body.remaining }),
        ...(typeof body.limit === "number" && { limit: body.limit }),
      };
    }
  }
  return { ok: false, error: fallback, retryable: true };
}

function reply(value: unknown): LiveReply | null {
  if (!isObj(value) || typeof value.label !== "string") return null;
  if (value.kind === "rejected") {
    return { label: value.label, kind: "rejected", status: count(value.status), message: typeof value.message === "string" ? value.message : "" };
  }
  if (value.kind !== "reply") return null;
  return {
    label: value.label, kind: "reply",
    text: typeof value.text === "string" ? value.text : "",
    toolCalls: Array.isArray(value.toolCalls) ? value.toolCalls.filter(isObj).map((call) => ({ name: String(call.name ?? ""), input: call.input })) : [],
    stopReason: typeof value.stopReason === "string" ? value.stopReason : null,
    refusalCategory: typeof value.refusalCategory === "string" ? value.refusalCategory : null,
  };
}

/** Today's allowance. null when live runs cannot be reached (signed out, offline, or the function is not deployed). */
export async function liveStatus(signal?: AbortSignal): Promise<LiveStatus | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.functions.invoke<unknown>("lab-live", { body: { action: "status" }, signal, timeout: 10_000 });
    if (error || !isObj(data)) return null;
    return { enabled: data.enabled === true, limit: count(data.limit), remaining: count(data.remaining), model: typeof data.model === "string" ? data.model : "" };
  } catch {
    return null;
  }
}

/** Sends the lab's allowlisted artifacts for one of its fixtures to real Claude. Never throws. */
export async function runLive(labId: string, files: LabFiles, fixtureId: string, signal?: AbortSignal): Promise<LiveResult> {
  const fallback = "Could not reach real Claude. Try again.";
  if (!liveSupported(labId)) return { ok: false, error: "This lab has no live runs." };
  const client = getSupabase();
  if (!client) return { ok: false, error: "Live runs are unavailable on this site." };
  try {
    const { data, error } = await client.functions.invoke<unknown>("lab-live", {
      body: { action: "run", labId, fixtureId, files: liveFiles(labId, files) },
      signal,
      // The function waits up to about 50 s for the model (one retry); allow for that plus the network.
      timeout: 65_000,
    });
    if (error) return failure(error, fallback);
    if (!isObj(data) || !Array.isArray(data.replies)) return { ok: false, error: fallback, retryable: true };
    const usage = isObj(data.usage) ? data.usage : {};
    return {
      ok: true,
      model: typeof data.model === "string" ? data.model : "",
      replies: data.replies.map(reply).filter((entry): entry is LiveReply => entry !== null),
      usage: { inputTokens: count(usage.inputTokens), outputTokens: count(usage.outputTokens), cacheReadTokens: count(usage.cacheReadTokens), cacheWriteTokens: count(usage.cacheWriteTokens) },
      notes: Array.isArray(data.notes) ? data.notes.filter((note): note is string => typeof note === "string") : [],
      remaining: count(data.remaining),
      limit: count(data.limit),
    };
  } catch (error) {
    if (signal?.aborted) return { ok: false, error: "Cancelled." };
    return failure(error, fallback);
  }
}
