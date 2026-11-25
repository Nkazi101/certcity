"use client";

import { CircleAlert, LoaderCircle, Sparkles, Wrench } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { supabaseConfigured } from "../../lib/supabase/client";
import { liveFiles, liveStatus, liveSupported, runLive } from "../../lib/labs/live";
import type { LiveReply, LiveResult } from "../../lib/labs/live";
import type { AnyLabMission, LabFiles } from "../../lib/labs/types";
import { useAccount } from "../account";
import styles from "./live-run.module.css";

const numbers = new Intl.NumberFormat("en-US");

function stopNote(reply: Extract<LiveReply, { kind: "reply" }>) {
  if (reply.stopReason === "max_tokens") return "Stopped at max_tokens: the answer was cut off.";
  if (reply.stopReason === "refusal") return `Claude declined this request (stop_reason: refusal${reply.refusalCategory ? `, ${reply.refusalCategory}` : ""}).`;
  if (reply.stopReason === "tool_use") return "Claude stopped to ask for the tool calls above (stop_reason: tool_use).";
  return null;
}

function ReplyView({ reply }: { reply: LiveReply }) {
  if (reply.kind === "rejected") {
    return <article className={styles.reply} data-kind="rejected">
      <h5>{reply.label}</h5>
      <p className={styles.rejected}><CircleAlert size={15} aria-hidden="true" />The API rejected this request ({reply.status}): {reply.message || "no message."}</p>
    </article>;
  }
  const note = stopNote(reply);
  return <article className={styles.reply}>
    <h5>{reply.label}</h5>
    {reply.text ? <pre className={styles.text} tabIndex={0}>{reply.text}</pre> : !reply.toolCalls.length && <p className={styles.muted}>No text in the reply.</p>}
    {reply.toolCalls.length > 0 && <ul className={styles.tools} aria-label="Tool calls Claude asked for">
      {reply.toolCalls.map((call, index) => <li key={index}>
        <Wrench size={14} aria-hidden="true" /><span>Asks to call <code>{call.name}</code> <code className={styles.input}>{JSON.stringify(call.input)}</code></span>
      </li>)}
    </ul>}
    {reply.toolCalls.length > 0 && <p className={styles.muted}>Tool calls are shown, not run.</p>}
    {note && <p className={styles.stop} data-stop={reply.stopReason}>{note}</p>}
  </article>;
}

/** "Try it with real Claude": sends the learner's artifact for the current fixture to a live model, next to the simulator. */
export function LiveRun({ lab, files, fixtureId }: { lab: AnyLabMission; files: LabFiles; fixtureId: string }) {
  const { user, ready } = useAccount();
  const headingId = useId();
  const [status, setStatus] = useState<{ enabled: boolean; remaining: number; limit: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ key: string; value: LiveResult } | null>(null);
  const running = useRef<AbortController | null>(null);
  const supported = supabaseConfigured && liveSupported(lab);
  const userId = user && !user.is_anonymous ? user.id : null;
  const key = JSON.stringify([lab.id, fixtureId, liveFiles(lab.id, files)]);

  useEffect(() => {
    if (!supported || !userId) return;
    const controller = new AbortController();
    void liveStatus(controller.signal).then((value) => {
      if (!controller.signal.aborted && value) setStatus({ enabled: value.enabled, remaining: value.remaining, limit: value.limit });
    });
    return () => controller.abort();
  }, [supported, userId]);

  useEffect(() => () => running.current?.abort(), []);

  if (!supported || !ready || status?.enabled === false) return null;

  if (!userId) {
    return <section className={styles.panel} aria-labelledby={headingId}>
      <h4 id={headingId}><Sparkles size={16} aria-hidden="true" />Try it with real Claude</h4>
      <p className={styles.muted}>Sign in to try it with real Claude. Your grade always comes from the checks.</p>
    </section>;
  }

  async function run() {
    if (busy) return;
    const controller = new AbortController();
    running.current?.abort();
    running.current = controller;
    setBusy(true);
    const sentKey = key;
    const value = await runLive(lab.id, files, fixtureId, controller.signal);
    if (controller.signal.aborted) return;
    running.current = null;
    setBusy(false);
    setResult({ key: sentKey, value });
    const { remaining, limit } = value;
    if (typeof remaining === "number" && typeof limit === "number" && limit > 0) setStatus({ enabled: true, remaining, limit });
  }

  const shown = result?.value;
  const stale = !!result && result.key !== key;
  const outOfRuns = status?.remaining === 0;

  return <section className={styles.panel} aria-labelledby={headingId} aria-busy={busy}>
    <h4 id={headingId}><Sparkles size={16} aria-hidden="true" />Try it with real Claude</h4>
    <div className={styles.actions}>
      <button type="button" className="button button-outline" onClick={() => { void run(); }} disabled={busy || outOfRuns}>
        {busy ? <LoaderCircle size={16} aria-hidden="true" className={styles.spin} /> : <Sparkles size={16} aria-hidden="true" />}
        {busy ? "Asking Claude…" : shown?.ok ? "Try again with real Claude" : "Try it with real Claude"}
      </button>
      {status && status.limit > 0 && <span className={styles.allowance}>{numbers.format(status.remaining)} of {numbers.format(status.limit)} live runs left today</span>}
    </div>
    <p className={styles.honest}>Real Claude may answer differently each time; your grade comes from the checks above.</p>

    <div role="status" className={styles.live}>
      {busy ? "Sending your files to real Claude." : shown?.ok ? `Real Claude replied${shown.replies.length > 1 ? ` to ${shown.replies.length} requests` : ""}.` : ""}
    </div>

    {shown && !shown.ok && !busy && <p className={styles.error} role="alert"><CircleAlert size={15} aria-hidden="true" />{shown.error}</p>}
    {shown?.ok && <div className={styles.result}>
      {stale && <p className={styles.stale}>Your files or the scenario changed since this reply. Try again to see what real Claude does with them now.</p>}
      {shown.replies.map((reply, index) => <ReplyView key={index} reply={reply} />)}
      <p className={styles.usage}>
        {shown.model && <><code>{shown.model}</code> · </>}
        {numbers.format(shown.usage.inputTokens)} input + {numbers.format(shown.usage.outputTokens)} output tokens
        {shown.usage.cacheReadTokens > 0 && <> · {numbers.format(shown.usage.cacheReadTokens)} read from cache</>}
        {shown.usage.cacheWriteTokens > 0 && <> · {numbers.format(shown.usage.cacheWriteTokens)} written to cache</>}
      </p>
      {shown.notes.length > 0 && <details className={styles.notes}>
        <summary>What was sent</summary>
        <ul>{shown.notes.map((note) => <li key={note}>{note}</li>)}</ul>
      </details>}
    </div>}
  </section>;
}
