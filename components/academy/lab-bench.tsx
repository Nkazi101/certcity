import { ArrowRight, BookOpen, Check, CircleAlert, ClipboardList, Code2, FileText, Lightbulb, Play, RotateCcw, Wand2 } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { CasePrebrief } from "../../lib/claude/casework";
import { capstoneFieldLimit } from "../../lib/claude/capstones/model";
import { lessonHref, lessonObjectiveFor } from "../../lib/claude/lessons/paths";
import type { Mission } from "../../lib/claude/missions";
import { emptyMastery, saveCaseBriefSeen, saveLabDraft, saveLabMastery, saveLabOutcome, startLabCycle } from "../../lib/claude/pathway";
import type { CaseMastery, HintRung, LabFileSet, MissionRecord } from "../../lib/claude/pathway";
import { parseJson } from "../../lib/labs/engines/parse";
import { compactJson } from "../../lib/labs/format";
import { failedChecks, labIndependent, pickVariant, runLab, starterFiles } from "../../lib/labs/run";
import type { AnyLabMission, ArtifactSpec, Check as LabCheck, CheckResult, FixtureSet, LabDocument, LabRun, TraceEvent, TraceSource } from "../../lib/labs/types";
import { progressScope } from "../../lib/progress-storage";
import type { TrackId } from "../../lib/claude/blueprints";
import { Glossed, GlossaryScope, LessonPeekLink } from "../glossary/peek";
import { WorkstationDirections } from "./case-workbench";
import { parseTable, TableRows } from "./table-rows";
import { LiveRun } from "./live-run";
import shared from "./station-workbench.module.css";
import styles from "./lab-bench.module.css";

type Snapshot = { files: LabFileSet; run: LabRun };
type View = "docs" | "files" | "run";

const rungCopy: Record<HintRung, { label: string; cost: string }> = {
  1: { label: "Nudge", cost: "Free" },
  2: { label: "Concept", cost: "Still counts as applied" },
  3: { label: "Worked example", cost: "Marks this objective as guided" },
};

const actorLabels: Record<TraceEvent["actor"], string> = {
  "learner-artifact": "Your file", model: "Claude", tool: "Tool", hook: "Hook", service: "Service", person: "Person",
};

function PrebriefContent({ prebrief }: { prebrief: CasePrebrief }) {
  return <>
    <p><Glossed text={prebrief.concept} /></p>
    <table className={shared.termTable}>
      <thead><tr><th scope="col">At this station</th><th scope="col">On the exam</th></tr></thead>
      <tbody>{prebrief.terms.map(([plain, exam]) => <tr key={plain}><td><Glossed text={plain} /></td><td><Glossed text={exam} /></td></tr>)}</tbody>
    </table>
    <div className={shared.contrast}>
      <p><strong>Works</strong> <Glossed text={prebrief.contrast.good} /></p>
      <p><strong>Breaks</strong> <Glossed text={prebrief.contrast.bad} /></p>
    </div>
  </>;
}

/** Monospace editor with line numbers. Exposes its textarea so the trace can jump to a line. */
function CodeEditor({ id, value, language, limit, onChange, onBlur, editorRef }: {
  id: string; value: string; language: string; limit: number;
  onChange: (value: string) => void; onBlur: () => void; editorRef: (element: HTMLTextAreaElement | null) => void;
}) {
  const gutter = useRef<HTMLDivElement>(null);
  const lines = Math.max(value.split("\n").length, 1);
  return <div className={styles.code} data-language={language}>
    <div ref={gutter} className={styles.gutter} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => <span key={index}>{index + 1}</span>)}
    </div>
    <textarea id={id} ref={editorRef} value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur}
      onScroll={(event) => { if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop; }}
      rows={Math.min(Math.max(lines + 1, 10), 26)} wrap="off" maxLength={limit}
      spellCheck={false} autoCapitalize="off" autoComplete="off" />
  </div>;
}

function SourceLink({ source, artifacts, onJump }: { source?: TraceSource; artifacts: readonly ArtifactSpec[]; onJump: (source: TraceSource) => void }) {
  if (!source) return null;
  const file = artifacts.find(({ id }) => id === source.artifact);
  if (!file) return null;
  return <button type="button" className={styles.sourceLink} onClick={() => onJump(source)}>
    {file.path}{source.line ? ` · line ${source.line}` : ""}
  </button>;
}

/** What happened, step by step, before any verdict. */
function TraceViewer({ run, lab, onJump }: { run: LabRun; lab: AnyLabMission; onJump: (source: TraceSource) => void }) {
  if (run.parseError) {
    return <p className={styles.parseError} role="status"><CircleAlert size={16} aria-hidden="true" />{run.parseError.error}{" "}
      <SourceLink source={run.parseError.source} artifacts={lab.artifacts} onJump={onJump} /></p>;
  }
  return <div className={styles.traces}>
    {run.fixtures.map(({ fixture, run: entry }) => <section key={fixture.id} className={styles.trace} aria-label={`Trace · ${fixture.name}`}>
      <h5>{fixture.name}</h5>
      <p className={styles.situation}><Glossed text={fixture.situation} /></p>
      <ol>{(entry?.trace ?? []).map((event) => <li key={event.step} data-tone={event.tone} data-actor={event.actor}>
        <span className={styles.actor}>{actorLabels[event.actor]}</span>
        <div>
          <p className={styles.eventLabel}><Glossed text={event.label} /></p>
          {event.detail && <pre className={styles.eventDetail}><Glossed text={event.detail} /></pre>}
          {event.payload !== undefined && <details className={styles.payload}><summary>Payload</summary><pre>{compactJson(event.payload)}</pre></details>}
          <SourceLink source={event.source} artifacts={lab.artifacts} onJump={onJump} />
        </div>
      </li>)}</ol>
    </section>)}
  </div>;
}

function CityEffects({ run }: { run: LabRun }) {
  const trays = run.effects.flatMap((effect) => effect.kind === "tray" ? [effect] : []);
  const meters = run.effects.flatMap((effect) => effect.kind === "meter" ? [effect] : []);
  if (!trays.length && !meters.length) return null;
  const labels = { posted: "Sent", held: "Held", escalated: "To staff", leaked: "Leaked", blocked: "Blocked", failed: "Failed" } as const;
  return <div className={styles.effects} aria-label="What reached the building">
    {trays.map(({ item, to }) => <span key={item + to} data-to={to}><strong>{labels[to]}</strong> {item}</span>)}
    {meters.map(({ id, label, value, limit, unit, better }) => <span key={id} data-to={limit !== undefined && (better === "lower" ? value > limit : value < limit) ? "held" : "posted"}>
      <strong>{value}{limit !== undefined ? ` / ${limit}` : ""} {unit}</strong> {label}</span>)}
  </div>;
}

function HintLadder({ check, rung, failures, revealed, lesson, onOpen, onReveal }: {
  check: LabCheck; rung: HintRung | 0; failures: number; revealed: boolean; lesson: { href: string; id: string; track: TrackId } | null;
  onOpen: (rung: HintRung) => void; onReveal: () => void;
}) {
  const next = rung < 3 ? (rung + 1) as HintRung : null;
  return <div className={shared.hintLadder}>
    {rung >= 1 && <p><strong><Lightbulb size={14} aria-hidden="true" />{rungCopy[1].label}</strong> <Glossed text={check.hints.nudge} /></p>}
    {rung >= 2 && <p><strong><BookOpen size={14} aria-hidden="true" />{rungCopy[2].label}</strong> <Glossed text={check.hints.concept} /></p>}
    {rung >= 3 && <p><strong>{rungCopy[3].label}</strong> <Glossed text={check.hints.worked} /></p>}
    {revealed && <p className={shared.revealed}><strong>Working version</strong> <code>{check.reveal}</code> This objective counts as guided.</p>}
    <div className={shared.hintActions}>
      {next && <button type="button" className="button button-outline" onClick={() => onOpen(next)}>
        {rung === 0 ? "Get a hint" : `Show the ${rungCopy[next].label.toLowerCase()}`}<small>{rungCopy[next].cost}</small>
      </button>}
      {/* Reading is free and always offered where the skill is needed; it never costs credit. */}
      {lesson && <LessonPeekLink className="button button-text" track={lesson.track} objective={lesson.id} href={lesson.href}>
        <span className={shared.lessonLabel}><BookOpen size={14} aria-hidden="true" />Read lesson {lesson.id}</span><small>Opens in a new tab · free</small>
      </LessonPeekLink>}
      {!revealed && failures >= 3 && <button type="button" className="button button-text" onClick={onReveal}>
        Show the working version<small>Marks this objective as guided</small>
      </button>}
    </div>
  </div>;
}

function checkRows(run: LabRun, checks: readonly LabCheck[]) {
  return checks.flatMap((check) => {
    const results = run.results.filter((result) => result.check === check.id);
    if (!results.length) return [];
    const failed = results.filter(({ passed }) => !passed);
    return [{ check, passed: !failed.length, results: failed.length ? failed : results.slice(0, 1) }];
  });
}

export function LabBench({ mission, lab, record, onChange, onSaved, beforeClose, legacyReplay, onRunResult }: {
  /** Tells the room how the latest run went, once the learner has judged it, so the person at the station reacts. */
  onRunResult?: (passed: boolean | null) => void;
  mission: Mission;
  lab: AnyLabMission;
  record?: MissionRecord;
  onChange: () => void;
  onSaved: () => void;
  beforeClose: (pending: Promise<unknown>) => void;
  legacyReplay?: ReactNode;
}) {
  const id = useId();
  const saved = record?.lab?.outcome;
  const [files, setFiles] = useState<Partial<Record<FixtureSet, LabFileSet>>>(() => ({
    sample: { ...starterFiles(lab), ...(saved?.sample ?? {}), ...(record?.lab?.drafts.sample ?? {}) },
    ...((record?.lab?.drafts.transfer ?? (lab.transferMode === "revise" ? saved?.transfer : undefined)) &&
      { transfer: { ...starterFiles(lab), ...(saved?.transfer ?? {}), ...(record?.lab?.drafts.transfer ?? {}) } }),
  }));
  const [stage, setStage] = useState<FixtureSet>(() => lab.transferMode === "revise" && record?.lab?.drafts.transfer ? "transfer" : "sample");
  const [activeFile, setActiveFile] = useState(lab.artifacts[0].id);
  const [mastery, setMastery] = useState<CaseMastery>(() => record?.lab?.mastery ?? emptyMastery);
  const [briefSeen, setBriefSeen] = useState(() => !!record?.briefSeen);
  const [sampleRun, setSampleRun] = useState<Snapshot | null>(null);
  const [transferRun, setTransferRun] = useState<Snapshot | null>(null);
  const [judging, setJudging] = useState<Record<string, boolean> | null>(null);
  const [judged, setJudged] = useState<{ right: number; total: number } | null>(null);
  const [guess, setGuess] = useState("");
  const [forecast, setForecast] = useState<{ predicted: number; actual: number; matched: boolean } | null>(null);
  const [isSaved, setIsSaved] = useState(() => !!saved && !record?.lab?.drafts.sample && !record?.lab?.drafts.transfer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("files");
  // Table-shaped files open row by row on phones, where typing `|` separators is the hard part; text everywhere else.
  const [rowMode, setRowMode] = useState<Record<string, boolean>>({});
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 700px)");
    const apply = () => setNarrow(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);
  const pending = useRef<Promise<unknown>>(Promise.resolve());
  const draftTimer = useRef<number | undefined>(undefined);
  /** The latest unsaved draft write. Flushed after a pause in typing, when the bench closes, or dropped when work is saved. */
  const queuedDraft = useRef<(() => void) | null>(null);
  const editors = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const variant = useMemo(() => saved && isSaved ? saved.variant : pickVariant(lab, mastery.cycle, progressScope()), [lab, mastery.cycle, saved, isSaved]);

  const sampleFiles = files.sample!;
  const transferFiles = lab.transferMode === "revise" ? files.transfer : sampleFiles;
  // Only revise-mode labs edit separate files for the new case; rerun-mode labs always edit the sample files.
  const editingTransfer = stage === "transfer" && lab.transferMode === "revise" && !!files.transfer;
  const editing = editingTransfer ? files.transfer! : sampleFiles;
  const sampleCurrent = !!sampleRun && sampleRun.files === sampleFiles;
  const transferCurrent = !!transferRun && !!transferFiles && transferRun.files === transferFiles;
  const samplePassed = sampleCurrent && sampleRun!.run.passed;
  const transferPassed = transferCurrent && transferRun!.run.passed;
  const shownRun = stage === "transfer" ? transferRun : sampleRun;
  const documents: readonly LabDocument[] = editingTransfer ? lab.transferDocuments?.[variant] ?? lab.documents : lab.documents;
  const failing = shownRun && !judging ? failedChecks(shownRun.run) : [];
  const stuck = failing.map((check) => lab.checks.find(({ id: entry }) => entry === check)!)
    .find((check) => check && (mastery.failures[check.id] ?? 0) >= 3 && !mastery.hints[check.id]);
  const artifact = lab.artifacts.find(({ id: entry }) => entry === activeFile) ?? lab.artifacts[0];
  const parseProblem = artifact.editor === "json" ? parseJson(editing[artifact.id], artifact.path).error : undefined;

  useEffect(() => () => {
    window.clearTimeout(draftTimer.current);
    queuedDraft.current?.();
  }, []);

  function flushDraft() {
    window.clearTimeout(draftTimer.current);
    const write = queuedDraft.current;
    queuedDraft.current = null;
    write?.();
  }

  function dropDraft() {
    window.clearTimeout(draftTimer.current);
    queuedDraft.current = null;
  }

  function lessonFor(objective: string) {
    const target = lessonObjectiveFor({ id: mission.track as Parameters<typeof lessonObjectiveFor>[0]["id"] }, undefined, objective);
    return target ? { id: target, track: mission.track as TrackId, href: lessonHref({ id: mission.track as Parameters<typeof lessonHref>[0]["id"] }, target) } : null;
  }

  function persist(write: () => Promise<unknown> | null) {
    const next = pending.current.then(async () => {
      const response = await write() as { saved?: boolean } | null;
      if (response && response.saved === false) setError("Your work is open here. This browser could not save the latest change.");
    });
    pending.current = next;
    beforeClose(next);
  }

  function changeMastery(update: (current: CaseMastery) => CaseMastery) {
    setMastery(update);
    persist(() => saveLabMastery(mission, update));
  }

  function edit(artifactId: string, value: string) {
    const set: FixtureSet = editingTransfer ? "transfer" : "sample";
    const next = { ...files[set]!, [artifactId]: value };
    setFiles((current) => ({ ...current, [set]: next }));
    setIsSaved(false);
    setError("");
    window.clearTimeout(draftTimer.current);
    queuedDraft.current = () => persist(() => saveLabDraft(mission, set, next));
    draftTimer.current = window.setTimeout(flushDraft, 500);
  }

  function format() {
    try {
      edit(artifact.id, compactJson(JSON.parse(editing[artifact.id])));
    } catch {
      // The parse error is already shown under the editor.
    }
  }

  function jumpTo(source: TraceSource) {
    setActiveFile(source.artifact);
    setView("files");
    window.requestAnimationFrame(() => {
      const element = editors.current[source.artifact];
      if (!element) return;
      const lines = element.value.split("\n");
      const line = Math.min(Math.max(source.line ?? 1, 1), lines.length);
      const start = lines.slice(0, line - 1).reduce((total, entry) => total + entry.length + 1, 0);
      element.focus();
      element.setSelectionRange(start, start + lines[line - 1].length);
      const height = Number.parseFloat(getComputedStyle(element).lineHeight) || 20;
      element.scrollTop = Math.max(0, (line - 4) * height);
    });
  }

  function recordRun(run: LabRun, set: FixtureSet, predictionHit = false) {
    const failed = failedChecks(run);
    changeMastery((current) => ({
      ...current,
      runs: current.runs + 1,
      firstRunPassed: current.runs === 0 && set === "sample" ? run.passed : current.firstRunPassed,
      predictions: current.predictions + (predictionHit ? 1 : 0),
      failures: { ...current.failures, ...Object.fromEntries(failed.map((check) => [check, (current.failures[check] ?? 0) + 1])) },
    }));
  }

  function openHint(check: string, rung: HintRung) {
    changeMastery((current) => ({ ...current, hints: { ...current.hints, [check]: Math.max(current.hints[check] ?? 0, rung) as HintRung } }));
  }

  function reveal(check: string) {
    changeMastery((current) => ({ ...current, revealed: [...new Set([...current.revealed, check])] }));
  }

  function focusResults() {
    window.requestAnimationFrame(() => resultsHeading.current?.focus());
  }

  function runSample() {
    // The first run is the start: the directions fold away once the learner has acted.
    if (!briefSeen) acknowledgeBrief();
    const run = runLab(lab, sampleFiles, "sample");
    const first = mastery.runs === 0;
    const predicted = guess.trim() === "" || !lab.prediction ? null : Number(guess);
    const actual = lab.prediction?.actual(run);
    const matched = predicted !== null && actual !== undefined && Number.isFinite(predicted) && Math.abs(predicted - actual) <= (lab.prediction?.tolerance ?? 0);
    setForecast(predicted === null || actual === undefined || !Number.isFinite(predicted) ? null : { predicted, actual, matched });
    setGuess("");
    setJudged(null);
    // The first run of an attempt shows what happened first; the learner judges each check before the verdict appears.
    setJudging(first && !run.parseError ? {} : null);
    setSampleRun({ files: sampleFiles, run });
    setStage("sample");
    setView("run");
    recordRun(run, "sample", matched && run.passed);
    focusResults();
  }

  function openTransfer() {
    if (!samplePassed) return;
    if (lab.transferMode === "revise") {
      const next = files.transfer ?? { ...sampleFiles, ...(lab.transferStarters?.[variant] ?? {}) };
      setFiles((current) => ({ ...current, transfer: next }));
      setStage("transfer");
      setView("docs");
      if (!files.transfer) persist(() => saveLabDraft(mission, "transfer", next));
    } else runTransfer();
  }

  function runTransfer() {
    const target = lab.transferMode === "revise" ? files.transfer : sampleFiles;
    if (!target || !samplePassed) return;
    const run = runLab(lab, target, "transfer", variant);
    setTransferRun({ files: target, run });
    setStage("transfer");
    setJudging(null);
    setView("run");
    recordRun(run, "transfer");
    focusResults();
  }

  function finishJudging(skip = false) {
    if (!judging || !sampleRun) return;
    const rows = checkRows(sampleRun.run, lab.checks);
    const right = rows.filter(({ check, passed }) => judging[check.id] === passed).length;
    setJudged(skip ? null : { right, total: rows.length });
    setJudging(null);
    focusResults();
  }

  async function save() {
    if (busy || !samplePassed || !transferPassed || !transferFiles) return;
    setBusy(true);
    dropDraft();
    await pending.current;
    const response = await saveLabOutcome(mission, sampleFiles, transferFiles, variant);
    setBusy(false);
    if (!response?.saved) {
      setError("This browser could not save the work. Keep the bench open and try saving again.");
      return;
    }
    setIsSaved(true);
    onChange();
    onSaved();
  }

  function startOver() {
    dropDraft();
    setFiles({ sample: starterFiles(lab) });
    setStage("sample");
    setSampleRun(null);
    setTransferRun(null);
    setJudging(null);
    setJudged(null);
    setForecast(null);
    setIsSaved(false);
    setMastery((current) => ({ ...emptyMastery, cycle: current.cycle + 1, ...(current.credit && { credit: current.credit }) }));
    persist(() => startLabCycle(mission));
  }

  function acknowledgeBrief() {
    setBriefSeen(true);
    persist(() => saveCaseBriefSeen(mission));
  }

  function checkPanel(run: LabRun, assist: boolean) {
    return <ul className={styles.checks}>
      {checkRows(run, lab.checks).map(({ check, passed, results }) => {
        const rung = mastery.hints[check.id] ?? 0;
        return <li key={check.id} className="casework-row" data-passed={judging ? undefined : passed}>
          {judging ? <ClipboardList size={18} aria-hidden="true" /> : passed ? <Check size={18} aria-hidden="true" /> : <CircleAlert size={18} aria-hidden="true" />}
          <div>
            <h5>{check.title} <span className={styles.objective} title="Exam objective in your current guide">{lessonFor(check.objective)?.id ?? check.objective}</span></h5>
            {judging ? <fieldset className={shared.judge}>
              <legend>Did this hold in the trace?</legend>
              <button type="button" className="button button-outline" aria-pressed={judging[check.id] === true} onClick={() => setJudging((current) => ({ ...current, [check.id]: true }))}>Held</button>
              <button type="button" className="button button-outline" aria-pressed={judging[check.id] === false} onClick={() => setJudging((current) => ({ ...current, [check.id]: false }))}>Failed</button>
            </fieldset> : <>
              {uniqueSymptoms(results).map((result) => <p key={result.fixture + result.symptom} className={styles.symptom}>
                {run.fixtures.length > 1 && <span className={styles.fixtureTag}>{run.fixtures.find(({ fixture }) => fixture.id === result.fixture)?.fixture.name}</span>}
                <Glossed text={result.symptom} /> <SourceLink source={result.source} artifacts={lab.artifacts} onJump={jumpTo} />
              </p>)}
              {!passed && assist && <>
                {rung >= 2 && <p className={shared.diagnosis}><small>Diagnosis</small><Glossed text={check.diagnosis} /></p>}
                <HintLadder check={check} rung={rung} failures={mastery.failures[check.id] ?? 0} revealed={mastery.revealed.includes(check.id)}
                  lesson={lessonFor(check.objective)} onOpen={(next) => openHint(check.id, next)} onReveal={() => reveal(check.id)} />
              </>}
            </>}
          </div>
        </li>;
      })}
    </ul>;
  }

  const revealed = !!shownRun && !judging && (stage === "transfer" ? transferCurrent : sampleCurrent) && !shownRun.run.parseError;
  const revealedPassed = revealed ? shownRun!.run.passed : null;
  useEffect(() => { onRunResult?.(revealedPassed); }, [revealedPassed, onRunResult]);
  const rows = shownRun ? checkRows(shownRun.run, lab.checks) : [];
  const issues = rows.filter(({ passed }) => !passed).length;
  const current = stage === "transfer" ? transferCurrent : sampleCurrent;
  const status = !shownRun ? null : !current ? "Files changed. Run again to see what they do now."
    : shownRun.run.parseError ? "The file could not be read, so nothing ran."
      : shownRun.run.passed ? stage === "sample" ? "Sample scenario passed. The new scenario is ready." : isSaved ? "New scenario passed. Outcome saved." : "New scenario passed. Your outcome is ready to save."
        : `${issues} ${issues === 1 ? "check needs" : "checks need"} attention.`;
  const independent = lab.objectives.filter((objective) => labIndependent(lab, mastery, objective)).length;

  return <GlossaryScope track={mission.track as TrackId}><section className={`casework ${shared.workbench} ${styles.bench}`} data-view={view} aria-labelledby={id + "-title"}>
    <header className="casework-header">
      <span className="casework-icon"><Code2 size={21} aria-hidden="true" /></span>
      <div><h3 id={id + "-title"}>{lab.station}</h3><p><Glossed text={lab.brief.problem} /></p></div>
    </header>
    {/* Experience first: the bench opens on the case. The idea behind it stays one click away, and each failing check links its lesson. */}
    <details className={shared.conceptChip}>
      <summary><BookOpen size={15} aria-hidden="true" />The idea behind this station · exam terms</summary>
      <PrebriefContent prebrief={lab.prebrief} />
    </details>
    <WorkstationDirections brief={lab.brief} seen={briefSeen} />
    {lab.engine.simulated && <p className={styles.simulated}>Simulated replies show how Claude tends to behave when instructions include or omit something. They are not live model output.</p>}

    <nav className={styles.tabs} aria-label="Bench panels">
      {(["docs", "files", "run"] as const).map((entry) => <button key={entry} type="button" aria-pressed={view === entry} onClick={() => setView(entry)}>
        {entry === "docs" ? "Mission file" : entry === "files" ? "Files" : "Run"}
      </button>)}
    </nav>

    <div className={styles.layout}>
      <section className={styles.docs} data-pane="docs" aria-label="Mission file">
        <h4><ClipboardList size={17} aria-hidden="true" />{editingTransfer ? "New scenario file" : "Mission file"}</h4>
        <blockquote className="casework-opening">“{lab.opening}” <cite>{lab.speaker}</cite></blockquote>
        {documents.map(({ id: doc, title, text, format: kind }, index) => <details key={doc} open={index === 0 || undefined}>
          <summary>{title}</summary>
          {kind ? <pre className={styles.record} data-format={kind} tabIndex={0}><Glossed text={text} /></pre> : <p><Glossed text={text} /></p>}
        </details>)}
      </section>

      <section className={styles.files} data-pane="files" aria-label="Your files">
        <h4><FileText size={17} aria-hidden="true" />{editingTransfer ? "Your files · new scenario" : "Your files"}</h4>
        <p className={styles.task}><Glossed text={lab.task} /></p>
        {lab.artifacts.length > 1 && <div className={styles.fileTabs} role="tablist" aria-label="Files">
          {lab.artifacts.map((entry) => <button key={entry.id} type="button" role="tab" aria-selected={entry.id === artifact.id} onClick={() => setActiveFile(entry.id)}>{entry.path}</button>)}
        </div>}
        {lab.artifacts.map((entry) => <div key={entry.id} className={styles.file} hidden={entry.id !== artifact.id}>
          <label htmlFor={`${id}-${entry.id}`} className={styles.fileName}>{entry.path}</label>
          <small><Glossed text={entry.instruction} /></small>
          {entry.example && <details className={styles.example}><summary>Example format</summary><pre tabIndex={0}>{entry.example}</pre></details>}
          {parseTable(editing[entry.id] ?? "") && <div className={styles.editMode} role="group" aria-label={`How to edit ${entry.path}`}>
            <button type="button" aria-pressed={!(rowMode[entry.id] ?? narrow)} onClick={() => setRowMode({ ...rowMode, [entry.id]: false })}>Edit as text</button>
            <button type="button" aria-pressed={rowMode[entry.id] ?? narrow} onClick={() => setRowMode({ ...rowMode, [entry.id]: true })}>Edit row by row</button>
          </div>}
          {(rowMode[entry.id] ?? narrow) && parseTable(editing[entry.id] ?? "")
            ? <TableRows value={editing[entry.id] ?? ""} instruction={entry.instruction} onChange={(value) => { edit(entry.id, value); }} />
            : <CodeEditor id={`${id}-${entry.id}`} value={editing[entry.id] ?? ""} language={entry.editor} limit={entry.maxChars ?? capstoneFieldLimit}
              onChange={(value) => edit(entry.id, value)} onBlur={flushDraft} editorRef={(element) => { editors.current[entry.id] = element; }} />}
          {entry.id === artifact.id && parseProblem && <p className={styles.parseError} role="status"><CircleAlert size={15} aria-hidden="true" />{parseProblem}</p>}
          {entry.editor === "json" && entry.id === artifact.id && !parseProblem && <button type="button" className="button button-text" onClick={format}><Wand2 size={14} aria-hidden="true" />Format JSON</button>}
        </div>)}
        <div className={`${shared.runActions} ${styles.runBar}`}>
          {status && !judging && <p className={shared.runStatus} data-state={!current ? "stale" : shownRun?.run.passed ? "passed" : "review"} role="status">{status}</p>}
          {!editingTransfer && !sampleCurrent && lab.prediction && !stuck && <label className={shared.predict}>
            <span>Predict first <small>(optional)</small> · {lab.prediction.prompt}</span>
            <span className="casework-number"><input type="number" inputMode="decimal" step="any" value={guess} aria-label={`${lab.prediction.prompt} (${lab.prediction.unit})`}
              onChange={(event) => setGuess(event.currentTarget.value)} /><span>{lab.prediction.unit}</span></span>
          </label>}
          {stuck ? <button type="button" className="button button-primary" onClick={() => { openHint(stuck.id, 1); setView("run"); focusResults(); }}>
            <Lightbulb size={16} aria-hidden="true" />Open a hint for “{stuck.title}”</button>
            : editingTransfer
              ? <button type="button" className="button button-primary" onClick={runTransfer} disabled={!samplePassed}><Play size={16} aria-hidden="true" />Run the new scenario</button>
              : <button type="button" className="button button-primary" onClick={runSample} disabled={!!judging}><Play size={16} aria-hidden="true" />Run the sample case</button>}
          {editingTransfer && !samplePassed && <button type="button" className="button button-outline" onClick={runSample}>Run the sample case first</button>}
          {editingTransfer && <button type="button" className="button button-text" onClick={() => setStage("sample")}>Back to the sample files</button>}
          {stage === "sample" && samplePassed && lab.transferMode === "revise" && files.transfer && <button type="button" className="button button-text" onClick={() => setStage("transfer")}>Go to the new scenario files</button>}
        </div>
      </section>

      <section className={styles.run} data-pane="run" aria-labelledby={id + "-results"}>
        <h4 id={id + "-results"} tabIndex={-1} ref={resultsHeading}><Play size={17} aria-hidden="true" />
          {!shownRun ? "Run" : judging ? "Judge the run" : stage === "transfer" ? "New scenario run" : "Sample run"}</h4>
        <p className={styles.engine}>{lab.engine.label}</p>
        {!shownRun && <p>Run the sample to see what your files do: each request, decision and output in order, then the checks.</p>}
        {shownRun && <>
          {stage === "sample" && forecast && <p className={shared.forecast} data-matched={forecast.matched}>
            You predicted {forecast.predicted} {lab.prediction?.unit} · the run shows {forecast.actual}.</p>}
          {judged && <p className={shared.forecast} data-matched={judged.right === judged.total}>You judged {judged.right} of {judged.total} checks correctly.</p>}
          <details className={styles.traceDetails} open={!!judging || !shownRun.run.passed}>
            <summary>What happened{!current ? " (previous run)" : ""}</summary>
            <TraceViewer run={shownRun.run} lab={lab} onJump={jumpTo} />
          </details>
          {!judging && <CityEffects run={shownRun.run} />}
          {/* After the deterministic run, a signed-in learner can see what real Claude does with the same files. Grading stays with the checks. */}
          {!judging && shownRun.run.fixtures[0] && <LiveRun lab={lab} files={shownRun.files} fixtureId={shownRun.run.fixtures[0].fixture.id} />}
          <h5 className={styles.checksTitle}>{judging ? "Which of these held?" : "Checks"}</h5>
          {checkPanel(shownRun.run, current && !judging)}
          {judging && <div className={shared.arrivalActions}>
            <button type="button" className="button button-primary" disabled={Object.keys(judging).length < rows.length} onClick={() => finishJudging()}>Show the verdict</button>
            <button type="button" className="button button-text" onClick={() => finishJudging(true)}>Skip judging</button>
          </div>}
        </>}
        {!judging && samplePassed && <section className="casework-retest" aria-label="New scenario">
          <h4>New scenario</h4>
          <p>{lab.transferMode === "revise"
            ? "A different scenario arrives. Its facts differ from the sample, so update your files for it, then run it."
            : "The same files now run against a scenario you have not seen. Credit as applied comes from passing it."}</p>
          <div className={shared.arrivalActions}>
            {lab.transferMode === "revise" && stage === "sample" && <button type="button" className="button button-outline" onClick={openTransfer}>
              <ArrowRight size={15} aria-hidden="true" />{files.transfer ? "Go to the new scenario" : "Open the new scenario"}</button>}
            {lab.transferMode === "rerun" && <button type="button" className="button button-outline" onClick={runTransfer}>
              <Play size={15} aria-hidden="true" />{transferRun ? "Run the new scenario again" : "Run the new scenario"}</button>}
            {samplePassed && transferPassed && (isSaved
              ? <p className="casework-saved"><Check size={17} aria-hidden="true" />Outcome saved</p>
              : <button type="button" className="button button-primary" onClick={() => void save()} disabled={busy}><Check size={16} aria-hidden="true" />{busy ? "Saving…" : "Save outcome"}</button>)}
            {isSaved && <button type="button" className="button button-text" onClick={startOver}><RotateCcw size={15} aria-hidden="true" />Start a fresh attempt</button>}
          </div>
          {stage === "sample" && transferRun && <details className={styles.traceDetails}>
            <summary>Last new-scenario run</summary>
            <TraceViewer run={transferRun.run} lab={lab} onJump={jumpTo} />
            {checkPanel(transferRun.run, false)}
          </details>}
        </section>}
        {samplePassed && transferPassed && <section className={shared.examDebrief} aria-label="Debrief">
          <h4>Your files next to a reference</h4>
          <p>{lab.debrief}</p>
          {lab.artifacts.map((entry) => <div key={entry.id} className={styles.compare}>
            <div><h5>Yours · {entry.path}</h5><pre tabIndex={0}>{(transferFiles ?? sampleFiles)[entry.id]}</pre></div>
            <div><h5>Reference · {entry.path}</h5><pre tabIndex={0}>{(lab.reference.transfer[variant] ?? lab.reference.sample)[entry.id]}</pre></div>
          </div>)}
          <p className={shared.masterySummary}>{mastery.runs} {mastery.runs === 1 ? "run" : "runs"} this attempt · first run {mastery.firstRunPassed ? "passed" : "needed changes"}
            {" · "}{independent} of {lab.objectives.length} objectives applied without a worked example or the working version</p>
        </section>}
      </section>
    </div>
    {error && <p className="academy-error" role="alert">{error}</p>}
    {legacyReplay}
  </section></GlossaryScope>;
}

function uniqueSymptoms(results: readonly CheckResult[]) {
  const seen = new Set<string>();
  return results.filter(({ symptom, fixture }) => {
    const key = fixture + symptom;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
