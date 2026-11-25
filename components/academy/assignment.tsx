import { Check } from "lucide-react";
import { useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import type { Assignment, ReplayResult } from "../../lib/claude/assignments";
import { saveMissionInterview } from "../../lib/claude/pathway";
import type { Mission } from "../../lib/claude/missions";
import type { MissionRecord } from "../../lib/claude/pathway";
import type { MissionExperience } from "../../lib/claude/mission-experiences";
import { ConversationAction, ConversationFrame } from "../city-conversation";

type Beat = "greeting" | "first-answer" | "second-opening" | "second-answer" | "evidence" | "choices" | "result";

export function CityAssignmentDialog({ dialog, assignment, mission, record, experience, person, role, complete, savedChoices, onClose, onComplete, onCheck, onTaskSaved, moduleProgress, enterWork }: {
  dialog: RefObject<HTMLDialogElement | null>;
  assignment: Assignment;
  mission: Mission;
  record?: MissionRecord;
  experience: MissionExperience;
  person: string;
  role: string;
  complete: boolean;
  savedChoices: Record<string, number> | null;
  onClose: () => void;
  onCheck: () => void;
  onComplete: (choices: Record<string, number>) => boolean;
  onTaskSaved: () => void;
  moduleProgress: ReactNode;
  enterWork?: boolean;
}) {
  const [choices, setChoices] = useState<Record<string, number>>(savedChoices ?? {});
  const [result, setResult] = useState<ReplayResult | null>(() => savedChoices ? assignment.replay(savedChoices) : null);
  const [saved, setSaved] = useState(!!savedChoices);
  const [failed, setFailed] = useState(false);
  const [beat, setBeat] = useState<Beat>(enterWork ? savedChoices ? "result" : "evidence" : "greeting");
  const [position, setPosition] = useState(0);
  const [savingInterview, setSavingInterview] = useState(false);
  const [journeyError, setJourneyError] = useState(false);
  const decisionHeading = useRef<HTMLParagraphElement>(null);
  const resultHeading = useRef<HTMLParagraphElement>(null);
  const control = assignment.controls[position];
  const evidence = assignment.cases.find(({ id }) => id === control?.id);
  const meetsGoal = !!result?.rows.every(({ accepted }) => accepted);
  const first = experience.interviews[0];
  const second = experience.interviews[1];
  const currentInterview = beat === "second-opening" || beat === "second-answer" ? second : first;

  function openDecision(index: number) {
    setPosition(index);
    setBeat("choices");
    requestAnimationFrame(() => decisionHeading.current?.focus());
  }

  function choose(index: number) {
    const next = { ...choices, [control.id]: index };
    setChoices(next);
    if (position < assignment.controls.length - 1) {
      openDecision(position + 1);
      return;
    }
    setResult(assignment.replay(next));
    setSaved(false);
    setFailed(false);
    setBeat("result");
    requestAnimationFrame(() => resultHeading.current?.focus());
  }

  async function recordInterview(interviewId: string, next: Beat) {
    setSavingInterview(true);
    const response = await saveMissionInterview(mission, interviewId);
    setSavingInterview(false);
    if (!response?.saved) { setJourneyError(true); return; }
    setJourneyError(false);
    setBeat(next);
    onCheck();
  }

  function save() {
    const persisted = onComplete(choices);
    setSaved(persisted);
    setFailed(!persisted);
    if (persisted) onTaskSaved();
  }

  const personName = currentInterview?.name ?? person;
  const personRole = currentInterview?.role ?? role;
  const portrait = currentInterview?.portrait;

  return (
    <ConversationFrame dialog={dialog} title={assignment.title} name={personName} role={personRole} portrait={portrait}
      step={`${beat}:${position}`} onClose={onClose} moduleProgress={moduleProgress}>
        <div className="conversation-line" aria-live="polite" tabIndex={-1}>
          {beat === "greeting" && <><p>{first.opening}</p>
            {complete && <p className="conversation-prior">Previously completed. {assignment.impact}</p>}</>}
          {beat === "first-answer" && <p>{first.reply}</p>}
          {beat === "second-opening" && <><p className="small-label">A second perspective</p><p>{second.opening}</p></>}
          {beat === "second-answer" && <p>{second.reply}</p>}
          {beat === "evidence" && <><p>{experience.arrival}</p><p>{assignment.title}: {assignment.debrief}</p></>}
          {beat === "choices" && <>
            <p>{position === 0 ? `${currentInterview?.name ?? person} needs a decision.` : "Here’s the next decision."}</p>
            <p className="conversation-question" ref={decisionHeading} tabIndex={-1}>{control.label}</p>
            {evidence && <p className="conversation-evidence">{evidence.evidence}</p>}
          </>}
          {beat === "result" && result && <p className="conversation-question" ref={resultHeading} tabIndex={-1}>{saved ? assignment.impact : meetsGoal ? `That works. ${result.summary}` : `We have a few things to fix. ${result.summary}`}</p>}
        </div>

        {beat === "greeting" && <div className="conversation-actions">
          <ConversationAction primary onClick={() => setBeat("first-answer")}>{first.question}</ConversationAction>
          {result && saved && <ConversationAction onClick={() => setBeat("result")}>Open saved replay</ConversationAction>}
        </div>}
        {beat === "first-answer" && <div className="conversation-actions"><ConversationAction primary disabled={savingInterview} onClick={() => void recordInterview(first.id, "second-opening")}>Hear from {second.name.split(" ")[0]}</ConversationAction></div>}
        {beat === "second-opening" && <div className="conversation-actions"><ConversationAction primary onClick={() => setBeat("second-answer")}>{second.question}</ConversationAction></div>}
        {beat === "second-answer" && <div className="conversation-actions"><ConversationAction primary disabled={savingInterview} onClick={() => void recordInterview(second.id, "evidence")}>Open mission file</ConversationAction></div>}
        {beat === "evidence" && <>
          <details className="conversation-file"><summary>Read the mission file</summary>
            <dl>{assignment.cases.map(({ id, name, evidence: line }) => <div key={id}><dt>{name}</dt><dd>{line}</dd></div>)}</dl>
          </details>
          <div className="conversation-actions"><ConversationAction onClick={() => setBeat("second-opening")}>Back</ConversationAction><ConversationAction primary onClick={() => result && saved ? setBeat("result") : openDecision(0)}>{result && saved ? "Open saved replay" : "Enter the work area"}</ConversationAction></div>
        </>}
        {beat === "choices" && <>
          {!evidence && <details className="conversation-file"><summary>Review the mission file</summary>
            <dl>{assignment.cases.map(({ id, name, evidence: line }) => <div key={id}><dt>{name}</dt><dd>{line}</dd></div>)}</dl></details>}
          <div className="conversation-replies" aria-label="Choose your response">
            {control.choices.map((option, index) => <ConversationAction key={option} onClick={() => choose(index)}>{option}</ConversationAction>)}
          </div>
          <div className="conversation-actions"><ConversationAction onClick={() => position > 0 ? openDecision(position - 1) : setBeat("evidence")}>Back</ConversationAction></div>
        </>}
        {beat === "result" && result && <>
          <details className="conversation-file"><summary>Review stakeholder conversations and mission evidence</summary>
            <dl>{experience.interviews.map((interview) => <div key={interview.id}><dt>{interview.name}</dt>
              <dd><strong>You asked:</strong> {interview.question} <strong>{interview.name.split(" ")[0]}:</strong> {interview.reply}</dd></div>)}
              {assignment.cases.map(({ id, name, evidence: line }) => <div key={id}><dt>{name}</dt><dd>{line}</dd></div>)}
            </dl>
          </details>
          <details className="conversation-file" open={!meetsGoal || undefined}>
            <summary>See what happened in the replay</summary>
            <dl>{result.rows.map(({ name, outcome, accepted }) => <div key={name}><dt>{name} · {accepted ? "Meets goal" : "Needs a change"}</dt><dd>{outcome}</dd></div>)}</dl>
          </details>
          <div className="conversation-actions">
            <ConversationAction onClick={() => openDecision(0)}>Try different replies</ConversationAction>
            {!saved && meetsGoal && <ConversationAction primary onClick={save}>Save to city</ConversationAction>}
          </div>
          {saved && <p className="academy-positive" role="status"><Check size={16} aria-hidden="true" /> Outcome saved to City impact</p>}
          {failed && <p className="academy-error" role="alert">The browser could not save this outcome.</p>}
        </>}
        {journeyError && <p className="academy-error" role="alert">The browser could not save the conversation notes.</p>}
    </ConversationFrame>
  );
}
