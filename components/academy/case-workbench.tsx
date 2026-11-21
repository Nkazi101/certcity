import { Check, CircleAlert, ClipboardList, FileText, Gauge, Play, Terminal, Workflow } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { CaseDraft, CaseValue, Casework } from "../../lib/claude/casework";
import { caseCapacity, caseworkPassed, replayCasework, startingCase } from "../../lib/claude/casework";
import { workLayout } from "../../lib/claude/cases/layouts";
import type { Mission } from "../../lib/claude/missions";
import { saveCityCasework } from "../../lib/claude/pathway";
import type { MissionRecord } from "../../lib/claude/pathway";
import { CaseSurface } from "./case-surface";

const appearance = {
  document: { Icon: FileText, inputs: "On the desk", edit: "Working draft", run: "Preview the work" },
  terminal: { Icon: Terminal, inputs: "Captured inputs", edit: "Change the running setup", run: "Run the sample" },
  flow: { Icon: Workflow, inputs: "Incoming work", edit: "Change the routes", run: "Replay the work" },
  operations: { Icon: Gauge, inputs: "Reports and limits", edit: "Set the operating plan", run: "Simulate the plan" },
} as const;

function Artifacts({ output }: { output: ReturnType<typeof replayCasework>["output"] }) {
  return <div className="casework-artifacts">
    {output.map(([title, content]) => <section key={title}><h5>{title}</h5><pre>{content}</pre></section>)}
  </div>;
}

function Capacity({ value }: { value: NonNullable<ReturnType<typeof replayCasework>["capacity"]> }) {
  return <p className="casework-meter" data-passed={value.used <= value.limit}>
    <Gauge size={18} aria-hidden="true" />
    <strong>{value.label}</strong><span>{value.used} / {value.limit} {value.unit}</span>
  </p>;
}

function Replay({ result }: { result: ReturnType<typeof replayCasework> }) {
  const { checks, capacity } = result;
  return <div className="casework-replay">
    {capacity && <Capacity value={capacity} />}
    {checks.map(({ name, evidence, passed, effect }) => <article className="casework-row" data-passed={passed} key={name}>
      {passed ? <Check size={18} aria-hidden="true" /> : <CircleAlert size={18} aria-hidden="true" />}
      <div><h5>{name}</h5><p>{evidence}</p><p className="casework-effect">{effect}</p></div>
    </article>)}
    {!!result.output.length && <Artifacts output={result.output} />}
  </div>;
}

export function CaseWorkbench({ mission, exercise, record, speaker, onChange, onSaved, beforeClose, legacyReplay }: {
  mission: Mission;
  exercise: Casework;
  record?: MissionRecord;
  speaker: string;
  onChange: () => void;
  onSaved: () => void;
  beforeClose: (pending: Promise<unknown>) => void;
  legacyReplay?: ReactNode;
}) {
  const [draft, setDraft] = useState<CaseDraft>(() => record?.caseDraft ?? record?.casework ?? startingCase(exercise));
  const [tested, setTested] = useState<CaseDraft | null>(() => !record?.caseDraft && record?.casework ? draft : null);
  const [testedAgain, setTestedAgain] = useState<CaseDraft | null>(() => !record?.caseDraft && record?.casework ? draft : null);
  const [saved, setSaved] = useState(() => !record?.caseDraft && !!record?.casework);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<Promise<unknown>>(Promise.resolve());
  const output = useRef<HTMLHeadingElement>(null);
  const workbench = useRef<HTMLElement>(null);
  const focusAfterRun = useRef(false);
  const id = useId();
  const layout = workLayout(mission.id);
  const { Icon, inputs, edit, run } = appearance[exercise.view];
  const baseline = replayCasework(exercise, startingCase(exercise));
  const capacity = caseCapacity(exercise, draft);
  const result = tested && replayCasework(exercise, tested);
  const retest = testedAgain && replayCasework(exercise, testedAgain, true);
  const sampleCurrent = tested === draft;

  function focusResult() {
    const response = workbench.current?.querySelector<HTMLElement>('.case-object-result[data-run="sample"][data-passed="false"]') ??
      workbench.current?.querySelector<HTMLElement>('.case-object-result[data-run="sample"]');
    (response ?? output.current)?.focus();
  }

  useEffect(() => {
    if (!focusAfterRun.current) return;
    focusAfterRun.current = false;
    focusResult();
  }, [tested]);

  function update(field: string, value: CaseValue) {
    if (draft[field] === value) return;
    const next = { ...draft, [field]: value };
    setDraft(next);
    setSaved(false);
    setError("");
    const write = pending.current.then(async () => {
      const response = await saveCityCasework(mission, next);
      if (!response?.saved) setError("Your draft is open here. This browser could not save the latest change.");
    });
    pending.current = write;
    beforeClose(write);
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

  return <section className="casework" data-workstyle={exercise.view} data-surface={layout.kind} aria-labelledby={id + "-title"}>
    <header className="casework-header">
      <span className="casework-icon"><Icon size={21} aria-hidden="true" /></span>
      <div><h3 id={id + "-title"}>{exercise.station}</h3><p>{exercise.task}</p></div>
    </header>
    <blockquote className="casework-opening">“{exercise.opening}” <cite>{speaker}</cite></blockquote>

    <section className="casework-panel casework-controls" aria-label={edit} ref={workbench}>
      {capacity && <Capacity value={capacity} />}
      <CaseSurface missionId={mission.id} retestCurrent={testedAgain === draft} {...{ exercise, layout, draft, update, busy, baseline, result, retest, sampleCurrent }} />
      <div className="casework-run-actions">
        <button type="button" className="button button-primary" onClick={() => {
          if (sampleCurrent) focusResult();
          else {
            focusAfterRun.current = true;
            setTested(draft);
          }
        }}><Play size={16} aria-hidden="true" />{run}</button>
        {result && <button type="button" className="button button-outline" onClick={() => output.current?.focus()}>
          {result.passed && sampleCurrent ? "See results and new case" : "See all results"}
        </button>}
      </div>
    </section>
    <details className="casework-file">
      <summary><ClipboardList size={17} aria-hidden="true" />{inputs} · complete case file</summary>
      <dl>{exercise.references.map(([name, content]) => <div key={name}><dt>{name}</dt><dd>{content}</dd></div>)}</dl>
      <details className="casework-before"><summary>Replay the starting setup</summary><Replay result={baseline} /></details>
    </details>

    {result && <section className="casework-results" aria-label="Replay results">
      <h4 tabIndex={-1} ref={output}>Sample replay</h4>
      {!sampleCurrent && <p role="status">Showing the last run. Replay the sample to check your changes.</p>}
      <Replay result={result} />
      {result.passed || retest ? <section className="casework-retest" aria-label="New arrival">
        <h4>{exercise.retest.name}</h4>
        <p>{exercise.retest.evidence}</p>
        <button type="button" className="button button-outline" disabled={!sampleCurrent || !result.passed}
          onClick={() => setTestedAgain(draft)}><Play size={15} aria-hidden="true" />Try the new case</button>
        {retest && <div role="status"><Replay result={retest} /></div>}
      </section> : <p role="status">Check the results with a warning, change the setup, and try the sample again.</p>}
      {sampleCurrent && result.passed && testedAgain === draft && retest?.passed && (saved
        ? <p className="casework-saved"><Check size={17} aria-hidden="true" />Outcome saved</p>
        : <button type="button" className="button button-primary" onClick={() => void save()} disabled={busy}>
          <Check size={16} aria-hidden="true" />{busy ? "Saving…" : "Save outcome"}
        </button>)}
    </section>}
    {error && <p className="academy-error" role="alert">{error}</p>}
    {legacyReplay}
  </section>;
}
