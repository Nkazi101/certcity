import { ArrowLeft, ArrowRight, Check, ChevronDown, Clock3 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { isCorrect } from "../../lib/certification-progress";
import { decemberVersion, examGuideLabel, rehearsalBlueprint } from "../../lib/claude/december-blueprints";
import type { Track } from "../../lib/claude/blueprints";
import { rehearsalFormLabel } from "../../lib/claude/assessment/forms";
import { evidenceFingerprint } from "../../lib/claude/evidence-snapshot";
import { answeredBeforeRelease, sources } from "../../lib/claude/items";
import type { PracticeItem } from "../../lib/claude/items";
import { itemDomain, objectiveTitle, responseComplete, score, sessionItems } from "../../lib/claude/practice";
import type { Attempt, Session } from "../../lib/claude/practice";
import { ExternalLink } from "./chrome";
import { QuestionReport } from "./question-report";
import { lessonHref, lessonObjectiveFor } from "../../lib/claude/lessons/paths";

export const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
const dueFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

export function dueLabel(due: number) {
  return dueFormat.format(due);
}

export function modeLabel(track: Track, record: Pick<Session, "mode" | "domain" | "version" | "form">) {
  if (record.mode === "mixed") return "Mixed practice";
  if (record.mode === "followup") return "7-day review";
  if (record.mode === "assessment") return rehearsalFormLabel(record.form);
  if (record.mode === "reassessment") return "Domain retest";
  return rehearsalBlueprint(track, record.version).domains.find(({ id }) => id === record.domain)?.title ?? "Domain practice";
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
  const questionPanel = useRef<HTMLElement>(null);
  const directory = useRef<HTMLDetailsElement>(null);
  const finishButton = useRef<HTMLButtonElement>(null);
  const finishHeading = useRef<HTMLParagraphElement>(null);
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

  useEffect(() => {
    if (confirmSubmit) finishHeading.current?.focus();
  }, [confirmSubmit]);

  async function go(index: number, fromDirectory = false) {
    setConfirmSubmit(false);
    if (await onMove(session.id, index)) {
      if (fromDirectory && directory.current) directory.current.open = false;
      requestAnimationFrame(() => {
        questionHeading.current?.focus({ preventScroll: true });
        const target = items[index].scenario === question.scenario ? questionHeading.current : questionPanel.current;
        target?.scrollIntoView({ block: "start" });
      });
    }
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
    <main id="academy-main" tabIndex={-1} className="academy-width academy-workspace academy-active-session">
      <button className="academy-back" onClick={onExit}><ArrowLeft size={16} aria-hidden="true" /> Save and exit</button>
      <div className="academy-workspace-title">
        <p className="academy-kicker">{track.code}</p>
        <h1>{modeLabel(track, session)}</h1>
        {(isRehearsal || session.mode === "reassessment") && <p>{session.snapshot?.label ?? examGuideLabel(track, session.version)}</p>}
      </div>
      <div className="academy-session-layout">
        <aside className="academy-panel academy-session-index" aria-label="Session navigation">
          <div className="academy-session-totals">
            <div className="academy-session-progress">
              <p className="academy-session-location">Question {session.index + 1} of {items.length}</p>
              <p><strong>{complete}</strong> / {items.length} answered</p>
              <progress aria-label="Questions answered" max={items.length} value={complete} />
            </div>
            {seconds !== null && <p className="academy-timer" data-low={seconds > 0 && seconds <= 300}>
              <Clock3 size={17} aria-hidden="true" /> <span role="timer" aria-label="Time remaining">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>
            </p>}
          </div>
          <details ref={directory} className="academy-question-directory">
            <summary>Jump to a question <ChevronDown size={15} aria-hidden="true" /></summary>
            <div className="academy-question-grid">
              {items.map((entry, index) => {
                const answered = responseComplete(entry, displayedAnswers);
                return <button key={entry.id} type="button" data-answered={answered}
                  aria-label={`Question ${index + 1}, ${answered ? "answered" : "unanswered"}`}
                  aria-current={session.index === index ? "step" : undefined} disabled={busy || expired}
                  onClick={() => void go(index, true)}>{index + 1}{answered && <Check size={11} aria-hidden="true" />}</button>;
              })}
            </div>
          </details>
        </aside>
        <section ref={questionPanel} className="academy-panel academy-question" aria-labelledby="question-title">
          <p className="academy-kicker">Question {session.index + 1} of {items.length}</p>
          <p className="academy-scenario">{question.scenario}</p>
          {question.context && <details className="academy-case-context" key={question.scenario} open>
            <summary>Scenario</summary><p>{question.context}</p>
          </details>}
          <h2 id="question-title" ref={questionHeading} tabIndex={-1}>{question.prompt}</h2>
          <fieldset className="academy-fieldset" disabled={expired}>
            <legend>{required === 1 ? "Select one response" : "Select two responses"}</legend>
            {required > 1 && <p className="academy-selection-count" role="status">{selected.length} of {required} selected{selected.length === required && " · Deselect a response to change your selection"}</p>}
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
              <p ref={finishHeading} tabIndex={-1}>{items.length - complete} questions still need a complete response. Unanswered scored questions count as incorrect.</p>
              <button className="academy-button primary" disabled={busy} onClick={onSubmit}>Submit practice exam</button>
              <button className="academy-button text" onClick={() => {
                setConfirmSubmit(false);
                requestAnimationFrame(() => finishButton.current?.focus());
              }}>Keep working</button>
            </> : <button ref={finishButton} className="academy-button text" onClick={() => setConfirmSubmit(true)}>Finish practice exam</button>}
          </div>}
          {expired && <p role="status" className="academy-notice">Time is up. Submit to review the responses you saved.</p>}
          {error && <p className="academy-error" role="alert">{error}</p>}
        </section>
      </div>
    </main>
  );
}

function ReviewItem({ track, entry, index, answers, reference, report, lesson, onPractice }: {
  track: Pick<Track, "domains">; entry: PracticeItem; index: number; answers: string[];
  reference?: readonly [label: string, url: string];
  lesson?: string | null;
  report?: ReactNode;
  onPractice: () => void;
}) {
  const [label, url] = reference ?? sources[entry.source];
  const correct = isCorrect(entry, answers);
  return (
    <details className="academy-review-item">
      <summary><span>{index + 1}. {objectiveTitle(track, entry)}</span><span className={correct ? "academy-positive" : "academy-missed"}>{correct ? "Correct" : answers.length ? "Needs review" : "Unanswered"}</span><ChevronDown size={16} aria-hidden="true" /></summary>
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
        {lesson && <Link className="academy-button text" href={lesson}>{correct ? "Lesson for this objective" : "Study the lesson for this objective"} <ArrowRight size={15} aria-hidden="true" /></Link>}
        {!correct && <button type="button" className="academy-button text" onClick={onPractice}>
          Practice this skill <ArrowRight size={15} aria-hidden="true" />
        </button>}
        {report}
      </div>
    </details>
  );
}

const reviewFilters = [["all", "All questions"], ["incorrect", "Incorrect"], ["unanswered", "Unanswered"]] as const;
type ReviewFilter = typeof reviewFilters[number][0];

export function PracticeReview({ track, attempt, due, onBack, onDomain }: {
  track: Track;
  attempt: Attempt;
  due: number | null;
  onBack: () => void;
  onDomain: (domain: number, objective?: string) => void;
}) {
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const items = sessionItems(track, attempt);
  const scored = items.filter((entry) => !entry.pilot);
  const count = score(scored, attempt.answers);
  const blueprint = attempt.snapshot ?? rehearsalBlueprint(track, attempt.version);
  const isTimedEvidence = attempt.mode === "assessment" || attempt.mode === "reassessment";
  const references = new Map(attempt.snapshot?.items.map(({ id, reference }) => [id, reference]));
  const incorrect = scored.find((entry) => !isCorrect(entry, attempt.answers[entry.id] ?? []));
  const reviewed = items.map((entry, index) => {
    const answers = attempt.answers[entry.id] ?? [];
    return { entry, index, answers, status: isCorrect(entry, answers) ? "correct" : answers.length ? "incorrect" : "unanswered" };
  });
  const filtered = reviewed.filter(({ status }) => filter === "all" || filter === status);
  return (
    <main id="academy-main" tabIndex={-1} className="academy-width academy-workspace academy-review-workspace">
      <button className="academy-back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Back to pathway</button>
      <div className="academy-workspace-title">
        <p className="academy-kicker">{modeLabel(track, attempt)} · {dateFormat.format(attempt.submittedAt)}{isTimedEvidence &&
          ` · ${attempt.snapshot?.label ?? examGuideLabel(track, attempt.version)}`}</p>
        <h1>{attempt.mode === "assessment" ? "Practice exam results" : attempt.mode === "reassessment" ? "Domain retest results" : "Practice results"}</h1>
        <p className="academy-result-score"><strong>{count} / {scored.length}</strong> correct</p>
        {due && attempt.mode === "mixed" && <p>7-day review opens {dueLabel(due)}.</p>}
        {!attempt.snapshot && answeredBeforeRelease(attempt.submittedAt) && <p className="academy-notice" role="note">These questions were rewritten after you answered them, so the wording below may not match what you saw. This result stays in your history but no longer counts toward readiness.</p>}
      </div>
      {isTimedEvidence && <section className="academy-panel academy-assessment-domains" aria-label="Assessment results by domain">
        <h2>Results by domain</h2>
        <dl>{blueprint.domains.filter(({ id }) => attempt.mode !== "reassessment" || id === attempt.domain).map(({ id, title }) => {
          const group = scored.filter((item) => itemDomain(item) === id);
          const correct = score(group, attempt.answers);
          return <div key={id}><dt>{title}</dt><dd>{correct}/{group.length}</dd>{group.length > 0 && <progress aria-label={title} value={correct} max={group.length} />}</div>;
        })}</dl>
        <details className="academy-review-meta">
          <summary>How this result is counted</summary>
          <p>These are raw results for this form. Anthropic reports a scaled score on the official exam.</p>
          <p>{attempt.snapshot ? "Questions, choices, and review notes are saved as delivered." :
            "This earlier attempt saved your answers. Review shows the questions currently linked to the form."}</p>
          <p>{attempt.priorExposure === undefined ? "This saved attempt predates question exposure tracking."
            : attempt.priorExposure.length === 0 ? "Every question was fresh when you started."
              : `${attempt.priorExposure.length} of ${items.length} questions had been seen when you started.`}</p>
        </details>
      </section>}
      <section className="academy-panel academy-review" aria-labelledby="answer-review">
        <div className="academy-section-heading">
          <h2 id="answer-review">Answer review</h2>
          {incorrect && <button className="academy-button secondary" onClick={() => onDomain(itemDomain(incorrect))}>{attempt.version === decemberVersion ? "Review a missed domain" : "Practice a missed domain"} <ArrowRight size={16} aria-hidden="true" /></button>}
        </div>
        <fieldset className="academy-review-filters">
          <legend>Show questions</legend>
          {reviewFilters.map(([value, label]) => <label key={value}>
            <input type="radio" name="answer-review-filter" value={value} checked={filter === value} onChange={() => setFilter(value)} />
            {label} <span>{value === "all" ? reviewed.length : reviewed.filter(({ status }) => status === value).length}</span>
          </label>)}
        </fieldset>
        {filtered.length === 0 && <p role="status">There are no {filter === "incorrect" ? "incorrect" : "unanswered"} responses to review.</p>}
        {filtered.map(({ entry, index, answers }) => <ReviewItem key={entry.id} track={blueprint} entry={entry} index={index}
          answers={answers} reference={references.get(entry.id)}
          lesson={(() => { const objective = lessonObjectiveFor(track, attempt.version, entry.objective); return objective ? lessonHref(track, objective) : null; })()}
          onPractice={() => onDomain(itemDomain(entry), entry.objective)} report={
            <QuestionReport trackId={track.id} version={attempt.version ?? "july-2026"} itemId={entry.id}
              revision={attempt.snapshot?.id ?? evidenceFingerprint(entry)}
              form={attempt.mode === "reassessment" ? "reassessment" : attempt.form} />
          } />)}
      </section>
    </main>
  );
}
