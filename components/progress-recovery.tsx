"use client";

import { useEffect, useId, useState } from "react";
import { activateRecovery, downloadProgressBackup, parseProgressBackup, recoveryCopies, restoreProgressBackup } from "../lib/progress-recovery";
import type { RecoveryCopy } from "../lib/progress-recovery";
import { subscribeToProgress } from "../lib/progress-storage";
import { useAccount } from "./account";

const dates = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function label(key: string) {
  if (key === "simza.city-dispatch.v1") return "City Dispatch";
  if (key === "simza.ccar-f.task-2.2.v1") return "City Dispatch study";
  if (key === "certcity.city.active-assignment.v1") return "Selected pathway";
  const fields = key.split(".");
  return fields[1] === "practice" ? fields[2] + " " + (fields[3] === "readiness" ? "preparation" : "practice")
    : fields.at(-1)?.replaceAll("-", " ") ?? "Saved work";
}

export function ProgressRecovery() {
  const { ready, user, sync } = useAccount();
  const [copies, setCopies] = useState<RecoveryCopy[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<RecoveryCopy | null>(null);
  const fileId = useId();

  useEffect(() => {
    if (!ready) return;
    const refresh = () => setCopies(recoveryCopies());
    refresh();
    return subscribeToProgress(refresh);
  }, [ready, user]);

  return <section className="academy-panel academy-recovery" aria-labelledby="recovery-title">
    <h2 id="recovery-title">Save and recover your progress</h2>
    <p>Your backup may include mission responses and work products. Keep the file private.</p>
    <div className="academy-actions">
      <button className="academy-button secondary" disabled={!ready || busy} onClick={() => downloadProgressBackup()}>Download progress</button>
      <label htmlFor={fileId}>Import a CertCity backup</label>
      <input type="file" id={fileId} accept=".json,application/json" disabled={!ready || busy} onChange={async (event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (!file) return;
        if (file.size > 8 * 1024 * 1024) { setMessage("Choose a CertCity backup smaller than 8 MB."); return; }
        setBusy(true);
        try {
          const saves = parseProgressBackup(await file.text());
          if (!saves) { setMessage("This file does not contain a valid CertCity backup."); return; }
          const result = await restoreProgressBackup(saves);
          setMessage(result.restored + " updated · " + result.existing + " already present · " + result.archived + " saved as separate copies · " + result.failed + " unavailable");
          setCopies(recoveryCopies());
          sync();
        } catch {
          setMessage("This browser could not restore the file. Your backup is still available.");
        } finally {
          setBusy(false);
        }
      }} />
    </div>
    {copies.length > 0 && <details>
      <summary>Recovery copies ({copies.length})</summary>
      <ul>
        {[...copies].reverse().map((copy) => <li key={copy.id}>
          <span>{label(copy.key)} · {dates.format(copy.capturedAt)}</span>
          {selected?.id === copy.id ? <>
            <p>CertCity will save the current version as a recovery copy before opening this one.</p>
            <button className="academy-button primary" disabled={busy} onClick={async () => {
              setBusy(true);
              try {
                if (await activateRecovery(copy)) {
                  setMessage("The recovery copy is now active.");
                  setCopies(recoveryCopies());
                  setSelected(null);
                  sync();
                } else setMessage("The copy is still saved. This browser could not make it active.");
              } catch { setMessage("The copy is still saved. This browser could not make it active."); }
              finally { setBusy(false); }
            }}>Confirm restore</button>
            <button className="academy-button text" disabled={busy} onClick={() => setSelected(null)}>Cancel</button>
          </> : <button className="academy-button text" disabled={busy} onClick={() => setSelected(copy)}>Restore this copy</button>}
        </li>)}
      </ul>
    </details>}
    {message && <p role="status">{message}</p>}
  </section>;
}
