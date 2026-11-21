"use client";

import { useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Track } from "../../lib/claude/blueprints";
import { bridges } from "../../lib/claude/curriculum/bridges";
import { sources } from "../../lib/claude/items";
import { ExternalLink } from "./chrome";

export function EntryBridge({ track, saved, onSave }: { track: Track; saved: readonly number[] | null; onSave: (choices: number[]) => Promise<boolean> }) {
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
      {checkpoints.map(({ prompt, choices: options, correct, why, tryNext, source }, index) => {
        const [label, href] = sources[source];
        return <fieldset className="academy-entry-question" key={prompt}>
          <legend>{prompt}</legend>
          {!saved && options.map((option, i) => <label key={option}><input required type="radio" name={`bridge-${index}`} value={i} checked={choices[index] === i} onChange={() => setChoices((current) => Object.assign([...current], { [index]: i }))} />{option}</label>)}
          {saved && <div className="academy-activity-feedback" data-outcome={saved[index] === correct ? "correct" : "review"}>
            {saved[index] !== correct && <p>Your choice was “{options[saved[index]]}.”</p>}
            <p><strong>{options[correct]}</strong></p><p>{why}</p><p>{tryNext}</p><ExternalLink href={href}>{label}</ExternalLink>
          </div>}
        </fieldset>;
      })}
      {!saved && <button className="academy-button primary" type="submit" disabled={busy}>See how you did <ArrowRight size={16} aria-hidden="true" /></button>}
    </form>
    {saved && <div className="academy-bridge-next"><p>{mission}</p><Link className="academy-button secondary" href={`/?assignment=${track.place}`}>Open your first assignment <ArrowRight size={16} aria-hidden="true" /></Link></div>}
  </details>;
}
