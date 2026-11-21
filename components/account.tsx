"use client";

import { CloudAlert, UserRound, X } from "lucide-react";
import { createContext, Fragment, useContext, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { diagnosticsEnabled, recordClientHealth, setDiagnosticsEnabled } from "../lib/client-health";
import { guestSaves, setProgressUser, subscribeToProgress } from "../lib/progress-storage";
import { downloadProgressBackup } from "../lib/progress-recovery";
import { getSupabase, supabaseConfigured } from "../lib/supabase/client";
import { queueGuestProgress, resolveProgressConflict, syncProgress } from "../lib/supabase/progress";
import type { ProgressConflict } from "../lib/supabase/progress";

type SyncState = "loading" | "synced" | "offline";
const AccountContext = createContext({
  user: null as User | null,
  ready: !supabaseConfigured,
  syncState: "loading" as SyncState,
  conflicts: [] as ProgressConflict[],
  sync: () => {},
});

export function useAccount() {
  return useContext(AccountContext);
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!supabaseConfigured);
  const [syncState, setSyncState] = useState<SyncState>("loading");
  const [conflicts, setConflicts] = useState<ProgressConflict[]>([]);
  const schedule = useRef<() => void>(() => {});
  const userId = user?.id ?? null;

  useEffect(() => {
    const client = getSupabase();
    if (!client) return;
    let currentId: string | null = null;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      const next = session?.user ?? null;
      const nextId = next?.id ?? null;
      if (nextId !== currentId) {
        currentId = nextId;
        setProgressUser(nextId);
        setSyncState("loading");
        setConflicts([]);
      }
      setUser(next);
      setAuthReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    let timer: number | undefined;
    let working = false;
    let pending = false;
    let delay = 3000;
    let offlineSince: number | null = null;

    function queue(wait = 350) {
      if (controller.signal.aborted) return;
      if (working) {
        pending = true;
        return;
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(run, wait);
    }

    async function run() {
      if (!userId || controller.signal.aborted) return;
      working = true;
      let nextDelay: number | null = null;
      try {
        const result = await syncProgress(userId, controller.signal);
        if (controller.signal.aborted) return;
        setConflicts(result.conflicts);
        setSyncState("synced");
        if (offlineSince !== null) {
          const outageDuration = Date.now() - offlineSince;
          void recordClientHealth(userId, "sync-unavailable", "account", outageDuration);
          void recordClientHealth(userId, "sync-recovered", "account", outageDuration);
          offlineSince = null;
        }
        delay = 3000;
        if (result.retry) nextDelay = 350;
      } catch {
        if (controller.signal.aborted) return;
        setSyncState("offline");
        offlineSince ??= Date.now();
        nextDelay = delay;
        delay = Math.min(delay * 2, 60000);
      } finally {
        working = false;
        const wait = pending ? 350 : nextDelay;
        pending = false;
        if (wait !== null) queue(wait);
      }
    }

    const refresh = () => queue();
    const unsubscribe = subscribeToProgress((_key, local) => { if (local) refresh(); });
    schedule.current = refresh;
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    queue(0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      schedule.current = () => {};
      unsubscribe();
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [userId]);

  const ready = authReady && (!user || syncState !== "loading");
  return <AccountContext.Provider value={{ user, ready, syncState, conflicts, sync: () => schedule.current() }}>
    <Fragment key={userId ?? "guest"}>{children}</Fragment>
  </AccountContext.Provider>;
}

function conflictLabel(key: string) {
  if (key === "simza.city-dispatch.v1") return "City Dispatch shift";
  if (key === "simza.ccar-f.task-2.2.v1") return "City Dispatch certification progress";
  if (key === "certcity.city.active-assignment.v1") return "Active certification pathway";
  const parts = key.split(".");
  if (key.startsWith("certcity.practice.")) return `${parts[2]} exam practice`;
  return parts.at(-1)?.replace(/-/g, " ") ?? key;
}

export function AccountButton({ city = false }: { city?: boolean }) {
  const { user, ready, syncState, conflicts, sync } = useAccount();
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const inputId = useId();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [canImport, setCanImport] = useState(false);
  const [diagnostics, setDiagnostics] = useState(false);
  const hasIssue = !!user && (syncState === "offline" || conflicts.length > 0);

  if (!supabaseConfigured) return null;

  function openAccount() {
    setError("");
    setNotice("");
    setCanImport(guestSaves().length > 0);
    setDiagnostics(user ? diagnosticsEnabled(user.id) : false);
    if (user) sync();
    dialog.current?.showModal();
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabase();
    if (!client || busy) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await client.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) setError(error.message);
      else setSent(true);
    } catch {
      setError("Could not reach the sign-in service. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    const client = getSupabase();
    if (!client || busy) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) setError(error.message);
    } catch {
      setError("Could not sign out. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const label = user ? "Account" : "Sign in";
  const Icon = hasIssue ? CloudAlert : UserRound;
  function chooseCopy(conflict: ProgressConflict, keepDevice: boolean) {
    if (!user || !resolveProgressConflict(user.id, conflict, keepDevice)) {
      setError("This browser could not preserve both versions. Download a backup before trying again.");
      return;
    }
    setNotice("Both versions are saved under Study help and recovery.");
    setError("");
    sync();
  }

  return <>
    <button className={city ? "nav-button account-nav" : "button button-outline account-nav"} type="button"
      aria-label={hasIssue ? "Account, sync needs attention" : label} aria-haspopup="dialog"
      disabled={!ready && !user} onClick={openAccount}>
      <Icon size={17} aria-hidden="true" /><span>{label}</span>
    </button>
    <dialog ref={dialog} className="game-dialog account-dialog" aria-labelledby={headingId}>
      <header className="dialog-header">
        <h2 id={headingId}>{user ? "Your account" : "Sign in to CertCity"}</h2>
        <button className="icon-button" type="button" aria-label="Close account" onClick={() => dialog.current?.close()}><X size={18} aria-hidden="true" /></button>
      </header>
      {user ? <div className="dialog-body account-body">
        <p className="account-email">{user.email}</p>
        <p role="status">{syncState === "offline" ? "Sync is unavailable. Changes on this device will retry automatically."
          : syncState === "loading" ? "Loading your saved progress…"
          : conflicts.length ? "Some saves need your attention. CertCity keeps recovery copies when you choose a version." : "Your progress is available across devices."}</p>
        {conflicts.map((conflict) => <div className="account-conflict" key={conflict.key}>
          <strong>{conflictLabel(conflict.key)}</strong>
          <div className="account-actions">
            {conflict.localOnly ? <p>This save exceeds the cloud size limit. Your work is available on this device.</p> : <>
              <button className="button button-outline" type="button" onClick={() => chooseCopy(conflict, true)}>Use this device’s version</button>
              <button className="button button-outline" type="button" onClick={() => chooseCopy(conflict, false)}>Use the cloud version</button>
            </>}
            <button className="button button-outline" type="button" onClick={() => downloadProgressBackup(conflict.cloudValue ? [{ key: conflict.key, value: conflict.cloudValue }] : [])}>Download backup</button>
          </div>
        </div>)}
        <div className="account-actions">
          {syncState === "offline" && <button className="button button-outline" type="button" onClick={sync}>Retry sync</button>}
          {canImport && syncState === "synced" && <button className="button button-outline" type="button" onClick={() => {
            const count = queueGuestProgress(user.id);
            setNotice(count ? "Syncing guest progress from this browser." : "This account already has saves for the available guest progress.");
            setCanImport(false);
            sync();
          }}>Copy guest progress</button>}
          <button className="button button-outline" type="button" disabled={busy} onClick={() => void signOut()}>Sign out</button>
        </div>
        <label className="account-diagnostics">
          <input type="checkbox" checked={diagnostics} onChange={(event) => {
            const enabled = event.currentTarget.checked;
            if (setDiagnosticsEnabled(user.id, enabled)) setDiagnostics(enabled);
            else setError("This browser could not save your diagnostic preference.");
          }} /> Share basic reliability diagnostics from this browser
        </label>
        <p>Diagnostics include scene load times and sync interruptions. Your answers and case records stay out of these reports.</p>
        <Link href="/help#study-email" onClick={() => dialog.current?.close()}>Study email reminders</Link>
        <Link href="/help" onClick={() => dialog.current?.close()}>Study help and recovery</Link>
        {notice && <p role="status">{notice}</p>}
        {error && <p className="account-error" role="alert">{error}</p>}
      </div> : <form className="dialog-body account-body" onSubmit={signIn}>
        {sent ? <p role="status">Check <strong>{email}</strong> for a sign-in link. Open the link in this browser.</p> : <>
          <p>Save your city assignments and practice across devices.</p>
          <label htmlFor={inputId}>Email address</label>
          <input id={inputId} value={email} onChange={(event) => setEmail(event.target.value)} type="email" required autoComplete="email" />
        </>}
        <div className="account-actions">
          {!sent && <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send sign-in link"}
          </button>}
          {sent && <button className="button button-outline" type="button" onClick={() => {
            setSent(false);
            setError("");
          }}>Use another email or resend</button>}
        </div>
        {error && <p className="account-error" role="alert">{error}</p>}
      </form>}
    </dialog>
  </>;
}
