import { ArrowRight, ClipboardCheck, FilePenLine, GitBranch, Play, Workflow } from "lucide-react";
import { useState } from "react";
import type { Mission } from "../../lib/claude/missions";
import { stationOptions } from "../../lib/claude/missions";

type Props = {
  mission: Extract<Mission, { kind: "workbench" }>;
  position: number;
  selected: number[];
  select: (indices: number[]) => void;
};

const instruments = {
  "associate-foundations": { icon: FilePenLine, surface: "desk", draft: "Work instruction", action: "Preview staff result", result: "Staff preview" },
  "developer-foundations": { icon: GitBranch, surface: "console", draft: "Integration change", action: "Replay fixture", result: "Fixture result" },
  "architect-foundations": { icon: Workflow, surface: "diagram", draft: "System change", action: "Run scenario", result: "System output" },
  "architect-professional": { icon: ClipboardCheck, surface: "record", draft: "Architecture decision", action: "Test against scenario", result: "Acceptance evidence" },
  "developer-professional": { icon: GitBranch, surface: "console", draft: "Production change", action: "Replay traffic", result: "Replay result" },
} as const;

export function MissionMechanic({ mission, position, selected, select }: Props) {
  const decision = mission.decisions[position];
  const { icon: Icon, surface, draft, action, result } = instruments[mission.track];
  const [tested, setTested] = useState("");
  const signature = `${decision.objective}:${selected.join(",")}`;
  const required = decision.combine ? 2 : 1;
  const ready = selected.length === required;
  const options = stationOptions(mission.id, decision);
  const currentEffect = decision.options[0].trace;

  function change(index: number) {
    setTested("");
    if (!decision.combine) select([index]);
    else if (selected.includes(index)) select(selected.filter((pick) => pick !== index));
    else if (selected.length < required) select([...selected, index]);
  }

  return <section className={`station-control station-control--${surface}`} aria-label={decision.station}>
    <header className="station-control-header"><Icon size={21} aria-hidden="true" /><h5>{draft}</h5></header>
    <fieldset>
      <legend>{decision.combine ? "Choose two changes to run together" : "Choose a change for this scenario"}</legend>
      {options.map(({ index, label }) => <label key={index} data-selected={selected.includes(index)} className="station-control-choice">
        <input type={decision.combine ? "checkbox" : "radio"} name={`station-${mission.id}-${decision.objective}`}
          checked={selected.includes(index)} disabled={decision.combine && ready && !selected.includes(index)}
          onChange={() => change(index)} />
        <span>{label}</span>
      </label>)}
    </fieldset>
    <button type="button" className="button button-outline station-replay-button" disabled={!ready}
      onClick={() => setTested(signature)}><Play size={15} aria-hidden="true" />{action}</button>
    {tested === signature && ready && <div className="station-comparison" role="status">
      <div><h6>Current scenario</h6><p>{currentEffect}</p></div><ArrowRight size={15} aria-hidden="true" />
      <div><h6>{result}</h6>{selected.map((index) => <p key={index}>{decision.options[index].trace}</p>)}</div>
    </div>}
  </section>;
}
