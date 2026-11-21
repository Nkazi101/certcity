import { ArrowLeft, ArrowRight, Check, Clock3 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { isCorrect } from "../../lib/certification-progress";
import { decemberVersion, examGuideLabel, rehearsalBlueprint } from "../../lib/claude/december-blueprints";
import type { Track } from "../../lib/claude/blueprints";
import { rehearsalFormLabel } from "../../lib/claude/assessment/forms";
import { sources } from "../../lib/claude/items";
import type { PracticeItem } from "../../lib/claude/items";
import { itemDomain, objectiveTitle, responseComplete, score, sessionItems } from "../../lib/claude/practice";
import type { Attempt, Session } from "../../lib/claude/practice";
import { ExternalLink } from "./chrome";

export const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
const dueFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

export function dueLabel(due: number) {
  return dueFormat.format(due);
}

export function modeLabel(track: Track, record: Pick<Session, "mode" | "domain" | "version" | "form">) {
  if (record.mode === "mixed") return "Mixed practice";
  if (record.mode === "followup") return "Seven-day follow-up";
  if (record.mode === "assessment") return rehearsalFormLabel(record.form);
  return track.domains.find(({ id }) => id === record.domain)?.title ?? "Domain practice";
}

export function PracticeSession({ track, session, error, busy, onMove, onChoose, onPresent, onSubmit, onExit }: {
  track: Track;
  session: Session;
  error: string | null;
  busy: boolean;
  onMove: (id: string, index: number) => Promise<boolean>;
  onChoose: (id: string, itemId: string, value: string) => Promise<boolean>;
  onPresent: (id: string, itemId: string) => void;
  onSubmit: () => void;
  onExit: () => void;
}) {
  const [now, setNow] = useState(Date.now);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [pendingPicks, setPendingPicks] = useState<{ id: string; picks: string[] } | null>(null);
  const pickVersion = useRef(0);
  const questionHeading = useRef<HTMLHeadingElement>(null);
  const items = sessionItems(track, session);
  const question = items[session.index];
  const displayedAnswers = pendingPicks
    ? { ...session.answers, [pendingPicks.id]: pendingPicks.picks }
    : session.answers;
  const selected = displayedAnswers[question.id] ?? [];
  const complete = items.filter((entry) => responseComplete(entry, displayedAnswers)).length;
  const seconds = session.deadline ? Math.max(0, Math.ceil((session.deadline - now) / 1000)) : null;
  const expired = seconds === 0;
  const required = question.correct.length;
  const isRehearsal = session.mode === "assessment";
  const saveExposureOnRender = !isRehearsal || session.priorExposure === undefined;
  const nextUnanswered = items.findIndex((entry) => !responseComplete(entry, displayedAnswers));

  useEffect(() => {
    if (!session.deadline) return;
    const interval = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, [session.deadline]);

  useEffect(() => {
    if (saveExposureOnRender) onPresent(session.id, question.id);
  }, [session.id, question.id, saveExposureOnRender, onPresent]);

  async function go(index: number) {
    setConfirmSubmit(false);
    if (await onMove(session.id, index)) requestAnimationFrame(() => questionHeading.current?.focus());
  }

  function choose(value: string) {
    const picks = required === 1 ? [value] : selected.includes(value)
      ? selected.filter((pick) => pick !== value)
      : [...selected, value];
    if (picks.length > required) return;
    const version = ++pickVersion.current;
    setPendingPicks({ id: question.id, picks });
    void onChoose(session.id, question.id, value).finally(() => {
      if (version === pickVersion.current) setPendingPicks(null);
    });
  }

  return (
    <main className="academy-width academy-workspace">
      <button className="academy-back" onClick={onExit}><ArrowLeft size={16} aria-hidden="true" /> Save and exit</button>
      <div className="academy-workspace-title">
        <p className="academy-kicker">{track.code}</p>
        <h1>{modeLabel(track, session)}</h1>
        <p>{complete} of {items.length} answered{isRehearsal && ` · ${examGuideLabel(track, session.version)}`}</p>
      </div>
      <div className="academy-session-layout">
        <section className="academy-panel academy-question" aria-labelledby="question-title">
          <p className="academy-kicker">Question {session.index + 1} of {items.length}</p>
          <p className="academy-scenario">{question.scenario}</p>
          {question.context && <details className="academy-case-context" open>
            <summary>Case brief</summary><p>{question.context}</p>
          </details>}
          <h2 id="question-title" ref={questionHeading} tabIndex={-1}>{question.prompt}</h2>
          <fieldset className="academy-fieldset" disabled={expired} aria-label={required === 1 ? "Select one response" : "Select two responses"}>
            <legend>{required === 1 ? "Select one response" : "Select two responses"}</legend>
            {question.options.map(([value, text], index) => (
              <label className="academy-option" key={value}>
                <input type={required === 1 ? "radio" : "checkbox"} name={question.id} value={value}
                  checked={selected.includes(value)} disabled={required > 1 && selected.length >= required && !selected.includes(value)}
                  onChange={() => choose(value)} />
                <span className="academy-option-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
                <span>{text}</span>
              </label>
            ))}
          </fieldset>
          <div className="academy-question-nav">
            <button className="academy-button secondary" disabled={session.index === 0 || busy || expired} onClick={() => void go(session.index - 1)}><ArrowLeft size={16} aria-hidden="true" /> Previous</button>
            {expired || complete === items.length
              ? <button className="academy-button primary" disabled={busy} onClick={onSubmit}>Submit answers <ArrowRight size={16} aria-hidden="true" /></button>
              : session.index < items.length - 1
                ? <button className="academy-button primary" disabled={busy} onClick={() => void go(session.index + 1)}>Next question <ArrowRight size={16} aria-hidden="true" /></button>
                : <button className="academy-button secondary" disabled={busy} onClick={() => void go(nextUnanswered)}>Go to first unanswered <ArrowRight size={16} aria-hidden="true" /></button>}
          </div>
          {session.mode === "assessment" && !expired && complete < items.length && <div className="academy-early-submit">
            {confirmSubmit ? <>
              <p>{items.length - complete} questions are unanswered. Unanswered scored questions will count as incorrect.</p>
              <button className="academy-button primary" disabled={busy} onClick={onSubmit}>Submit rehearsal</button>
              <button className="academy-button text" onClick={() => setConfirmSubmit(false)}>Keep working</button>
            </> : <button className="academy-button text" onClick={() => setConfirmSubmit(true)}>Finish rehearsal</button>}
          </div>}
          {expired && <p role="status" className="academy-notice">Time is up. Submit to review the responses you saved.</p>}
          {error && <p className="academy-error" role="alert">{error}</p>}
        </section>
        <aside className="academy-panel academy-session-index" aria-label="Session navigation">
          {seconds !== null && <p className="academy-timer" aria-label="Time remaining">
            <Clock3 size={17} aria-hidden="true" /> <span role="timer">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>
          </p>}
          <details className="academy-question-directory" open={!isRehearsal}>
            <summary>Jump to a question</summary>
            <div className="academy-question-grid">
              {items.map((entry, index) => {
                const answered = responseComplete(entry, displayedAnswers);
                return <button key={entry.id} type="button" data-answered={answered}
                  aria-label={`Question ${index + 1}, ${answered ? "answered" : "unanswered"}`}
                  aria-current={session.index === index ? "step" : undefined} disabled={busy || expired}
                  onClick={() => void go(index)}>{index + 1}</button>;
              })}
            </div>
          </details>
          <progress aria-label="Questions answered" max={items.length} value={complete} />
        </aside>
      </div>
    </main>
  );
}

function ReviewItem({ track, entry, index, answers }: { track: Pick<Track, "domains">; entry: PracticeItem; index: number; answers: string[] }) {
  const [label, url] = sources[entry.source];
  const correct = isCorrect(entry, answers);
  return (
    <details className="academy-review-item">
      <summary><span>{index + 1}. {objectiveTitle(track, entry)}</span><span className={correct ? "academy-positive" : "academy-missed"}>{correct ? "Correct" : answers.length ? "Needs review" : "Unanswered"}</span></summary>
      <div className="academy-review-body">
        <p className="academy-scenario">{entry.scenario}</p>
        {entry.context && <p>{entry.context}</p>}
        <h3>{entry.prompt}</h3>
        {entry.pilot && <p>Unscored review item</p>}
        <p>{entry.explanation}</p>
        <ul className="academy-review-options">
          {entry.options.map(([value, text], index) => {
            const key = entry.correct.includes(value);
            const picked = answers.includes(value);
            return <li key={value} data-correct={key}>
              <div><strong>{String.fromCharCode(65 + index)}. {text}</strong>{(picked || key) && <span className="academy-option-status">{key && <><Check size={14} aria-hidden="true" /> Correct answer</>}{picked && <span>Your response</span>}</span>}</div>
              {entry.rationales[value] && <p>{entry.rationales[value]}</p>}
            </li>;
          })}
        </ul>
        <ExternalLink href={url}>{label}</ExternalLink>
      </div>
    </details>
  );
}

export function PracticeReview({ track, attempt, due, onBack, onDomain }: {
  track: Track;
  attempt: Attempt;
  due: number | null;
  onBack: () => void;
  onDomain: (domain: number) => void;
}) {
  const items = sessionItems(track, attempt);
  const scored = items.filter((entry) => !entry.pilot);
  const count = score(scored, attempt.answers);
  const blueprint = rehearsalBlueprint(track, attempt.version);
  const incorrect = scored.find((entry) => !isCorrect(entry, attempt.answers[entry.id] ?? []));
  return (
    <main className="academy-width academy-workspace">
      <button className="academy-back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Back to pathway</button>
      <div className="academy-workspace-title">
        <p className="academy-kicker">{modeLabel(track, attempt)} · {dateFormat.format(attempt.submittedAt)}{attempt.mode === "assessment" && ` · ${examGuideLabel(track, attempt.version)}`}</p>
        <h1>{attempt.mode === "assessment" ? "Rehearsal results" : "Practice results"}</h1>
        <p className="academy-result-score"><strong>{count} / {scored.length}</strong> correct</p>
        {due && attempt.mode === "mixed" && <p>Seven-day follow-up available {dueLabel(due)}.</p>}
      </div>
      {attempt.mode === "assessment" && <section className="academy-panel academy-assessment-domains" aria-label="Rehearsal results by domain">
        <h2>Results by domain</h2>
        <p>Raw results for this form. Anthropic reports a separate scaled score on the official exam.</p>
        <p>{attempt.priorExposure === undefined ? "This saved attempt predates question exposure tracking."
          : attempt.priorExposure.length === 0 ? "Every question was fresh when you started."
            : `${attempt.priorExposure.length} of ${items.length} questions had been seen when you started.`}</p>
        <dl>{blueprint.domains.map(({ id, title }) => {
          const group = scored.filter((item) => itemDomain(item) === id);
          return <div key={id}><dt>{title}</dt><dd>{score(group, attempt.answers)}/{group.length}</dd></div>;
        })}</dl>
      </section>}
      <section className="academy-panel academy-review" aria-labelledby="answer-review">
        <div className="academy-section-heading">
          <h2 id="answer-review">Answer review</h2>
          {incorrect && <button className="academy-button secondary" onClick={() => onDomain(itemDomain(incorrect))}>{attempt.version === decemberVersion ? "Review a missed domain" : "Practice a missed domain"} <ArrowRight size={16} aria-hidden="true" /></button>}
        </div>
        {items.map((entry, index) => <ReviewItem key={entry.id} track={blueprint} entry={entry} index={index} answers={attempt.answers[entry.id] ?? []} />)}
      </section>
    </main>
  );
}
