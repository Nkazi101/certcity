import { FunctionsHttpError } from "@supabase/supabase-js";
import type { CheckStage } from "../certification";
import type { SkillAttempt } from "../certification-progress";
import { getSupabase } from "./client";

export type DispatchStudy = {
  eligible: boolean;
  first: SkillAttempt | null;
  followup: SkillAttempt | null;
  dueAt: number | null;
};

export async function dispatchStudyRequest<T>(
  operation: "status" | "start" | "submit",
  stage?: CheckStage,
  answers?: SkillAttempt["answers"],
  signal?: AbortSignal,
): Promise<{ data: T; error: null } | { data: null; error: string }> {
  const client = getSupabase();
  const fallback = "Could not reach your study progress. Try again.";
  if (!client) return { data: null, error: fallback };
  const { data, error } = await client.functions.invoke<T>("dispatch", {
    body: { action: "study", operation, stage, answers },
    signal,
    timeout: 10000,
  });
  if (!error && data) return { data, error: null };
  if (error instanceof FunctionsHttpError) {
    const message = await error.context.json().catch(() => null);
    if (typeof message?.error === "string") return { data: null, error: message.error };
  }
  return { data: null, error: fallback };
}
