import { ArrowRight, Clock3, FileText, Gauge, GitPullRequestArrow, Mail, Shield, Terminal } from "lucide-react";
import { useId, useState } from "react";
import type { CaseDraft, CaseField, CaseValue, Casework } from "../../lib/claude/casework";
import { caseCapacity } from "../../lib/claude/casework";
import type { WorkLayout, WorkSection } from "../../lib/claude/cases/layouts";

type Props = {
  exercise: Casework;
  layout: WorkLayout;
  draft: CaseDraft;
  busy: boolean;
  update: (field: string, value: CaseValue) => void;
};

function Field({ field, value, busy, update, compact, buttons }: {
  field: CaseField;
  value: CaseValue;
  busy: boolean;
  update: (value: CaseValue) => void;
  compact?: boolean;
  buttons?: boolean;
}) {
  if (buttons && "options" in field) return <fieldset className="casework-route" data-field={field.id} disabled={busy}>
    <legend>{field.label}</legend>
    <div>{field.options.map((option) => <button type="button" className="button button-outline" key={option}
      aria-pressed={value === option} onClick={() => update(option)}>{option}</button>)}</div>
  </fieldset>;

  return <label data-field={field.id}>
    {!compact && <span>{field.label}</span>}
    {"options" in field ? <select value={value} aria-label={compact ? field.label : undefined} disabled={busy}
      onChange={(event) => update(event.currentTarget.value)}>
      {field.options.map((option) => <option key={option}>{option}</option>)}
    </select> : <span className="casework-number">
      <input type="number" inputMode="numeric" aria-label={compact ? field.label : undefined}
        min={field.min} max={field.max} disabled={busy} defaultValue={value}
        onChange={(event) => {
          const candidate = event.currentTarget.valueAsNumber;
          if (Number.isInteger(candidate) && candidate >= field.min && candidate <= field.max) update(candidate);
        }}
        onBlur={(event) => {
          if (event.currentTarget.valueAsNumber !== value) event.currentTarget.value = String(value);
        }} />
      <span>{field.unit}</span>
    </span>}
  </label>;
}

function Paper({ title, content }: { title: string; content: string }) {
  return <article className="case-draft-paper">
    <h5><FileText size={17} aria-hidden="true" />{title}</h5>
    <pre>{content}</pre>
  </article>;
}

function LinkedResults({ exercise, layout, draft, busy, update }: Props) {
  const fields = new Map(exercise.fields.map((field) => [field.id, field]));
  return <div className="case-trace">
    {layout.arrivals?.map(({ field: id, label, text }) => {
      const field = fields.get(id);
      if (!field || !("options" in field)) return null;
      return <div className="case-link-row" key={id}>
        <article className="case-trace-event"><small>{label}</small><strong>{text}</strong></article>
        <ArrowRight size={22} aria-hidden="true" />
        <fieldset data-field={id} disabled={busy}>
          <legend>{field.label}</legend>
          {field.options.map((target) => <button type="button" key={target} aria-pressed={draft[id] === target}
            onClick={() => update(id, target)}>{target}</button>)}
        </fieldset>
      </div>;
    })}
  </div>;
}

export function CaseSurface({ exercise, layout, draft, busy, update }: Props) {
  const [active, setActive] = useState(0);
  const panel = useId();
  const fields = new Map(exercise.fields.map((field) => [field.id, field]));
  const capacity = caseCapacity(exercise, draft);
  const generated = exercise.output?.(draft) ?? [];
  const { kind, sections } = layout;
  const chosenSection = sections[active];

  function fieldControl(id: string, compact = false, buttons = false) {
    const field = fields.get(id);
    return field && <Field field={field} value={draft[id]} update={(value) => update(id, value)}
      compact={compact} buttons={buttons} busy={busy} key={id} />;
  }

  function sectionPreview(section: WorkSection) {
    if (section.preview === undefined) return null;
    const artifact = generated[section.preview];
    return artifact && <Paper title={artifact[0]} content={artifact[1]} />;
  }

  if (kind === "inbox" || kind === "desk" || kind === "console") {
    return <div className="case-folder" data-folder={kind}>
      <nav aria-label={kind === "inbox" ? "Messages" : kind === "console" ? "Test stations" : "Documents"}>
        {sections.map(({ title }, index) => <button key={title} type="button" aria-pressed={active === index}
          aria-controls={panel} onClick={() => setActive(index)}>
          {kind === "inbox" ? <Mail size={17} aria-hidden="true" /> : kind === "console" ? <Terminal size={17} aria-hidden="true" /> : <FileText size={17} aria-hidden="true" />}
          {title}
        </button>)}
      </nav>
      <section id={panel} className="case-folder-page" aria-label={chosenSection.title}>
        <h4>{chosenSection.title}</h4>
        {kind === "inbox" && layout.arrivals?.[active] && <blockquote>
          {layout.arrivals[active].text}<cite>{layout.arrivals[active].label}</cite>
        </blockquote>}
        {chosenSection.fields.map((id) => fieldControl(id))}
        {kind === "inbox" && generated[0] ? <Paper title="Reply preview" content={generated[0][1].split("\n")[active] ?? ""} />
          : sectionPreview(chosenSection)}
      </section>
    </div>;
  }

  if (kind === "ledger" || kind === "matrix") {
    return <div className="case-sheets" data-sheet={kind}>
      {sections.map(({ title, fields: keys }) => <table key={title}>
        <caption>{title}</caption>
        <thead><tr><th scope="col">{kind === "ledger" ? "Entry" : "Boundary"}</th><th scope="col">Before</th><th scope="col">Working change</th></tr></thead>
        <tbody>{keys.map((id) => {
          const field = fields.get(id);
          return field && <tr key={id}>
            <th scope="row">{field.label}</th><td>{field.initial}{"unit" in field ? " " + field.unit : ""}</td>
            <td>{fieldControl(id, true)}</td>
          </tr>;
        })}</tbody>
      </table>)}
      {generated[0] && <Paper title={generated[0][0]} content={generated[0][1]} />}
    </div>;
  }

  if (kind === "redaction") {
    return <div className="case-redaction">
      <section className="case-redaction-paper">
        <h4>{sections[0].title}</h4>
        {layout.arrivals?.map(({ field, label, text }) => {
          const removed = draft[field] === "Remove";
          const control = fields.get(field);
          return control && "options" in control && <div className="case-redaction-row" key={field} data-field={field} data-redacted={removed}>
            <div><strong>{label}</strong><p>{removed ? "Redacted" : text}</p></div>
            <button type="button" className="button button-outline" aria-label={`Redact ${label.toLowerCase()}`} aria-pressed={removed} disabled={busy}
              onClick={() => update(field, (removed ? control.options.find((option) => option !== "Remove") : "Remove") ?? control.initial)}>
              {removed ? "Restore" : "Redact"}
            </button>
          </div>;
        })}
      </section>
      <section className="case-surface-card">
        <h4><Shield size={17} aria-hidden="true" />{sections[1].title}</h4>
        {sections[1].fields.map((id) => fieldControl(id))}
      </section>
    </div>;
  }

  if (kind === "trace") {
    return <div className="case-trace">
      <section className="case-surface-card">
        <h4><GitPullRequestArrow size={18} aria-hidden="true" />{sections[0].title}</h4>
        {layout.arrivals ? <LinkedResults {...{ exercise, layout, draft, busy, update }} />
          : <ol className="case-trace-sequence">
            <li>Request received</li><li>c42 · {draft.call}</li><li>{draft.connector}</li>
          </ol>}
        {!layout.arrivals && sections[0].fields.map((id) => fieldControl(id, false, true))}
        {layout.arrivals && generated[0] && <details className="case-trace-preview">
          <summary>Inspect the linked message</summary><Paper title={generated[0][0]} content={generated[0][1]} />
        </details>}
      </section>
      <section className="case-surface-card"><h4>{sections[1].title}</h4>{sections[1].fields.map((id) => fieldControl(id))}</section>
    </div>;
  }

  if (kind === "incident") {
    let elapsed = 0;
    return <div className="case-incident">
      <section className="case-command">
        <h4><Clock3 size={19} aria-hidden="true" />{sections[0].title}</h4>
        <ol>{sections[0].fields.map((id) => {
          const time = capacity?.lengths.find((step) => step.id === id)?.units ?? 0;
          elapsed += time;
          return <li key={id} data-late={elapsed > (capacity?.limit ?? Infinity)}>
            <time dateTime={`PT${elapsed}M`}>{elapsed} min</time>{fieldControl(id, false, true)}
          </li>;
        })}</ol>
      </section>
      {sections.slice(1).map(({ title, fields: keys }) => <section className="case-surface-card" key={title}>
        <h4>{title}</h4>{keys.map((id) => fieldControl(id))}
      </section>)}
      {generated[1] && <Paper title={generated[1][0]} content={generated[1][1]} />}
    </div>;
  }

  return <div className={kind === "lanes" ? "case-lanes" : "case-review"}>
    {sections.map(({ title, fields: keys }) => <section className="case-surface-card" key={title}>
      <h4>{kind === "review" && <Gauge size={17} aria-hidden="true" />}{title}</h4>
      {keys.map((id) => fieldControl(id, false, kind === "lanes"))}
    </section>)}
    {kind === "review" && generated[0] && <Paper title={generated[0][0]} content={generated[0][1]} />}
  </div>;
}
