"use client";

import { Flag } from "lucide-react";
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { TrackId } from "../../lib/claude/blueprints";
import type { ExamVersion } from "../../lib/claude/december-blueprints";
import { getSupabase } from "../../lib/supabase/client";
import { useAccount } from "../account";

export function QuestionReport({ trackId, version, itemId, revision, form }: {
  trackId: TrackId; version: ExamVersion; itemId: string; revision?: string; form?: string;
}) {
  const { user } = useAccount();
  const [type, setType] = useState("accuracy");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const receipt = useRef<string | null>(null);
  const include = { track_id: trackId, guide: version, item_id: itemId, form: form ?? null, content_revision: revision ?? null, report_type: type, details: details.trim() };
  const canSend = !!user && !!getSupabase();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || saved || details.trim().length < 10) return;
    const client = getSupabase();
    setBusy(true);
    setMessage("");
    if (canSend && client) {
      try {
        const id = receipt.current ?? (receipt.current = crypto.randomUUID());
        const { error } = await client.from("practice_item_reports").insert({ id, ...include }).abortSignal(AbortSignal.timeout(6000));
        if (error && error.code !== "23505") throw error;
        setSaved(true);
        setMessage("Report received. Reference " + id + ".");
      } catch {
        setMessage("Sending is unavailable. Your note is still here and you can download a copy.");
      } finally {
        setBusy(false);
      }
      return;
    }
    download();
    setBusy(false);
  }

  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(include, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "certcity-question-report.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <details className="academy-item-report">
    <summary><Flag size={15} aria-hidden="true" /> Report this question</summary>
    <form onSubmit={(event) => { void submit(event); }}>
      <label>What needs review?
        <select value={type} disabled={saved || busy} onChange={(event) => setType(event.target.value)}>
          <option value="accuracy">Accuracy or answer key</option>
          <option value="clarity">Unclear wording</option>
          <option value="accessibility">Accessibility</option>
          <option value="other">Something else</option>
        </select>
      </label>
      <label>Describe the issue
        <textarea rows={3} required minLength={10} maxLength={1200} value={details} disabled={saved || busy}
          onChange={(event) => setDetails(event.target.value)} />
      </label>
      <p>The report includes the question ID, exam guide and content revision. Use fictional examples and leave personal details out.</p>
      {!canSend && <p>Sign in to send a report from CertCity. You can download the report from this session.</p>}
      <div className="academy-actions">
        <button className="academy-button secondary" disabled={busy || saved || details.trim().length < 10}>{canSend ? "Send report" : "Download report"}</button>
        {canSend && !saved && <button className="academy-button text" type="button" onClick={download} disabled={details.trim().length < 10}>Download a copy</button>}
      </div>
      {message && <p role="status">{message}</p>}
    </form>
  </details>;
}
