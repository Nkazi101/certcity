"use client";

import { ArrowRight, Check, ChevronDown, ChevronUp, Flame } from "lucide-react";
import { useEffect, useId, useState } from "react";
import type { TodayItem } from "../../lib/today/plan";
import type { TodayView } from "./use-today";
import styles from "./today.module.css";

const kindLabel: Record<TodayItem["kind"], string> = {
  date: "Plan", followup: "7-day check", shift: "Daily shift", case: "Mission", wrapup: "Mission", redo: "Mission",
  exam: "Practice exam", lab: "Lab", transfer: "Lab", review: "Review",
};

function minutes(value: number) {
  return value >= 60 ? `${Math.floor(value / 60)} h${value % 60 ? ` ${value % 60} min` : ""}` : `${value} min`;
}

function Row({ item, done, onAction }: { item: TodayItem; done?: boolean; onAction: (item: TodayItem) => void }) {
  return <li className={styles.row} data-done={done || undefined}>
    <button type="button" onClick={() => onAction(item)} aria-label={`${done ? "Done: " : ""}${item.label}. ${kindLabel[item.kind]}, about ${minutes(item.minutes)}.`}>
      <span className={styles.check} aria-hidden="true">{done ? <Check size={14} /> : null}</span>
      <span className={styles.copy}>
        <small>{kindLabel[item.kind]} · {minutes(item.minutes)}</small>
        <strong>{item.label}</strong>
        <span className={styles.detail}>{item.detail}</span>
      </span>
      {!done && <ArrowRight size={16} aria-hidden="true" />}
    </button>
  </li>;
}

/**
 * Today's work: a short list fixed for the day, built from cases, with review riding along. `compact` is the city's
 * corner card (first open item, expands to the list); the dashboard shows it open.
 */
export function TodayWork({ view, onAction, compact = false, heading = "Today’s work" }: {
  view: TodayView;
  onAction: (item: TodayItem) => void;
  compact?: boolean;
  heading?: string;
}) {
  const [open, setOpen] = useState(!compact);
  const id = useId();
  // Phones: closed, the card is a one-line pill in the free bottom-left corner; open, a bottom sheet over the controls.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 700px)");
    const apply = () => setNarrow(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);
  const next = view.items.find(({ done }) => !done);
  const allDone = !next;
  const pace = view.daysLeft === null ? "No exam date: a steady pace" : view.daysLeft < 0 ? "Your exam date has passed" : `Exam in ${view.daysLeft} ${view.daysLeft === 1 ? "day" : "days"}`;

  if (compact && narrow && !open) {
    return <section className={`${styles.today} ${styles.pill}`} data-compact aria-labelledby={id}>
      <button type="button" className={styles.pillButton} aria-expanded={false} aria-controls={`${id}-list`} onClick={() => setOpen(true)}>
        <span className={styles.pillMeta}><span id={id}>{heading}</span> · {view.doneCount}/{view.items.length}{view.streak > 0 && <> · <Flame size={12} aria-hidden="true" />{view.streak}</>}</span>
        <strong>{next ? next.label : "All done for today"}</strong>
        <ChevronUp size={18} aria-hidden="true" />
      </button>
    </section>;
  }

  return <section className={styles.today} data-compact={compact || undefined} data-open={open || undefined} data-sheet={(compact && narrow) || undefined} aria-labelledby={id}>
    <header className={styles.header}>
      <div>
        <h2 id={id}>{heading}</h2>
        <p className={styles.meta}>
          <span>{view.doneCount} of {view.items.length} done</span>
          {!allDone && <span>about {minutes(view.minutesLeft)} left</span>}
          {view.streak > 0 && <span className={styles.streak}><Flame size={13} aria-hidden="true" />{view.streak} {view.streak === 1 ? "day" : "days"} in a row</span>}
        </p>
      </div>
      {compact && <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={`${id}-list`} onClick={() => setOpen(!open)}>
        <ChevronDown size={18} aria-hidden="true" /><span className={styles.srOnly}>{open ? "Hide" : "Show"} today’s list</span>
      </button>}
    </header>

    {compact && !open && next && <ul className={styles.list}><Row item={next} onAction={onAction} /></ul>}
    {compact && !open && allDone && <p className={styles.doneNote}>All done for today. {view.more.length > 0 && "Open the list to keep going."}</p>}

    {open && <div id={`${id}-list`}>
      <p className={styles.pace}>{pace} · about {minutes(view.budget)} a day</p>
      <ul className={styles.list}>{view.items.map((item) => <Row key={item.key} item={item} done={item.done} onAction={onAction} />)}</ul>
      {allDone && <p className={styles.doneNote}>That’s today’s work done. Come back tomorrow for the next mission and your reviews{view.more.length > 0 ? ", or keep going now." : "."}</p>}
      {view.more.length > 0 && <details className={styles.more} open={allDone || undefined}>
        <summary>Keep going</summary>
        <ul className={styles.list}>{view.more.map((item) => <Row key={item.key} item={item} onAction={onAction} />)}</ul>
      </details>}
    </div>}
  </section>;
}
