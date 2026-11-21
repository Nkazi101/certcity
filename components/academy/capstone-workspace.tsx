"use client";

import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Clock3, Code2, FileText, GitBranch, Workflow } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { progressScope } from "../../lib/progress-storage";
import type { Track } from "../../lib/claude/blueprints";
import type { ExamVersion } from "../../lib/claude/december-blueprints";
import { capstoneEvidence, getCapstoneDefinition, initialCapstoneDraft, scoreCapstone } from "../../lib/claude/capstones";
import type { CapstoneAttempt, CapstoneDefinition, CapstoneDraft, CapstoneStage } from "../../lib/claude/capstones";
import { capstoneFieldLimit } from "../../lib/claude/capstones/model";
import type { CapstoneField, CapstonePreview } from "../../lib/claude/capstones/model";
import { ExternalLink } from "./chrome";
import styles from "./capstone-workspace.module.css";

const icons = {
  "associate-foundations": FileText,
  "developer-foundations": Code2,
  "architect-foundations": Workflow,
  "architect-professional": GitBranch,
};

function WorkProduct({ preview }: { preview: CapstonePreview }) {
  switch (preview.kind) {
    case "notice":
      return <div className={styles.notice}>
        <article>
          <h6>{preview.title}</h6>
          <p>{preview.body}</p>
        </article>
        <p>{preview.handoff}</p>
      </div>;
    case "console":
      return <pre className={styles.console} tabIndex={0}>{preview.text}</pre>;
    case "trace":
      return <div className={styles.trace}>
        {preview.steps.length > 0
          ? <ol>{preview.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
          : <p>Enter a valid manifest with a sequence to replay it.</p>}
        <p>Verified references · {preview.citations.join(", ") || "None"}</p>
        <p>Missing coverage · {preview.missing.join(", ") || "None recorded"}</p>
      </div>;
    case "comparison":
      return <div className={styles.comparison}>
        {preview.windows.map(({ name, route, queue, cost, budget, minutes, reviewMinutes }) =>
          <section key={name}>
            <h6>{name}</h6>
            <p>{route}</p>
            <p>{queue}</p>
            <BudgetMeter label="Cost" value={cost} limit={budget} unit="cents" />
            <BudgetMeter label="Review time" value={minutes} limit={reviewMinutes} unit="minutes" />
          </section>)}
        <p>{preview.decision}</p>
      </div>;
  }
}

function BudgetMeter({ label, value, limit, unit }: { label: string; value: number | null; limit: number; unit: string }) {
  return <div className={styles.meter} data-over={value !== null && value > limit}>
    <p>{label} · {value ?? "Pending"} / {limit} {unit}</p>
    {value !== null && <meter min={0} max={Math.max(limit, value)} value={value} optimum={0} high={limit}
      aria-label={`${label} budget: ${value} of ${limit} ${unit}`} />}
  </div>;
}

function PracticalChecks({ attempt }: { attempt: CapstoneAttempt }) {
  return <ul>
    {attempt.results.map(({ criterion, title, passed, detail, review }) => (
      <li key={criterion} data-passed={passed}>
        <p><strong>{title}</strong><span>{passed ? "Met" : "Needs revision"}</span></p>
        <p>{detail}</p>
        {!passed && <p>{review}</p>}
      </li>
    ))}
  </ul>;
}

function SavedPractical({ attempt }: { attempt: CapstoneAttempt }) {
  const [expanded, setExpanded] = useState(false);
  const { snapshot, artifact, stage, submittedAt, passed } = attempt;
  const title = snapshot?.title ?? (stage === "capstone" ? "Capstone" : "Delayed case");
  const fields = snapshot?.fields ?? Object.keys(artifact).map((id) => ({ id, label: id }));
  const date = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(submittedAt);
  return <details onToggle={(event) => setExpanded(event.currentTarget.open)}>
    <summary><strong>{title}</strong><span>{date} · {passed ? "Checks met" : "Needs revision"}</span></summary>
    {expanded && <section className={styles.results}>
      {snapshot ? <><p>{snapshot.brief}</p><p>{snapshot.deliverable}</p>
        <details className={styles.archivedRecords}>
          <summary>Case records as delivered</summary>
          {snapshot.documents.map(({ id, title, text, format }) => <details key={id}>
            <summary>{title} · {id}</summary>
            {format === "json" ? <pre className={styles.recordCode} tabIndex={0}>{text}</pre> : <p>{text}</p>}
          </details>)}
        </details></> : <p>This earlier submission saved your work and checks. The original case records were unavailable when it was saved.</p>}
      <h4>Submitted work</h4>
      <dl className={styles.archivedArtifact}>
        {fields.map(({ id, label }) => <div key={id}><dt>{label}</dt><dd>{artifact[id] || "—"}</dd></div>)}
      </dl>
      <h4>Checks at submission</h4>
      <PracticalChecks attempt={attempt} />
      {snapshot && <ExternalLink href={snapshot.reference.url}>{snapshot.reference.label}</ExternalLink>}
    </section>}
  </details>;
}

function previousAttempt(attempts: readonly CapstoneAttempt[], definition: CapstoneDefinition, version: ExamVersion) {
  return attempts.filter(({ scenarioId, version: attemptVersion }) => scenarioId === definition.id && attemptVersion === version)
    .reduce<CapstoneAttempt | undefined>((latest, candidate) => !latest || candidate.submittedAt >= latest.submittedAt ? candidate : latest, undefined);
}

function loadDraft(key: string, definition: CapstoneDefinition, latest?: CapstoneAttempt) {
  const base = initialCapstoneDraft(definition);
  for (const { id } of definition.fields) {
    const previous = latest?.artifact[id];
    if (typeof previous === "string") base[id] = previous;
  }
  try {
    const saved: unknown = JSON.parse(window.sessionStorage.getItem(key) ?? "null");
    if (saved && typeof saved === "object") {
      const values = saved as Record<string, unknown>;
      return Object.fromEntries(definition.fields.map(({ id }) => [id,
        typeof values[id] === "string" ? values[id].slice(0, capstoneFieldLimit) : base[id]]));
    }
  } catch {
    // The exercise can continue without draft storage.
  }
  return base;
}

function CapstoneEditor({ track, version, definition, attempts, onSubmit, onExit }: {
  track: Track;
  version: ExamVersion;
  definition: CapstoneDefinition;
  attempts: readonly CapstoneAttempt[];
  onSubmit: (attempt: CapstoneAttempt) => boolean | Promise<boolean>;
  onExit: () => void;
}) {
  const draftKey = `certcity.capstone.draft.${progressScope()}.${version}.${definition.id}`;
  const latest = previousAttempt(attempts, definition, version);
  const [draft, setDraft] = useState(() => loadDraft(draftKey, definition, latest));
  const [preview, setPreview] = useState<CapstonePreview | null>(null);
  const [run, setRun] = useState(definition.runs?.[0]?.id ?? "");
  const [result, setResult] = useState<CapstoneAttempt | null>(latest ?? null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const Icon = icons[track.id];
  const groups = new Map<string, CapstoneField[]>();
  for (const field of definition.fields) {
    const group = field.group ?? "";
    const fields = groups.get(group);
    if (fields) fields.push(field);
    else groups.set(group, [field]);
  }

  useEffect(() => { heading.current?.focus({ preventScroll: false }); }, []);

  function edit(id: string, value: string) {
    const next = { ...draft, [id]: value };
    setDraft(next);
    setPreview(null);
    setMessage("");
    try {
      window.sessionStorage.setItem(draftKey, JSON.stringify(next));
    } catch {
      // Keep the draft in memory.
    }
  }

  function showPreview() {
    setPreview(definition.preview(draft, run));
    window.requestAnimationFrame(() => previewHeading.current?.focus());
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage("");
    const submittedAt = Date.now();
    const attempt = {
      ...scoreCapstone(track.id, version, definition.stage, draft),
      id: globalThis.crypto?.randomUUID?.() ?? `${definition.id}-${submittedAt}-${Math.random().toString(36).slice(2)}`,
      submittedAt,
    };
    try {
      if (!await onSubmit(attempt)) {
        setMessage("This attempt could not be saved. Your work is still in the editor.");
        return;
      }
      setResult(attempt);
      try {
        window.sessionStorage.removeItem(draftKey);
      } catch {
        // The submitted artifact has already been saved.
      }
      window.requestAnimationFrame(() => resultsHeading.current?.focus());
    } catch {
      setMessage("This attempt could not be saved. Your work is still in the editor.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function renderField({ id, label, instruction, editor, options }: CapstoneField) {
    return <label key={id} data-editor={editor ?? "text"}>
      <span>{label}</span>
      {instruction && <small>{instruction}</small>}
      {options
        ? <select value={draft[id]} onChange={(event) => edit(id, event.target.value)} disabled={busy}>
            <option value="">Choose an option</option>
            {options.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        : editor && editor !== "text"
          ? <textarea value={draft[id]} onChange={(event) => edit(id, event.target.value)}
              maxLength={capstoneFieldLimit} rows={editor === "json" ? 14 : 4} spellCheck={editor === "notes"} disabled={busy} />
          : <input type="text" value={draft[id]} onChange={(event) => edit(id, event.target.value)}
              maxLength={capstoneFieldLimit} disabled={busy} />}
    </label>;
  }

  return (
    <div className={styles.editor} data-track={track.id}>
      <header className={styles.editorHeader}>
        <button type="button" className="academy-button text" onClick={onExit} disabled={busy}><ArrowLeft size={16} aria-hidden="true" /> Back to practicals</button>
        <div className={styles.brief}>
          <span className={styles.sceneIcon}><Icon size={28} strokeWidth={1.65} aria-hidden="true" /></span>
          <div>
            <p>{definition.role}</p>
            <h3 ref={heading} tabIndex={-1}>{definition.title}</h3>
            <p>{definition.brief}</p>
          </div>
        </div>
      </header>

      <div className={styles.workspace}>
        <section className={styles.source} aria-label="Case records">
          <h4><BookOpen size={17} aria-hidden="true" /> Case records</h4>
          {definition.documents.map(({ id, title, text, format }, index) => (
            <details key={id} open={index === 0 || undefined}>
              <summary><span>{title}</span><span className={styles.recordId}>{id}</span></summary>
              {format === "json" ? <pre className={styles.recordCode} tabIndex={0}>{text}</pre> : <p>{text}</p>}
            </details>
          ))}
        </section>

        <form className={styles.form} onSubmit={submit}>
          <h4>Prepare your work</h4>
          <p>{definition.deliverable}</p>
          <div className={styles.fields}>
            {[...groups].map(([group, fields]) => group ? <fieldset key={group}>
              <legend>{group}</legend>
              <div>{fields.map(renderField)}</div>
            </fieldset> : fields.map(renderField))}
          </div>
          <div className={styles.actions}>
            {definition.runs && <label className={styles.run}>
              <span>Local test case</span>
              <select value={run} disabled={busy} onChange={(event) => { setRun(event.target.value); setPreview(null); }}>
                {definition.runs.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>}
            <button type="button" className="academy-button secondary" onClick={showPreview} disabled={busy}>
              {definition.runs ? "Run test case" : track.id === "architect-professional" ? "Compare operating plans" : "Preview public notice"}
            </button>
            <button type="submit" className="academy-button primary" disabled={busy}>
              {busy ? "Saving" : "Submit for review"} <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
          {message && <p role="alert" className={styles.error}>{message}</p>}
          {preview && <div className={styles.preview}>
            <h5 ref={previewHeading} tabIndex={-1}>Work product preview</h5>
            <WorkProduct preview={preview} />
          </div>}
        </form>
      </div>

      {result && (
        <section className={styles.results}>
          <h4 ref={resultsHeading} tabIndex={-1}>{result.passed ? "All practical checks met" : "Review the practical checks"}</h4>
          <p>{result.results.filter(({ passed }) => passed).length} of {result.results.length} checks met on the last submission.</p>
          <PracticalChecks attempt={result} />
          <ExternalLink href={(result.snapshot?.reference ?? definition.reference).url}>
            {(result.snapshot?.reference ?? definition.reference).label}
          </ExternalLink>
        </section>
      )}
    </div>
  );
}

export function CapstoneWorkspace({ track, version, attempts, onSubmit }: {
  track: Track;
  version: ExamVersion;
  attempts: readonly CapstoneAttempt[];
  onSubmit: (attempt: CapstoneAttempt) => boolean | Promise<boolean>;
}) {
  const [stage, setStage] = useState<CapstoneStage | null>(null);
  const [now, setNow] = useState(Date.now);
  const heading = useRef<HTMLHeadingElement>(null);
  const evidence = capstoneEvidence(track.id, version, attempts, now);
  const history = attempts.filter((entry) => entry.trackId === track.id && entry.version === version)
    .sort((left, right) => right.submittedAt - left.submittedAt);
  const transferAvailable = evidence.transferDue !== null && now >= evidence.transferDue;
  const definition = stage ? getCapstoneDefinition(track.id, version, stage) : null;

  useEffect(() => {
    const update = () => setNow(Date.now());
    window.addEventListener("focus", update);
    const timer = window.setInterval(update, 15_000);
    return () => {
      window.removeEventListener("focus", update);
      window.clearInterval(timer);
    };
  }, []);
  useEffect(() => { setNow(Date.now()); }, [attempts]);

  function close() {
    setStage(null);
    window.requestAnimationFrame(() => heading.current?.focus());
  }

  return (
    <section className={`academy-panel ${styles.panel}`} id="track-practicals" aria-labelledby="track-practicals-title">
      <h2 id="track-practicals-title" ref={heading} tabIndex={-1}>Independent practicals</h2>
      <p>Work from case records and submit an artifact for review. These local simulations save your check results separately from city progress.</p>
      {definition && (stage !== "transfer" || transferAvailable)
        ? <CapstoneEditor key={`${progressScope()}:${version}:${definition.id}`} definition={definition} track={track} version={version}
            attempts={attempts} onSubmit={onSubmit} onExit={close} />
        : <div className={styles.stages}>
          <section>
            <div>
              <h3>Capstone</h3>
              <p>{evidence.capstone ? "All checks met. Your work product is saved." : evidence.firstCapstone ? "Review the feedback and revise your work." : getCapstoneDefinition(track.id, version, "capstone").deliverable}</p>
            </div>
            <button type="button" className="academy-button secondary" onClick={() => setStage("capstone")}>
              {evidence.capstone ? "Review capstone" : evidence.firstCapstone ? "Reopen capstone" : "Open capstone"} <ArrowRight size={16} aria-hidden="true" />
            </button>
          </section>
          <section>
            <div>
              <h3>Delayed case</h3>
              <p>{evidence.transfer ? "All checks met on the delayed case." : transferAvailable
                ? evidence.firstTransfer ? "Review the feedback and revise your work." : "A different case is open."
                : evidence.transferDue === null ? "Opens seven days after you meet the capstone checks."
                  : `Opens ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(evidence.transferDue)}.`}</p>
            </div>
            {transferAvailable
              ? <button type="button" className="academy-button secondary" onClick={() => setStage("transfer")}>
                {evidence.transfer ? "Review delayed case" : "Open delayed case"} <ArrowRight size={16} aria-hidden="true" />
              </button>
              : <span className={styles.waiting}><Clock3 size={15} aria-hidden="true" /> Scheduled after the capstone</span>}
          </section>
        </div>}
      {evidence.capstone && evidence.transfer && <p className={styles.complete}><CheckCircle2 size={16} aria-hidden="true" /> Both practicals complete</p>}
      {!!history.length && <details className={`${styles.editor} ${styles.history}`} data-track={track.id}>
        <summary>Practical submission history <span>{history.length} saved</span></summary>
        {history.map((attempt) => <SavedPractical key={attempt.id} attempt={attempt} />)}
      </details>}
    </section>
  );
}
