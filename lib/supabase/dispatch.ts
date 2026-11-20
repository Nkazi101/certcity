import { FunctionsHttpError } from "@supabase/supabase-js";
import type { DispatchPolicy } from "../shift";
import { getSupabase } from "./client";

type Attempt = { id: string; revision: number };
export type DispatchCommand = { attempt: Attempt; id: string; policy: DispatchPolicy };

export async function openDispatchAttempt() {
  const client = getSupabase();
  if (!client) throw new Error("Cloud saves are unavailable.");
  const { data, error } = await client.functions.invoke<Attempt>("dispatch", { body: { action: "start" } });
  if (error || !data) throw new Error("Could not connect to your saved shift. Try again.");
  return data;
}

export async function saveDispatchRun(command: DispatchCommand) {
  const client = getSupabase();
  if (!client) return { error: "Cloud saves are unavailable.", conflict: false };
  const { error } = await client.functions.invoke("dispatch", {
    body: {
      action: "commit",
      attemptId: command.attempt.id,
      revision: command.attempt.revision,
      commandId: command.id,
      policy: command.policy,
    },
  });
  if (!error) return { error: null, conflict: false };
  if (error instanceof FunctionsHttpError) {
    const response: Response = error.context;
    const message = await response.json().catch(() => null);
    if (typeof message?.error === "string") return { error: message.error, conflict: response.status === 409 };
  }
  return { error: "Could not save your shift. Try again.", conflict: false };
}
