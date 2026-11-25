import { ArrowRight, Check, Clock3, GraduationCap, MapPin, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { places } from "../../lib/world";
import { trackPracticeHref, tracks, trackTitle } from "../../lib/claude/blueprints";
import { availableProviders } from "../../lib/certifications/providers";
import { decemberVersion, examGuideLabel } from "../../lib/claude/december-blueprints";
import { readReadiness, readinessKey } from "../../lib/claude/readiness";
import { objectiveCoverage } from "../../lib/claude/curriculum";
import { guideCityHref } from "../../lib/claude/curriculum/city-guide";
import { subscribeToProgress } from "../../lib/progress-storage";
import type { Track } from "../../lib/claude/blueprints";
import { missionMappings } from "../../lib/claude/missions";
import type { Mission } from "../../lib/claude/missions";
import { missingExpertise, missionCompleted, missionFollowupAt, portfolioEvidence, unmetMissions } from "../../lib/claude/pathway";
import type { PortfolioRecords } from "../../lib/claude/pathway";

export function CityCertificationDialog({ dialog, selected, onSelect }: {
  dialog: RefObject<HTMLDialogElement | null>;
  selected: Track | null;
  onSelect: (track: Track) => void;
}) {
  return (
    <dialog ref={dialog} className="game-dialog city-certifications" aria-labelledby="city-certifications-title">
      <header className="dialog-header">
        <img className="city-certifications-mark" src="/brand/mark-primary.svg" width={32} height={32} alt="" />
        <h2 id="city-certifications-title">Choose your exam</h2>
        <button className="icon-button" type="button" aria-label="Close exam list" onClick={() => dialog.current?.close()}><X size={20} aria-hidden="true" /></button>
      </header>
      <div className="dialog-body">
        {availableProviders.map((provider) => <section key={provider.id} aria-labelledby={`provider-${provider.id}`}>
          <h3 className="city-provider-heading" id={`provider-${provider.id}`}>{provider.name}</h3>
          <ul className="city-certification-list city-exam-list">
            {tracks.filter((track) => track.provider === provider.id).map((track) => (
              <li key={track.id}>
                <button type="button" onClick={() => onSelect(track)} aria-current={selected?.id === track.id ? "true" : undefined}>
                  <span className="city-exam-code">{track.code}</span>
                  <span><strong>{track.role} {track.level}</strong><span className="city-track-description">{track.description}</span></span>
                  {selected?.id === track.id ? <Check size={18} aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        </section>)}
        <ExamFit onSelect={onSelect} />
        <Link className="button button-text city-study-link" href="/certifications">Browse the catalog</Link>
      </div>
    </dialog>
  );
}

const fitQuestions = [
  { id: "code", text: "Do you write code that calls an AI model, or configure tools like Claude Code?" },
  { id: "design", text: "Do you design how agents, tools and data fit together for a team or product?" },
  { id: "lead", text: "Do you decide how AI rolls out across an organization: budgets, governance, vendors?" },
] as const;

/**
 * Three yes/no questions that point to an exam, for people who don't know the codes. Provider-neutral: it recommends by
 * each track's audience, so other providers' exams can join the list without new logic.
 */
function ExamFit({ onSelect }: { onSelect: (track: Track) => void }) {
  const [answers, setAnswers] = useState<Partial<Record<(typeof fitQuestions)[number]["id"], boolean>>>({});
  const answered = fitQuestions.every(({ id }) => answers[id] !== undefined);
  const audience = answers.lead ? "lead" : answers.design ? "design" : answers.code ? "code" : "use";
  // When two exams share an audience (CCDV-F and CCDV-P both serve people who write code), recommend the Foundations one.
  const pick = availableProviders.flatMap((provider) => tracks.filter((track) => track.provider === provider.id && track.audience === audience))
    .sort((left, right) => Number(left.level !== "Foundations") - Number(right.level !== "Foundations"))[0];
  return <details className="conversation-file city-exam-fit">
    <summary>Not sure which one fits you?</summary>
    <form onSubmit={(event) => event.preventDefault()}>
      {fitQuestions.map(({ id, text }) => <fieldset key={id}>
        <legend>{text}</legend>
        <label><input type="radio" name={`fit-${id}`} checked={answers[id] === true} onChange={() => setAnswers({ ...answers, [id]: true })} /> Yes</label>
        <label><input type="radio" name={`fit-${id}`} checked={answers[id] === false} onChange={() => setAnswers({ ...answers, [id]: false })} /> No</label>
      </fieldset>)}
    </form>
    {answered && pick && <p role="status" className="city-exam-fit-result">
      Start with <strong>{pick.code} · {pick.role} {pick.level}</strong>. {audience === "use" ? "It needs no coding, and it’s the usual first exam for students and people new to Claude." : "You can still begin with Associate if you’re new to Claude."}{" "}
      <button type="button" className="button button-outline" onClick={() => onSelect(pick)}>Choose {pick.code}</button>
    </p>}
  </details>;
}

export function MissionJournal({ dialog, track, records, legacy, progress, currentGuide = false, requestedMission, dispatchDueAt, onMission, onStudy, onChangeTrack, onToggleProgress }: {
  dialog: RefObject<HTMLDialogElement | null>;
  track: Track;
  records: PortfolioRecords;
  legacy: ReadonlySet<string>;
  progress: boolean;
  currentGuide?: boolean;
  requestedMission?: string | null;
  onMission: (mission: Mission) => void;
  onStudy: (mission: Mission, page: "check" | "followup") => void;
  dispatchDueAt?: number | null;
  onChangeTrack: () => void;
  onToggleProgress?: () => void;
}) {
  const [now, setNow] = useState(0);
  const [guidePracticed, setGuidePracticed] = useState<string[]>([]);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    refresh();
    const journal = dialog.current;
    journal?.addEventListener("toggle", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      journal?.removeEventListener("toggle", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [dialog]);
  useEffect(() => {
    if (!currentGuide) return;
    const refresh = () => setGuidePracticed(readReadiness(track)?.guide ?? []);
    refresh();
    return subscribeToProgress((key) => { if (key === readinessKey(track) || key === null) refresh(); });
  }, [currentGuide, track]);
  useEffect(() => {
    const journal = dialog.current;
    if (!requestedMission || !journal) return;
    if (!journal.open) journal.showModal();
    const frame = requestAnimationFrame(() => {
      const row = document.getElementById(`journal-${requestedMission}`);
      row?.focus({ preventScroll: true });
      row?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [dialog, requestedMission]);
  const evidence = portfolioEvidence(track, records, legacy);
  const schedule = evidence.missions.flatMap((mission) => {
    const record = records[mission.id];
    const due = mission.kind === "dispatch" ? dispatchDueAt : record?.followup ? null : missionFollowupAt(record?.check);
    return due ? [{ mission, due }] : [];
  }).sort((left, right) => left.due - right.due);
  const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
  const total = track.domains.reduce((sum, domain) => sum + domain.objectives.length, 0);
  const available = evidence.missions.filter((mission) => !unmetMissions(mission, records, legacy).length && !missingExpertise(mission, records).length && !missionCompleted(mission, records, legacy));
  const completed = evidence.completed;
  const locked = evidence.missions.filter((mission) => !missionCompleted(mission, records, legacy) && (unmetMissions(mission, records, legacy).length || missingExpertise(mission, records).length));
  const heading = progress ? "Progress" : "City missions";

  function rows(items: readonly Mission[], showLocked = false) {
    return <ul className="city-certification-list mission-journal-list">
      {items.map((mission) => {
        const place = places.find(({ id }) => id === mission.place)!;
        const unmet = unmetMissions(mission, records, legacy);
        const done = missionCompleted(mission, records, legacy);
        const missing = missingExpertise(mission, records);
        const reviewMissions = completed.filter((candidate) => candidate.id !== mission.id &&
          missionMappings(candidate).some(({ objective }) => missing.includes(objective)));
        const blockers = unmet.length ? `Easier after ${unmet.map(({ title }) => title).join(" and ")}` :
          `Easier after the practice questions for ${missing.join(", ")}`;
        const label = <>
          <span className="city-certification-icon">{showLocked ? <Clock3 size={17} aria-hidden="true" /> : done ? <Check size={18} aria-hidden="true" /> : <MapPin size={19} aria-hidden="true" />}</span>
          <span><strong>{mission.title}</strong><small>{place.name}{!showLocked && (records[mission.id]?.caseDraft || records[mission.id]?.workDraft || (!records[mission.id]?.casework && records[mission.id]?.draft)) && " · Draft saved"}{showLocked && ` · ${blockers}`}</small></span>
        </>;
        return <li key={mission.id} id={`journal-${mission.id}`} tabIndex={requestedMission === mission.id ? -1 : undefined}>{showLocked
          // Later cases are suggestions, never locks: any case opens, and the note says what makes it easier.
          ? <div className="mission-locked"><button type="button" onClick={() => onMission(mission)}>{label}<ArrowRight size={17} aria-hidden="true" /></button>
            {!unmet.length && !!reviewMissions.length && <div className="mission-blocker-links">
              {reviewMissions.map((entry) => <button className="button button-outline" type="button" key={entry.id}
                onClick={() => onMission(entry)}>Revisit {entry.title}</button>)}
            </div>}</div>
          : <button type="button" onClick={() => onMission(mission)}>{label}<ArrowRight size={17} aria-hidden="true" /></button>}</li>;
      })}
    </ul>;
  }

  return (
    <dialog ref={dialog} className="game-dialog mission-journal" aria-labelledby="mission-journal-title">
      <header className="dialog-header">
        <GraduationCap size={22} aria-hidden="true" />
        <div><p className="small-label">{track.code}</p><h2 id="mission-journal-title">{heading}</h2></div>
        <button className="icon-button" type="button" aria-label={`Close ${heading.toLowerCase()}`} onClick={() => dialog.current?.close()}><X size={20} aria-hidden="true" /></button>
      </header>
      <div className="dialog-body mission-journal-body">
        <p>{trackTitle(track)} · {examGuideLabel(track, currentGuide ? decemberVersion : undefined)}</p>
        <div className="mission-progress-summary">
          <div><strong>{completed.length}/{evidence.missions.length}</strong><span>Missions done</span></div>
          <div><strong>{evidence.applied.size}/{total}</strong><span>{currentGuide ? "July objectives practiced in the city" : "Practiced in the city"}</span></div>
          <div><strong>{evidence.demonstrated.size}/{total}</strong><span>{currentGuide ? "July objectives right first time" : "Right first time"}</span></div>
        </div>
        {!!schedule.length && <details className="academy-domain mission-review-schedule" open={schedule[0].due <= now}>
          <summary><span><strong>7-day reviews</strong><small>
            {schedule.filter(({ due }) => due <= now).length} ready, {schedule.filter(({ due }) => due > now).length} upcoming
          </small></span><Clock3 size={17} aria-hidden="true" /></summary>
          <ul className="academy-objectives">
            {schedule.map(({ mission, due }) => <li key={mission.id}><span>{mission.title}</span>
              <button type="button" className="button button-outline" onClick={() => onStudy(mission, "followup")}>
                {due <= now ? "Start 7-day review" : timeFormat.format(due)}
              </button></li>)}
          </ul>
        </details>}
        {progress ? <>
          {currentGuide && <section className="city-guide-progress" aria-labelledby="city-guide-progress-title">
            <h3 id="city-guide-progress-title">Current exam guide practice</h3>
            {objectiveCoverage(track, decemberVersion).map(({ id, title, skills }) => <details className="academy-domain" key={id}>
              <summary><span><strong>{title}</strong><small>{skills.filter(({ id }) => guidePracticed.includes(id)).length}/{skills.length} practiced</small></span></summary>
              <ul className="academy-objectives">{skills.map(({ id, title, missions }) => <li key={id}>
                <span>{title}</span>{missions[0] && <a href={guideCityHref(track.id, missions[0].id, id)}>City practice</a>}
              </li>)}</ul>
            </details>)}
            <h3>July city records</h3>
          </section>}
          {evidence.domains.map((domain) => (
            <details className="academy-domain" key={domain.id}>
              <summary><span><strong>{domain.title}</strong><small>{domain.objectives.filter((_, i) => evidence.applied.has(`${domain.id}.${i + 1}`)).length}/{domain.objectives.length} practiced in the city, {domain.objectives.filter((_, i) => evidence.demonstrated.has(`${domain.id}.${i + 1}`)).length}/{domain.objectives.length} right first time
              {domain.objectives.some((_, i) => evidence.retained.has(`${domain.id}.${i + 1}`)) && `, ${domain.objectives.filter((_, i) => evidence.retained.has(`${domain.id}.${i + 1}`)).length} recalled at the 7-day review`}
              </small></span><span className="academy-weight">{domain.weight}% of exam</span></summary>
              <ul className="academy-objectives">
                {domain.objectives.map((name, index) => {
                  const code = `${domain.id}.${index + 1}` as const;
                  const review = completed.find((mission) => missionMappings(mission).some(({ objective }) => objective === code) &&
                    (records[mission.id]?.check || mission.kind === "dispatch" && evidence.assessed.has(code)));
                  return <li key={code}><span>{code} · {name}</span>{review && evidence.assessed.has(code) && !evidence.demonstrated.has(code)
                    ? <button type="button" className="button button-outline" onClick={() => onStudy(review, "check")}>Review practice questions</button>
                    : <span>{evidence.demonstrated.has(code) ? "Right first time" : evidence.applied.has(code) ? "Practiced in the city" : "Covered by a mission"}</span>}</li>;
                })}
              </ul>
            </details>
          ))}
        </> : <>
          <section><h3>Available now</h3>{available.length ? rows(available) : <p>All currently available work is complete.</p>}</section>
          {!!locked.length && <details className="conversation-file" open={locked.some(({ id }) => requestedMission === id) || undefined}><summary>Later missions ({locked.length}) · open any time</summary>{rows(locked, true)}</details>}
          {!!completed.length && <details className="conversation-file"><summary>Done ({completed.length})</summary>{rows(completed)}</details>}
        </>}
        <div className="conversation-actions">
          {onToggleProgress && <button type="button" className="button button-outline" onClick={onToggleProgress}>{progress ? "See missions" : "See progress"}</button>}
          <button type="button" className="button button-outline" onClick={onChangeTrack}>Switch exam</button>
          <Link className="button button-text city-study-link" href={trackPracticeHref(track)} prefetch={false}>Practice exams and lessons</Link>
        </div>
      </div>
    </dialog>
  );
}
