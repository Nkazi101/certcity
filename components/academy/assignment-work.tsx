import { RoleFieldwork } from "./role-fieldwork";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, FileText, Folder, GitBranch, Play, X } from "lucide-react";
import {
  approvedProofExample, archiveBaseline, briefSections, invoices, kitchenBaseline, packetFields, printBaseline, proofPaths,
  runArchive, runKitchen, runPrintworks,
} from "../../lib/claude/assignment-work";
import type {
  ArchiveWork, AssignmentWork, AssignmentWorkId, FileLocation, InvoiceRoute, InvoiceStatus, KitchenWork, PrintWork, SkillLocation,
} from "../../lib/claude/assignment-work";
import type { ReactNode } from "react";
import styles from "./station-workbench.module.css";

type WorkProps<T extends AssignmentWork> = {
  value: T;
  change: (value: T) => void;
  saved: boolean;
  busy: boolean;
  save: () => void;
};

function useReplayHeading<T>() {
  const [run, setRun] = useState<T | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusAfterRun = useRef(false);
  useEffect(() => {
    if (run && focusAfterRun.current) {
      focusAfterRun.current = false;
      heading.current?.focus();
    }
  }, [run]);
  return { run, heading, replay: (value: T) => {
    if (run === value) heading.current?.focus();
    else {
      focusAfterRun.current = true;
      setRun(value);
    }
  } };
}

function WorkActions({ ready, saved, busy, save, message }: {
  ready: boolean; saved: boolean; busy: boolean; save: () => void; message?: string;
}) {
  if (!ready && !saved && !message) return null;
  return <footer className="assignment-work-actions">
    {saved ? <p role="status"><Check size={16} />Saved to City impact</p> : ready &&
      <button type="button" className="button button-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save outcome"}</button>}
    {!ready && !saved && message && <p className="assignment-work-hint">{message}</p>}
  </footer>;
}

function CheckField({ checked, change, children }: { checked: boolean; change: (value: boolean) => void; children: ReactNode }) {
  return <label className="assignment-check-field"><input type="checkbox" checked={checked} onChange={(event) => change(event.target.checked)} />{children}</label>;
}

function toggle<T>(items: T[], item: T) {
  return items.includes(item) ? items.filter((entry) => entry !== item) : [...items, item];
}

const routeLabels: Record<InvoiceRoute, string> = {
  unchanged: "Retry original request", repair: "Retry with validator feedback",
  review: "Send source to bookkeeper", clear: "Clear the field",
};

function KitchenCounter({ value, change, ...actions }: WorkProps<KitchenWork>) {
  const [sourceId, setSourceId] = useState<string>("303");
  const [panel, setPanel] = useState<"examples" | "ledger" | "exceptions">("ledger");
  const replay = useReplayHeading<KitchenWork>();
  const batchSummary = useRef<HTMLHeadingElement>(null);
  const source = invoices.find(({ id }) => id === sourceId)!;
  const selected = value.examples.find(({ source }) => source === sourceId);
  const result = runKitchen(value);
  const batch = replay.run === value || actions.saved ? result : null;
  const current = result.rows.find(({ id }) => id === sourceId)!;
  const tested = batch?.rows.find(({ id }) => id === sourceId);
  const postedMismatch = tested?.tray === "posted" && "printed" in source && Math.abs(source.printed - source.sum) > 0;
  const preview = <><code>{current.extracted}</code><p>{current.reason}</p></>;

  function putExample(status: string) {
    const examples = value.examples.filter(({ source }) => source !== sourceId);
    if (status && examples.length < 2) examples.push({ source: sourceId, status: status as InvoiceStatus });
    change({ ...value, examples });
  }

  return <section className={`assignment-work kitchen-counter ${styles.kitchenCounter}`} aria-labelledby="kitchen-work-title">
    <header className="assignment-work-heading">
      <h3 id="kitchen-work-title">Receiving counter</h3>
    </header>
    <div className="kitchen-desk">
      <div className="kitchen-documents" aria-label="Supplier invoices">
        {invoices.map((invoice) => <button key={invoice.id} type="button" aria-pressed={sourceId === invoice.id}
          onClick={() => setSourceId(invoice.id)}><FileText size={16} aria-hidden="true" />{invoice.label}
          {value.examples.some(({ source }) => source === invoice.id) && <Check size={16} aria-label="In example tray" />}</button>)}
      </div>
      <article className="kitchen-paper">
        <div className="kitchen-paper-header"><strong>{source.label}</strong><span>Supplier copy</span></div>
        <dl>
          <dt>Printed total</dt>
          <dd>{source.id === "blank" ? <span className="kitchen-blank" aria-label="Empty field" />
            : source.id === "304" ? <span className="kitchen-unreadable">Illegible mark</span>
              : "printed" in source ? `${source.printed.toLocaleString("en-US")}¢` : "Legible"}</dd>
          <dt>Line sum</dt><dd>{"sum" in source ? `${source.sum.toLocaleString("en-US")}¢` : source.id === "302" ? "Matches printed total" : "See supplier copy"}</dd>
        </dl>
        {source.id === "304" && <p>{source.description}</p>}
        <div className={`kitchen-output ${styles.fullBrief}`} aria-live="polite"><span>Extractor preview</span>{preview}</div>
        <details className={`kitchen-output ${styles.shortBrief}`}><summary>Extractor preview</summary>{preview}</details>
        {tested && <div className="kitchen-replay-stamp" data-posted={tested.tray === "posted"} data-warning={postedMismatch || undefined}>
          <h4 tabIndex={-1} ref={replay.heading}>{postedMismatch ? "Mismatched total posted" : tested.tray === "posted" ? "Posted in this replay" : "Held in this replay"}</h4>
          <p>{tested.reason}</p>
          <button type="button" className="button button-text" onClick={() => batchSummary.current?.focus()}>See full batch</button>
        </div>}
      </article>
      <div className="kitchen-binder">
        <nav className="assignment-switch" aria-label="Receiving controls">
          <button type="button" aria-pressed={panel === "examples"} onClick={() => setPanel("examples")}>Examples</button>
          <button type="button" aria-pressed={panel === "ledger"} onClick={() => setPanel("ledger")}>Ledger</button>
          <button type="button" aria-pressed={panel === "exceptions"} onClick={() => setPanel("exceptions")}>Exceptions</button>
        </nav>
        {panel === "examples" && <>
          <label className="assignment-select">Expected status for {source.label}
            <select value={selected?.status ?? ""} disabled={!selected && value.examples.length >= 2} onChange={(event) => putExample(event.target.value)}>
              <option value="">Leave out of tray</option><option value="readable">Readable</option>
              <option value="unreadable">Unreadable</option><option value="blank">Blank</option>
            </select>
          </label>
          <h4>Example tray <small>{value.examples.length}/2</small></h4>
          {value.examples.length ? <ul className="kitchen-examples">
            {value.examples.map((example) => <li key={example.source}><span>{invoices.find(({ id }) => id === example.source)?.label}</span>
              <code>{example.status === "readable" ? "amount" : "null"} · {example.status}</code>
              <button type="button" className="assignment-remove" aria-label={`Remove ${invoices.find(({ id }) => id === example.source)?.label} from tray`}
                onClick={() => change({ ...value, examples: value.examples.filter((row) => row.source !== example.source) })}><X size={16} /></button></li>)}
          </ul> : <p>Pick an invoice, then set the output it should teach.</p>}
          {!selected && value.examples.length >= 2 && <p>Remove an example to make room.</p>}
        </>}
        {panel === "ledger" && <>
          <h4>Before posting</h4>
          <CheckField checked={value.reconcile} change={(reconcile) => change({ ...value, reconcile })}>Compare total with the trusted line sum</CheckField>
          <CheckField checked={value.typed} change={(typed) => change({ ...value, typed })}>Require integer cents or null</CheckField>
          <div className="kitchen-output" aria-live="polite"><span>Fixture with amount text</span><p>{result.shape}</p></div>
        </>}
        {panel === "exceptions" && <>
          <h4>Exception tray</h4>
          {(["date", "conflict"] as const).map((key) => <label className="assignment-select" key={key}>
            {key === "date" ? "Legible date, wrong output format" : "Two conflicting totals"}
            <select value={value[key]} onChange={(event) => change({ ...value, [key]: event.target.value as InvoiceRoute })}>
              {Object.entries(routeLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>)}
        </>}
      </div>
    </div>
    <div className="kitchen-ledger">
      <button type="button" className="button button-primary" onClick={() => replay.replay(value)}><Play size={16} />Run receiving batch</button>
      {batch && <div aria-live="polite">
        <h4 tabIndex={-1} ref={batchSummary}>{batch.posted} posted · {batch.held} held for review</h4>
        <ul>{batch.rows.map((row) => <li key={row.id}><strong>{row.label}</strong><code>{row.extracted}</code><span>{row.tray === "posted" ? "Posted" : "Review"} · {row.reason}</span></li>)}
          <li><strong>Output contract</strong><span>{batch.shape}</span></li>
          <li><strong>Malformed date</strong><span>{batch.date.reason}</span></li>
          <li><strong>Conflicting totals</strong><span>{batch.conflict.reason}</span></li>
        </ul>
        {!batch.passes.every(Boolean) && <p className="assignment-result-note">Revise the controls that let the mismatch through, lose the field status, or leave an exception unresolved.</p>}
      </div>}
    </div>
    <WorkActions {...actions} ready={!!batch?.passes.every(Boolean)} message={batch ? "Review the batch results above." : "Run the batch to check your changes."} />
  </section>;
}

type PrintFile = "instructions" | "skill" | "rule" | "example";

function PrintworksRepository({ value, change, ...actions }: WorkProps<PrintWork>) {
  const [file, setFile] = useState<PrintFile>("instructions");
  const [checkout, setCheckout] = useState<"day" | "evening">("evening");
  const [sample, setSample] = useState<(typeof proofPaths)[number]["id"]>("billing");
  const replay = useReplayHeading<PrintWork>();
  const showCheckout = replay.run === value || actions.saved;
  const result = runPrintworks(value);
  const opened = result.files.find(({ id }) => id === sample)!;
  const ruleText = value.rule === "paths"
    ? `---\npaths:\n${proofPaths.filter(({ id }) => value.paths.includes(id)).map(({ glob }) => `  - "${glob}"`).join("\n")}\n---\n\n`
    : "";
  const teamExample = "examples/approved-proof.md";

  return <section className="assignment-work print-repository" aria-labelledby="print-work-title">
    <header className="assignment-work-heading">
      <h3 id="print-work-title">Proof workstation</h3>
      <p>Give both shifts the same release procedure. Keep the paper-size rule out of billing.</p>
    </header>
    <div className="print-ide">
      <nav className="print-files" aria-label="Repository files">
        <div><GitBranch size={17} aria-hidden="true" /> printworks</div>
        <button type="button" aria-pressed={file === "instructions"} onClick={() => setFile("instructions")}><FileText size={16} />CLAUDE.md</button>
        <div><Folder size={16} aria-hidden="true" /> .claude</div>
        <button type="button" aria-pressed={file === "skill"} onClick={() => setFile("skill")}><FileText size={16} />skills/proof-release/SKILL.md</button>
        <button type="button" aria-pressed={file === "rule"} onClick={() => setFile("rule")}><FileText size={16} />rules/proof-tests.md</button>
        <button type="button" aria-pressed={file === "example"} onClick={() => setFile("example")}><FileText size={16} />Approved proof example</button>
      </nav>
      <div className="print-editor">
        {file === "instructions" && <>
          <h4>Instruction placement</h4>
          <div className="print-placement">
            <label className="assignment-select">Proof naming convention<select value={value.naming} onChange={(event) => change({ ...value, naming: event.target.value as FileLocation })}>
              <option value="user">~/.claude/CLAUDE.md</option><option value="project">Project CLAUDE.md</option>
            </select></label>
            <label className="assignment-select">Riley’s terse explanations<select value={value.tone} onChange={(event) => change({ ...value, tone: event.target.value as FileLocation })}>
              <option value="user">~/.claude/CLAUDE.md</option><option value="project">Project CLAUDE.md</option>
            </select></label>
          </div>
          <pre>{["# Project instructions", value.naming === "project" && "Use the shared proof naming convention.",
            value.tone === "project" && "Keep explanations terse.",
            value.skill === "instructions" && "Check and release the proof."].filter(Boolean).join("\n")}</pre>
        </>}
        {file === "skill" && <>
          <h4>Release checklist</h4>
          <label className="assignment-select">Store checklist in<select value={value.skill} onChange={(event) => change({ ...value, skill: event.target.value as SkillLocation })}>
            <option value="user">Personal Skill</option><option value="instructions">Project CLAUDE.md</option><option value="project">Project Skill</option>
          </select></label>
          <CheckField checked={value.example} change={(example) => change({ ...value, example })}>Link the approved proof example</CheckField>
          <pre>{value.skill === "instructions" ? "# Release checklist\nCheck and release the proof."
            : `---\nname: proof-release\ndescription: Run the approved proof release checklist\ndisable-model-invocation: true\n---\nCheck and release the proof.${value.example ? `\nSee [approved proof](${teamExample}).` : ""}`}</pre>
        </>}
        {file === "example" && <>
          <h4>Approved proof example</h4>
          <pre>{approvedProofExample}</pre>
          <p>{value.example ? "Linked from the release checklist." : "Available for the release checklist."}</p>
          <button type="button" className="button button-outline" onClick={() => setFile("skill")}>Open release checklist <ArrowRight size={16} /></button>
        </>}
        {file === "rule" && <>
          <h4>Paper-size rule</h4>
          <label className="assignment-select">Load rule<select value={value.rule} onChange={(event) => change({ ...value, rule: event.target.value === "paths" ? "paths" : "project" })}>
            <option value="project">Across the project</option><option value="paths">For selected directories</option>
          </select></label>
          {value.rule === "paths" && <fieldset className="print-paths"><legend>Directories that load the rule</legend>
            {proofPaths.map(({ id, glob }) => <CheckField key={id} checked={value.paths.includes(id)} change={() => change({ ...value, paths: toggle(value.paths, id) })}><code>{glob}</code></CheckField>)}
          </fieldset>}
          {value.rule === "paths" && !value.paths.length
            ? <p className="assignment-result-note">No target directories yet.</p>
            : <pre>{ruleText}{"Check paper size against the proof specification."}</pre>}
        </>}
      </div>
      <section className="print-checkout" aria-label="Checkout preview">
        <h4>Checkout preview</h4>
        <nav className="assignment-switch" aria-label="Preview operator">
          <button type="button" aria-pressed={checkout === "day"} onClick={() => setCheckout("day")}>Riley</button>
          <button type="button" aria-pressed={checkout === "evening"} onClick={() => setCheckout("evening")}>Evening shift</button>
        </nav>
        <ul aria-live="polite">
          <li>Proof naming <strong>{checkout === "day" || result.sharedNaming ? "Loaded" : "Missing"}</strong></li>
          <li>Terse style <strong>{checkout === "day" || result.personalToneLeaked ? "Loaded" : "Off"}</strong></li>
          <li><code>/proof-release</code><strong>{(checkout === "day" && value.skill === "user") || result.callable ? value.example ? "With example" : "No example" : "Unavailable"}</strong></li>
        </ul>
        <label className="assignment-select">Open a file<select value={sample} onChange={(event) => setSample(event.target.value as typeof sample)}>
          {proofPaths.map(({ id, path }) => <option key={id} value={id}>{path}</option>)}
        </select></label>
        <p role="status">{opened.loaded ? "Paper-size rule loaded" : "Paper-size rule absent"}.</p>
      </section>
    </div>
    <section className="print-check-results">
      <button type="button" className="button button-primary" onClick={() => replay.replay(value)}><Play size={16} />Run clean checkout</button>
      {showCheckout && <div aria-live="polite"><h4 tabIndex={-1} ref={replay.heading}>Evening shift</h4>
        <ul><li>Proof naming: {result.sharedNaming ? "loaded" : "missing"}</li>
          <li>Personal style: {result.personalToneLeaked ? "loaded for the whole team" : "stays with Riley"}</li>
          <li>Release Skill: {result.releaseReady ? "available with approved example" : result.callable ? "missing the example" : "unavailable"}</li>
          {result.files.map(({ id, path, loaded }) => <li key={id}><code>{path}</code> · {loaded ? "rule loaded" : "rule absent"}</li>)}
        </ul>
      </div>}
    </section>
    <WorkActions {...actions} ready={showCheckout && result.passes.every(Boolean)} message={showCheckout ? "Check the evening shift results above." : "Run a clean checkout to check your changes."} />
  </section>;
}

function ArchiveTable({ value, change, ...actions }: WorkProps<ArchiveWork>) {
  const [dispatched, setDispatched] = useState<ArchiveWork | null>(actions.saved ? value : null);
  const [worker, setWorker] = useState<"register" | "maps">("maps");
  const [brief, setBrief] = useState<ArchiveWork | null>(actions.saved ? value : null);
  const result = runArchive(value);
  const request = result.workers.find(({ id }) => id === worker)!;
  const packetValues = { collection: request.name, dates: request.dates, accession: request.accession, citation: "Collection, record ID, source reference" };
  const sameDispatch = !!dispatched && dispatched.south === value.south && dispatched.keepRegister === value.keepRegister
    && dispatched.parallel === value.parallel && dispatched.access === value.access && dispatched.packets === value.packets;

  return <section className="assignment-work archive-table" aria-labelledby="archive-work-title">
    <header className="assignment-work-heading">
      <h3 id="archive-work-title">Research table</h3>
      <p>The editor needs the verified records today. Keep completed work, assign the missing search, and account for any gaps.</p>
    </header>
    <div className="archive-desks">
      <section className="archive-coverage">
        <h4>Coverage board</h4>
        <article><span>Property register</span><strong>Search complete</strong>
          <CheckField checked={value.keepRegister} change={(keepRegister) => change({ ...value, keepRegister })}>Keep completed findings</CheckField>
        </article>
        <article><span>Map coverage</span><strong>South ward</strong>
          <label className="assignment-select">Assign search to<select value={value.south} onChange={(event) => change({ ...value, south: event.target.value as ArchiveWork["south"] })}>
            <option value="none">Unassigned</option><option value="maps">Historic maps</option>
            <option value="register">Property register</option><option value="both">Both workers</option>
          </select></label>
        </article>
      </section>
      <section className="archive-packet">
        <h4>Worker packet</h4>
        <p>Pack each request separately. The workers start with their own context.</p>
        <nav className="assignment-switch" aria-label="Worker packets">
          {result.workers.map(({ id, name }) => <button key={id} type="button" aria-pressed={id === worker} onClick={() => setWorker(id)}>{name}</button>)}
        </nav>
        <fieldset><legend>Include in the {worker === "maps" ? "maps" : "register"} packet</legend>
          {packetFields.map(({ id, label }) => <CheckField key={id} checked={value.packets[worker].includes(id)}
            change={() => change({ ...value, packets: { ...value.packets, [worker]: toggle(value.packets[worker], id) } })}><span>{label}<small>{packetValues[id]}</small></span></CheckField>)}
        </fieldset>
        <label className="assignment-select">Collection access<select value={value.access} onChange={(event) => change({ ...value, access: event.target.value as ArchiveWork["access"] })}>
          <option value="assigned">Assigned collection only</option><option value="both">Both collections for each worker</option>
        </select></label>
        <CheckField checked={value.parallel} change={(parallel) => change({ ...value, parallel })}>Run independent requests together</CheckField>
        <button type="button" className="button button-outline" onClick={() => setDispatched(value)}><Play size={16} />Replay worker dispatch</button>
        {sameDispatch && <div className="archive-dispatch-output" aria-live="polite">
          <p>{result.assignment} {result.preserved}</p>
          {result.workers.map(({ id, name, missing }) => <p key={id}><strong>{name}</strong> · {missing.length
            ? `Missing ${missing.map(({ label }) => label.toLowerCase()).join(", ")}.` : "Packet complete."}</p>)}
          <p>{value.access === "both" ? "Both workers received unrelated collection access. " : ""}
            Requests ran {value.parallel ? "together" : "one at a time"}.</p>
        </div>}
      </section>
      <section className="archive-brief">
        <h4>Editor’s brief</h4>
        <p>A separate run returned three wards before the map source failed. Its one retry is spent. Decide what the editor receives.</p>
        <div className="archive-clips">
          {briefSections.map(({ id, label, detail }) => <button type="button" key={id} aria-pressed={value.brief.includes(id)}
            onClick={() => change({ ...value, brief: toggle(value.brief, id) })}>
            <FileText size={16} aria-hidden="true" /><span><strong>{label}</strong><small>{detail}</small></span>
            {value.brief.includes(id) && <Check size={16} aria-hidden="true" />}
          </button>)}
        </div>
        <button type="button" className="button button-primary" disabled={!sameDispatch} onClick={() => setBrief(value)}>Review brief <ArrowRight size={16} /></button>
        {!sameDispatch && <p className="archive-review-hint">Replay worker dispatch to review this brief.</p>}
        {brief === value && <div className="archive-brief-output" aria-live="polite">
          <strong>What the editor sees</strong>
          {result.brief.length ? <ul>{result.brief.map(({ id, label, detail }) => <li key={id}><b>{label}</b> · {detail}</li>)}</ul> : <p>No findings attached.</p>}
          {!value.brief.includes("gaps") && <p>The report leaves the editor unable to distinguish unchecked wards from a completed search.</p>}
          {!result.passes[0] && <p>{result.assignment} {result.preserved}</p>}
          {!result.passes[1] && <p>Worker dispatch still needs complete scoped packets and parallel execution.</p>}
        </div>}
      </section>
    </div>
    <WorkActions {...actions} ready={brief === value && !!sameDispatch && result.passes.every(Boolean)} />
  </section>;
}

export function AssignmentWorkArea({ id, draft, savedWork, busy, change, save }: {
  id: AssignmentWorkId;
  draft?: AssignmentWork;
  savedWork?: AssignmentWork;
  busy: boolean;
  change: (work: AssignmentWork) => void;
  save: (work: AssignmentWork) => void;
}) {
  const heading = useRef<HTMLDivElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  const value = draft ?? savedWork;
  const common = { busy, change, saved: !!savedWork && !draft };
  let work;
  if (id === "kitchen-extract") {
    const kitchen = value?.kind === id ? value : kitchenBaseline;
    work = <KitchenCounter {...common} value={kitchen} save={() => save(kitchen)} />;
  } else if (id === "printworks-rules") {
    const print = value?.kind === id ? value : printBaseline;
    work = <PrintworksRepository {...common} value={print} save={() => save(print)} />;
  } else if (id === "archive-coordination") {
    const archive = value?.kind === id ? value : archiveBaseline;
    work = <ArchiveTable {...common} value={archive} save={() => save(archive)} />;
  } else {
    const fieldwork = value?.kind === id ? value : undefined;
    work = <RoleFieldwork id={id} value={fieldwork} {...common} save={save} />;
  }
  return <div className="assignment-work-area" tabIndex={-1} ref={heading}>{work}</div>;
}
