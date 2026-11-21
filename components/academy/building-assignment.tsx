import { useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { BookOpen } from "lucide-react";
import type { ReplayCase } from "../../lib/claude/assignments";
import type { Mission } from "../../lib/claude/missions";
import type { MissionExperience } from "../../lib/claude/mission-experiences";
import { assignmentStations } from "../../lib/claude/assignment-work";
import type { AssignmentWork, AssignmentWorkId } from "../../lib/claude/assignment-work";
import { saveAssignmentWork, saveMissionInterview } from "../../lib/claude/pathway";
import type { MissionRecord } from "../../lib/claude/pathway";
import type { MissionRoomReplay } from "../../lib/scene/renderer";
import { ConversationAction, ConversationFrame } from "../city-conversation";
import { AssignmentWorkArea } from "./assignment-work";
import { caseworkFor } from "../../lib/claude/cases";
import { sourcesForSection, workstationBrief } from "../../lib/claude/cases/presentation";
import { CaseWorkbench, WorkstationDirections } from "./case-workbench";
import { CityGuidePractice } from "./city-guide-practice";

export type BuildingStation = "stakeholder-0" | "stakeholder-1" | "work" | "evidence" | "guide";

export function BuildingAssignmentDialog({ mission, id, experience, station, dialog, record, caseFiles, onClose, onChange, onSaved, onWork, onLegacyReplay, moduleProgress, objective, onRoomReplay }: {
  mission: Mission;
  id?: AssignmentWorkId;
  caseFiles?: readonly ReplayCase[];
  experience: MissionExperience;
  station: BuildingStation;
  dialog: RefObject<HTMLDialogElement | null>;
  record?: MissionRecord;
  onClose: () => void;
  onChange: () => void;
  onSaved: () => void;
  onWork: () => void;
  onLegacyReplay?: () => void;
  moduleProgress: ReactNode;
  objective?: string;
  onRoomReplay: (replay: MissionRoomReplay, preview: HTMLCanvasElement) => void;
}) {
  const [draft, setDraft] = useState(record?.workDraft);
  const [asked, setAsked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef<Promise<unknown>>(Promise.resolve());
  const person = experience.interviews[station === "stakeholder-1" ? 1 : 0];
  const answered = asked || !!record?.interviewed?.includes(person.id);
  const exercise = caseworkFor(mission.id);
  const brief = workstationBrief(mission.id);

  function change(work: AssignmentWork) {
    if (mission.kind !== "workbench") return;
    setDraft(work);
    setError(false);
    pending.current = pending.current.then(async () => {
      const response = await saveAssignmentWork(mission, work);
      setError(!response?.saved);
    });
  }

  async function save(work: AssignmentWork) {
    if (busy || mission.kind !== "workbench") return;
    setBusy(true);
    await pending.current;
    const response = await saveAssignmentWork(mission, work, true);
    setBusy(false);
    setError(!response?.saved);
    if (response?.saved) {
      onChange();
      onSaved();
    }
  }

  async function ask() {
    if (busy) return;
    setAsked(true);
    setBusy(true);
    const response = await saveMissionInterview(mission, person.id);
    setBusy(false);
    setError(!response?.saved);
    onChange();
  }

  const evidence = mission.kind === "workbench"
    ? mission.decisions.map(({ objective, station: name, evidence }) => ({ id: objective, name, evidence }))
    : caseFiles ?? [];
  const firstSource = exercise && sourcesForSection(mission.id, exercise, 0)[0]?.[0];

  const stationWork = station === "work" || station === "evidence" || station === "guide";
  return <ConversationFrame dialog={dialog} title={station === "work" ? mission.title : station === "evidence" ? "Case file" : station === "guide" ? "Exam guide practice" : experience.room}
    name={person.name} role={person.role} portrait={person.portrait}
    moduleProgress={moduleProgress}
    step={stationWork ? station : answered ? "answer" : "opening"}
    variant={stationWork ? "workbench" : "conversation"}
    room={stationWork ? experience.room : undefined}
    onClose={() => { onClose(); void pending.current.then(onChange); }}>
    {station === "guide" ? <CityGuidePractice mission={mission} objective={objective} />
    : station === "work" && exercise ? <CaseWorkbench mission={mission} exercise={exercise} record={record}
      speaker={person.name}
      onChange={onChange} onSaved={onSaved} onRoomReplay={onRoomReplay} beforeClose={(write) => { pending.current = write; }}
      legacyReplay={onLegacyReplay && <button type="button" className="button button-text" onClick={onLegacyReplay}>Open work from the earlier version</button>} />
    : station === "work" && id ? <>
      {brief && <WorkstationDirections brief={brief} showProblem />}
      <AssignmentWorkArea id={id} draft={draft} savedWork={record?.work} busy={busy} change={change} save={(work) => void save(work)} />
      <details className="conversation-file assignment-work-notes">
        <summary><BookOpen size={16} aria-hidden="true" /> Case notes</summary>
        <p>{mission.brief}</p>
        {experience.interviews.map((interview) => <section key={interview.id}>
          <h4>{interview.name}</h4>
          {record?.interviewed?.includes(interview.id) ? <p>{interview.reply}</p> : <p>{interview.opening} <small>Talk to {interview.name.split(" ")[0]} in the room for their notes.</small></p>}
        </section>)}
      </details>
    </> : station === "evidence" ? <section className="building-case-file" aria-label={mission.title}>
      <header><BookOpen size={22} aria-hidden="true" /><div><h3>{mission.title}</h3><p>{experience.arrival}</p></div></header>
      {exercise ? exercise.references.map(([name, facts]) => <details className="conversation-file" key={name} open={name === firstSource}>
        <summary>{name}</summary><p>{facts}</p>
      </details>) : evidence.map(({ id, name, evidence: facts }) => <details className="conversation-file" key={id}>
        <summary>{name}</summary><p>{facts}</p>
      </details>)}
      {!!record?.interviewed?.length && <details className="conversation-file"><summary>Notes from your conversations</summary>
        {experience.interviews.filter((person) => record.interviewed?.includes(person.id)).map(({ id, name, reply }) => <p key={id}><strong>{name}</strong> · {reply}</p>)}
      </details>}
      <ConversationAction primary onClick={onWork}>Open work area</ConversationAction>
    </section> : <>
      <div className="conversation-line" aria-live="polite" tabIndex={-1}>
        <p>{answered ? person.reply : person.opening}</p>
      </div>
      <div className="conversation-actions">
        {!answered && <ConversationAction onClick={() => void ask()}>{person.question}</ConversationAction>}
        <ConversationAction primary disabled={busy} onClick={onWork}>Open {id ? assignmentStations[id].toLowerCase() : "work area"}</ConversationAction>
      </div>
    </>}
    {error && <p className="academy-error" role="alert">This browser could not save your changes.</p>}
  </ConversationFrame>;
}
