import { ArrowRight, BookOpen, Check, Clock3, GraduationCap, Lock, MapPin, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { places } from "../../lib/world";
import { trackHref, tracks, trackTitle } from "../../lib/claude/blueprints";
import { examGuideLabel } from "../../lib/claude/december-blueprints";
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
        <h2 id="city-certifications-title">Choose a certification</h2>
        <button className="icon-button" type="button" aria-label="Close certifications" onClick={() => dialog.current?.close()}><X size={20} aria-hidden="true" /></button>
      </header>
      <div className="dialog-body">
        <ul className="city-certification-list">
          {tracks.map((track) => (
            <li key={track.id}>
              <button type="button" onClick={() => onSelect(track)} aria-current={selected?.id === track.id ? "true" : undefined}>
                <span className="city-certification-icon">{selected?.id === track.id ? <Check size={19} aria-hidden="true" /> : <GraduationCap size={19} aria-hidden="true" />}</span>
                <span><strong>{track.role} · {track.level}</strong><small>{track.code} · {track.domains.length} city practice domains</small></span>
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <Link className="button button-outline city-study-link" href="/certifications"><BookOpen size={16} aria-hidden="true" /> Exam practice and guides <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
    </dialog>
  );
}

export function MissionJournal({ dialog, track, records, legacy, progress, requestedMission, dispatchDueAt, onMission, onStudy, onChangeTrack }: {
  dialog: RefObject<HTMLDialogElement | null>;
  track: Track;
  records: PortfolioRecords;
  legacy: ReadonlySet<string>;
  progress: boolean;
  requestedMission?: string | null;
  onMission: (mission: Mission) => void;
  onStudy: (mission: Mission, page: "check" | "followup") => void;
  dispatchDueAt?: number | null;
  onChangeTrack: () => void;
}) {
  const [now, setNow] = useState(0);
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
  const heading = progress ? "Pathway progress" : "City missions";

  function rows(items: readonly Mission[], showLocked = false) {
    return <ul className="city-certification-list mission-journal-list">
      {items.map((mission) => {
        const place = places.find(({ id }) => id === mission.place)!;
        const unmet = unmetMissions(mission, records, legacy);
        const done = missionCompleted(mission, records, legacy);
        const missing = missingExpertise(mission, records);
        const reviewMissions = completed.filter((candidate) => candidate.id !== mission.id &&
          missionMappings(candidate).some(({ objective }) => missing.includes(objective)));
        const blockers = unmet.length ? `Complete ${unmet.map(({ title }) => title).join(" and ")}` :
          `Take or review the exam checks for ${missing.join(", ")}`;
        const label = <>
          <span className="city-certification-icon">{showLocked ? <Lock size={17} aria-hidden="true" /> : done ? <Check size={18} aria-hidden="true" /> : <MapPin size={19} aria-hidden="true" />}</span>
          <span><strong>{mission.title}</strong><small>{place.name}{!showLocked && (records[mission.id]?.caseDraft || records[mission.id]?.workDraft || (!records[mission.id]?.casework && records[mission.id]?.draft)) && " · Draft saved"}{showLocked && ` · ${blockers}`}</small></span>
        </>;
        return <li key={mission.id} id={`journal-${mission.id}`} tabIndex={requestedMission === mission.id ? -1 : undefined}>{showLocked
          ? <div className="mission-locked">{label}{!unmet.length && !!reviewMissions.length && <div className="mission-blocker-links">
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
        <p>{trackTitle(track)} · {examGuideLabel(track)}</p>
        <div className="mission-progress-summary">
          <div><strong>{completed.length}/{evidence.missions.length}</strong><span>Assignments saved</span></div>
          <div><strong>{evidence.applied.size}/{total}</strong><span>Objectives applied in the city</span></div>
          <div><strong>{evidence.demonstrated.size}/{total}</strong><span>Objectives answered correctly on a first-seen exam check</span></div>
        </div>
        {!!schedule.length && <details className="academy-domain mission-review-schedule" open={schedule[0].due <= now}>
          <summary><span><strong>Scheduled follow-ups</strong><small>
            {schedule.filter(({ due }) => due <= now).length} ready · {schedule.filter(({ due }) => due > now).length} upcoming
          </small></span><Clock3 size={17} aria-hidden="true" /></summary>
          <ul className="academy-objectives">
            {schedule.map(({ mission, due }) => <li key={mission.id}><span>{mission.title}</span>
              <button type="button" className="button button-outline" onClick={() => onStudy(mission, "followup")}>
                {due <= now ? "Start follow-up" : timeFormat.format(due)}
              </button></li>)}
          </ul>
        </details>}
        {progress ? <>
          {evidence.domains.map((domain) => (
            <details className="academy-domain" key={domain.id}>
              <summary><span><strong>{domain.title}</strong><small>{domain.objectives.filter((_, i) => evidence.applied.has(`${domain.id}.${i + 1}`)).length}/{domain.objectives.length} applied in the city · {domain.objectives.filter((_, i) => evidence.demonstrated.has(`${domain.id}.${i + 1}`)).length}/{domain.objectives.length} correct on first-seen checks
              {domain.objectives.some((_, i) => evidence.retained.has(`${domain.id}.${i + 1}`)) && ` · ${domain.objectives.filter((_, i) => evidence.retained.has(`${domain.id}.${i + 1}`)).length} recalled at follow-up`}
              </small></span><span className="academy-weight">{domain.weight}% of exam</span></summary>
              <ul className="academy-objectives">
                {domain.objectives.map((name, index) => {
                  const code = `${domain.id}.${index + 1}` as const;
                  const review = completed.find((mission) => missionMappings(mission).some(({ objective }) => objective === code) &&
                    (records[mission.id]?.check || mission.kind === "dispatch" && evidence.assessed.has(code)));
                  return <li key={code}><span>{code} · {name}</span>{review && evidence.assessed.has(code) && !evidence.demonstrated.has(code)
                    ? <button type="button" className="button button-outline" onClick={() => onStudy(review, "check")}>Review exam check</button>
                    : <span>{evidence.demonstrated.has(code) ? "First-seen answer correct" : evidence.applied.has(code) ? "Applied in city" : "In mission portfolio"}</span>}</li>;
                })}
              </ul>
            </details>
          ))}
        </> : <>
          <section><h3>Available now</h3>{available.length ? rows(available) : <p>All currently available work is complete.</p>}</section>
          {!!locked.length && <details className="conversation-file" open={locked.some(({ id }) => requestedMission === id) || undefined}><summary>Later missions · {locked.length}</summary>{rows(locked, true)}</details>}
          {!!completed.length && <details className="conversation-file"><summary>Completed missions · {completed.length}</summary>{rows(completed)}</details>}
        </>}
        <div className="conversation-actions">
          <button type="button" className="button button-outline" onClick={onChangeTrack}>Switch certification</button>
          <Link className="button button-outline city-study-link" href={trackHref(track)}>Exam practice and guide <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </div>
    </dialog>
  );
}
