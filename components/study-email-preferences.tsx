"use client";

import { useEffect, useState } from "react";
import { getSupabase, supabaseConfigured } from "../lib/supabase/client";
import { useAccount } from "./account";

export function StudyEmailPreferences() {
  const { user } = useAccount();
  if (!supabaseConfigured) return null;

  return <section className="academy-panel" id="study-email" aria-labelledby="study-email-title">
    <h2 id="study-email-title">Study email reminders</h2>
    <p>Get an email when a 7-day review or a 7-day review lab opens. Reminders use progress saved to your account.</p>
    {user ? <ReminderSetting key={user.id} userId={user.id} /> : <p data-restore="progress">Sign in to manage your reminders.</p>}
  </section>;
}

function ReminderSetting({ userId }: { userId: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const client = getSupabase();
    if (!client) return;
    let active = true;
    async function load() {
      try {
        const { data, error } = await client!.from("study_email_preferences").select("user_id").eq("user_id", userId)
          .abortSignal(AbortSignal.timeout(6000)).maybeSingle();
        if (error) throw error;
        if (active) setEnabled(data !== null);
      } catch {
        if (active) setError("Could not load your email preference.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [userId, reload]);

  async function save(next: boolean) {
    const client = getSupabase();
    if (!client || saving || enabled === null) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const request = next
        ? client.from("study_email_preferences").upsert({ user_id: userId }, { ignoreDuplicates: true })
        : client.from("study_email_preferences").delete().eq("user_id", userId);
      const { error } = await request.abortSignal(AbortSignal.timeout(6000));
      if (error) throw error;
      setEnabled(next);
      setNotice(next ? "Study email reminders are on." : "Study email reminders are off.");
    } catch {
      setEnabled(null);
      setError("Could not confirm your email preference. Reload the setting to try again.");
    } finally {
      setSaving(false);
    }
  }

  return <>
    {loading ? <p role="status">Loading your email preference…</p> : enabled === null
      ? <button className="academy-button secondary" type="button" onClick={() => {
        setError("");
        setLoading(true);
        setReload((value) => value + 1);
      }}>Reload email preference</button>
      : <label className="account-diagnostics">
        <input type="checkbox" checked={enabled} disabled={saving} onChange={(event) => void save(event.currentTarget.checked)} />
        Email me when study activities are ready
      </label>}
    {saving && <p role="status">Saving your email preference…</p>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
  </>;
}
