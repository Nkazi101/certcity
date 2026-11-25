"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { objectiveCoverage } from "../../lib/claude/curriculum";
import { guideCityHref } from "../../lib/claude/curriculum/city-guide";
import { guideChoices, guideRevision } from "../../lib/claude/curriculum/guide-options";
import { QuestionReport } from "./question-report";
import type { GuideActivity } from "../../lib/claude/curriculum/types";
import type { Track } from "../../lib/claude/blueprints";
import { decemberVersion } from "../../lib/claude/december-blueprints";
import { sources } from "../../lib/claude/items";
import { places } from "../../lib/world";

const responseLabels: Record<Track["id"], string> = {
  "associate-foundations": "Desk outcome",
  "developer-foundations": "Integration replay",
  "architect-foundations": "Workflow outcome",
  "architect-professional": "Operating consequence",
  "developer-professional": "Production replay",
};

export function GuideDecision({ track, activity, completed, onPractice, onAdvance }: {
  track: Track; activity: GuideActivity; completed: boolean;
  onPractice: (objective: string) => Promise<boolean>; onAdvance?: () => void;
}) {
  const [objective, source, caseFile, , explanation] = activity;
  const choices = useMemo(() => guideChoices(activity), [activity]);
  const [choice, setChoice] = useState<number | null>(null);
  const [result, setResult] = useState<number | null>(null);
  const [tries, setTries] = useState(0);
  const [busy, setBusy] = useState(false);
  const [label] = sources[source];
  const chosen = result === null ? undefined : choices[result];
  return <><form className="academy-activity" onSubmit={async (event) => {
    event.preventDefault();
    if (choice === null) return;
    setResult(choice);
    setTries((count) => count + 1);
    if (!choices[choice].correct || completed) return;
    setBusy(true);
    await onPractice(objective);
    setBusy(false);
  }}>
    <fieldset className="academy-entry-question">
      <legend>{caseFile}</legend>
      {choices.map(({ text }, index) => <label key={text}><input type="radio" name={`guide-${objective}`} checked={choice === index} onChange={() => setChoice(index)} />{text}</label>)}
    </fieldset>
    <button type="submit" className="academy-button secondary" disabled={choice === null || busy || choice === result}>Apply decision</button>
    {chosen && <>
      <div className="academy-activity-feedback" role="status" data-outcome={chosen.correct ? "correct" : "review"}>
        <strong>{responseLabels[track.id]}{chosen.correct ? tries > 1 && ` · Found on try ${tries}` : " · Needs revision"}</strong>
        <p>{chosen.consequence}</p>
        {!chosen.correct && <p>Read the scenario again and choose another decision.</p>}
      </div>
      {chosen.correct && <div className="academy-activity-notes"><p>{explanation}</p>
        <details><summary>What the other decisions lead to</summary>
          <ul>{choices.filter(({ correct }) => !correct).map(({ text, consequence }) => <li key={text}><strong>{text}</strong><p>{consequence}</p></li>)}</ul>
        </details>
        <cite>{label}</cite></div>}
      {chosen.correct && onAdvance && <button className="academy-button text" type="button" onClick={onAdvance}>Next scenario <ArrowRight size={16} aria-hidden="true" /></button>}
    </>}
  </form>
  {/* Outside the decision form: the report control is its own form. */}
  {chosen && <QuestionReport trackId={track.id} version={decemberVersion} itemId={`guide.${objective}`} revision={guideRevision(activity)} />}
  </>;
}

export function GuideSkills({ track, practiced, onPractice, onTarget }: {
  track: Track; practiced: ReadonlySet<string>; onPractice: (objective: string) => Promise<boolean>;
  onTarget: (domain: number, objective: string) => void;
}) {
  const domains = objectiveCoverage(track, decemberVersion);
  const sequence = domains.flatMap(({ skills }) => skills);
  function advance(current: string, next: string) {
    const currentCase = document.getElementById(`guide-case-${current}`) as HTMLDetailsElement | null;
    const nextCase = document.getElementById(`guide-case-${next}`) as HTMLDetailsElement | null;
    const nextDomain = nextCase?.closest<HTMLDetailsElement>(".academy-domain");
    if (!nextCase || !nextDomain) return;
    if (currentCase) currentCase.open = false;
    nextDomain.open = true;
    nextCase.open = true;
    nextCase.querySelector("summary")?.focus({ preventScroll: true });
    nextCase.scrollIntoView({ block: "center" });
  }
  return <section className="academy-panel academy-guide-skills" id="guide-skills" tabIndex={-1} aria-labelledby="guide-skills-title" data-track={track.id}>
    <h2 id="guide-skills-title">December guide practice</h2>
    <p>Apply a decision in each scenario and see the outcome. Use these scenarios to revisit domains before a timed practice exam.</p>
    <div className="academy-guide-domains">
      {domains.map(({ id, title, weight, skills }) => {
        const completed = skills.filter((skill) => practiced.has(skill.id)).length;
        return <details className="academy-domain" id={`december-domain-${id}`} key={id}>
          <summary><span><strong>{title}</strong><small>{completed}/{skills.length} practiced</small></span><span className="academy-weight" aria-label={`${weight}% of the exam`}>{weight}%</span><ChevronDown size={17} aria-hidden="true" /></summary>
          <ol className="academy-skill-list">
            {skills.map(({ id: objective, title: name, activity, missions }) => {
              const next = sequence[sequence.findIndex(({ id }) => id === objective) + 1];
              return <li key={objective}>
                <details id={`guide-case-${objective}`} className="academy-guide-activity">
                  <summary><span>{name}</span><span>{practiced.has(objective) && <Check size={17} aria-label="Practiced" />}<ChevronDown size={15} aria-hidden="true" /></span></summary>
                  {activity && <GuideDecision track={track} activity={activity} completed={practiced.has(objective)} onPractice={onPractice}
                    onAdvance={next && (() => advance(objective, next.id))} />}
                  <div className="academy-skill-actions">
                    {missions.map((mission) => <Link key={mission.id} className="academy-button secondary"
                      href={guideCityHref(track.id, mission.id, objective)}>Practice at {places.find(({ id }) => id === mission.place)?.name ?? mission.title} <ArrowRight size={15} aria-hidden="true" /></Link>)}
                    <button type="button" className="academy-button text" onClick={() => onTarget(id, objective)}>Try a different scenario</button>
                  </div>
                </details>
              </li>;
            })}
          </ol>
        </details>;
      })}
    </div>
  </section>;
}
