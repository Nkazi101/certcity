import { ArrowRight, FileCheck2, GitCompareArrows, Network, Play } from "lucide-react";
import { useState } from "react";
import type { TrackId } from "../../lib/claude/blueprints";
import { ExternalLink } from "./chrome";

const delegationSettings = [
  ["Extract dates from the approved service bulletin", "delegate", "The approved source is available and a wrong draft can be corrected."],
  ["Decide whether a conflicting notice can be released", "owner", "Release requires an accountable editor to resolve the source conflict."],
  ["Draft the final public notice from verified facts", "review", "The source is approved. An editor still checks the draft before publication."],
] as const;

function EditorialWorkshop() {
  const [routes, setRoutes] = useState<string[]>([]);
  const [included, setIncluded] = useState(false);
  const [checked, setChecked] = useState(false);
  const [result, setResult] = useState(false);
  return <div className="academy-workshop-flow">
    <section>
      <h3>Build the editorial workflow</h3>
      <p>The transit operator sends a signed service notice and a separate restricted incident file. The editor owns release.</p>
      <ol>{delegationSettings.map(([label], index) => <li key={label}>
        <label>{label}<select value={routes[index] ?? ""} onChange={(event) => {
          const next = [...routes];
          next[index] = event.target.value;
          setRoutes(next);
          setResult(false);
        }}>
          <option value="">Assign this step</option>
          <option value="delegate">Claude prepares the result</option>
          <option value="owner">Authorized editor decides</option>
          <option value="review">Claude drafts, editor reviews</option>
        </select></label>
      </li>)}</ol>
      <label className="academy-workshop-check"><input type="checkbox" checked={included} onChange={(event) => { setIncluded(event.target.checked); setResult(false); }} />Include the restricted incident file in Claude’s inputs</label>
      <label className="academy-workshop-check"><input type="checkbox" checked={checked} onChange={(event) => { setChecked(event.target.checked); setResult(false); }} />Verify the audience and effective time against the signed notice</label>
    </section>
    {result && <section aria-live="polite" className="academy-workshop-result">
      <h3>Publication rehearsal</h3>
      <ul>{delegationSettings.map(([label, expected, reason], index) => <li key={label}>
        <strong>{routes[index] === expected ? "Fits" : "Revise"} · {label}</strong><p>{reason}</p>
      </li>)}
        <li><strong>{included ? "Restricted data crossed the boundary" : "Restricted file stayed with the editor"}</strong></li>
        <li><strong>{checked ? "Effective time verified" : "An incorrect effective time could reach the notice"}</strong></li>
      </ul>
      <ExternalLink href="https://www.anthropic.com/ai-fluency/overview">Anthropic AI Fluency framework</ExternalLink>
    </section>}
    <button type="button" className="academy-button secondary" disabled={routes.filter(Boolean).length !== delegationSettings.length}
      onClick={() => setResult(true)}><Play size={15} aria-hidden="true" /> Run the publication case</button>
  </div>;
}

const judgePairs = [
  { name: "Outage response", source: "Reopen at 14:30", expected: "B", responses: [
    { id: "A", excerpt: "Reopen at 14:00. Service often resumes gradually, so plan ahead and carry a printed copy of the schedule." },
    { id: "B", excerpt: "Reopen at 14:30, per the outage log." },
  ] },
  { name: "Reference desk response", source: "Request a seat 24 hours ahead", expected: "A", responses: [
    { id: "A", excerpt: "Request a seat 24 hours ahead, per the room policy." },
    { id: "B", excerpt: "Request a seat 12 hours ahead. Please have your membership card and a list of dates ready for the team." },
  ] },
  { name: "Return authorization", source: "Retain the delivery slip", expected: "B", responses: [
    { id: "A", excerpt: "Retain the sales receipt. Exceptional requests go to the supervisor, who will check each file for gaps." },
    { id: "B", excerpt: "Retain the delivery slip, per the returns policy." },
  ] },
] as const;

function EvaluationWorkshop() {
  const [rubric, setRubric] = useState("detail");
  const [swap, setSwap] = useState(false);
  const [result, setResult] = useState(false);
  const rows = judgePairs.flatMap(({ name, expected, source, responses }) => {
    const orderedPairs = swap ? [responses, [...responses].reverse()] : [responses];
    return orderedPairs.map(([first, second]) => {
      const chosen = rubric === "grounding"
        ? [first, second].find(({ excerpt }) => excerpt.includes(source))
        : rubric === "position" || first.excerpt.length >= second.excerpt.length ? first : second;
      return { name, expected, order: `${first.id} then ${second.id}`, chosen: chosen?.id };
    });
  });
  const agreement = rows.filter(({ chosen, expected }) => chosen === expected).length;
  return <div className="academy-workshop-flow">
    <section>
      <h3>Calibrate a model judge</h3>
      <p>Each example includes a source and a reference label. Compare three fixture judges to those labels in both answer positions.</p>
      <ul>{judgePairs.map(({ name, source, responses }) => <li key={name}><strong>{name}</strong>
        <p>Source · {source}</p>
        {responses.map(({ id, excerpt }) => <p key={id}>{id} · {excerpt}</p>)}
      </li>)}</ul>
      <label>Grading rubric<select value={rubric} onChange={(event) => { setRubric(event.target.value); setResult(false); }}>
        <option value="detail">Prefer the greater level of detail</option><option value="position">Score the first acceptable answer</option>
        <option value="grounding">Check support for each decision-bearing claim</option>
      </select></label>
      <label className="academy-workshop-check"><input type="checkbox" checked={swap} onChange={(event) => { setSwap(event.target.checked); setResult(false); }} />Test each pair again in reverse order</label>
    </section>
    {result && <section aria-live="polite" className="academy-workshop-result">
      <h3>{agreement}/{rows.length} judgments match reference labels</h3>
      <ul>{rows.map(({ name, order, expected, chosen }) => <li key={name + order}><strong>{name} · {order}</strong>
        <p>Reference label {expected} · Fixture judge chose {chosen ?? "neither response"}</p>
      </li>)}</ul>
      <p>This fixture checks for the exact source phrase. A production judge must also accept a faithful paraphrase and reject claims that contradict surrounding evidence. Validate those cases with independently labeled examples.</p>
      <ExternalLink href="https://www.anthropic.com/research/demystifying-evals-for-ai-agents">Anthropic evaluation design</ExternalLink>
    </section>}
    <button type="button" className="academy-button secondary" onClick={() => setResult(true)}><Play size={15} aria-hidden="true" /> Run the calibration set</button>
  </div>;
}

function DeploymentWorkshop() {
  const [runtime, setRuntime] = useState("managed");
  const [trace, setTrace] = useState("full");
  const [retry, setRetry] = useState("immediate");
  const [result, setResult] = useState(false);
  const recovery = retry === "owned";
  const copies = (runtime === "controlled" ? 0 : 1) + (trace === "metadata" ? 0 : 1);
  return <div className="academy-workshop-flow">
    <section>
      <h3>Review a deployment under failure</h3>
      <p>In this case, the existing approved account and self-hosted runner can reach the private service. The proposed hosted setup lacks approval for its session store. Raw traces are prohibited. A write sometimes commits before returning a timeout.</p>
      <label>Runtime and state<select value={runtime} onChange={(event) => { setRuntime(event.target.value); setResult(false); }}>
        <option value="managed">Hosted runtime with unapproved session retention</option>
        <option value="controlled">Approved inference surface and private runner with controlled state</option>
      </select></label>
      <label>Diagnostics<select value={trace} onChange={(event) => { setTrace(event.target.value); setResult(false); }}>
        <option value="full">Store full prompts and tool outputs</option><option value="metadata">Correlate status, timings and operation IDs</option>
      </select></label>
      <label>Recovery on write timeout<select value={retry} onChange={(event) => { setRetry(event.target.value); setResult(false); }}>
        <option value="immediate">Retry immediately with a new operation ID</option>
        <option value="owned">Check the existing operation ID before any bounded retry</option>
      </select></label>
    </section>
    {result && <section aria-live="polite" className="academy-workshop-result">
      <h3>Release review</h3>
      <ul>
        <li><strong>{copies} unapproved copies</strong><p>{copies ? "Review both session state and trace payloads." : "The case keeps source data in approved storage."}</p></li>
        <li><strong>{recovery ? "One recorded change" : "Two recorded changes"}</strong><p>{recovery ? "Reconciliation finds the timed-out but committed action." : "The recovery write uses a fresh identity and commits a duplicate."}</p></li>
        <li><strong>{!copies && recovery ? "Meets the case’s release conditions" : "Requires changes before release"}</strong></li>
      </ul>
      <ExternalLink href="https://platform.claude.com/docs/en/managed-agents/overview">Anthropic runtime and environment guide</ExternalLink>
    </section>}
    <button type="button" className="academy-button secondary" onClick={() => setResult(true)}><Play size={15} aria-hidden="true" /> Replay the timeout and review custody</button>
  </div>;
}

export function DecemberWorkshop({ track }: { track: TrackId }) {
  const workshop = track === "associate-foundations" ? [FileCheck2, EditorialWorkshop] as const
    : track === "developer-foundations" ? [GitCompareArrows, EvaluationWorkshop] as const
    : [Network, DeploymentWorkshop] as const;
  const [Icon, Content] = workshop;
  return <details className="academy-panel academy-december-workshop">
    <summary><Icon size={20} aria-hidden="true" /> Practice the revised exam skills <ArrowRight size={15} aria-hidden="true" /></summary>
    <Content />
  </details>;
}
