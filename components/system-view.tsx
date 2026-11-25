import {
  ArrowRight, ArrowUpRight, CircleCheck, CircleHelp, ClipboardList, Inbox, Play, RotateCw, Save, ScanLine, Signpost, UserRound,
} from "lucide-react";
import {
  baselineShift, conditions, contractLabels, initialRoutes, meetsDispatchGoal, routeLabels, sampleTicket, traceOutcome,
} from "../lib/shift";
import type { Contract, Condition, Route, Routes, ShiftResult } from "../lib/shift";
import { Glossed } from "./glossary/peek";

const ticketCondition = conditions.find(({ id }) => id === sampleTicket.condition)!;

export function focusTicketRule(contract: Contract) {
  const id = contract === "typed" ? `recovery-${sampleTicket.condition}` : "response-contract";
  document.getElementById(id)?.focus();
}

export function DispatchBrief({ contract, result, status, step, onReplay }: {
  contract: Contract;
  result: ShiftResult | null;
  status: "saved" | "saving" | "unavailable" | null;
  step: number;
  onReplay: () => void;
}) {
  const met = !!result && meetsDispatchGoal(result);
  const next = met
    ? (status === "saved" ? "Open the technical debrief, then answer the practice questions." : "Save this replay week to record the improvement in your city.")
    : result ? "Compare your results below. Adjust the recovery rules and run another replay week."
    : contract === "typed" ? "Set a recovery rule for each of the four outcomes, then select Run replay week."
    : step === 0 ? "Replay T-17 to see what the lookup returned and what the customer heard."
    : "T-17 timed out, yet the customer heard “not found”. Under Response contract, find the setting that keeps those two results apart.";
  const replayFirst = !result && contract !== "typed" && step === 0;
  function goNext() {
    if (replayFirst) onReplay();
    else if (met) document.getElementById("shift-heading")?.focus();
    else focusTicketRule(contract);
  }
  return (
    <section className="dispatch-brief" aria-labelledby="dispatch-goal">
      <ClipboardList size={22} aria-hidden="true" />
      <div>
        <h3 id="dispatch-goal">Your mission: fix false “order not found” replies</h3>
        <p>Get to zero false replies and reduce staff follow-up below {baselineShift.staffHours} hours across the replay week.</p>
        <p className="dispatch-next" role="status"><strong>Next step</strong> · {next}</p>
        <button type="button" className="button button-text" onClick={goNext}>
          {replayFirst ? "Watch ticket T-17" : met ? "Go to replay week results" : "Go to recovery rules"} <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

const nodes = [
  { id: "intake", name: "Request intake", icon: Inbox },
  { id: "lookup", name: "Order lookup", icon: ScanLine },
  { id: "rules", name: "Recovery rules", icon: Signpost },
] as const;

const outputs = [
  { id: "reply", name: "Customer reply", icon: CircleCheck },
  { id: "support", name: "Support desk", icon: UserRound },
] as const;

export function SystemBoard({ contract, routes, step, playing, onReplay, onStep, onEditRules }: {
  contract: Contract;
  routes: Routes;
  step: number;
  playing: boolean;
  onReplay: () => void;
  onStep: () => void;
  onEditRules: () => void;
}) {
  const outcome = traceOutcome(contract, routes);
  const active = ["intake", "lookup", "rules", outcome.target][step];
  const descriptions = [
    sampleTicket.request,
    sampleTicket.source,
    `${ticketCondition.name} → ${outcome.rule}`,
    outcome.message,
  ];

  return (
    <section className="system-board" aria-label="Order lookup workflow">
      <div className="board-title">
        <div>
          <h3 id="ticket-heading" tabIndex={-1}>Follow ticket {sampleTicket.id}</h3>
          <p>Follow the timeout through the workflow and see what your recovery rules do.</p>
        </div>
      </div>
      <div className="flow" aria-label="Workflow stations">
        {nodes.map(({ id, name, icon: Icon }, index) => (
          <div key={id} className="flow-stage">
            {id === "rules" ? <button className="flow-node flow-rule-button" type="button" aria-controls="recovery-editor"
              aria-current={active === id ? "step" : undefined} data-active={active === id} onClick={onEditRules}>
              <Icon aria-hidden="true" size={22} strokeWidth={1.7} />
              <span>{name}<small>Edit rule for {sampleTicket.id} <ArrowUpRight size={12} aria-hidden="true" /></small></span>
            </button> : <div className="flow-node" aria-current={active === id ? "step" : undefined} data-active={active === id}>
              <Icon aria-hidden="true" size={22} strokeWidth={1.7} />
              <span>{name}</span>
            </div>}
            {index < nodes.length - 1 && <ArrowRight className="flow-arrow" size={18} aria-hidden="true" />}
          </div>
        ))}
        <div className="flow-stage flow-outputs">
          <ArrowRight className="flow-arrow" size={18} aria-hidden="true" />
          <div className="flow-branches">
            {outputs.map(({ id, name, icon: Icon }) => (
              <div key={id} className="flow-node" aria-current={active === id ? "step" : undefined} data-active={active === id}>
                <Icon aria-hidden="true" size={18} strokeWidth={1.7} />
                <span>{name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ticket-trace" role="status">
        <span className="ticket-id">{step === 1 ? sampleTicket.code : sampleTicket.id}</span>
        <p><Glossed text={descriptions[step]} track="architect-foundations" /></p>
      </div>
      {step >= 2 && (
        <dl className="ticket-comparison">
          <div><dt>Original outcome</dt><dd>{traceOutcome("baseline", initialRoutes).disposition}</dd></div>
          <div><dt>Live preview with your rule</dt><dd>{outcome.disposition}</dd></div>
        </dl>
      )}
      <div className="trace-actions">
        <button type="button" className="button button-outline" onClick={onReplay} disabled={playing}>
          <RotateCw size={16} aria-hidden="true" /> {playing ? "Replaying ticket" : `Replay ${sampleTicket.id}`}
        </button>
        <button type="button" className="button button-outline" onClick={onStep}>
          {step === 3 ? "Back to intake" : "Next station"} <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

export function SystemControls({
  contract, routes, onContract, onRoute, onRun, onLens,
}: {
  contract: Contract;
  routes: Routes;
  onContract: (contract: Contract) => void;
  onRoute: (condition: Condition, route: Route) => void;
  onRun: () => void;
  onLens: () => void;
}) {
  return (
    <aside className="inspector system-controls" id="recovery-editor" aria-labelledby="controls-heading">
      <header className="inspector-header">
        <div className="inspector-heading">
          <Signpost size={19} aria-hidden="true" />
          <h2 id="controls-heading" tabIndex={-1}>Recovery rules</h2>
        </div>
      </header>
      <div className="inspector-body">
        <p className="body-copy">Changes here update the {sampleTicket.id} preview. Run the replay week to test them across all 1,000 requests.</p>
        <label className="control-label" data-ticket-rule={contract !== "typed"}>
          <span>Response contract {contract !== "typed" && <small className="linked-ticket">Used by {sampleTicket.id}</small>}</span>
          <select id="response-contract" value={contract} onChange={(event) => onContract(event.target.value as Contract)}>
            {Object.entries(contractLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        {contract === "typed" && (
          <div className="route-fields">
            {conditions.map(({ id, name, actions }) => (
              <label key={id} className="control-label" data-ticket-rule={id === sampleTicket.condition}>
                <span>{name} {id === sampleTicket.condition && <small className="linked-ticket">Used by {sampleTicket.id}</small>}</span>
                <select id={`recovery-${id}`} value={routes[id]} onChange={(event) => onRoute(id, event.target.value as Route)}>
                  {actions.map((route) => <option key={route} value={route}>{routeLabels[route]}</option>)}
                </select>
              </label>
            ))}
          </div>
        )}
        <div className="editor-ticket-preview">
          <p role="status"><strong>{sampleTicket.id} live preview</strong> · {traceOutcome(contract, routes).disposition}</p>
          <button type="button" className="button button-text" onClick={() => document.getElementById("ticket-heading")?.focus()}>Back to ticket diagram</button>
        </div>
        <div className="system-actions">
          <button className="button button-primary" type="button" onClick={onRun}>
            <Play size={16} aria-hidden="true" /> Run replay week
          </button>
        </div>
        <button className="button button-text" type="button" onClick={onLens}>
          Try an exam question on this
        </button>
      </div>
    </aside>
  );
}

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function ShiftSummary({ result, contract, routes, status, onSave, signedIn, error }: {
  result: ShiftResult;
  contract: Contract;
  routes: Routes;
  status: "saved" | "saving" | "unavailable" | null;
  onSave: () => void;
  signedIn: boolean;
  error: string | null;
}) {
  const outcome = traceOutcome(contract, routes);
  const metrics = [
    ["False no-match replies", String(baselineShift.falseNoMatches), String(result.falseNoMatches)],
    ["Staff follow-up time", `${baselineShift.staffHours} h`, `${result.staffHours} h`],
    ["Direct operating spend", dollars.format(baselineShift.directSpend), dollars.format(result.directSpend)],
  ];
  return (
    <section className="shift-summary" aria-labelledby="shift-heading" aria-live="polite">
      <div className="shift-heading">
        <h2 id="shift-heading" tabIndex={-1}>Replay week</h2>
        <p>{meetsDispatchGoal(result) ? "Goal met." : "Goal still open."} {result.calls.toLocaleString("en-US")} lookup calls across 1,000 requests. Payroll stays fixed.</p>
      </div>
      <dl className="impact-metrics">
        {metrics.map(([label, baseline, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd><span>{baseline}</span><ArrowRight size={16} aria-hidden="true" />{value}</dd>
          </div>
        ))}
      </dl>
      <div className="debrief">
        <CircleHelp size={18} aria-hidden="true" />
        <div>
          <p><strong>What changed for {sampleTicket.id}</strong></p>
          <p><Glossed text={`${outcome.message} A completed search with zero rows can report no match. A timeout leaves the outcome unknown.`} track="architect-foundations" /></p>
        </div>
      </div>
      <div className="shift-save">
        <button type="button" className="button button-primary" onClick={onSave} disabled={status === "saved" || status === "saving"}>
          <Save size={16} aria-hidden="true" /> {status === "saved" ? "Replay week saved" : status === "saving" ? "Saving replay week…" : "Save replay week"}
        </button>
        {status === "saved" && <span role="status">{signedIn ? "Saved to your account." : "Saved in this browser."}</span>}
        {status === "unavailable" && <span role="alert">{error ?? "This browser could not save the replay week."}</span>}
      </div>
    </section>
  );
}
