import { skillNote } from "../lib/claude/skill-notes";
import { ArrowLeft, ArrowRight, BookOpen, Check, ClipboardCheck, GraduationCap, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { FormEvent, RefObject } from "react";
import { progressScope, subscribeToProgress } from "../lib/progress-storage";
import { dispatchStudyRequest } from "../lib/supabase/study";
import type { DispatchStudy } from "../lib/supabase/study";
import { useAccount } from "./account";
import { architectFoundations, lookupResults, otherErrors } from "../lib/certification";
import type { CheckStage } from "../lib/certification";
import { checkForAttempt, skillChecks } from "../lib/exam-practice";
import type { SkillCheck } from "../lib/exam-practice";
import {
  certificationKey, dispatchPreparationSteps, emptyProgress, followupAt, followupDays, gradeAttempt, isCorrect, readCertification, updateCertification,
} from "../lib/certification-progress";
import type { CertificationProgress, SkillAttempt } from "../lib/certification-progress";
import { missionFollowupAt, missionPreparationSteps, missionQuestions, missionFollowupQuestions, saveMissionDebrief } from "../lib/claude/pathway";
import type { MissionRecord } from "../lib/claude/pathway";
import { lensForMission } from "../lib/claude/assignment-lens";
import { assignmentOutcome, hasAssignmentWork, proofPaths } from "../lib/claude/assignment-work";
import { assignments, isCityAssignment } from "../lib/claude/assignments";
import { replayMission } from "../lib/claude/missions";
import type { Mission } from "../lib/claude/missions";
import { tracks, trackHref, trackTitle } from "../lib/claude/blueprints";
import { missionExperiences } from "../lib/claude/mission-experiences";
import { places } from "../lib/world";
import { objectiveTitle } from "../lib/claude/practice";
import { sources } from "../lib/claude/items";
import { MissionFollowup, MissionTransfer } from "./academy/mission-workbench";
import { ExternalLink } from "./academy/chrome";
import { caseworkFor } from "../lib/claude/cases";
import { replayCasework } from "../lib/claude/casework";

export type MissionCertificationPage = "mission-debrief" | "mission-check" | "mission-followup";
export type CertificationPage = "pathway" | "debrief" | CheckStage | "previous-first" | "previous-followup" |
  "browser-first" | "browser-followup" | MissionCertificationPage;
type BrowserStudy = Pick<CertificationProgress, "first" | "followup">;

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
const dispatchPages = ["debrief", "first", "followup"] as const;
const missionPages = ["mission-debrief", "mission-check", "mission-followup"] as const;

export function useCertificationProgress(shiftComplete: boolean) {
  const { ready, user } = useAccount();
  const userId = user?.id;
  const [progress, setProgress] = useState(emptyProgress);
  const [sessionOnly, setSessionOnly] = useState(false);
  const [study, setStudy] = useState<DispatchStudy | null>(null);
  const [studyError, setStudyError] = useState<string | null>(null);
  const [reloadStudy, setReloadStudy] = useState(0);
  const latest = useRef(emptyProgress);

  useEffect(() => {
    if (!ready) return;
    function restore() {
      const stored = readCertification() ?? emptyProgress;
      latest.current = stored;
      setProgress(stored);
      setSessionOnly(false);
    }
    restore();
    return subscribeToProgress((key, local) => {
      if (!local && (key === certificationKey || key === null)) restore();
    });
  }, [ready]);

  useEffect(() => {
    if (!ready || !userId || !shiftComplete) return;
    const controller = new AbortController();
    const restore = async () => {
      const response = await dispatchStudyRequest<DispatchStudy>("status", undefined, undefined, controller.signal);
      if (controller.signal.aborted) return;
      setStudyError(response.error);
      if (response.data) {
        const incoming = response.data;
        setStudy((current) => ({
          ...incoming,
          first: incoming.first ?? current?.first ?? null,
          followup: incoming.followup ?? current?.followup ?? null,
          dueAt: incoming.dueAt ?? current?.dueAt ?? null,
        }));
      }
    };
    void restore();
    window.addEventListener("focus", restore);
    return () => {
      controller.abort();
      window.removeEventListener("focus", restore);
    };
  }, [ready, userId, shiftComplete, reloadStudy]);

  const recordResult = useCallback((stage: CheckStage, result: SkillAttempt) => {
    setStudy((current) => current && {
      ...current,
      [stage]: result,
      dueAt: stage === "first" ? followupAt(result) : current.dueAt,
    });
  }, []);

  const startStudy = useCallback(async (stage: CheckStage, signal: AbortSignal) => {
    const response = await dispatchStudyRequest<{ result?: SkillAttempt }>("start", stage, undefined, signal);
    if (!signal.aborted && response.data?.result) recordResult(stage, response.data.result);
    return response.error;
  }, [recordResult]);

  async function update(action: Parameters<typeof updateCertification>[1]) {
    if (action.kind === "submit" && study?.eligible) {
      const scope = progressScope();
      const response = await dispatchStudyRequest<{ result: SkillAttempt }>("submit", action.stage, action.answers);
      if (progressScope() !== scope) return "Your account changed. Try again.";
      if (response.data?.result) recordResult(action.stage, response.data.result);
      return response.error;
    }
    const { progress: updated, saved, error } = await updateCertification(latest.current, action);
    if (!error) {
      latest.current = updated;
      setProgress(updated);
      setSessionOnly(!saved);
    }
    return error;
  }

  const displayProgress = study?.eligible ? {
    ...progress, first: study.first, followup: study.followup,
  } : progress;
  return {
    progress: displayProgress, sessionOnly, update,
    startStudy: study?.eligible ? startStudy : undefined,
    studyPending: !!userId && shiftComplete && !study,
    studyError,
    retryStudy: () => setReloadStudy((current) => current + 1),
    dueAt: study?.eligible ? study.dueAt : null,
    committedDispatchCheck: study?.eligible ? study.first : undefined,
    browserStudy: study?.eligible ? { first: progress.first, followup: progress.followup } : undefined,
  };
}

function checkResult(stage: CheckStage, attempt: SkillAttempt) {
  const check = checkForAttempt(stage, attempt.checkId);
  return `${gradeAttempt(check, attempt)} of ${check.questions.length} correct`;
}

export function ModuleProgressButton({ completed, onOpen }: { completed: readonly boolean[]; onOpen: () => void }) {
  const count = completed.filter(Boolean).length;
  return <button className="button button-outline module-progress-button" type="button" aria-haspopup="dialog"
    aria-label={`Module progress, ${count} of ${completed.length} steps`} onClick={onOpen}>
    <GraduationCap size={17} aria-hidden="true" />
    <span>Module progress</span>
    <span className="module-progress-count" aria-hidden="true">{count}/{completed.length}</span>
  </button>;
}

type ModuleStep = { title: string; description: string; action: string; open: () => void; scheduled?: boolean };

function ModulePathway({ title, intro, location, steps, completed, practice, guide, href, pathwayName, onLens, history }: {
  title: string;
  intro: React.ReactNode;
  location: React.ReactNode;
  steps: ModuleStep[];
  completed: readonly boolean[];
  practice: string;
  guide: string;
  href: string;
  pathwayName: string;
  onLens: () => void;
  history?: React.ReactNode;
}) {
  const count = completed.filter(Boolean).length;
  const next = completed.findIndex((done, index) => !done && !steps[index].scheduled);
  return <>
    <div className="certification-intro">
      <h3>{title}</h3><p>{intro}</p>
      <p className="certification-muted">{location}</p>
    </div>
    <div className="preparation-progress">
      <label htmlFor="module-progress">Your progress in this module</label><strong>{count} of {steps.length} steps</strong>
      <progress id="module-progress" max={steps.length} value={count} />
    </div>
    <ol className="pathway-list">
      {steps.map(({ title, description, action, open }, index) => (
        <li key={title} className="pathway-row" aria-current={index === next ? "step" : undefined}>
          <span className="pathway-icon" aria-hidden="true">{completed[index] ? <Check size={17} /> : index + 1}</span>
          <div><h4>{title}</h4><p>{completed[index] && <strong>Complete · </strong>}{index === next && <strong>Suggested next · </strong>}{description}</p></div>
          <button className={`button ${index === next ? "button-primary" : "button-outline"}`} type="button" onClick={open}>
            {action} <ArrowRight size={15} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ol>
    <div className="preparation-extra">
      <p><strong>Optional practice</strong> · {practice}</p>
      <button className="button button-outline" type="button" onClick={onLens}><BookOpen size={16} aria-hidden="true" /> Open Exam Lens</button>
    </div>
    {history}
    <div className="certification-sources">
      <a href={guide} target="_blank" rel="noreferrer">Exam guide (PDF)</a>
      <Link href={href}>Full {pathwayName} pathway</Link>
    </div>
  </>;
}

function Pathway({ progress, browserStudy, completed, unlocked, onNavigate, onDispatch, onLens }: {
  progress: CertificationProgress;
  browserStudy?: BrowserStudy;
  completed: ReturnType<typeof dispatchPreparationSteps>;
  unlocked: boolean;
  onNavigate: (page: CertificationPage) => void;
  onDispatch: () => void;
  onLens: () => void;
}) {
  const [shiftComplete] = completed;
  const { first, followup } = progress;
  const steps: ModuleStep[] = [
    { title: "Repair the City Dispatch lookup", description: shiftComplete ? "A repaired shift is saved." : "Fix false ‘order not found’ replies and save an improved shift.", action: shiftComplete ? "Revisit assignment" : "Start assignment", open: onDispatch },
    { title: "Open the technical debrief", description: "Compare MCP responses and the recovery decisions they support.", action: "Read debrief", open: () => onNavigate("debrief") },
    { title: "Take the exam-style check", description: first ? checkResult("first", first) : "A bike-share scenario with single- and multiple-response questions.", action: first ? "Review results" : "Start skill check", open: () => onNavigate("first") },
    { title: "Return for the follow-up", description: followup ? checkResult("followup", followup) : unlocked ? "Apply the same skills in an arts center scenario."
      : first ? `Available ${dateFormat.format(followupAt(first))}.` : `Available ${followupDays} days after the first check.`,
      action: followup ? "Review follow-up" : unlocked ? "Start follow-up" : "View follow-up", open: () => onNavigate("followup"), scheduled: !unlocked },
  ];
  return <ModulePathway title={architectFoundations.title}
    intro={<><strong>Task {architectFoundations.task}</strong> · {architectFoundations.objective}</>}
    location={`City Dispatch assignment · Task ${architectFoundations.task}`}
    steps={steps} completed={completed}
    practice={progress.practiced ? "Museum exercise attempted." : "Try a museum scenario with feedback."}
    guide={architectFoundations.guide} href="/certifications/architect-foundations" pathwayName="Architect Foundations" onLens={onLens}
    history={(progress.previousFirst || progress.previousFollowup || browserStudy?.first || browserStudy?.followup) && <details className="preparation-history">
      <summary>Earlier practice results</summary>
      {progress.previousFirst && <button type="button" className="button button-text" onClick={() => onNavigate("previous-first")}>Original skill check · {checkResult("first", progress.previousFirst)}</button>}
      {progress.previousFollowup && <button type="button" className="button button-text" onClick={() => onNavigate("previous-followup")}>Original follow-up · {checkResult("followup", progress.previousFollowup)}</button>}
      {browserStudy?.first && <button type="button" className="button button-text" onClick={() => onNavigate("browser-first")}>Earlier skill check · {checkResult("first", browserStudy.first)}</button>}
      {browserStudy?.followup && <button type="button" className="button button-text" onClick={() => onNavigate("browser-followup")}>Earlier follow-up · {checkResult("followup", browserStudy.followup)}</button>}
    </details>} />;
}

function MissionPathway({ mission, record, completed, unlocked, onNavigate, onStart, onLens }: {
  mission: Mission;
  record?: MissionRecord;
  completed: ReturnType<typeof missionPreparationSteps>;
  unlocked: boolean;
  onNavigate: (page: MissionCertificationPage) => void;
  onStart: () => void;
  onLens: () => void;
}) {
  const track = tracks.find(({ id }) => id === mission.track)!;
  const questions = missionQuestions(mission);
  const [complete] = completed;
  const first = record?.check;
  const followup = record?.followup;
  const dueAt = missionFollowupAt(first);
  const followupQuestions = missionFollowupQuestions(mission, followup?.answers);
  const checkScore = first ? `${questions.filter((question) => isCorrect(question, first.answers[question.id])).length} of ${questions.length} correct` : null;
  const followupScore = followup ? `${followupQuestions.filter((question) => isCorrect(question, followup.answers[question.id])).length} of ${followupQuestions.length} correct` : null;
  const room = missionExperiences[mission.id]?.room ?? "Assignment building";
  const place = places.find(({ id }) => id === mission.place)?.name ?? "Assignment building";
  const steps: ModuleStep[] = [
    { title: mission.title, description: complete ? "An assignment outcome is saved." : `Meet the team and complete the work in ${place}.`, action: complete ? "Revisit assignment" : "Start assignment", open: onStart },
    { title: "Open the technical debrief", description: "Review the system changes and the decisions they support.", action: "Read debrief", open: () => onNavigate("mission-debrief") },
    { title: "Take the exam-style check", description: checkScore ?? `${questions.length} original ${questions.length === 1 ? "question" : "questions"} mapped to this assignment.`, action: first ? "Review results" : "Start skill check", open: () => onNavigate("mission-check") },
    { title: "Return for the follow-up", description: followupScore ?? (unlocked ? `Apply the same skills to ${followupQuestions.length} held-out ${followupQuestions.length === 1 ? "question" : "questions"}.` : dueAt ? `Available ${dateFormat.format(dueAt)}.` : first ? "Retake the check to schedule the follow-up." : `Available ${followupDays} days after the first check.`),
      action: followup ? "Review follow-up" : unlocked ? "Start follow-up" : "View follow-up", open: () => onNavigate("mission-followup"), scheduled: !unlocked },
  ];
  const architectModule = track.id === "architect-foundations";
  return <ModulePathway title={architectModule ? architectFoundations.title : trackTitle(track)}
    intro={questions.map((question) => <span className="module-objective" key={question.objective}>
      <strong>{architectModule ? "Task" : "Objective"} {question.objective}</strong> · {objectiveTitle(track, question)}
    </span>)}
    location={<><strong>{mission.title}</strong> · {place} · {room}</>} steps={steps} completed={completed}
    practice={record?.practiced ? "Practice case attempted." : `Try the ${lensForMission(mission).scenario.toLowerCase()} case with feedback.`}
    guide={track.guide} href={trackHref(track)} pathwayName={`${track.role} ${track.level}`} onLens={onLens} />;
}

function WorkDebrief({ missionId, work }: { missionId: string; work?: MissionRecord["work"] }) {
  switch (missionId) {
    case "kitchen-extract":
      return <div className="mission-debrief-results">
        <h4>How the ledger catches invoice 303</h4>
        <p>The extractor can return <code>11000</code> as a valid integer. Comparing it with the trusted line sum of <code>10000</code> gives the ledger a reason to hold it for review.</p>
        <div className="result-examples">
          <section className="result-example"><h4>Valid output shape</h4><pre><code>{'{ "total_cents": 11000, "source_status": "readable" }'}</code></pre></section>
          <section className="result-example"><h4>Business validation</h4><pre><code>{"11,000¢ − 10,000¢ = 1,000¢ discrepancy"}</code></pre></section>
        </div>
        <p>Two null totals can mean different things. Use examples that preserve whether the supplier left a blank or made an unreadable mark. A known date can be reformatted after validator feedback. Conflicting source totals need a person to determine which is authoritative.</p>
      </div>;
    case "printworks-rules":
      return <div className="mission-debrief-results">
        <h4>What the evening shift inherits</h4>
        <p>Project instructions travel with the checkout. Riley’s user instructions stay local. A named Skill makes the release checklist callable and can link to its supporting example.</p>
        {work?.kind === "printworks-rules" && <pre><code>{`---\npaths:\n${proofPaths.filter(({ id }) => work.paths.includes(id)).map(({ glob }) => `  - "${glob}"`).join("\n")}\n---`}</code></pre>}
        <p>Paths are relative to the project. Scope the rule to the proof tests so it loads for their files and stays out of billing work.</p>
      </div>;
    case "library-desk":
      return <div className="mission-debrief-results">
        <h4>Verify the Project with a fresh chat</h4>
        <p>The approved FAQ and current access glossary live in project knowledge. Shared instructions define how to cite a claim and when to refer an exception. In the replay, rev 5 and rev 6 disagree on the cancellation window. Retire rev 5 from active knowledge and verify the 24-hour rule from rev 6.</p>
        <p>Connector scope is a separate control. The workspace can retrieve restricted material when the source account grants it, even if the Project never explicitly adds the circulation file.</p>
      </div>;
    case "printworks-stream":
      return <div className="mission-debrief-results">
        <h4>Trace data from the provider to the browser</h4>
        <p>The end of a network chunk can fall inside a data field or between event separators. Keep partial data until the next complete SSE frame arrives. A text delta updates the preview. The terminal event completes it, and a stream error leaves it provisional.</p>
        <p>Authenticate before forwarding the stream. Reproduce a split event and an upstream error with captured fixtures. A clean checkout should also load the proof rule for both proof-test trees and leave billing files alone.</p>
      </div>;
    case "library-retrieval-architecture":
      return <div className="mission-debrief-results">
        <h4>Trace the selected record before tuning generation</h4>
        <p>Q-318 tests the exact-ID path while the unfolded-sheet query tests paraphrases and ambiguity. Preserve revision metadata when indexing sections, filter superseded revisions, and inspect which candidate reaches the prompt.</p>
        <p>Reranking improves the ambiguous fixture, but reranking every query puts fixture p95 over the service limit. Compare quality by slice with end-to-end latency. Use linked timing and status fields to locate the affected stage without collecting restricted text.</p>
      </div>;
    case "archive-coordination":
      return <div className="mission-debrief-results">
        <h4>What the editor can verify</h4>
        <p>Keep the completed property register and assign the missing south ward to the worker with map access. Give each independent worker its own scope, dates, accession and citation requirements.</p>
        <div className="result-examples">
          <section className="result-example"><h4>Verified</h4><p>Register findings and map results from three wards, with their source references.</p></section>
          <section className="result-example"><h4>Unverified</h4><p>Two wards remained unchecked after the permitted retry. The editor could see where to resume.</p></section>
        </div>
        <p>A source that returned no matching record after completing a search supports a different claim from a source the worker could not check.</p>
      </div>;
  }
}

function MissionDebrief({ mission, record, complete, onComplete, onChange }: {
  mission: Mission;
  record?: MissionRecord;
  complete: boolean;
  onComplete: () => void;
  onChange: () => void;
}) {
  const track = tracks.find(({ id }) => id === mission.track)!;
  const questions = missionQuestions(mission);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const replay = mission.kind === "workbench" && record?.choices ? replayMission(mission, record.choices) : [];
  const original = mission.kind === "original" && isCityAssignment(mission.track) ? assignments[mission.track] : null;
  const exercise = caseworkFor(mission.id);
  const savedExercise = exercise && record?.casework ? replayCasework(exercise, record.casework, true) : null;

  return <>
    <div className="certification-intro">
      <p className="small-label">Technical debrief · {mission.title}</p>
      <h3>What the assignment teaches</h3>
      <p>{record?.work ? assignmentOutcome(record.work) : exercise ? exercise.opening : mission.specialist || mission.brief}</p>
    </div>
    {!complete && <p>Your replay results will appear here once you save an outcome.</p>}
    {exercise && <div className="mission-debrief-results">
      {savedExercise && savedExercise.checks.map(({ name, evidence, effect }) => <section key={name}>
        <h4>{name}</h4><p>{evidence}</p><p><strong>What your setup did</strong> · {effect}</p>
      </section>)}
      <p>{exercise.debrief}</p>
    </div>}
    {original && !exercise && <p>{original.debrief}</p>}
    {hasAssignmentWork(mission.id) && <WorkDebrief missionId={mission.id} work={record?.work} />}
    {!savedExercise && !record?.work && mission.kind === "workbench" && replay.length > 0 && <div className="mission-debrief-results">
      <h4>Your saved system decisions</h4>
      {replay.map(({ station, passed, traces }, index) => {
        const decision = mission.decisions[index];
        const labels = (record?.choices?.[decision.objective] ?? []).map((choice) => decision.options[choice]?.label).filter(Boolean);
        return <section key={decision.objective}>
          <h4>{station} · {passed ? "Target met" : "Needs review"}</h4>
          <p><strong>Evidence:</strong> {decision.evidence}</p><p><strong>Your configuration:</strong> {labels.join(" + ")}</p>
          {traces.map((trace) => <p key={trace}>{trace}</p>)}
        </section>;
      })}
    </div>}
    {!exercise && !hasAssignmentWork(mission.id) && mission.kind === "workbench" && !replay.length && <div className="mission-debrief-results">
      <h4>What to look for in the replay</h4>
      {mission.decisions.map(({ objective, station, evidence, options }) => <section key={objective}>
        <h4>{station}</h4>
        <p>{evidence}</p>
        {options.filter(({ passed }) => passed).map(({ trace }) => <p key={trace}>{trace}</p>)}
      </section>)}
    </div>}
    <section className="mission-exam-map">
      <h4>How this assignment maps to the exam</h4>
      <p>The exam-style check uses a different scenario to test the same published objectives.</p>
      <ul className="mission-mapping">{questions.map((question) => {
        const [label, url] = sources[question.source];
        return <li key={question.id}>
          <strong>Objective {question.objective}: {objectiveTitle(track, question)}</strong>
          {exercise && <small>{exercise.objectives.includes(question.objective) ? "Used in the workbench" : "Explained here and tested in the exam-style check"}</small>}
          {hasAssignmentWork(mission.id) && mission.kind === "workbench" && <p>{mission.decisions.find(({ objective }) => objective === question.objective)?.station} → {question.scenario}</p>}
          <p>{skillNote(track.id, question.objective)}</p>
          <p>{question.correct.length === 1 ? "Single response · choose one" : "Multiple response · choose two"}</p>
          <ExternalLink href={url}>{label}</ExternalLink>
        </li>;
      })}</ul>
      <ExternalLink href={track.guide}>Official {track.role} {track.level} exam guide</ExternalLink>
    </section>
    {!record?.debriefSeen ? <button className="button button-primary" type="button" disabled={saving} onClick={async () => {
      setSaving(true);
      const response = await saveMissionDebrief(mission);
      setSaving(false);
      setError(!response.saved);
      if (response.saved) { onChange(); onComplete(); }
    }}>{saving ? "Saving…" : "Mark debrief complete"} <ArrowRight size={16} aria-hidden="true" /></button>
      : <button className="button button-primary" type="button" onClick={onComplete}>Return to certification practice <ArrowRight size={16} aria-hidden="true" /></button>}
    {error && <p role="alert">This browser could not save the debrief confirmation.</p>}
  </>;
}

function Debrief({ onContinue, seen, saving, error }: { onContinue: () => void; seen: boolean; saving: boolean; error: boolean }) {
  return (
    <>
      <h3>City Dispatch technical debrief</h3>
      <p><strong>CCAR-F task 2.2</strong> · Structured errors for MCP tools. The exam check presents a different tool contract and asks you to choose recovery actions from the result and failure type.</p>
      <p>Compare the completed search with ticket T-17. These examples show the result body of an MCP tool call.</p>
      <div className="result-examples">
        {lookupResults.map(({ title, action, result }) => (
          <section className="result-example" key={title}>
            <h4>{title}</h4>
            <pre><code>{JSON.stringify(result, null, 2)}</code></pre>
            <p>{action}</p>
          </section>
        ))}
      </div>
      <p>MCP uses <code>isError</code> to signal a tool execution error. City Dispatch defines <code>errorCategory</code> and <code>isRetryable</code> in <code>structuredContent</code> to guide recovery. The text block carries the same JSON for clients that read text. An unknown tool can produce a JSON-RPC error. If the MCP connection itself drops, the client may receive no tool result.</p>
      <dl className="error-reference">
        {otherErrors.map(({ title, example, action }) => (
          <div key={title}><dt>{title}</dt><dd>{example} {action}</dd></div>
        ))}
      </dl>
      <div className="certification-sources">
        <a href={architectFoundations.specification} target="_blank" rel="noreferrer">MCP specification</a>
      </div>
      <button className="button button-primary" type="button" onClick={onContinue} disabled={saving}>
        {saving ? "Saving…" : seen ? "Return to certification practice" : "Mark debrief complete"} <ArrowRight size={16} aria-hidden="true" />
      </button>
      {error && <p role="alert">This browser could not save the debrief confirmation.</p>}
    </>
  );
}

function CheckForm({ check, onSubmit, onStart, stage, active = true }: {
  check: SkillCheck;
  onSubmit: (answers: Record<string, string[]>) => Promise<string | null>;
  onStart?: (stage: CheckStage, signal: AbortSignal) => Promise<string | null>;
  stage: CheckStage;
  active?: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [opened, setOpened] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [retryStart, setRetryStart] = useState(0);
  const questionHeading = useRef<HTMLHeadingElement>(null);
  const question = check.questions[position];
  const picks = answers[question.id] ?? [];
  const count = question.correct.length;
  const last = position === check.questions.length - 1;

  useEffect(() => {
    if (!active || !onStart || opened) return;
    const controller = new AbortController();
    setStartError(null);
    void onStart(stage, controller.signal).then((failure) => {
      if (controller.signal.aborted) return;
      if (failure) setStartError(failure);
      else setOpened(true);
    });
    return () => controller.abort();
  }, [active, onStart, opened, retryStart, stage]);

  function navigate(index: number) {
    setError(null);
    setPosition(index);
    requestAnimationFrame(() => questionHeading.current?.focus());
  }

  function select(value: string) {
    const selected = count === 1 ? [value] : picks.includes(value) ? picks.filter((pick) => pick !== value) : [...picks, value];
    setAnswers((current) => ({ ...current, [question.id]: selected }));
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (picks.length !== count) {
      setError(`Select exactly ${count} ${count === 1 ? "response" : "responses"} to continue.`);
      return;
    }
    if (!last) {
      navigate(position + 1);
      return;
    }
    setSubmitting(true);
    setError(null);
    const failure = await onSubmit(answers);
    if (failure) {
      setSubmitting(false);
      setError(failure);
    }
  }

  if (onStart && !opened) return startError
    ? <><p role="alert">{startError}</p><button className="button button-outline" type="button"
      onClick={() => setRetryStart((current) => current + 1)}>Try again</button></>
    : <p role="status">Opening your study check…</p>;

  return (
    <form className="certification-form" onSubmit={submit}>
      <div className="question-position">
        <h4 ref={questionHeading} tabIndex={-1}>Question {position + 1} of {check.questions.length}</h4>
        <span id="response-count">{count === 1 ? "Select one response" : "Select two responses"}</span>
      </div>
      <fieldset key={question.id} aria-describedby="response-count">
        <legend>{question.prompt}</legend>
        {question.options.map(([value, label], index) => (
          <label className="answer-option" key={value}>
            <input type={count === 1 ? "radio" : "checkbox"} name={question.id} value={value}
              checked={picks.includes(value)} onChange={() => select(value)} />
            <span className="option-letter" aria-hidden="true">{String.fromCharCode(65 + index)}.</span><span>{label}</span>
          </label>
        ))}
      </fieldset>
      <div className="question-navigation">
        {position > 0 && <button className="button button-outline" type="button" onClick={() => navigate(position - 1)}><ArrowLeft size={16} aria-hidden="true" /> Previous</button>}
        <button className="button button-primary" type="submit" disabled={submitting}>
          {last ? (submitting ? "Submitting…" : "Submit answers") : "Next question"} <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}

function CheckReview({ check, attempt }: { check: SkillCheck; attempt: SkillAttempt }) {
  return (
    <>
      <p className="check-score"><strong>{gradeAttempt(check, attempt)} of {check.questions.length} correct</strong>
        <span>{dateFormat.format(attempt.submittedAt)}</span></p>
      <ul className="check-review">
        {check.questions.map((question) => {
          const { id, skill, options, correct, explanation } = question;
          const response = attempt.answers[id];
          const correctResponse = isCorrect(question, response);
          return (
            <li key={id}>
              <h4>{skill}</h4>
              <p className="decision-mark" data-correct={correctResponse}>{correctResponse ? "Correct" : "Needs review"}</p>
              <p className="submitted-answer"><strong>Your {response.length === 1 ? "response" : "responses"}</strong> · {options.filter(([value]) => response.includes(value)).map(([, label]) => label).join(" ")}</p>
              {!correctResponse && <p><strong>Correct {correct.length === 1 ? "response" : "responses"}</strong> · {options.filter(([value]) => correct.includes(value)).map(([, label]) => label).join(" ")}</p>}
              <p>{explanation}</p>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function CertificationDialog({ dialog, page: requestedPage, progress, shiftComplete, sessionOnly, mission, missionRecord, missionComplete, onNavigate, onClose, onDispatch, onMissionStart, onMissionChange, onLens, onSubmit, onDispatchDebrief, startStudy, studyPending, studyError, retryStudy, studyDueAt, browserStudy }: {
  dialog: RefObject<HTMLDialogElement | null>;
  page: CertificationPage | null;
  progress: CertificationProgress;
  shiftComplete: boolean;
  sessionOnly: boolean;
  mission?: Mission | null;
  missionRecord?: MissionRecord;
  missionComplete?: boolean;
  onNavigate: (page: CertificationPage) => void;
  onClose: () => void;
  onDispatch: () => void;
  onMissionStart?: () => void;
  onMissionChange?: () => void;
  onLens: () => void;
  onSubmit: (stage: CheckStage, answers: Record<string, string[]>) => Promise<string | null>;
  onDispatchDebrief: () => Promise<string | null>;
  startStudy?: (stage: CheckStage, signal: AbortSignal) => Promise<string | null>;
  studyPending: boolean;
  studyError: string | null;
  retryStudy: () => void;
  studyDueAt: number | null;
  browserStudy?: BrowserStudy;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const [savingDebrief, setSavingDebrief] = useState(false);
  const [debriefError, setDebriefError] = useState(false);
  const completed = mission ? missionPreparationSteps(!!missionComplete, missionRecord) : dispatchPreparationSteps(progress, shiftComplete);
  const due = mission ? missionFollowupAt(missionRecord?.check) : studyDueAt ?? (progress.first ? followupAt(progress.first) : null);
  const unlocked = completed[3] || (due !== null && now >= due);
  const [debriefPage, checkPage, followupPage] = mission ? missionPages : dispatchPages;
  const available: CertificationPage[] = ["pathway", debriefPage, checkPage, followupPage];
  if (!mission) {
    if (progress.previousFirst) available.push("previous-first");
    if (progress.previousFollowup) available.push("previous-followup");
    if (browserStudy?.first) available.push("browser-first");
    if (browserStudy?.followup) available.push("browser-followup");
  }
  const page = requestedPage && (available.includes(requestedPage) ? requestedPage : "pathway");
  const stage = page === "first" || page === "followup" ? page : null;
  const previous = {
    "previous-first": progress.previousFirst, "previous-followup": progress.previousFollowup,
    "browser-first": browserStudy?.first, "browser-followup": browserStudy?.followup,
  };
  const earlier = page && Object.hasOwn(previous, page) ? page as keyof typeof previous : null;
  const earlierStage = earlier ? earlier.endsWith("-first") ? "first" : "followup" : null;
  const attempt = stage ? progress[stage] : earlier ? previous[earlier] : null;

  useEffect(() => {
    const element = dialog.current;
    if (!element || !page) return;
    if (!element.open) element.showModal();
    element.scrollTop = 0;
    heading.current?.focus({ preventScroll: true });
  }, [dialog, page, attempt]);

  useEffect(() => {
    if (!page) return;
    const refresh = () => setNow(Date.now());
    refresh();
    window.addEventListener("focus", refresh);
    const timer = due !== null && due > Date.now() ? window.setTimeout(refresh, due - Date.now()) : undefined;
    return () => {
      window.removeEventListener("focus", refresh);
      window.clearTimeout(timer);
    };
  }, [page, due]);

  const firstCheck = skillChecks.first;
  const followupCheck = skillChecks.followup;
  const reviewStage = stage ?? earlierStage;

  return (
    <dialog className="game-dialog certification-dialog" ref={dialog} aria-labelledby="certification-title"
      onClose={(event) => { if (!event.currentTarget.open) onClose(); }}>
      <header className="dialog-header">
        <GraduationCap size={23} aria-hidden="true" />
        <h2 id="certification-title" tabIndex={-1} ref={heading}>
          {attempt ? (earlierStage ? "Earlier practice results" : "Skill check results") : page === "mission-debrief" ? "Technical debrief"
            : page === "mission-check" ? "Exam-style skill check" : page === "mission-followup" ? "Seven-day follow-up"
              : stage ? (stage === "first" ? "Exam-style skill check" : "Seven-day follow-up") : "Certification practice"}
        </h2>
        <button className="icon-button" type="button" onClick={() => dialog.current?.close()} aria-label="Close certification practice">
          <X size={20} aria-hidden="true" />
        </button>
      </header>
      <div className="dialog-body certification-body">
        {page && page !== "pathway" && <button className="certification-back" type="button" onClick={() => onNavigate("pathway")}>
          <ArrowLeft size={16} aria-hidden="true" /> Back to pathway
        </button>}
        {page === "pathway" && mission && <MissionPathway mission={mission} record={missionRecord} completed={completed} unlocked={unlocked}
          onNavigate={onNavigate} onStart={onMissionStart ?? onDispatch} onLens={onLens} />}
        {page === "pathway" && !mission && <Pathway progress={progress} browserStudy={browserStudy} completed={completed} unlocked={unlocked}
          onNavigate={onNavigate} onDispatch={onDispatch} onLens={onLens} />}
        {page === "debrief" && <Debrief seen={progress.debriefSeen} saving={savingDebrief} error={debriefError} onContinue={async () => {
          if (!progress.debriefSeen) {
            setSavingDebrief(true);
            const error = await onDispatchDebrief();
            setSavingDebrief(false);
            setDebriefError(!!error);
            if (error) return;
          }
          onNavigate("pathway");
        }} />}
        {attempt && reviewStage && <CheckReview check={checkForAttempt(reviewStage, attempt.checkId)} attempt={attempt} />}
        {!mission && stage && studyPending && <div>
          <p role={studyError ? "alert" : "status"}>{studyError ?? "Loading your study progress…"}</p>
          {studyError && <button className="button button-outline" type="button" onClick={retryStudy}>Try again</button>}
        </div>}
        {!mission && !studyPending && !progress.first && <div className="module-check-page" hidden={page !== "first"}>
          <div className="exam-scenario">
            <span className="small-label">Shared scenario</span>
            <h3>{firstCheck.title}</h3>
            <p>{firstCheck.context}</p>
          </div>
          <CheckForm check={firstCheck} stage="first" active={page === "first"} onStart={startStudy}
            onSubmit={(answers) => onSubmit("first", answers)} />
        </div>}
        {stage === "followup" && !studyPending && unlocked && !attempt && <>
          <div className="exam-scenario">
            <span className="small-label">Shared scenario</span>
            <h3>{followupCheck.title}</h3>
            <p>{followupCheck.context}</p>
          </div>
          <CheckForm check={followupCheck} stage="followup" onStart={startStudy}
            onSubmit={(answers) => onSubmit("followup", answers)} />
        </>}
        {page === "mission-debrief" && mission && <MissionDebrief mission={mission} record={missionRecord} complete={!!missionComplete}
          onComplete={() => onNavigate("pathway")} onChange={onMissionChange ?? (() => {})} />}
        {mission && <div key={mission.id} hidden={page !== "mission-check"}>
          <MissionTransfer mission={mission} record={missionRecord} onChange={onMissionChange ?? (() => {})} />
        </div>}
        {page === "mission-followup" && mission && unlocked && <MissionFollowup mission={mission} record={missionRecord} onChange={onMissionChange ?? (() => {})} />}
        {page === followupPage && !unlocked && <>
          <p>{due !== null ? `Your follow-up is available ${dateFormat.format(due)}.` : `Follow-up practice is scheduled for ${followupDays} days after you submit a check.`}</p>
          {due === null && <button className="button button-outline" type="button" onClick={() => onNavigate(checkPage)}>
            {missionRecord?.check ? "Review exam check" : "Open exam check"} <ArrowRight size={16} aria-hidden="true" />
          </button>}
        </>}
        {page && <p className="certification-muted certification-storage" role="status">
          {mission ? "Practice progress is stored in this browser."
            : sessionOnly ? "This browser could not save your progress. Your responses are available until you leave or reload."
              : "Practice progress is stored in this browser."}
        </p>}
      </div>
    </dialog>
  );
}
