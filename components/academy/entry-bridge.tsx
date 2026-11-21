"use client";

import { useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Track } from "../../lib/claude/blueprints";
import { bridges } from "../../lib/claude/curriculum/bridges";
import { decemberVersion, rehearsalBlueprint } from "../../lib/claude/december-blueprints";
import type { ExamVersion } from "../../lib/claude/december-blueprints";
import { sources } from "../../lib/claude/items";
import { ExternalLink } from "./chrome";

export function EntryBridge({ track, version, saved, onSave, onSkill }: {
  track: Track;
  version: ExamVersion;
  saved: readonly number[] | null;
  onSave: (choices: number[]) => Promise<boolean>;
  onSkill: (objective: string) => void;
}) {
  const { intro, mission, checkpoints } = bridges[track.id];
  const [choices, setChoices] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const summary = useRef<HTMLElement>(null);
  const count = saved?.filter((choice, index) => choice === checkpoints[index].correct).length;
  return <details className="academy-panel academy-bridge" id="entry-bridge">
    <summary ref={summary}><strong>Start here</strong><span>{saved ? `${count}/${checkpoints.length} on the starting check` : "3 quick decisions"}</span></summary>
    <p>{intro}</p>
    <form onSubmit={async (event) => {
      event.preventDefault();
      setBusy(true);
      if (await onSave(choices)) summary.current?.focus();
      setBusy(false);
    }}>
      {checkpoints.map(({ prompt, choices: options, correct, why, tryNext, source, objectives }, index) => {
        const [label, href] = sources[source];
        const objective = (version === decemberVersion && objectives[1]) || objectives[0];
        const [domainId, skillIndex] = objective.split(".").map(Number);
        const skill = rehearsalBlueprint(track, version).domains.find(({ id }) => id === domainId)?.objectives[skillIndex - 1];
        const missed = saved && saved[index] !== correct;
        return <fieldset className="academy-entry-question" key={prompt}>
          <legend>{prompt}</legend>
          {!saved && options.map((option, i) => <label key={option}><input required type="radio" name={`bridge-${index}`} value={i} checked={choices[index] === i} onChange={() => setChoices((current) => Object.assign([...current], { [index]: i }))} />{option}</label>)}
          {saved && <div className="academy-activity-feedback" data-outcome={saved[index] === correct ? "correct" : "review"}>
            {missed && <p>Your choice was “{options[saved[index]]}.”</p>}
            <p><strong>{options[correct]}</strong></p><p>{why}</p><p>{tryNext}</p><ExternalLink href={href}>{label}</ExternalLink>
            {missed && skill && <button type="button" className="academy-button text" onClick={() => onSkill(objective)}>Practice {skill.toLowerCase()} <ArrowRight size={16} aria-hidden="true" /></button>}
          </div>}
        </fieldset>;
      })}
      {!saved && <button className="academy-button primary" type="submit" disabled={busy}>See how you did <ArrowRight size={16} aria-hidden="true" /></button>}
    </form>
    {saved && <div className="academy-bridge-next"><p>{mission}</p><Link className="academy-button secondary" href={`/?assignment=${track.place}&guide=${version}`}>{track.assignment} <ArrowRight size={16} aria-hidden="true" /></Link></div>}
  </details>;
}
