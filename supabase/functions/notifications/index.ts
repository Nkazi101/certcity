import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { sendNotification } from "./email.ts";
import type { Notification } from "./email.ts";

const workerToken = Deno.env.get("NOTIFICATIONS_WORKER_TOKEN");
const resendKey = Deno.env.get("RESEND_API_KEY");
const site = new URL(Deno.env.get("NOTIFICATIONS_SITE_URL") || "https://certcity.org");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const projectUrl = new URL(supabaseUrl);
const database = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(4000) }) },
});
const encoder = new TextEncoder();

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  if (!workerToken || !resendKey) return new Response(null, { status: 503 });
  const expected = encoder.encode(`Bearer ${workerToken}`);
  const supplied = encoder.encode(request.headers.get("Authorization") ?? "");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    return new Response(null, { status: 401 });
  }

  const { data, error } = await database.rpc("claim_notification_emails");
  if (error || !Array.isArray(data)) {
    console.error("Could not claim notification emails", error?.code);
    return new Response(null, { status: 500 });
  }

  let sent = 0;
  let failed = 0;
  const jobs: Notification[] = data;
  for (const job of jobs) {
    const startedAt = Date.now();
    try {
      const id = await sendNotification(resendKey, job, site, projectUrl);
      const { error } = await database.rpc("mark_notification_email_sent", {
        target_id: job.delivery_id,
        claim_attempt: job.attempts,
        resend_id: id,
      });
      if (error) throw new Error(`Delivery update failed (${error.code})`);
      sent++;
    } catch (error) {
      failed++;
      console.error("Notification email failed", job.delivery_id, job.attempts, error instanceof Error ? error.message : "Unknown error");
    }
    // Keep batches within the provider's request rate when sends resolve quickly.
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, 550 - (Date.now() - startedAt))));
  }

  return Response.json({ sent, failed });
});
