// The one place the live-run model and its limits are set. The client never chooses a model, a system prompt or a
// token budget: labs.ts builds every request from the lab's fixture and the learner's files, within these bounds.

/** A current fast, low-cost model. Change it here only. */
export const LIVE_MODEL = "claude-haiku-5-5";
/** Upper bound on output tokens per model call. A learner's own smaller max_tokens is honoured (it is part of the lesson). */
export const MAX_OUTPUT_TOKENS = 1024;
/** Per model call. The SDK retries once, so one call waits at most about twice this. */
export const CALL_TIMEOUT_MS = 25_000;
/** Largest request body the function reads. */
export const MAX_BODY_BYTES = 64 * 1024;

function envLimit(name: string, fallback: number, max: number) {
  const value = Number.parseInt(Deno.env.get(name) ?? "", 10);
  return Number.isSafeInteger(value) && value > 0 ? Math.min(value, max) : fallback;
}
/** Runs per learner per UTC day. */
export const DAILY_LIMIT = envLimit("LAB_LIVE_DAILY_LIMIT", 20, 200);
/** Runs per UTC day across every learner: a spend ceiling for the whole site. */
export const GLOBAL_DAILY_LIMIT = envLimit("LAB_LIVE_GLOBAL_DAILY_LIMIT", 2000, 100_000);
