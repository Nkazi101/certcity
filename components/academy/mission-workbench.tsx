import { useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { missionPassed, replayMission } from "../../lib/claude/missions";
import type { Choices, Mission } from "../../lib/claude/missions";
import type { MissionRecord } from "../../lib/claude/pathway";
import { acknowledgeReview, missionFollowupQuestions, missionQuestions, saveMission, saveMissionDebrief, saveMissionDraft, saveMissionFollowup, saveMissionInterview, saveTransfer } from "../../lib/claude/pathway";
import { tracks } from "../../lib/claude/blueprints";
import { isCorrect } from "../../lib/certification-progress";
import { objectiveTitle } from "../../lib/claude/practice";
import { sources } from "../../lib/claude/items";
import { missionExperiences } from "../../lib/claude/mission-experiences";
import { ExternalLink } from "./chrome";
import { QuestionReport } from "./question-report";
import { evidenceFingerprint } from "../../lib/claude/evidence-snapshot";
import { ConversationAction, ConversationFrame } from "../city-conversation";
import { MissionLab } from "./mission-lab";

type Workbench = Extract<Mission, { kind: "workbench" }>;

export function MissionTransfer({ mission, record, onChange }: {
  mission: Mission;
  record?: MissionRecord;
  onChange: () => void;
}) {
  const questions = missionQuestions(mission);
  const track = tracks.find(({ id }) => id === mission.track)!;
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [local, setLocal] = useState<MissionRecord["check"]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [retaking, setRetaking] = useState(false);
  const result = retaking ? local : record?.check ?? local;
  const heading = useRef<HTMLHeadingElement>(null);
  const complete = questions.every(({ id, correct }) => answers[id]?.length === correct.length);

  async function submit() {
    if (!complete || busy) return;
    const saving = saveTransfer(mission, answers, retaking);
    if (!saving) return;
    setBusy(true);
    const response = await saving;
    setLocal(response.record.check);
    setRetaking(false);
    setError(!response.saved);
    setBusy(false);
    onChange();
    requestAnimationFrame(() => heading.current?.focus());
  }

  return (
    <section className="mission-transfer" aria-labelledby="mission-check-title">
      <h3 id="mission-check-title" ref={heading} tabIndex={-1}>{result ? "Exam check results" : "Exam check"}</h3>
      {result ? <>
        <p>{questions.filter((question) => isCorrect(question, result.answers[question.id])).length} of {questions.length} correct</p>
        {record?.checkHistory?.length ? <details className="mission-prior-checks">
          <summary>Earlier checks · {record.checkHistory.length} saved</summary>
          {record.checkHistory.map((check, index) => <p key={index}>Check {index + 1} · {questions.filter((question) => isCorrect(question, check.answers[question.id])).length} of {questions.length} correct
            {check.submittedAt ? ` · ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(check.submittedAt)}` : " · date unavailable"}</p>)}
        </details> : null}
        {questions.map((question) => {
          const correct = isCorrect(question, result.answers[question.id]);
          const [label, url] = sources[question.source];
          return <details className="academy-review-item" key={question.id}>
            <summary><span>{question.objective} · {objectiveTitle(track, question)}</span><span>{correct ? "Correct" : "Needs review"}</span></summary>
            <div className="academy-review-body">
              <p><strong>{question.scenario}</strong></p>
              {question.context && <p className="mission-question-context">{question.context}</p>}
              <p>{question.prompt}</p>
              <p>{question.explanation}</p>
              {result.priorExposure.includes(question.id) && <p>Previously seen in practice.</p>}
              <ul className="academy-review-options">
                {question.options.map(([id, label]) => (
                  <li key={id} data-correct={question.correct.includes(id)}>
                    <strong>{label}</strong>
                    {question.correct.includes(id) && <span className="academy-option-status">Correct response</span>}
                    {result.answers[question.id].includes(id) && <span className="academy-option-status">Your response</span>}
                    {question.rationales[id] && <p>{question.rationales[id]}</p>}
                  </li>
                ))}
              </ul>
              <ExternalLink href={url}>{label}</ExternalLink>
              {(!correct || result.priorExposure.includes(question.id)) && !record?.reviewed?.includes(question.objective) &&
                <button type="button" className="button button-outline" onClick={async () => {
                  const response = await acknowledgeReview(mission, question.objective);
                  setError(!response.saved);
                  onChange();
                }}>Mark explanation reviewed</button>}
              <QuestionReport trackId={track.id} version="july-2026" itemId={question.id} revision={evidenceFingerprint(question)} />
            </div>
          </details>;
        })}
        {!result.submittedAt && <button className="button button-outline" type="button" onClick={() => {
          setAnswers({});
          setLocal(undefined);
          setRetaking(true);
          requestAnimationFrame(() => heading.current?.focus());
        }}>Start new practice questions to schedule the 7-day review</button>}
        {error && <p role="alert">This browser could not save the practice questions.</p>}
      </> : (
        <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <p>Apply the same skills in a different setting. Explanations appear after you submit.</p>
          {questions.map((question) => {
            const picks = answers[question.id] ?? [];
            const multiple = question.correct.length > 1;
            return <fieldset className="academy-fieldset" key={question.id} disabled={busy}>
              <legend><strong>{question.scenario}</strong>{question.context && <span className="mission-question-context">{question.context}</span>}<span>{question.prompt}</span><small>{multiple ? "Select two responses" : "Select one response"}</small></legend>
              {question.options.map(([id, label]) => <label className="academy-option" key={id}>
                <input name={question.id} type={multiple ? "checkbox" : "radio"} checked={picks.includes(id)}
                  disabled={multiple && picks.length >= question.correct.length && !picks.includes(id)}
                  onChange={() => setAnswers((current) => {
                    const previous = current[question.id] ?? [];
                    const next = multiple ? previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id] : [id];
                    return { ...current, [question.id]: next };
                  })} />
                <span>{label}</span>
              </label>)}
            </fieldset>;
          })}
          <button className="button button-primary" disabled={!complete || busy} type="submit">Submit practice questions</button>
        </form>
      )}
    </section>
  );
}

export function MissionFollowup({ mission, record, onChange }: {
  mission: Mission;
  record?: MissionRecord;
  onChange: () => void;
}) {
  const track = tracks.find(({ id }) => id === mission.track)!;
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [local, setLocal] = useState<MissionRecord["followup"]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const result = record?.followup ?? local;
  const questions = missionFollowupQuestions(mission, result?.answers);
  const complete = questions.length > 0 && questions.every(({ id, correct }) => answers[id]?.length === correct.length);

  async function submit() {
    if (!complete || busy) return;
    const saving = saveMissionFollowup(mission, answers);
    if (!saving) return;
    setBusy(true);
    const response = await saving;
    setLocal(response.record.followup);
    setError(!response.saved);
    setBusy(false);
    onChange();
    requestAnimationFrame(() => heading.current?.focus());
  }

  return <section className="mission-followup" aria-labelledby="mission-followup-title">
    <h3 id="mission-followup-title" ref={heading} tabIndex={-1}>{result ? "7-day review results" : "7-day review"}</h3>
    {result ? <>
      <p>{questions.filter((question) => isCorrect(question, result.answers[question.id])).length} of {questions.length} correct · delayed domain practice</p>
      {questions.map((question) => {
        const correct = isCorrect(question, result.answers[question.id]);
        const [label, url] = sources[question.source];
        return <details className="academy-review-item" key={question.id}>
          <summary><span>{question.objective} · {objectiveTitle(track, question)}</span><span>{correct ? "Correct" : "Needs review"}</span></summary>
          <div className="academy-review-body">
            <p><strong>{question.scenario}</strong></p><p>{question.prompt}</p><p>{question.explanation}</p>
            <ul className="academy-review-options">{question.options.map(([id, label]) => <li key={id} data-correct={question.correct.includes(id)}>
              <strong>{label}</strong>{question.correct.includes(id) && <span className="academy-option-status">Correct response</span>}
              {result.answers[question.id].includes(id) && <span className="academy-option-status">Your response</span>}
              {question.rationales[id] && <p>{question.rationales[id]}</p>}
            </li>)}</ul>
            <ExternalLink href={url}>{label}</ExternalLink>
            <QuestionReport trackId={track.id} version="july-2026" itemId={question.id} revision={evidenceFingerprint(question)} />
          </div>
        </details>;
      })}
      {error && <p role="alert">This browser could not save the follow-up.</p>}
    </> : <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <p>These held-out questions revisit the exam domains in this mission. They are practice, not an exam score.</p>
      {questions.map((question) => {
        const picks = answers[question.id] ?? [];
        const multiple = question.correct.length > 1;
        return <fieldset className="academy-fieldset" key={question.id} disabled={busy}>
          <legend><strong>{question.scenario}</strong><span>{question.prompt}</span><small>{multiple ? "Select two responses" : "Select one response"}</small></legend>
          {question.options.map(([id, label]) => <label className="academy-option" key={id}>
            <input name={question.id} type={multiple ? "checkbox" : "radio"} checked={picks.includes(id)}
              disabled={multiple && picks.length >= question.correct.length && !picks.includes(id)}
              onChange={() => setAnswers((current) => {
                const previous = current[question.id] ?? [];
                const next = multiple ? previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id] : [id];
                return { ...current, [question.id]: next };
              })} />
            <span>{label}</span>
          </label>)}
        </fieldset>;
      })}
      <button className="button button-primary" disabled={!complete || busy} type="submit">Submit 7-day review</button>
      {error && <p role="alert">This browser could not save the follow-up.</p>}
    </form>}
  </section>;
}

type WorkBeat = "greeting" | "first-answer" | "second-opening" | "second-answer" | "evidence" | "decision" | "result";

export function MissionWorkbench({ mission, record, dialog, onClose, onChange, onTaskSaved, moduleProgress, enterWork }: {
  mission: Workbench;
  record?: MissionRecord;
  dialog: RefObject<HTMLDialogElement | null>;
  onClose: () => void;
  onChange: () => void;
  onTaskSaved: () => void;
  moduleProgress: ReactNode;
  enterWork?: boolean;
}) {
  const experience = missionExperiences[mission.id]!;
  const first = experience.interviews[0];
  const second = experience.interviews[1];
  const [choices, setChoices] = useState<Choices>(record?.draft ?? record?.choices ?? {});
  const [run, setRun] = useState<Choices | null>(record?.draft ? null : record?.choices ?? null);
  const [saved, setSaved] = useState(!!record?.choices && !record?.draft);
  const [interviewed, setInterviewed] = useState<string[]>(record?.interviewed ?? []);
  const [beat, setBeat] = useState<WorkBeat>(enterWork ? run ? "result" : "decision" : "greeting");
  const [position, setPosition] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef<Promise<unknown>>(Promise.resolve());
  const experienceInterview = beat === "second-opening" || beat === "second-answer" ? second : first;
  const control = mission.decisions[position];
  const replay = run && replayMission(mission, run);
  const workload = run && mission.simulate?.(run);
  const baseWorkload = mission.simulate?.({});
  const meetsGoals = !!run && missionPassed(mission, run);
  const spoken = new Set([...interviewed, ...(record?.interviewed ?? [])]);

  function focusBeat(next: WorkBeat, index = position) {
    setPosition(index);
    setBeat(next);
  }

  function rememberChoices(next: Choices) {
    setChoices(next);
    setSaved(false);
    setRun(null);
    setError(false);
    pending.current = pending.current.then(async () => {
      const response = await saveMissionDraft(mission, next);
      setError(!response?.saved);
    });
  }

  function choose(indices: number[]) {
    if (!control) return;
    const next = { ...choices, [control.objective]: indices };
    rememberChoices(next);
  }

  function runAssignment() {
    setRun(choices);
    focusBeat("result");
  }

  async function recordInterview(interview: typeof first, nextBeat: WorkBeat) {
    setBusy(true);
    const response = await saveMissionInterview(mission, interview.id);
    setBusy(false);
    if (!response?.saved) { setError(true); return; }
    setInterviewed((current) => [...new Set([...current, interview.id])]);
    setError(false);
    onChange();
    focusBeat(nextBeat);
  }

  async function save() {
    if (!run || busy) return;
    setBusy(true);
    await pending.current;
    const saving = saveMission(mission, run);
    if (!saving) { setBusy(false); return; }
    const response = await saving;
    setBusy(false);
    setError(!response.saved);
    if (response.saved) { onChange(); onTaskSaved(); }
  }

  return <ConversationFrame dialog={dialog} title={mission.title} name={experienceInterview.name} role={experienceInterview.role}
    portrait={experienceInterview.portrait} variant={beat === "decision" || beat === "result" ? "workbench" : "conversation"} step={[beat, position].join(":")}
    moduleProgress={moduleProgress}
    onClose={() => { onClose(); void pending.current.then(onChange); }}>
    {beat !== "decision" && beat !== "result" && <div className="conversation-line" aria-live="polite" tabIndex={-1}>
      {beat === "greeting" && <p>{first.opening}</p>}
      {beat === "first-answer" && <p>{first.reply}</p>}
      {beat === "second-opening" && <p>{second.opening}</p>}
      {beat === "second-answer" && <p>{second.reply}</p>}
      {beat === "evidence" && <><p className="small-label">Mission file · {mission.workload}</p><p>{mission.brief}</p><p>{mission.specialist}</p></>}
    </div>
    }

    {beat === "greeting" && <div className="conversation-actions">
      <ConversationAction primary onClick={() => focusBeat("first-answer")}>{first.question}</ConversationAction>
      {(record?.choices || record?.draft) && <ConversationAction onClick={() => focusBeat(run ? "result" : "decision", 0)}>{run ? "Open saved replay" : "Resume work"}</ConversationAction>}
    </div>}
    {beat === "first-answer" && <div className="conversation-actions"><ConversationAction primary disabled={busy} onClick={() => void recordInterview(first, "second-opening")}>Hear from {second.name.split(" ")[0]}</ConversationAction></div>}
    {beat === "second-opening" && <div className="conversation-actions"><ConversationAction primary onClick={() => focusBeat("second-answer")}>{second.question}</ConversationAction></div>}
    {beat === "second-answer" && <div className="conversation-actions"><ConversationAction primary disabled={busy} onClick={() => void recordInterview(second, "evidence")}>Open mission file</ConversationAction></div>}

    {beat === "evidence" && <>
      <details className="conversation-file"><summary>Review stakeholder conversations and mission evidence</summary>
        <dl>{experience.interviews.map((interview) => <div key={interview.id}><dt>{interview.name} · {spoken.has(interview.id) ? "Conversation saved" : "Stakeholder"}</dt>
          <dd><strong>You asked:</strong> {interview.question} <strong>{interview.name.split(" ")[0]}:</strong> {interview.reply}</dd></div>)}
          {mission.decisions.map(({ objective, station: name, evidence }) => <div key={objective}><dt>{name} · Objective {objective}</dt><dd>{evidence}</dd></div>)}
        </dl>
      </details>
      <div className="conversation-actions"><ConversationAction primary onClick={() => focusBeat(run ? "result" : "decision", 0)}>{run ? "Open saved replay" : "Open work area"}</ConversationAction></div>
    </>}

    {((beat === "decision" && !run) || (beat === "result" && !!run && !!replay)) && control && <MissionLab
      mission={mission}
      position={position}
      choices={choices}
      run={run}
      saved={saved}
      meetsGoals={meetsGoals}
      replay={replay ?? []}
      workload={workload || null}
      baseWorkload={baseWorkload ?? null}
      busy={busy}
      error={error}
      onChoose={choose}
      onPosition={(index) => focusBeat("decision", index)}
      onRun={runAssignment}
      onAdjust={() => { setRun(null); setSaved(false); focusBeat("decision", 0); }}
      onSave={() => void save()}
      onBackToEvidence={() => focusBeat("evidence")}
    />}
  </ConversationFrame>;
}
