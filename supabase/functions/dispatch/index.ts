import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@supabase/supabase-js/cors";
import { meetsDispatchGoal, parseDispatchPolicy, runShift } from "../_shared/dispatch.ts";

const headers = { ...corsHeaders, "Cache-Control": "no-store" };
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const publicKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serverKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const authOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const authClient = createClient(supabaseUrl, publicKey, authOptions);
const database = createClient(supabaseUrl, serverKey, authOptions);

function respond(value: unknown, status = 200) {
  return Response.json(value, { status, headers });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return respond({ error: "Method not allowed." }, 405);

  const token = request.headers.get("Authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return respond({ error: "Sign in to save a cloud run." }, 401);
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user || user.is_anonymous) return respond({ error: "Sign in to save a cloud run." }, 401);

  let body;
  try {
    const reader = request.body?.getReader();
    if (!reader) return respond({ error: "Missing request." }, 400);
    const decoder = new TextDecoder();
    let text = "";
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        return respond({ error: "Request is too large." }, 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    body = JSON.parse(text + decoder.decode());
  } catch {
    return respond({ error: "Invalid request." }, 400);
  }

  if (body?.action === "study") {
    const operation = body.operation;
    const stage = body.stage;
    if (!["status", "start", "submit"].includes(operation) ||
        (operation !== "status" && !["first", "followup"].includes(stage))) {
      return respond({ error: "Invalid study check request." }, 400);
    }
    const { data, error } = await database.rpc("dispatch_study_check", {
      actor_id: user.id,
      operation,
      stage: stage ?? null,
      answers: operation === "submit" ? body.answers ?? null : null,
    });
    if (error) {
      console.error("Could not process Dispatch study check", error.code);
      return respond({ error: "Could not save your study progress. Try again." }, 500);
    }
    if (data.status === "invalid") return respond({ error: "Choose the requested number of answers for every question." }, 400);
    if (data.status === "shift_required") return respond({ error: "Save a successful Dispatch shift to your account first." }, 409);
    if (data.status === "not_due") return respond({ error: "The follow-up window has yet to open." }, 409);
    if (data.status === "start_required") return respond({ error: "Reopen the check to start your attempt." }, 409);
    return respond(data);
  }

  if (body?.action === "start") {
    const { data, error } = await database.rpc("start_dispatch_attempt", { actor_id: user.id });
    if (error) {
      console.error("Could not start Dispatch attempt", error.code);
      return respond({ error: "Could not open your saved shift." }, 500);
    }
    return respond({ id: data.id, revision: data.revision });
  }

  const policy = parseDispatchPolicy(body?.policy);
  if (body?.action !== "commit" || !policy || typeof body.attemptId !== "string" || !uuid.test(body.attemptId) ||
      typeof body.commandId !== "string" || !uuid.test(body.commandId) ||
      !Number.isSafeInteger(body.revision) || body.revision < 0) {
    return respond({ error: "Invalid shift policy or revision." }, 400);
  }
  const result = runShift(policy.contract, policy.routes);
  const requestHash = new Uint8Array(await crypto.subtle.digest("SHA-256",
    new TextEncoder().encode(JSON.stringify({ revision: body.revision, policy }))));
  const { data, error } = await database.rpc("commit_dispatch_run", {
    actor_id: user.id,
    target_attempt: body.attemptId,
    command: body.commandId,
    expected_revision: body.revision,
    request_hash: [...requestHash].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
    policy_snapshot: policy,
    result_summary: {
      calls: result.calls,
      falseNoMatches: result.falseNoMatches,
      staffMinutes: Math.round(result.staffHours * 60),
      directSpendMicros: Math.round(result.directSpend * 1_000_000),
    },
    goal_met: meetsDispatchGoal(result),
  });
  if (error) {
    console.error("Could not commit Dispatch run", error.code);
    return respond({ error: "Could not save your shift. Try again." }, 500);
  }
  if (data.status === "missing") return respond({ error: "Shift attempt is unavailable." }, 404);
  if (data.status === "command_conflict") return respond({ error: "This command ID already has a different policy." }, 409);
  if (data.status === "stale") return respond({ error: "A newer shift was saved. Try again to apply this policy.", revision: data.revision }, 409);
  return respond({ id: data.run.id, revision: data.run.committed_revision, passed: data.run.passed });
});
