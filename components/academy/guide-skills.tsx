"use client";

import { useState } from "react";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { objectiveCoverage } from "../../lib/claude/curriculum";
import { guideCityHref } from "../../lib/claude/curriculum/city-guide";
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
};

export function GuideDecision({ track, activity, completed, onPractice, onAdvance }: {
  track: Track; activity: GuideActivity; completed: boolean;
  onPractice: (objective: string) => Promise<boolean>; onAdvance?: () => void;
}) {
  const [objective, source, caseFile, change, comparison, effect, explanation, initialConsequence] = activity;
  const [choice, setChoice] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const position = [...caseFile].reduce((hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16777619), 2166136261);
  const correctFirst = position % 2 === 0;
  const choices = correctFirst ? [change, comparison] : [comparison, change];
  const [label] = sources[source];
  return <form className="academy-activity" onSubmit={async (event) => {
    event.preventDefault();
    if (!choice) return;
    setResult(choice);
    if (choice !== change || completed) return;
    setBusy(true);
    await onPractice(objective);
    setBusy(false);
  }}>
    <fieldset className="academy-entry-question">
      <legend>{caseFile}</legend>
      {choices.map((option) => <label key={option}><input type="radio" name={`guide-${objective}`} checked={choice === option} onChange={() => setChoice(option)} />{option}</label>)}
    </fieldset>
    <button type="submit" className="academy-button secondary" disabled={!choice || busy || choice === result}>Apply decision</button>
    {result && <>
      <div className="academy-activity-feedback" role="status" data-outcome={result === change ? "correct" : "review"}>
        <strong>{responseLabels[track.id]}{result !== change && " · Needs revision"}</strong>
        <p>{result === change ? effect : initialConsequence}</p>
      </div>
      <div className="academy-activity-notes"><p>{explanation}</p><cite>{label}</cite></div>
      {result === change && onAdvance && <button className="academy-button text" type="button" onClick={onAdvance}>Next case <ArrowRight size={16} aria-hidden="true" /></button>}
    </>}
  </form>;
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
  return <section className="academy-panel academy-guide-skills" id="guide-skills" aria-labelledby="guide-skills-title" data-track={track.id}>
    <h2 id="guide-skills-title">December guide practice</h2>
    <p>Apply a decision in each case and see the outcome. Use these cases to revisit domains before a timed rehearsal.</p>
    <div className="academy-guide-domains">
      {domains.map(({ id, title, weight, skills }) => {
        const completed = skills.filter((skill) => practiced.has(skill.id)).length;
        return <details className="academy-domain" id={`december-domain-${id}`} key={id}>
          <summary><span><strong>{title}</strong><small>{completed}/{skills.length} practiced</small></span><span className="academy-weight">{weight}%</span><ChevronDown size={17} aria-hidden="true" /></summary>
          <ol className="academy-skill-list">
            {skills.map(({ id: objective, title: name, activity, missions }) => {
              const next = sequence[sequence.findIndex(({ id }) => id === objective) + 1];
              return <li key={objective}>
                <details id={`guide-case-${objective}`} className="academy-guide-activity">
                  <summary><span>{name}</span>{practiced.has(objective) && <Check size={17} aria-label="Practiced" />}</summary>
                  {activity && <GuideDecision track={track} activity={activity} completed={practiced.has(objective)} onPractice={onPractice}
                    onAdvance={next && (() => advance(objective, next.id))} />}
                  <div className="academy-skill-actions">
                    {missions.map((mission) => <Link key={mission.id} className="academy-button secondary"
                      href={guideCityHref(track.id, mission.id, objective)}>Practice at {places.find(({ id }) => id === mission.place)?.name ?? mission.title} <ArrowRight size={15} aria-hidden="true" /></Link>)}
                    <button type="button" className="academy-button text" onClick={() => onTarget(id, objective)}>Try a different case</button>
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
