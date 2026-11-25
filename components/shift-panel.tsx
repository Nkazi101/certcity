"use client";

import { ArrowRight, Check, PhoneCall, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { TrackId } from "../lib/claude/blueprints";
import { lessonHref, lessonObjectiveFor } from "../lib/claude/lessons/paths";
import {
  completedShifts, localDate, nextShiftNumber, planShift, proofFor, recordShift, shiftAvailableToday, streak,
} from "../lib/shifts/engine";
import type { Decision, ProofQuestion, ShiftContent, ShiftPlan, ShiftRecord, ShiftState, ShiftTicket } from "../lib/shifts/engine";
import type { ShiftId } from "../lib/shifts";
import { readShiftState, saveShiftState } from "../lib/shifts/storage";
import type { RoomReaction } from "../lib/scene/room-reactions";
import { QuestionReport } from "./academy/question-report";
import { CharacterPortrait } from "./character-portrait";
import styles from "./shift-panel.module.css";
import { Glossed, GlossaryScope, LessonPeekLink, TermLabel } from "./glossary/peek";
import { defineTerm } from "../lib/glossary";

export type Speaker = { name: string; role: string; portrait?: string };
export type DeskOutcome<I> = { correct: boolean; text: string; cost: number; counts?: Record<string, number>; follow?: I };

/** How one building's shift looks and judges its work; the panel runs the shared day around it. */
export type ShiftDesk<C extends string, I, R extends string> = {
  id: ShiftId;
  track: TrackId;
  content: ShiftContent<C, I>;
  building: string;
  routes: readonly { id: R; label: string; hint: string }[];
  routesLabel: string;
  itemsLabel: string;
  people: { brief: Speaker; summary: Speaker; why: (concept: C) => Speaker };
  itemKey: (item: I) => string;
  itemLabel: (item: I, ticket: ShiftTicket<C, I>) => string;
  renderItem: (item: I, ticket: ShiftTicket<C, I>) => ReactNode;
  /** Field names on the items that the glossary can define. */
  fieldTerms?: (items: readonly I[], ticket: ShiftTicket<C, I>) => string[];
  /** Shown under the person's line: order numbers, the papers on the desk… */
  renderTicket: (ticket: ShiftTicket<C, I>) => ReactNode;
  /** When set, items arrive after a button press (e.g. "Run the lookup"). */
  reveal?: { label: (ticket: ShiftTicket<C, I>) => string; busy: string };
  consequence: (item: I, route: R) => DeskOutcome<I>;
  /** Pair tickets: match each item to the request it answers. */
  pair?: {
    help: string;
    slots: (ticket: ShiftTicket<C, I>) => { id: string; title: string; detail: string }[];
    slotOf: (item: I) => string;
    outcome: (ticket: ShiftTicket<C, I>, wrong: I | undefined) => string;
  };
  reactions: { happy: readonly string[]; unhappy: readonly string[] };
  copy: {
    opening: (state: ShiftState<C>, number: number, introduces: readonly C[]) => string;
    done: string;
    howto: string;
    retrying?: string;
    person: string;
    meter: (minutes: number) => string;
    cost: (outcome: DeskOutcome<I>) => string;
    summary: (record: ShiftRecord<C>) => readonly (readonly [label: string, value: string])[];
    closing: (record: ShiftRecord<C>) => string;
    back: string;
  };
};

type Phase = "brief" | "work" | "proof" | "done";
type Shown<I> = DeskOutcome<I> & { ticketId: string; reaction: string };

export function ShiftPanel<C extends string, I, R extends string>({ desk, note, onClose, onScene, onProgress }: {
  desk: ShiftDesk<C, I, R>;
  /** An extra line in the brief (for example, about the learner's own saved work). */
  note?: string | null;
  onClose: () => void;
  /** Drives the room: the waiting line, the callback bench and each routing outcome. */
  onScene: (scene: RoomReaction | null) => void;
  /** Tickets left (null outside work) and callbacks owed, for buildings with other live props. */
  onProgress?: (ticketsLeft: number | null, callbacks: number) => void;
}) {
  const { content } = desk;
  const [state, setState] = useState<ShiftState<C> | null>(null);
  const [practice, setPractice] = useState(false);
  const [phase, setPhase] = useState<Phase>("brief");
  const [plan, setPlan] = useState<ShiftPlan<C, I> | null>(null);
  const [ticketIndex, setTicketIndex] = useState(0);
  const [queue, setQueue] = useState<I[]>([]);
  const [looking, setLooking] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [paired, setPaired] = useState<Record<string, string>>({});
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [outcome, setOutcome] = useState<Shown<I> | null>(null);
  const [why, setWhy] = useState(false);
  const [proof, setProof] = useState<ProofQuestion<C>[]>([]);
  const [proofIndex, setProofIndex] = useState(0);
  const [proofPick, setProofPick] = useState<string | null>(null);
  const [proofChecked, setProofChecked] = useState(false);
  const [proofResults, setProofResults] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<ShiftState<C> | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [serial, setSerial] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => setState(readShiftState<C>(desk.id)), [desk.id]);

  const ticket = plan?.tickets[ticketIndex] ?? null;
  const owed = (made: readonly Decision[]) => made.reduce((sum, { cost }) => sum + cost, 0);
  const callbackMinutes = owed(decisions);
  const wrongTickets = (upTo: number) => plan ? plan.tickets.slice(0, upTo).filter(({ id }) => decisions.some((decision) => decision.ticketId === id && !decision.correct)).length : 0;

  // Customers resolved so far: the one at the desk leaves as soon as their routing is final.
  const resolved = !plan ? 0 : phase === "work" ? ticketIndex + (outcome && !outcome.follow ? 1 : 0) : phase === "brief" ? 0 : plan.tickets.length;
  const lastResolved = plan && resolved > 0 ? plan.tickets[resolved - 1] : null;
  const owedTickets = wrongTickets(resolved);
  const lastCorrect = lastResolved ? decisions.filter(({ ticketId }) => ticketId === lastResolved.id).every(({ correct }) => correct) : true;
  const previewSize = state ? content.size(nextShiftNumber(state)) : 5;

  useEffect(() => {
    if (!onProgress) return;
    if (!plan || phase === "brief") return onProgress(null, 0);
    onProgress(phase === "work" ? plan.tickets.length - ticketIndex : 0, wrongTickets(plan.tickets.length));
  }, [plan, phase, ticketIndex, decisions, onProgress]);
  useEffect(() => () => onProgress?.(null, 0), [onProgress]);

  useEffect(() => {
    if (!state) return;
    const waiting = phase === "brief" ? (shiftAvailableToday(state) ? previewSize : 0) : plan ? Math.max(0, plan.tickets.length - resolved) : 0;
    onScene({ waiting, callbacks: owedTickets, event: lastResolved ? { token: serial * 100 + resolved, correct: lastCorrect } : null, frame: true });
  }, [state, phase, plan, resolved, owedTickets, lastResolved, lastCorrect, serial, previewSize, onScene]);
  useEffect(() => () => onScene(null), [onScene]);

  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [phase, ticketIndex]);

  const shiftNumber = state ? nextShiftNumber(state) : 1;
  const available = state ? shiftAvailableToday(state) : true;
  const opening = useMemo(() => {
    if (!state) return "";
    return desk.copy.opening(state, shiftNumber, planShift(content, state, shiftNumber).introduces);
  }, [state, shiftNumber, desk, content]);

  function start(asPractice: boolean) {
    if (!state) return;
    const number = asPractice ? Math.max(content.unlockOrder.length, shiftNumber) : shiftNumber;
    setPractice(asPractice);
    setSerial((value) => value + 1);
    const next = planShift(content, state, number, asPractice ? Date.now() % 100_000 : number);
    setPlan(next);
    setTicketIndex(0);
    arrive(next.tickets[0]);
    setDecisions([]);
    setOutcome(null);
    setPaired({});
    setPhase("work");
  }

  /** Without a reveal step, the ticket's items are on the counter as soon as the person steps up. */
  function arrive(next: ShiftTicket<C, I> | undefined) {
    if (!next || desk.reveal) {
      setQueue([]);
      return;
    }
    setQueue([...next.items]);
    setSelected(next.kind === "pair" ? null : desk.itemKey(next.items[0]));
  }

  function reveal() {
    if (!ticket) return;
    setLooking(true);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => {
      // Parallel results come back in reverse order, so arrival order is a trap.
      setQueue(ticket.kind === "pair" ? [...ticket.items].reverse() : [...ticket.items]);
      setSelected(ticket.kind === "pair" ? null : desk.itemKey(ticket.items[0]));
      setLooking(false);
    }, reduce ? 0 : 650);
  }

  function route(choice: R) {
    if (!ticket || outcome || ticket.kind === "pair") return;
    const item = queue[0];
    if (!item) return;
    const result = desk.consequence(item, choice);
    const decision: Decision = { ticketId: ticket.id, correct: result.correct, cost: result.cost, counts: result.counts };
    setDecisions((current) => [...current, decision]);
    const reaction = pick(result.correct ? desk.reactions.happy : desk.reactions.unhappy, decisions.length);
    if (result.follow) {
      setOutcome({ ...result, ticketId: ticket.id, reaction: "" });
      window.setTimeout(() => {
        setQueue([result.follow!]);
        setSelected(desk.itemKey(result.follow!));
        setOutcome(null);
      }, 700);
      return;
    }
    setQueue([]);
    setOutcome({ ...result, ticketId: ticket.id, reaction });
    setWhy(false);
  }

  function pairTo(slotId: string) {
    const pair = desk.pair;
    if (!pair || !ticket || ticket.kind !== "pair" || !selected || outcome) return;
    const item = queue.find((entry) => desk.itemKey(entry) === selected);
    if (!item) return;
    const next = { ...paired, [selected]: slotId };
    setPaired(next);
    setSelected(queue.map(desk.itemKey).find((key) => !next[key]) ?? null);
    if (Object.keys(next).length < queue.length) return;
    const wrong = queue.find((entry) => next[desk.itemKey(entry)] !== pair.slotOf(entry));
    const pairDecisions = queue.map((entry): Decision => {
      const correct = next[desk.itemKey(entry)] === pair.slotOf(entry);
      return { ticketId: ticket.id, correct, cost: correct ? 0 : 3 };
    });
    setDecisions((current) => [...current, ...pairDecisions]);
    setOutcome({
      ticketId: ticket.id, correct: !wrong, cost: owed(pairDecisions), text: pair.outcome(ticket, wrong),
      reaction: pick(!wrong ? desk.reactions.happy : desk.reactions.unhappy, decisions.length),
    });
    setWhy(false);
  }

  function nextTicket() {
    if (!plan) return;
    setOutcome(null);
    setPaired({});
    if (ticketIndex + 1 < plan.tickets.length) {
      setTicketIndex(ticketIndex + 1);
      arrive(plan.tickets[ticketIndex + 1]);
      return;
    }
    setQueue([]);
    const missed = [...new Set(plan.tickets.filter((entry) => decisions.some((decision) => decision.ticketId === entry.id && !decision.correct)).map(({ concept }) => concept))];
    setProof(proofFor(content, state!, plan, missed));
    setProofIndex(0);
    setProofPick(null);
    setProofChecked(false);
    setProofResults({});
    setPhase("proof");
  }

  // Auto-advance after a correct routing so the shift keeps its rhythm; misses wait for the learner.
  useEffect(() => {
    if (!outcome?.correct || outcome.follow || phase !== "work") return;
    const timer = window.setTimeout(nextTicket, 1500);
    return () => window.clearTimeout(timer);
  });

  function checkProof() {
    const question = proof[proofIndex];
    if (!question || !proofPick) return;
    setProofResults((current) => ({ ...current, [question.id]: proofPick === question.correct }));
    setProofChecked(true);
  }

  function nextProof() {
    if (proofIndex + 1 < proof.length) {
      setProofIndex(proofIndex + 1);
      setProofPick(null);
      setProofChecked(false);
      return;
    }
    // Re-read before saving so a shift finished on another device (or tab) today isn't counted twice.
    const latest = readShiftState<C>(desk.id);
    const counted = !practice && shiftAvailableToday(latest);
    const next = recordShift(latest, plan!, decisions, proofResults, localDate(), !counted);
    saveShiftState(desk.id, next);
    if (!counted) setPractice(true);
    setSaved(next);
    setState(next);
    setPhase("done");
  }

  // Pointer drag: pick up an item and drop it on a target (tapping a target works too).
  function startDrag(event: ReactPointerEvent<HTMLElement>, id: string) {
    if (outcome || event.button > 0) return;
    setSelected(id);
    setDrag({ id, x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event: ReactPointerEvent<HTMLElement>) {
    if (drag) setDrag({ ...drag, x: event.clientX, y: event.clientY });
  }
  function endDrag(event: ReactPointerEvent<HTMLElement>) {
    if (!drag) return;
    const target = document.elementsFromPoint(event.clientX, event.clientY).map((element) => element.closest<HTMLElement>("[data-route],[data-slot]")).find(Boolean);
    setDrag(null);
    if (target?.dataset.route) route(target.dataset.route as R);
    else if (target?.dataset.slot) pairTo(target.dataset.slot);
  }

  if (!state) return null;
  const missedToday = outcome && !outcome.correct ? plan?.tickets.find(({ id }) => id === outcome.ticketId)?.concept : undefined;
  const whyNote = missedToday ? content.conceptNotes[missedToday] : null;
  const whySpeaker = missedToday ? desk.people.why(missedToday) : null;
  const lessonObjective = whyNote ? lessonObjectiveFor({ id: desk.track }, undefined, whyNote.objective) : null;
  const titleId = `shift-title-${desk.id}`;
  const terms = ticket && queue.length && desk.fieldTerms ? [...new Set(desk.fieldTerms(queue, ticket))].filter((field) => defineTerm(field)) : [];

  return (
    <GlossaryScope track={desk.track}><aside className={styles.shift} aria-labelledby={titleId} data-phase={phase} data-shift-panel={desk.id}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>{desk.building} · {practice ? "Practice shift" : `Shift ${plan?.number ?? shiftNumber}`}</p>
          <h2 id={titleId} ref={heading} tabIndex={-1}>
            {phase === "brief" ? "Today's shift" : phase === "work" ? `${desk.copy.person} ${ticketIndex + 1} of ${plan?.tickets.length}` : phase === "proof" ? "Prove it" : "Shift done"}
          </h2>
        </div>
        {phase === "work" && <p className={styles.meter} aria-live="polite"><PhoneCall size={15} aria-hidden="true" /> {desk.copy.meter(callbackMinutes)}</p>}
        <button className={styles.close} type="button" onClick={onClose} aria-label="Close the shift"><X size={18} aria-hidden="true" /></button>
      </header>

      {phase === "brief" && <div className={styles.body}>
        <SpeakerLine speaker={desk.people.brief} text={available ? opening : desk.copy.done} />
        {available && note && <p className={styles.note}>{note}</p>}
        {state.shifts.length > 0 && <p className={styles.streak}>{streak(state)} {streak(state) === 1 ? "day" : "days"} in a row · {completedShifts(state).length} {completedShifts(state).length === 1 ? "shift" : "shifts"} worked</p>}
        <div className={styles.actions}>
          {available
            ? <button className="button button-primary" type="button" onClick={() => start(false)}>Start shift {shiftNumber} <ArrowRight size={16} aria-hidden="true" /></button>
            : <button className="button button-primary" type="button" onClick={() => start(true)}><RotateCcw size={16} aria-hidden="true" /> Practice shift (doesn't count)</button>}
          <p className={styles.howto}>{desk.copy.howto}</p>
        </div>
      </div>}

      {phase === "work" && ticket && <div className={styles.body}>
        <div className={styles.customer}>
          <div className={styles.customerHead}>
            <strong>{ticket.customer}</strong>
            {ticket.returning && <span className={styles.returning}>Back from yesterday</span>}
          </div>
          <p><Glossed text={ticket.line} /></p>
          {desk.renderTicket(ticket)}
          {desk.reveal && !queue.length && !outcome && <button className="button button-primary" type="button" onClick={reveal} disabled={looking}>
            {looking ? desk.reveal.busy : desk.reveal.label(ticket)}
          </button>}
        </div>

        {queue.length > 0 && <div className={styles.parcels} aria-label={desk.itemsLabel}>
          {queue.map((item) => {
            const key = desk.itemKey(item);
            const placed = paired[key];
            return <button key={key} type="button" className={styles.parcel} aria-pressed={selected === key}
              data-dragging={drag?.id === key || undefined} disabled={!!placed || !!outcome}
              style={drag?.id === key ? { position: "fixed", left: drag.x - 110, top: drag.y - 30, zIndex: 20, pointerEvents: "none", width: 220 } : undefined}
              onClick={() => setSelected(key)} onPointerDown={(event) => startDrag(event, key)} onPointerMove={moveDrag} onPointerUp={endDrag}
              aria-label={desk.itemLabel(item, ticket)}>
              {desk.renderItem(item, ticket)}
              {placed && <span className={styles.placed}>→ {placed}</span>}
            </button>;
          })}
        </div>}
        {terms.length > 0 && <p className={styles.fieldGuide}>
          <span>What the fields mean:</span>
          {terms.map((field) => <span key={field}><TermLabel text={field} /></span>)}
        </p>}

        {queue.length > 0 && ticket.kind === "single" && !outcome && <div className={styles.chutes} role="group" aria-label={desk.routesLabel}>
          {desk.routes.map(({ id, label, hint }) => <button key={id} type="button" className={styles.chute} data-route={id} onClick={() => route(id)}>
            <strong>{label}</strong><small>{hint}</small>
          </button>)}
        </div>}

        {queue.length > 0 && ticket.kind === "pair" && desk.pair && !outcome && <div className={styles.slots} role="group" aria-label="Match each result to the request it answers">
          <p className={styles.howto}>{desk.pair.help}</p>
          {desk.pair.slots(ticket).map(({ id, title, detail }) => <button key={id} type="button" className={styles.slot} data-slot={id} disabled={!selected || Object.values(paired).includes(id)} onClick={() => pairTo(id)}>
            <strong>{title}</strong><small>{detail}</small>
          </button>)}
        </div>}

        {outcome && !outcome.follow && <div className={styles.outcome} data-correct={outcome.correct} role="status">
          <p className={styles.outcomeHead}>{outcome.correct ? <Check size={18} aria-hidden="true" /> : <PhoneCall size={18} aria-hidden="true" />}<span><Glossed text={outcome.text} /></span></p>
          {outcome.reaction && <p className={styles.reaction}>{ticket.customer}: {outcome.reaction}</p>}
          {!outcome.correct && <p className={styles.cost}>{desk.copy.cost(outcome)}</p>}
          {!outcome.correct && whyNote && whySpeaker && (why
            ? <div className={styles.why}>
                <Portrait speaker={whySpeaker} small />
                <div><strong>{whySpeaker.name.split(" ")[0]}: {whyNote.title}</strong><p><Glossed text={whyNote.note} /></p>
                  <p className={styles.term}>On the exam: {whyNote.examTerm}{lessonObjective && <> · <LessonPeekLink track={desk.track} objective={lessonObjective} href={lessonHref({ id: desk.track }, lessonObjective)}>lesson {lessonObjective}</LessonPeekLink></>}</p></div>
              </div>
            : <button className="button button-text" type="button" onClick={() => setWhy(true)}>Ask {whySpeaker.name.split(" ")[0]} why</button>)}
          <button className="button button-primary" type="button" onClick={nextTicket}>{ticketIndex + 1 < (plan?.tickets.length ?? 0) ? `Next ${desk.copy.person.toLowerCase()}` : "Finish the shift"} <ArrowRight size={16} aria-hidden="true" /></button>
        </div>}
        {outcome?.follow && <p className={styles.retrying} role="status">{desk.copy.retrying}</p>}
      </div>}

      {phase === "proof" && proof[proofIndex] && <div className={styles.body}>
        <p className={styles.howto}>Two exam-style questions on today's work. Question {proofIndex + 1} of {proof.length}.</p>
        <fieldset className={styles.question}>
          <legend>{renderCode(proof[proofIndex].prompt)}</legend>
          {proof[proofIndex].options.map(([key, text, rationale]) => {
            const isKey = key === proof[proofIndex].correct;
            return <label key={key} className={styles.option} data-state={proofChecked ? isKey ? "key" : proofPick === key ? "wrong" : undefined : undefined}>
              <input type="radio" name={`proof-${desk.id}`} value={key} checked={proofPick === key} disabled={proofChecked} onChange={() => setProofPick(key)} />
              <span>{renderCode(text)}{proofChecked && <small>{rationale}</small>}</span>
            </label>;
          })}
        </fieldset>
        {proofChecked && <p className={styles.explain}>{renderCode(proof[proofIndex].explanation)}</p>}
        {proofChecked && <QuestionReport trackId={desk.track} version="july-2026" itemId={`shift.${desk.id}.${proof[proofIndex].id}`} />}
        <div className={styles.actions}>
          {proofChecked
            ? <button className="button button-primary" type="button" onClick={nextProof}>{proofIndex + 1 < proof.length ? "Next question" : "See today's results"} <ArrowRight size={16} aria-hidden="true" /></button>
            : <button className="button button-primary" type="button" disabled={!proofPick} onClick={checkProof}>Check</button>}
        </div>
      </div>}

      {phase === "done" && saved && plan && <Summary desk={desk} state={saved} practice={practice} onClose={onClose} />}
    </aside></GlossaryScope>
  );
}

function Summary<C extends string, I, R extends string>({ desk, state, practice, onClose }: { desk: ShiftDesk<C, I, R>; state: ShiftState<C>; practice: boolean; onClose: () => void }) {
  const record = state.shifts.at(-1)!;
  const proofRight = Object.values(record.proof).filter(Boolean).length;
  const returning = record.missed.map((concept) => desk.content.conceptNotes[concept].title.toLowerCase());
  return <div className={styles.body}>
    <dl className={styles.summary}>
      {desk.copy.summary(record).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      <div><dt>Exam-style questions</dt><dd>{proofRight}/{Object.keys(record.proof).length}</dd></div>
    </dl>
    <SpeakerLine speaker={desk.people.summary} text={desk.copy.closing(record)} />
    <p className={styles.tomorrow}>{practice ? "Practice shifts don't change tomorrow's line."
      : returning.length ? `Tomorrow, people come back for ${listOf(returning)}.` : "Tomorrow brings new people. Skills you've shown stay on a slower review schedule."}</p>
    <div className={styles.actions}>
      <button className="button button-primary" type="button" onClick={onClose}>{desk.copy.back}</button>
    </div>
  </div>;
}

function SpeakerLine({ speaker, text }: { speaker: Speaker; text: string }) {
  return <div className={styles.speaker}>
    <Portrait speaker={speaker} />
    <div><strong>{speaker.name}</strong><small>{speaker.role}</small><p>{text}</p></div>
  </div>;
}

function Portrait({ speaker, small = false }: { speaker: Speaker; small?: boolean }) {
  const className = small ? styles.portraitSmall : styles.portrait;
  if (speaker.portrait) return <CharacterPortrait id={speaker.portrait} className={className} width={small ? 64 : 120} height={small ? 74 : 138} />;
  const initials = speaker.name.split(" ").map((part) => part[0]).join("").slice(0, 2);
  return <span className={`${className} ${styles.initials}`} aria-hidden="true">{initials}</span>;
}

function listOf(items: string[]) {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function pick<T>(items: readonly T[], index: number) {
  return items[index % items.length];
}

export function renderCode(text: string) {
  return text.split(/(`[^`]+`)/g).map((part, index) => part.startsWith("`") ? <code key={index}>{part.slice(1, -1)}</code> : part);
}
