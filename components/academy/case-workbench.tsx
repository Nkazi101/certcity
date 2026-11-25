import { ArrowRight, BookOpen, Check, CircleAlert, ClipboardList, FileText, Gauge, Lightbulb, Play, RotateCcw, Terminal, Workflow } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { CaseDraft, CaseField, CasePrebrief, CaseValue, Casework } from "../../lib/claude/casework";
import { caseCapacity, caseworkPassed, chosenOption, deployedCase, isChoice, replayCasework, shownCase, startingCase } from "../../lib/claude/casework";
import { workLayout } from "../../lib/claude/cases/layouts";
import type { WorkstationBrief } from "../../lib/claude/cases/presentation";
import { lessonHref, lessonObjectiveFor } from "../../lib/claude/lessons/paths";
import type { Mission } from "../../lib/claude/missions";
import { caseIndependent, emptyMastery, saveCaseBriefSeen, saveCaseMastery, saveCityCasework, startCaseCycle } from "../../lib/claude/pathway";
import type { CaseMastery, HintRung, MissionRecord } from "../../lib/claude/pathway";
import type { MissionRoomReplay } from "../../lib/scene/renderer";
import { CaseSurface } from "./case-surface";
import styles from "./station-workbench.module.css";
import type { TrackId } from "../../lib/claude/blueprints";
import { Glossed, GlossaryScope, LessonPeekLink } from "../glossary/peek";

const appearance = {
  document: { Icon: FileText, inputs: "On the desk", edit: "Working draft", run: "Preview the work" },
  terminal: { Icon: Terminal, inputs: "Captured inputs", edit: "Change the running setup", run: "Run the sample" },
  flow: { Icon: Workflow, inputs: "Incoming work", edit: "Change the routes", run: "Replay the work" },
  operations: { Icon: Gauge, inputs: "Reports and limits", edit: "Set the operating plan", run: "Simulate the plan" },
} as const;

const roomReplayLabels = {
  "market-bulletin": "Market bulletin desk",
  "supplier-invoices": "Receiving station",
  "regional-operations": "Incident queue desk",
} as const;

type ReplayFocus = { stage: "sample" | "new-case"; check: number };

function roomReplay(mission: string, draft: CaseDraft, run: ReturnType<typeof replayCasework>, stage: "sample" | "new-case"): MissionRoomReplay | null {
  const state = { token: performance.now(), result: run.passed ? "pass" as const : "review" as const, stage };
  switch (mission) {
    case "market-bulletin": {
      const destination = stage === "sample" ? undefined : draft.send === "Inez’s desk" ? "approval" : draft.send === "Publish now" ? "public" : "vendor";
      return { ...state, kind: "bulletin", destination };
    }
    case "supplier-invoices": {
      const routed = run.checks[stage === "sample" ? 1 : 0]?.passed;
      return { ...state, kind: "receiving", disposition: routed ? "held" : "unresolved" };
    }
    case "regional-operations": {
      const minutes = stage === "sample" ? run.capacity?.used : undefined;
      const staffed = stage === "sample" ? !!run.checks[0]?.passed && minutes !== undefined && minutes <= (run.capacity?.limit ?? 0) : undefined;
      return { ...state, kind: "operations", staffed, minutes };
    }
    default: return null;
  }
}

function Artifacts({ output }: { output: ReturnType<typeof replayCasework>["output"] }) {
  return <div className="casework-artifacts">
    {output.map(([title, content]) => <section key={title}><h5>{title}</h5><pre><Glossed text={content} /></pre></section>)}
  </div>;
}

function Capacity({ value }: { value: NonNullable<ReturnType<typeof replayCasework>["capacity"]> }) {
  return <p className="casework-meter" data-passed={value.used <= value.limit}>
    <Gauge size={18} aria-hidden="true" />
    <strong>{value.label}</strong><span>{value.used} / {value.limit} {value.unit}</span>
  </p>;
}

type CheckRun = ReturnType<typeof replayCasework>["checks"][number];

/** Fields that failed in a run. Used for hint gating; never shown as a list. */
function failingFields(run: ReturnType<typeof replayCasework>) {
  return [...new Set(run.checks.flatMap(({ failing }) => failing))];
}

const rungCopy: Record<HintRung, { label: string; cost: string }> = {
  1: { label: "Nudge", cost: "Free" },
  2: { label: "Concept", cost: "Still counts" },
  3: { label: "Worked example", cost: "Won’t count as right first time" },
};

function HintLadder({ field, rung, failures, revealed, lesson, onOpen, onReveal }: {
  field: CaseField;
  rung: HintRung | 0;
  failures: number;
  revealed: boolean;
  lesson: { href: string; id: string; track: TrackId } | null;
  onOpen: (rung: HintRung) => void;
  onReveal: () => void;
}) {
  const next = rung < 3 ? (rung + 1) as HintRung : null;
  return <div className={styles.hintLadder} data-field-hint={field.id}>
    {rung >= 1 && <p><strong><Lightbulb size={14} aria-hidden="true" />{rungCopy[1].label}</strong> <Glossed text={field.hints.nudge} /></p>}
    {rung >= 2 && <p><strong><BookOpen size={14} aria-hidden="true" />{rungCopy[2].label}</strong> <Glossed text={field.hints.concept} /></p>}
    {rung >= 3 && <p><strong>{rungCopy[3].label}</strong> <Glossed text={field.hints.worked} /></p>}
    {revealed && <p className={styles.revealed}><strong>Answer shown</strong> {field.label} is set to the working value. Redo this mission later to count it.</p>}
    <div className={styles.hintActions}>
      {next && <button type="button" className="button button-outline" onClick={() => onOpen(next)}>
        {rung === 0 ? "Get a hint" : `Show the ${rungCopy[next].label.toLowerCase()}`}<small>{rungCopy[next].cost}</small>
      </button>}
      {/* Reading is free and always offered where the skill is needed; it never costs credit. */}
      {lesson && <LessonPeekLink className="button button-text" track={lesson.track} objective={lesson.id} href={lesson.href}>
        <span className={styles.lessonLabel}><BookOpen size={14} aria-hidden="true" />Read lesson {lesson.id}</span><small>Opens in a new tab · free</small>
      </LessonPeekLink>}
      {!revealed && failures >= 3 && <button type="button" className="button button-text" onClick={onReveal}>
        Show the answer<small>Won’t count as right first time</small>
      </button>}
    </div>
  </div>;
}

function Replay({ result, judging, verdicts, onJudge, assist }: {
  result: ReturnType<typeof replayCasework>;
  judging?: boolean;
  verdicts?: Record<number, boolean>;
  onJudge?: (check: number, held: boolean) => void;
  assist?: (check: CheckRun, index: number) => ReactNode;
}) {
  const { checks, capacity } = result;
  return <div className="casework-replay">
    {capacity && <Capacity value={capacity} />}
    {!!result.output.length && <Artifacts output={result.output} />}
    {checks.map((check, index) => {
      const { name, evidence, passed, effect } = check;
      return <article className="casework-row" data-passed={judging ? undefined : passed} data-judging={judging || undefined} key={name}>
        {judging ? <ClipboardList size={18} aria-hidden="true" /> : passed ? <Check size={18} aria-hidden="true" /> : <CircleAlert size={18} aria-hidden="true" />}
        <div><h5>{name}</h5><p><Glossed text={evidence} /></p><p className="casework-effect"><Glossed text={effect} /></p>
          {judging && onJudge && <fieldset className={styles.judge}>
            <legend>Did this check hold?</legend>
            <button type="button" className="button button-outline" aria-pressed={verdicts?.[index] === true} onClick={() => onJudge(index, true)}>Held</button>
            <button type="button" className="button button-outline" aria-pressed={verdicts?.[index] === false} onClick={() => onJudge(index, false)}>Failed</button>
          </fieldset>}
          {!judging && !passed && assist?.(check, index)}
        </div>
      </article>;
    })}
  </div>;
}

export function WorkstationDirections({ brief, showProblem = false, seen = false }: { brief: WorkstationBrief; showProblem?: boolean; seen?: boolean }) {
  const content = <>
    {showProblem && <p className={styles.problem}>{brief.problem}</p>}
    <p><strong>Start here</strong> <span><Glossed text={brief.move} /></span></p>
    <div><strong>Success looks like</strong><ul className={styles.successList}>{brief.success.map((line) => <li key={line}><Glossed text={line} /></li>)}</ul></div>
  </>;
  return <>
    <div className={`${styles.directions} ${showProblem ? styles.labDirections : ""} ${seen ? styles.directionsSeen : ""}`}>{content}</div>
    {seen && <details className={`${styles.directionsChip} ${showProblem ? styles.labDirections : ""}`}>
      <summary>Directions</summary><div className={styles.directions}>{content}</div>
    </details>}
  </>;
}

function PrebriefContent({ prebrief }: { prebrief: CasePrebrief }) {
  return <>
    <p><Glossed text={prebrief.concept} /></p>
    <table className={styles.termTable}>
      <thead><tr><th scope="col">At this station</th><th scope="col">On the exam</th></tr></thead>
      <tbody>{prebrief.terms.map(([plain, exam]) => <tr key={plain}><td><Glossed text={plain} /></td><td><Glossed text={exam} /></td></tr>)}</tbody>
    </table>
    <div className={styles.contrast}>
      <p><strong>Works</strong> <Glossed text={prebrief.contrast.good} /></p>
      <p><strong>Breaks</strong> <Glossed text={prebrief.contrast.bad} /></p>
    </div>
  </>;
}

/** Experience first: the station opens on the case. The idea behind it stays one click away, and each failing check links its lesson. */
function Prebrief({ prebrief }: { prebrief: CasePrebrief }) {
  return <details className={styles.conceptChip}>
    <summary><BookOpen size={15} aria-hidden="true" />The idea behind this station · exam terms</summary>
    <PrebriefContent prebrief={prebrief} />
  </details>;
}

function ExamDebrief({ exercise, draft, mastery }: { exercise: Casework; draft: CaseDraft; mastery: CaseMastery }) {
  return <section className={styles.examDebrief} aria-label="Your choices in exam terms">
    <h4>Your choices in exam terms</h4>
    <dl>{exercise.fields.map((field) => {
      const chosen = chosenOption(field, draft[field.id]);
      return <div key={field.id}>
        <dt>{field.label}</dt>
        <dd><strong>{String(draft[field.id] ?? "")}{!isChoice(field) && ` ${field.unit}`}</strong>
          {chosen?.examTerm && <span className={styles.examTerm}>{chosen.examTerm}</span>}
          <span>{chosen?.rationale ?? (!isChoice(field) ? field.derivation : undefined)}</span></dd>
      </div>;
    })}</dl>
    <p className={styles.masterySummary}>
      {mastery.runs} {mastery.runs === 1 ? "run" : "runs"} this attempt · first run {mastery.firstRunPassed ? "passed" : "needed changes"}
      {" · "}{exercise.objectives.filter((objective) => caseIndependent(exercise, mastery, objective)).length} of {exercise.objectives.length} objectives applied without a worked example or answer
    </p>
  </section>;
}

export function CaseWorkbench({ mission, exercise, record, speaker, onChange, onSaved, beforeClose, legacyReplay, onRoomReplay }: {
  mission: Mission;
  exercise: Casework;
  record?: MissionRecord;
  speaker: string;
  onChange: () => void;
  onSaved: () => void;
  beforeClose: (pending: Promise<unknown>) => void;
  legacyReplay?: ReactNode;
  onRoomReplay: (replay: MissionRoomReplay, preview: HTMLCanvasElement) => void;
}) {
  const [draft, setDraft] = useState<CaseDraft>(() => record?.caseDraft ?? record?.casework ?? startingCase(exercise));
  const [tested, setTested] = useState<CaseDraft | null>(() => !record?.caseDraft && record?.casework ? draft : null);
  const [testedAgain, setTestedAgain] = useState<CaseDraft | null>(() => !record?.caseDraft && record?.casework ? draft : null);
  const [activeSection, setActiveSection] = useState(0);
  const [saved, setSaved] = useState(() => !record?.caseDraft && !!record?.casework);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mastery, setMastery] = useState<CaseMastery>(() => record?.mastery ?? emptyMastery);
  const [briefSeen, setBriefSeen] = useState(() => !!record?.briefSeen);
  const [guess, setGuess] = useState("");
  const [forecast, setForecast] = useState<{ predicted: number; actual: number; matched: boolean } | null>(null);
  const [judging, setJudging] = useState<Record<number, boolean> | null>(null);
  const [judged, setJudged] = useState<{ right: number; total: number } | null>(null);
  const pending = useRef<Promise<unknown>>(Promise.resolve());
  const output = useRef<HTMLHeadingElement>(null);
  const newCase = useRef<HTMLHeadingElement>(null);
  const newCaseOutcome = useRef<HTMLParagraphElement>(null);
  const workbench = useRef<HTMLElement>(null);
  const roomPreview = useRef<HTMLCanvasElement>(null);
  const focusAfterReplay = useRef<ReplayFocus | null>(null);
  const id = useId();
  const layout = workLayout(mission.id);
  const { Icon, inputs, edit, run } = appearance[exercise.view];
  const baseline = replayCasework(exercise, deployedCase(exercise));
  const capacity = caseCapacity(exercise, draft);
  const result = tested && replayCasework(exercise, tested);
  const retest = testedAgain && replayCasework(exercise, testedAgain, true);
  const sampleCurrent = tested === draft;
  const retestCurrent = testedAgain === draft;
  const sampleSections = exercise.cases.map(({ fields }) => layout.sections.findIndex((section) => section.fields.includes(fields[0])));
  const fieldsById = new Map(exercise.fields.map((field) => [field.id, field]));
  const issues = result?.checks.filter(({ passed }) => !passed).length ?? 0;
  const overLimit = result?.capacity ? result.capacity.used > result.capacity.limit : false;
  const unset = exercise.fields.filter(({ id: field }) => draft[field] === null || draft[field] === undefined).length;
  const sampleStatus = !sampleCurrent ? "Draft changed. Replay the sample to check it."
    : result?.passed ? "Sample passed. New scenario ready."
      : overLimit && !issues ? "Sample is over the operating limit."
        : `${issues} ${issues === 1 ? "check needs" : "checks need"} attention${overLimit ? " · also over limit" : ""}${unset ? ` · ${unset} ${unset === 1 ? "choice" : "choices"} not set` : ""}.`;
  const opening = <blockquote className="casework-opening">“{exercise.opening}” <cite>{speaker}</cite></blockquote>;
  const roomLabel = roomReplayLabels[mission.id as keyof typeof roomReplayLabels];
  // This station is the casework itself, so its own brief applies even where a lab now replaces it in the room.
  const brief = exercise.brief;
  const prediction = exercise.prediction ?? { prompt: `How many of the ${exercise.cases.length} sample checks will hold?`, unit: "checks",
    tolerance: 0, actual: (shown: CaseDraft) => replayCasework(exercise, shown).checks.filter(({ passed }) => passed).length };
  const askPrediction = !sampleCurrent;
  // After three failed runs on one field with no hint opened, Run asks for a hint first.
  const stuck = result ? failingFields(result).find((field) => (mastery.failures[field] ?? 0) >= 3 && !mastery.hints[field]) : undefined;
  const stuckField = stuck ? fieldsById.get(stuck) : undefined;

  function lessonFor(objective: string) {
    const target = lessonObjectiveFor({ id: mission.track }, undefined, objective);
    return target ? { id: target, track: mission.track as TrackId, href: lessonHref({ id: mission.track }, target) } : null;
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
    persist(() => saveCaseMastery(mission, update));
  }

  function recordRun(outcome: ReturnType<typeof replayCasework>, stage: ReplayFocus["stage"], predictionHit = false) {
    const failed = failingFields(outcome);
    changeMastery((current) => ({
      ...current,
      runs: current.runs + 1,
      firstRunPassed: current.runs === 0 && stage === "sample" ? outcome.passed : current.firstRunPassed,
      predictions: current.predictions + (predictionHit ? 1 : 0),
      failures: { ...current.failures, ...Object.fromEntries(failed.map((field) => [field, (current.failures[field] ?? 0) + 1])) },
    }));
  }

  function openHint(field: string, rung: HintRung) {
    changeMastery((current) => ({ ...current, hints: { ...current.hints, [field]: Math.max(current.hints[field] ?? 0, rung) as HintRung } }));
  }

  function reveal(field: CaseField) {
    if (isChoice(field)) update(field.id, field.key);
    else update(field.id, typeof field.key === "number" ? field.key : field.key.atLeast ?? field.key.atMost ?? field.min);
    changeMastery((current) => ({ ...current, revealed: [...new Set([...current.revealed, field.id])] }));
  }

  function assist(check: CheckRun, index: number, stage: ReplayFocus["stage"]) {
    const fieldId = check.failing[0];
    const field = fieldId ? fieldsById.get(fieldId) : undefined;
    if (!field) return null;
    const rung = mastery.hints[field.id] ?? 0;
    const section = stage === "sample" ? layout.sections[sampleSections[index]] : layout.sections.find(({ fields }) => fields.includes(field.id));
    return <>
      {rung >= 2 && <p className={styles.diagnosis}><small>Diagnosis</small><Glossed text={check.diagnosis} /></p>}
      <HintLadder field={field} rung={rung} failures={mastery.failures[field.id] ?? 0} revealed={mastery.revealed.includes(field.id)}
        lesson={lessonFor(field.objective)} onOpen={(next) => openHint(field.id, next)} onReveal={() => reveal(field)} />
      {rung >= 1 && section && stage === "sample" && <button type="button" className={`button button-outline ${styles.issueLink}`} onClick={() => showSample(index)}>
        Review {section.title}<ArrowRight size={14} aria-hidden="true" />
      </button>}
    </>;
  }

  function replayInRoom(stage: ReplayFocus["stage"], outcome: ReturnType<typeof replayCasework>) {
    if (!roomPreview.current) return;
    const replay = roomReplay(mission.id, draft, outcome, stage);
    if (replay) onRoomReplay(replay, roomPreview.current);
  }

  function focusReplay({ stage, check }: ReplayFocus) {
    const target = stage === "new-case" ? newCaseOutcome.current
      : check >= 0 ? workbench.current?.querySelector<HTMLElement>(`[data-check-index="${check}"]`)
        : result?.passed ? newCase.current : output.current;
    (target ?? output.current)?.focus();
  }

  useEffect(() => {
    const requested = focusAfterReplay.current;
    if (!requested) return;
    focusAfterReplay.current = null;
    focusReplay(requested);
  }, [activeSection, tested, testedAgain]);

  function showSample(check: number, afterUpdate = false) {
    const target = { stage: "sample", check } as const;
    const section = sampleSections[check] ?? -1;
    if (afterUpdate || (section >= 0 && section !== activeSection)) {
      focusAfterReplay.current = target;
      if (section >= 0) setActiveSection(section);
    } else focusReplay(target);
  }

  function runSample() {
    // The first replay is the start: the directions fold away once the learner has acted.
    if (!briefSeen) acknowledgeBrief();
    const outcome = replayCasework(exercise, draft);
    const first = mastery.runs === 0;
    const predicted = guess.trim() === "" ? null : Number(guess);
    const actual = prediction.actual(shownCase(exercise, draft));
    const matched = predicted !== null && Number.isFinite(predicted) && Math.abs(predicted - actual) <= (prediction.tolerance ?? 0);
    setForecast(predicted === null || !Number.isFinite(predicted) ? null : { predicted, actual, matched });
    setGuess("");
    setJudged(null);
    // The first replay of an attempt shows consequences first; the learner judges before the verdict appears.
    setJudging(first ? {} : null);
    replayInRoom("sample", outcome);
    recordRun(outcome, "sample", matched && outcome.passed);
    if (first) {
      focusAfterReplay.current = { stage: "sample", check: -1 };
      setTested(draft);
      return;
    }
    showSample(outcome.checks.findIndex(({ passed }) => !passed), !sampleCurrent);
    setTested(draft);
  }

  function finishJudging(skip = false) {
    if (!judging || !result) return;
    const total = result.checks.length;
    const right = result.checks.filter(({ passed }, index) => judging[index] === passed).length;
    setJudged(skip ? null : { right, total });
    setJudging(null);
    focusAfterReplay.current = { stage: "sample", check: result.checks.findIndex(({ passed }) => !passed) };
  }

  function runNewCase() {
    const outcome = replayCasework(exercise, draft, true);
    replayInRoom("new-case", outcome);
    recordRun(outcome, "new-case");
    const target = { stage: "new-case", check: -1 } as const;
    if (retestCurrent) focusReplay(target);
    else {
      focusAfterReplay.current = target;
      setTestedAgain(draft);
    }
  }

  function update(field: string, value: CaseValue) {
    if (draft[field] === value) return;
    const next = { ...draft, [field]: value };
    setDraft(next);
    setSaved(false);
    setError("");
    persist(() => saveCityCasework(mission, next));
  }

  function acknowledgeBrief() {
    setBriefSeen(true);
    persist(() => saveCaseBriefSeen(mission));
  }

  function startOver() {
    const fresh = startingCase(exercise);
    setDraft(fresh);
    setTested(null);
    setTestedAgain(null);
    setSaved(false);
    setForecast(null);
    setJudging(null);
    setJudged(null);
    setActiveSection(0);
    setMastery((current) => ({ ...emptyMastery, cycle: current.cycle + 1, ...(current.credit && { credit: current.credit }) }));
    persist(() => startCaseCycle(mission));
  }

  async function save() {
    if (busy || testedAgain !== draft || !caseworkPassed(exercise, draft)) return;
    setBusy(true);
    await pending.current;
    const response = await saveCityCasework(mission, draft, true);
    setBusy(false);
    if (!response?.saved) {
      setError("This browser could not save the work. Keep the desk open and try saving again.");
      return;
    }
    setSaved(true);
    onChange();
    onSaved();
  }

  const surfaceResult = judging ? null : result;
  return <GlossaryScope track={mission.track as TrackId}><section className={`casework ${styles.workbench}`} data-workstyle={exercise.view} data-surface={layout.kind} aria-labelledby={id + "-title"}>
    <header className="casework-header">
      <span className="casework-icon"><Icon size={21} aria-hidden="true" /></span>
      <div><h3 id={id + "-title"}>{exercise.station}</h3><p><Glossed text={brief?.problem ?? exercise.task} /></p></div>
    </header>
    <Prebrief prebrief={exercise.prebrief} />
    {brief && <WorkstationDirections brief={brief} seen={briefSeen} />}

    <section className="casework-panel casework-controls" aria-label={edit} ref={workbench}>
      {capacity && layout.kind !== "incident" && <Capacity value={capacity} />}
      <CaseSurface missionId={mission.id} active={activeSection} onSelectSection={setActiveSection} cycle={mastery.cycle}
        result={surfaceResult} {...{ exercise, layout, draft, update, busy, baseline, retest, sampleCurrent, retestCurrent, sampleSections }} />
      <details className={styles.deployed}>
        <summary>Before · the deployed setup</summary>
        <dl>{exercise.fields.map((field) => <div key={field.id}><dt>{field.label}</dt>
          <dd>{exercise.deployed[field.id]}{isChoice(field) ? "" : ` ${field.unit}`}</dd></div>)}</dl>
      </details>
      <div className={`casework-run-actions ${styles.runActions}`}>
        {result && !judging && <p className={styles.runStatus} data-state={!sampleCurrent ? "stale" : result.passed ? "passed" : "review"} role="status">{sampleStatus}</p>}
        {judging && <p className={styles.runStatus} data-state="stale" role="status">Read what happened in the replay, then mark each check.</p>}
        {askPrediction && !stuckField && <label className={styles.predict}>
          <span>Predict first <small>(optional)</small> · {prediction.prompt}</span>
          <span className="casework-number"><input type="number" inputMode="numeric" value={guess} aria-label={`${prediction.prompt} (${prediction.unit})`}
            onChange={(event) => setGuess(event.currentTarget.value)} /><span>{prediction.unit}</span></span>
        </label>}
        {stuckField ? <button type="button" className="button button-primary" onClick={() => {
          openHint(stuckField.id, 1);
          output.current?.focus();
        }}><Lightbulb size={16} aria-hidden="true" />Open a hint for {stuckField.label}</button>
          : <button type="button" className="button button-primary" onClick={runSample} disabled={!!judging}><Play size={16} aria-hidden="true" />{run}</button>}
        {result && !judging && <button type="button" className="button button-outline"
          onClick={() => (sampleCurrent && result.passed ? newCase.current : output.current)?.focus()}>
          {sampleCurrent && result.passed ? "Go to the new scenario" : "See replay details"}
        </button>}
      </div>
      {roomLabel && <figure className={styles.roomPreview} aria-hidden="true">
        <canvas width={640} height={280} ref={roomPreview} />
        <figcaption>{roomLabel} during replay</figcaption>
      </figure>}
    </section>
    <details className="casework-file">
      <summary><ClipboardList size={17} aria-hidden="true" />{inputs} · complete mission file</summary>
      <dl>{exercise.references.map(([name, content]) => <div key={name}><dt>{name}</dt><dd>{content}</dd></div>)}</dl>
      <details className="casework-before"><summary>What the deployed setup does</summary><Replay result={baseline} /></details>
    </details>
    <details className={styles.stationContext}>
      <summary>{speaker}’s briefing</summary>
      {opening}
      <p>{exercise.task}</p>
    </details>

    {result && <section className="casework-results" aria-labelledby={id + "-results"}>
      <h4 id={id + "-results"} tabIndex={-1} ref={output}>{judging ? "Judge the replay" : "Replay results"}</h4>
      {forecast && <p className={styles.forecast} data-matched={forecast.matched}>
        You predicted {forecast.predicted} {prediction.unit} · the replay shows {forecast.actual}.
      </p>}
      {judged && <p className={styles.forecast} data-matched={judged.right === judged.total}>You judged {judged.right} of {judged.total} checks correctly.</p>}
      {judging ? <>
        <Replay result={result} judging verdicts={judging} onJudge={(check, held) => setJudging((current) => ({ ...current, [check]: held }))} />
        <div className={styles.arrivalActions}>
          <button type="button" className="button button-primary" disabled={Object.keys(judging).length < result.checks.length} onClick={() => finishJudging()}>
            Show the verdict</button>
          <button type="button" className="button button-text" onClick={() => finishJudging(true)}>Skip judging</button>
        </div>
      </> : <details className={styles.replayDetails} open={!result.passed}>
        <summary>{sampleCurrent ? "Sample replay details" : "Previous sample replay details"}</summary>
        <Replay result={result} assist={sampleCurrent ? (check, index) => assist(check, index, "sample") : undefined} />
      </details>}
      {!judging && (result.passed || retest) ? <section className="casework-retest" aria-labelledby={id + "-arrival"}>
        <h4 id={id + "-arrival"} tabIndex={-1} ref={newCase}>{exercise.retest.name}</h4>
        <p>{exercise.retest.evidence}</p>
        {retest && <p className={styles.arrivalStatus} tabIndex={-1} ref={newCaseOutcome}
          data-state={!retestCurrent ? "stale" : retest.passed ? "passed" : "review"}>
          {!retestCurrent ? "Previous new-scenario result. Run the current sample before trying again."
            : retest.passed ? saved ? "New scenario passed." : "New scenario passed. Your outcome is ready to save."
              : "New scenario needs attention. Review what happened, then update the setup."}
        </p>}
        <div className={styles.arrivalActions}>
          {sampleCurrent && result.passed && retestCurrent && retest?.passed && (saved
            ? <p className="casework-saved"><Check size={17} aria-hidden="true" />Outcome saved</p>
            : <button type="button" className="button button-primary" onClick={() => void save()} disabled={busy}>
              <Check size={16} aria-hidden="true" />{busy ? "Saving…" : "Save outcome"}
            </button>)}
          <button type="button" className="button button-outline" disabled={!sampleCurrent || !result.passed || busy}
            onClick={runNewCase}><Play size={15} aria-hidden="true" />{retest ? "Replay the new scenario" : "Try the new scenario"}</button>
          {saved && <button type="button" className="button button-text" onClick={startOver}>
            <RotateCcw size={15} aria-hidden="true" />Start a fresh attempt</button>}
        </div>
        {retest && <details className={styles.replayDetails} open={!retest.passed}>
          <summary>{retestCurrent ? "New scenario replay details" : "Previous new-scenario replay details"}</summary>
          <Replay result={retest} assist={retestCurrent ? (check, index) => assist(check, index, "new-case") : undefined} />
        </details>}
        {retestCurrent && retest?.passed && sampleCurrent && result.passed && <ExamDebrief exercise={exercise} draft={draft} mastery={mastery} />}
      </section> : null}
    </section>}
    {error && <p className="academy-error" role="alert">{error}</p>}
    {legacyReplay}
  </section></GlossaryScope>;
}
