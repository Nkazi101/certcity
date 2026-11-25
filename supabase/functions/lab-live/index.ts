// "Try it with real Claude" for labs. A signed-in learner's artifact for an allowlisted lab is turned into Messages
// API calls by labs.ts (server-side fixtures, fixed model and limits), sent with the server's ANTHROPIC_API_KEY, and the
// real reply comes back next to the simulator's. Grading never reads this output. Learner files and model replies are
// never logged or stored; only a run count per learner per day is (certcity_private.lab_live_usage).
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@supabase/supabase-js/cors";
import { CALL_TIMEOUT_MS, DAILY_LIMIT, GLOBAL_DAILY_LIMIT, LIVE_MODEL, MAX_BODY_BYTES } from "./config.ts";
import { buildLiveRun, liveLabs } from "./labs.ts";
import type { LiveCall } from "./labs.ts";

const headers = { ...corsHeaders, "Cache-Control": "no-store" };
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const authOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, authOptions);
const database = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, authOptions);
const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
const anthropic = apiKey ? new Anthropic({ apiKey, timeout: CALL_TIMEOUT_MS, maxRetries: 1 }) : null;

type Usage = { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number };
type Reply =
  | { label: string; kind: "reply"; text: string; toolCalls: { name: string; input: unknown }[]; stopReason: string | null; refusalCategory: string | null }
  | { label: string; kind: "rejected"; status: number; message: string };

/** The provider, not the learner's request, made the run fail: the run is given back. */
class ProviderFailure extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function respond(value: unknown, status = 200) {
  return Response.json(value, { status, headers });
}

const isObj = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function apiMessage(error: InstanceType<typeof Anthropic.APIError>) {
  const body = error.error as { error?: { message?: unknown } } | undefined;
  const message = typeof body?.error?.message === "string" ? body.error.message : error.message;
  return message.slice(0, 600);
}

async function call(entry: LiveCall): Promise<{ reply: Reply; usage: Usage | null; model: string | null }> {
  try {
    const message = await anthropic!.messages.create({
      model: LIVE_MODEL,
      max_tokens: entry.maxTokens,
      // No thinking: replies stay quick and cheap, a learner's small max_tokens truncates the answer itself, and a
      // replayed tool_use turn needs no thinking block.
      thinking: { type: "disabled" },
      output_config: { effort: "medium" },
      ...(entry.system && { system: entry.system }),
      messages: entry.messages,
      ...(entry.tools && { tools: entry.tools }),
      ...(entry.toolChoice && { tool_choice: entry.toolChoice }),
    });
    const details = (message as unknown as { stop_details?: { category?: string | null } | null }).stop_details;
    return {
      reply: {
        label: entry.label, kind: "reply",
        text: message.content.flatMap((block) => block.type === "text" ? [block.text] : []).join("\n\n"),
        toolCalls: message.content.flatMap((block) => block.type === "tool_use" ? [{ name: block.name, input: block.input }] : []),
        stopReason: message.stop_reason,
        refusalCategory: message.stop_reason === "refusal" ? details?.category ?? null : null,
      },
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
      },
      model: message.model,
    };
  } catch (error) {
    // Most specific first. Only status and error class are logged, never request or reply content.
    if (error instanceof Anthropic.BadRequestError || error instanceof Anthropic.UnprocessableEntityError) {
      return { reply: { label: entry.label, kind: "rejected", status: error.status, message: apiMessage(error) }, usage: null, model: null };
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new ProviderFailure(503, "Claude is handling too many requests right now. Try again in a minute; this try did not count.");
    }
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      throw new ProviderFailure(504, "Claude took too long to answer. Try again; this try did not count.");
    }
    if (error instanceof Anthropic.APIConnectionError) {
      throw new ProviderFailure(502, "Could not reach Claude. Try again; this try did not count.");
    }
    if (error instanceof Anthropic.InternalServerError) {
      console.error("lab-live provider error", error.status);
      throw new ProviderFailure(503, error.status === 529
        ? "Claude is overloaded right now. Try again in a minute; this try did not count."
        : "Claude had a temporary problem. Try again; this try did not count.");
    }
    if (error instanceof Anthropic.APIError) {
      if (error.status === 413) {
        return { reply: { label: entry.label, kind: "rejected", status: 413, message: apiMessage(error) }, usage: null, model: null };
      }
      console.error("lab-live configuration error", error.status, error.name);
      throw new ProviderFailure(503, "Live runs are unavailable right now. The checks above still work.");
    }
    throw error;
  }
}

async function readBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new RangeError("missing");
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new RangeError("too large");
    }
    text += decoder.decode(value, { stream: true });
  }
  return JSON.parse(text + decoder.decode());
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return respond({ error: "Method not allowed." }, 405);

  const token = request.headers.get("Authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  const signedOut = { error: "Sign in to try it with real Claude.", signedOut: true };
  if (!token) return respond(signedOut, 401);
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user || user.is_anonymous) return respond(signedOut, 401);

  let body: unknown;
  try {
    body = await readBody(request);
  } catch (error) {
    if (error instanceof RangeError && error.message === "too large") return respond({ error: "Your files are too large to send. Shorten them and try again." }, 413);
    return respond({ error: "Invalid request." }, 400);
  }
  if (!isObj(body)) return respond({ error: "Invalid request." }, 400);

  if (body.action === "status") {
    const { data, error } = await database.rpc("lab_live_runs_today", { actor_id: user.id });
    if (error) {
      console.error("Could not read live-run usage", error.code);
      return respond({ error: "Could not check today’s live runs." }, 500);
    }
    return respond({ enabled: !!anthropic, limit: DAILY_LIMIT, remaining: Math.max(0, DAILY_LIMIT - Number(data ?? 0)), model: LIVE_MODEL });
  }
  if (body.action !== "run") return respond({ error: "Invalid request." }, 400);

  const labId = body.labId;
  if (typeof labId !== "string" || !Object.hasOwn(liveLabs, labId)) return respond({ error: "This lab has no live runs." }, 400);
  const lab = liveLabs[labId];
  const fixtureId = body.fixtureId;
  if (typeof fixtureId !== "string" || !lab.fixtures.includes(fixtureId)) return respond({ error: "Unknown case for this lab." }, 400);
  const files = body.files;
  if (!isObj(files)) return respond({ error: "Invalid request." }, 400);
  const accepted: Record<string, string> = {};
  for (const [id, value] of Object.entries(files)) {
    if (!Object.hasOwn(lab.artifacts, id) || typeof value !== "string") return respond({ error: "This file cannot be sent to Claude from this lab." }, 400);
    if (value.length > lab.artifacts[id].maxChars) {
      return respond({ error: `${lab.artifacts[id].path} is longer than ${lab.artifacts[id].maxChars.toLocaleString("en-US")} characters, the live-run limit. Shorten it and try again.` }, 413);
    }
    accepted[id] = value;
  }
  const built = buildLiveRun(lab, accepted, fixtureId);
  if (!built.ok) return respond({ error: built.error }, 422);
  if (!anthropic) return respond({ error: "Live runs are not set up on this site yet. The checks above still work." }, 503);

  const { data: claimRows, error: claimError } = await database.rpc("claim_lab_live_run", {
    actor_id: user.id, daily_limit: DAILY_LIMIT, global_limit: GLOBAL_DAILY_LIMIT,
  });
  const claim = (Array.isArray(claimRows) ? claimRows[0] : claimRows) as { status?: string; used?: number } | null;
  if (claimError || !claim?.status) {
    console.error("Could not claim a live run", claimError?.code);
    return respond({ error: "Could not start a live run. Try again." }, 500);
  }
  const used = Number(claim.used ?? 0);
  if (claim.status === "limit") {
    return respond({ error: `You have used today’s ${DAILY_LIMIT} live runs. They reset at 00:00 UTC.`, remaining: 0, limit: DAILY_LIMIT }, 429);
  }
  if (claim.status === "busy") {
    return respond({ error: "Live runs have reached today’s limit for the whole site. Try again tomorrow; the checks above still work.",
      remaining: Math.max(0, DAILY_LIMIT - used), limit: DAILY_LIMIT }, 503);
  }

  let results: Awaited<ReturnType<typeof call>>[];
  try {
    results = await Promise.all(built.calls.map(call));
  } catch (error) {
    const { error: releaseError } = await database.rpc("release_lab_live_run", { actor_id: user.id });
    if (releaseError) console.error("Could not release a live run", releaseError.code);
    const remaining = Math.max(0, DAILY_LIMIT - used + (releaseError ? 0 : 1));
    if (error instanceof ProviderFailure) return respond({ error: error.message, remaining, limit: DAILY_LIMIT, retryable: true }, error.status);
    console.error("lab-live failed", error instanceof Error ? error.name : "unknown");
    return respond({ error: "The live run failed. Try again; this try did not count.", remaining, limit: DAILY_LIMIT, retryable: true }, 500);
  }

  const usage: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  for (const result of results) {
    if (!result.usage) continue;
    usage.inputTokens += result.usage.inputTokens;
    usage.outputTokens += result.usage.outputTokens;
    usage.cacheReadTokens += result.usage.cacheReadTokens;
    usage.cacheWriteTokens += result.usage.cacheWriteTokens;
  }
  return respond({
    model: results.find((result) => result.model)?.model ?? LIVE_MODEL,
    replies: results.map(({ reply }) => reply),
    usage,
    notes: built.notes,
    remaining: Math.max(0, DAILY_LIMIT - used),
    limit: DAILY_LIMIT,
  });
});
