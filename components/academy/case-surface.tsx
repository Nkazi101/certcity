import { ArrowRight, Check, CircleAlert, Clock3, FileText, Gauge, GitPullRequestArrow, Mail, Shield, Terminal } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { CaseDraft, CaseField, CaseOption, CaseValue, Casework } from "../../lib/claude/casework";
import { caseCapacity, isChoice } from "../../lib/claude/casework";
import { caseOptionOrder } from "../../lib/claude/missions";
import type { replayCasework } from "../../lib/claude/casework";
import type { WorkLayout, WorkSection } from "../../lib/claude/cases/layouts";
import { sourcesForSection } from "../../lib/claude/cases/presentation";
import styles from "./station-workbench.module.css";
import { Glossed } from "../glossary/peek";

type Run = ReturnType<typeof replayCasework>;

type Props = {
  missionId: string;
  exercise: Casework;
  layout: WorkLayout;
  draft: CaseDraft;
  busy: boolean;
  /** Retry cycle. Option order is seeded by mission, field and cycle. */
  cycle: number;
  update: (field: string, value: CaseValue) => void;
};

/** Options in this cycle's display order. Saved values do not depend on it. */
export function orderedOptions(missionId: string, field: Extract<CaseField, { options: unknown }>, cycle: number): readonly CaseOption[] {
  return caseOptionOrder(missionId, field.id, cycle, field.options.length).map((index) => field.options[index]);
}

function Field({ field, value, busy, update, compact, buttons, options }: {
  field: CaseField;
  value: CaseValue | null;
  busy: boolean;
  update: (value: CaseValue) => void;
  compact?: boolean;
  buttons?: boolean;
  options: readonly CaseOption[];
}) {
  const numberId = useId();
  const [numberFeedback, setNumberFeedback] = useState<"invalid" | "restored" | null>(null);
  const numberInput = useRef<HTMLInputElement>(null);
  // Keep the uncontrolled number box in step with a revealed answer or a fresh attempt.
  useEffect(() => {
    const input = numberInput.current;
    if (input && document.activeElement !== input) input.value = value === null ? "" : String(value);
  }, [value]);
  if (buttons && isChoice(field)) return <fieldset className="casework-route" data-field={field.id} data-unset={value === null || undefined} disabled={busy}>
    <legend>{field.label}</legend>
    <div>{options.map(({ value: option }) => <button type="button" className="button button-outline" key={option}
      aria-pressed={value === option} onClick={() => update(option)}>{option}</button>)}</div>
  </fieldset>;

  return <label data-field={field.id} data-unset={value === null || undefined}>
    {!compact && <span>{field.label}</span>}
    {isChoice(field) ? <select value={value ?? ""} aria-label={compact ? field.label : undefined} disabled={busy}
      onChange={(event) => { if (event.currentTarget.value) update(event.currentTarget.value); }}>
      <option value="" disabled>Choose…</option>
      {options.map(({ value: option }) => <option key={option} value={option}>{option}</option>)}
    </select> : <>
      <span className="casework-number">
        <input ref={numberInput} type="number" inputMode="numeric" aria-label={field.label} aria-invalid={numberFeedback === "invalid" || undefined}
          aria-describedby={numberFeedback ? `${numberId}-unit ${numberId}-feedback` : `${numberId}-unit`}
          min={field.min} max={field.max} disabled={busy} defaultValue={value ?? ""} placeholder="Enter"
          onChange={(event) => {
            const candidate = event.currentTarget.valueAsNumber;
            if (Number.isInteger(candidate) && candidate >= field.min && candidate <= field.max) {
              setNumberFeedback(null);
              update(candidate);
            } else setNumberFeedback("invalid");
          }}
          onBlur={(event) => {
            const entered = event.currentTarget.valueAsNumber;
            if (value === null ? Number.isNaN(entered) : entered === value) return;
            event.currentTarget.value = value === null ? "" : String(value);
            setNumberFeedback(value === null ? "invalid" : "restored");
          }} />
        <span id={`${numberId}-unit`}>{field.unit}</span>
      </span>
      {numberFeedback && <span id={`${numberId}-feedback`} className={styles.numberFeedback} role="status">
        {numberFeedback === "restored" && value !== null && `Restored ${value}. `}Enter a whole number between {field.min} and {field.max}.
      </span>}
    </>}
  </label>;
}

function Paper({ title, content }: { title: string; content: string }) {
  return <article className="case-draft-paper">
    <h5><FileText size={17} aria-hidden="true" />{title}</h5>
    <pre><Glossed text={content} /></pre>
  </article>;
}

function LinkedResults({ missionId, exercise, layout, draft, busy, update, cycle }: Props) {
  const fields = new Map(exercise.fields.map((field) => [field.id, field]));
  return <div className="case-trace">
    {layout.arrivals?.map(({ field: id, label, text }) => {
      const field = fields.get(id);
      if (!field || !isChoice(field)) return null;
      return <div className="case-link-row" key={id}>
        <article className="case-trace-event"><small>{label}</small><strong>{text}</strong></article>
        <ArrowRight size={22} aria-hidden="true" />
        <fieldset data-field={id} disabled={busy}>
          <legend>{field.label}</legend>
          {orderedOptions(missionId, field, cycle).map(({ value: target }) => <button type="button" key={target} aria-pressed={draft[id] === target}
            onClick={() => update(id, target)}>{target}</button>)}
        </fieldset>
      </div>;
    })}
  </div>;
}

function RunAtStation({ starting, current, stale, checkIndex }: {
  starting?: Run["checks"][number];
  current: Run["checks"][number];
  stale: boolean;
  checkIndex?: number;
}) {
  const newArrival = checkIndex === undefined;
  const status = stale ? "Last run" : current.passed ? "Passed" : "Needs attention";
  return <article className="case-object-result" data-passed={current.passed} data-run={newArrival ? "arrival" : "sample"} data-check-index={checkIndex} data-stale={stale || undefined}
    aria-label={`${current.name}. ${status}.`} tabIndex={-1}>
    <header><strong>{current.name}</strong><span>{stale ? "Last run" : newArrival ? "New arrival replay" : "Sample replay"}</span></header>
    <p><Glossed text={current.evidence} /></p>
    {starting && starting.effect !== current.effect && <p className="case-object-before"><small>Deployed setup</small><Glossed text={starting.effect} /></p>}
    <p className="case-object-effect"><small>{current.passed ? "What held" : "What needs attention"}</small><Glossed text={current.effect} /></p>
  </article>;
}

export function CaseSurface({ missionId, exercise, layout, draft, busy, update, cycle, baseline, result, retest, sampleCurrent, retestCurrent,
  active, onSelectSection, sampleSections }: Props & {
  baseline: Run;
  result: Run | null;
  retest: Run | null;
  sampleCurrent: boolean;
  retestCurrent: boolean;
  active: number;
  onSelectSection: (section: number) => void;
  sampleSections: readonly number[];
}) {
  const panel = useId();
  const fields = new Map(exercise.fields.map((field) => [field.id, field]));
  const capacity = caseCapacity(exercise, draft);
  const generated = exercise.output?.(draft) ?? [];
  const { kind, sections } = layout;
  const chosenSection = sections[active];
  const retestSection = missionId === "regional-operations" ? 2 : sections.findIndex(({ fields }) =>
    fields.includes(exercise.retest.fields[0]));

  function sources(index: number, placement?: "first" | "remaining") {
    const nearby = sourcesForSection(missionId, exercise, index);
    const displayed = placement === "first" ? nearby.slice(0, 1) : placement === "remaining" ? nearby.slice(1) : nearby;
    if (!displayed.length) return null;
    return <div className={`case-object-sources ${placement === "remaining" ? styles.remainingEvidence : styles.firstEvidence}`}
      key={`${index}:${placement ?? "all"}`} aria-label={placement === "remaining" ? "More evidence" : "Source evidence"}>
      {displayed.map(([name, facts], source) => <details key={name} open={placement !== "remaining" && source === 0}>
        <summary>{name}</summary>
        <p><Glossed text={facts} /></p>
      </details>)}
    </div>;
  }

  function workingObject(index: number, controls: ReactNode) {
    return <div className={styles.workingObject}>
      {sources(index, "first")}
      <div className={styles.workingControls}>{controls}</div>
      {sources(index, "remaining")}
    </div>;
  }

  function outcomes(index: number) {
    const checks = result?.checks.flatMap((check, checkIndex) => {
      return sampleSections[checkIndex] === index
        ? [<RunAtStation key={check.name} checkIndex={checkIndex} starting={baseline.checks[checkIndex]} current={check} stale={!sampleCurrent} />] : [];
    });
    const arrival = retest?.checks[0];
    return <>
      {checks}
      {arrival && retestSection === index && <RunAtStation current={arrival} stale={!retestCurrent} />}
    </>;
  }

  function fieldControl(id: string, compact = false, buttons = false) {
    const field = fields.get(id);
    return field && <Field field={field} value={draft[id] ?? null} update={(value) => update(id, value)}
      options={isChoice(field) ? orderedOptions(missionId, field, cycle) : []}
      compact={compact} buttons={buttons} busy={busy} key={id} />;
  }

  function sectionPreview(section: WorkSection) {
    if (section.preview === undefined) return null;
    const artifact = generated[section.preview];
    return artifact && <Paper title={artifact[0]} content={artifact[1]} />;
  }

  if (kind === "inbox" || kind === "desk" || kind === "console") {
    const bulletin = missionId === "market-bulletin";
    const controls = chosenSection.fields.map((id) => fieldControl(id, false, bulletin && id === "send"));
    return <div className="case-folder" data-folder={kind}>
      <nav className={styles.folderTabs} aria-label={kind === "inbox" ? "Messages" : kind === "console" ? "Test stations" : "Documents"}>
        {sections.map(({ title }, index) => {
          const checks = (sampleCurrent ? result?.checks : undefined)?.filter((_, checkIndex) => sampleSections[checkIndex] === index) ?? [];
          if (retestCurrent && retest && retestSection === index) checks.push(...retest.checks);
          const passed = checks.every((check) => check.passed);
          const ResultIcon = passed ? Check : CircleAlert;
          const description = checks.length ? passed ? "Replay passed" : "Replay needs attention" : undefined;
          return <button key={title} type="button" aria-pressed={active === index} aria-controls={panel} aria-description={description} onClick={() => onSelectSection(index)}>
            {kind === "inbox" ? <Mail size={17} aria-hidden="true" /> : kind === "console" ? <Terminal size={17} aria-hidden="true" /> : <FileText size={17} aria-hidden="true" />}
            {title}
            {description && <ResultIcon className="case-folder-result" size={15} aria-hidden="true" />}
          </button>;
        })}
      </nav>
      <section id={panel} className="case-folder-page" aria-label={chosenSection.title}>
        <h4 className={styles.repeatTitle}>{chosenSection.title}</h4>
        {kind === "inbox" && layout.arrivals?.[active] && <blockquote>
          <Glossed text={layout.arrivals[active].text} /><cite>{layout.arrivals[active].label}</cite>
        </blockquote>}
        {workingObject(active, controls)}
        {outcomes(active)}
        {kind === "inbox" && generated[0] ? <Paper title="Reply preview" content={generated[0][1].split("\n")[active] ?? ""} />
          : sectionPreview(chosenSection)}
      </section>
    </div>;
  }

  if (kind === "ledger" || kind === "matrix") {
    if (missionId === "supplier-invoices") {
      return <div className={styles.receivingLedger}>
        {sections.map(({ title, fields: keys }, index) => <section className={styles.invoiceSection} key={title}>
          <h4>{title}</h4>
          {workingObject(index, keys.map((id) => fieldControl(id)))}
          {outcomes(index)}
          {index === 0 && generated[0] && <Paper title={generated[0][0]} content={generated[0][1]} />}
        </section>)}
      </div>;
    }
    return <div className="case-sheets" data-sheet={kind}>
      {sections.map(({ title, fields: keys }, index) => <section className="case-ledger-page" key={title}>
        <h4>{title}</h4>
        <div className="case-ledger-working">
          {sources(index)}
          <table aria-label={title}>
            <thead><tr><th scope="col">{kind === "ledger" ? "Entry" : "Boundary"}</th><th scope="col">Before</th><th scope="col">Working change</th></tr></thead>
            <tbody>{keys.map((id) => {
              const field = fields.get(id);
              return field && <tr key={id}>
                <th scope="row">{field.label}</th><td>{exercise.deployed[id]}{"unit" in field ? " " + field.unit : ""}</td>
                <td>{fieldControl(id, true)}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        {index === 0 && generated[0] && <Paper title={generated[0][0]} content={generated[0][1]} />}
        {outcomes(index)}
      </section>)}
    </div>;
  }

  if (kind === "redaction") {
    return <div className="case-redaction">
      <section className="case-redaction-paper">
        <h4>{sections[0].title}</h4>
        {sources(0)}
        {layout.arrivals?.map(({ field, label, text }) => {
          const value = draft[field] ?? null;
          const removed = value === "Remove";
          const control = fields.get(field);
          return control && isChoice(control) && <div className="case-redaction-row" key={field} data-field={field} data-redacted={removed}>
            <div><strong>{label}</strong><p>{removed ? "Redacted" : value === null ? text : `${text} · ${value}`}</p></div>
            <fieldset className="casework-route" disabled={busy}>
              <legend>{control.label}</legend>
              <div>{orderedOptions(missionId, control, cycle).map(({ value: option }) => <button type="button" className="button button-outline" key={option}
                aria-pressed={value === option} onClick={() => update(field, option)}>{option}</button>)}</div>
            </fieldset>
          </div>;
        })}
        {outcomes(0)}
      </section>
      <section className="case-surface-card">
        <h4><Shield size={17} aria-hidden="true" />{sections[1].title}</h4>
        {sources(1)}
        {sections[1].fields.map((id) => fieldControl(id))}
        {outcomes(1)}
      </section>
    </div>;
  }

  if (kind === "trace") {
    return <div className="case-trace">
      <section className="case-surface-card">
        <h4><GitPullRequestArrow size={18} aria-hidden="true" />{sections[0].title}</h4>
        {layout.arrivals ? workingObject(0, <LinkedResults {...{ missionId, exercise, layout, draft, busy, update, cycle }} />) : <>
          {sources(0)}
          <ol className="case-trace-sequence">
            <li>Request received</li><li>c42 · {draft.call ?? "next step not chosen"}</li><li>{draft.connector ?? "source action not chosen"}</li>
          </ol>
          {sections[0].fields.map((id) => fieldControl(id, false, true))}
        </>}
        {layout.arrivals && generated[0] && <details className="case-trace-preview">
          <summary>Inspect the linked message</summary><Paper title={generated[0][0]} content={generated[0][1]} />
        </details>}
        {outcomes(0)}
      </section>
      <section className="case-surface-card"><h4>{sections[1].title}</h4>{sources(1)}{sections[1].fields.map((id) => fieldControl(id))}{outcomes(1)}</section>
    </div>;
  }

  if (kind === "incident") {
    let elapsed = 0;
    return <div className="case-incident">
      <section className="case-command">
        <header className={styles.incidentHeader}>
          <h4><Clock3 size={19} aria-hidden="true" />{sections[0].title}</h4>
          {capacity && <p aria-live="polite" data-late={capacity.used > capacity.limit}>
            <strong>{capacity.used}/{capacity.limit}</strong> {capacity.unit}
            {capacity.used > capacity.limit && <span> · Over limit</span>}
          </p>}
        </header>
        {workingObject(0,
          <ol>{sections[0].fields.map((id) => {
            const time = capacity?.lengths.find((step) => step.id === id)?.units ?? 0;
            elapsed += time;
            return <li key={id} data-late={elapsed > (capacity?.limit ?? Infinity)}>
              <time dateTime={`PT${elapsed}M`}>{elapsed} min{elapsed > (capacity?.limit ?? Infinity) && <CircleAlert size={14} aria-label="Over limit" />}</time>
              {fieldControl(id, false, true)}
            </li>;
          })}</ol>,
        )}
        {outcomes(0)}
      </section>
      {sections.slice(1).map(({ title, fields: keys }, index) => <section className="case-surface-card" key={title}>
        <h4>{title}</h4>{sources(index + 1)}{keys.map((id) => fieldControl(id))}
        {index === 0 && generated[1] && <Paper title={generated[1][0]} content={generated[1][1]} />}
        {outcomes(index + 1)}
      </section>)}
    </div>;
  }

  return <div className={kind === "lanes" ? "case-lanes" : "case-review"}>
    {sections.map(({ title, fields: keys }, index) => <section className="case-surface-card" key={title}>
      <h4>{kind === "review" && <Gauge size={17} aria-hidden="true" />}{title}</h4>
      {sources(index)}
      {keys.map((id) => fieldControl(id, false, kind === "lanes"))}
      {outcomes(index)}
    </section>)}
    {kind === "review" && generated[0] && <Paper title={generated[0][0]} content={generated[0][1]} />}
  </div>;
}
