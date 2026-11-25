"use client";

import { BookOpen } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { TrackId } from "../../lib/claude/blueprints";
import { lessonHref } from "../../lib/claude/lessons/paths";
import { lessonPreviews, termLessons } from "../../lib/glossary/claude-lessons";
import { defineTerm, glossText } from "../../lib/glossary";
import type { FoundTerm } from "../../lib/glossary";
import styles from "./peek.module.css";

/**
 * Definitions where the work happens. Hover (mouse), focus (keyboard) or tap (touch) a dotted term to see what it means
 * without leaving the case. The card stays while the pointer moves onto it, closes with Escape or a tap elsewhere, and
 * links the lesson for the learner's track when there is one (WCAG 1.4.13: dismissible, hoverable, persistent).
 */

type GlossaryScope = { track?: TrackId; provider: string; current?: string };
const GlossaryContext = createContext<GlossaryScope>({ provider: "anthropic" });

/** `current` is the lesson being read, if any, so definitions there don't link back to the same page. */
export function GlossaryScope({ track, provider = "anthropic", current, children }: { track?: TrackId; provider?: string; current?: string; children: ReactNode }) {
  const value = useMemo(() => ({ track, provider, current }), [track, provider, current]);
  return <GlossaryContext.Provider value={value}>{children}</GlossaryContext.Provider>;
}

const supportsPopover = () => typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype;

function usePeek() {
  const trigger = useRef<HTMLElement | null>(null);
  const card = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const pinned = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const place = useCallback(() => {
    const anchor = trigger.current?.getBoundingClientRect();
    const element = card.current;
    if (!anchor || !element) return;
    const width = Math.min(320, window.innerWidth - 16);
    element.style.width = `${width}px`;
    const left = Math.min(Math.max(8, anchor.left + anchor.width / 2 - width / 2), window.innerWidth - width - 8);
    const height = element.offsetHeight;
    const below = window.innerHeight - anchor.bottom;
    const top = below >= height + 12 || anchor.top < height + 12 ? anchor.bottom + 6 : anchor.top - height - 6;
    element.style.left = `${left}px`;
    element.style.top = `${Math.max(8, top)}px`;
  }, []);

  const show = useCallback(() => {
    window.clearTimeout(timer.current);
    const element = card.current;
    if (!element) return;
    if (supportsPopover()) {
      if (!element.matches(":popover-open")) element.showPopover();
    } else element.dataset.open = "";
    place();
    setOpen(true);
  }, [place]);

  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    pinned.current = false;
    const element = card.current;
    if (element) {
      if (supportsPopover()) {
        if (element.matches(":popover-open")) element.hidePopover();
      } else delete element.dataset.open;
    }
    setOpen(false);
  }, []);

  const later = useCallback((action: () => void, ms: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(action, ms);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      event.preventDefault();
      hide();
      trigger.current?.focus();
    };
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !card.current?.contains(target)) hide();
    };
    const onMove = () => place();
    // Capture so Escape closes the card before a surrounding dialog sees it.
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, hide, place]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const triggerProps = {
    onPointerEnter: (event: React.PointerEvent) => { if (event.pointerType === "mouse") later(show, 120); },
    onPointerLeave: (event: React.PointerEvent) => { if (event.pointerType === "mouse" && !pinned.current) later(hide, 160); },
    onFocus: () => show(),
    onBlur: (event: React.FocusEvent) => {
      if (!pinned.current && !card.current?.contains(event.relatedTarget as Node | null)) later(hide, 80);
    },
  };
  const cardProps = {
    onPointerEnter: () => window.clearTimeout(timer.current),
    onPointerLeave: (event: React.PointerEvent) => { if (event.pointerType === "mouse" && !pinned.current) later(hide, 160); },
    onBlur: (event: React.FocusEvent) => {
      if (!pinned.current && !trigger.current?.contains(event.relatedTarget as Node | null)
        && !card.current?.contains(event.relatedTarget as Node | null)) later(hide, 80);
    },
  };
  return { trigger, card, open, show, hide, pinned, triggerProps, cardProps };
}

function LessonLine({ id }: { id: string }) {
  const { track, current } = useContext(GlossaryContext);
  const objective = track ? termLessons[id]?.[track] : undefined;
  if (!track || !objective || objective === current) return null;
  const preview = lessonPreviews[track]?.[objective];
  return <a className={styles.lesson} href={lessonHref({ id: track }, objective)} target="_blank" rel="noreferrer">
    <BookOpen size={13} aria-hidden="true" />Lesson {objective}{preview ? ` · ${preview[0]}` : ""}
  </a>;
}

/** One defined term: a quiet dotted underline that opens a short definition card. */
export function Term({ found, children }: { found: FoundTerm; children?: ReactNode }) {
  const id = useId();
  const peek = usePeek();
  return <>
    <button ref={(element) => { peek.trigger.current = element; }} type="button" className={styles.term}
      aria-expanded={peek.open} aria-controls={id} {...peek.triggerProps}
      onClick={() => {
        if (peek.open && peek.pinned.current) peek.hide();
        else { peek.pinned.current = true; peek.show(); }
      }}>
      {children ?? found.text}
    </button>
    <span ref={(element) => { peek.card.current = element; }} id={id} role="note" className={styles.card}
      popover="manual" {...peek.cardProps}>
      {found.note && <span className={styles.kicker}>{found.note}</span>}
      <strong className={styles.title}>{found.term}</strong>
      <span className={styles.plain}>{found.plain}</span>
      {found.example && <span className={styles.example}>{found.example}</span>}
      <LessonLine id={found.id} />
    </span>
  </>;
}

/**
 * Plain text with its defined terms marked. Each term is marked on its first appearance in the block. Use only where
 * the text is not already inside a button or link (a button can't sit inside another).
 */
export function Glossed({ text, track }: { text: string | undefined | null; track?: TrackId }) {
  const scope = useContext(GlossaryContext);
  const segments = useMemo(() => text ? glossText(text, scope.provider) : [], [text, scope.provider]);
  if (!text) return null;
  const marked = <>{segments.map((segment, index) => typeof segment === "string" ? segment
    : <Term key={index} found={segment} />)}</>;
  // A one-off track lets a single block link lessons without wrapping its whole screen in a scope.
  return track && track !== scope.track ? <GlossaryScope track={track} provider={scope.provider}>{marked}</GlossaryScope> : marked;
}

/** A single term labelled on purpose, such as a field name on a parcel; plain text when the glossary doesn't know it. */
export function TermLabel({ text }: { text: string }) {
  const { provider } = useContext(GlossaryContext);
  const found = useMemo(() => defineTerm(text, provider), [text, provider]);
  return found ? <Term found={found} /> : <>{text}</>;
}

/**
 * A link to a lesson that previews the lesson's key rule on hover or focus, so a learner can often get what they need
 * at a glance and stay in the case. Clicking opens the full lesson in a new tab.
 */
export function LessonPeekLink({ track, objective, href, className, children }: {
  track: TrackId; objective: string; href: string; className?: string; children: ReactNode;
}) {
  const id = useId();
  const peek = usePeek();
  const touch = useRef(false);
  const preview = lessonPreviews[track]?.[objective];
  if (!preview) return <a className={className} href={href} target="_blank" rel="noreferrer">{children}</a>;
  return <>
    <a ref={(element) => { peek.trigger.current = element; }} className={className} href={href} target="_blank" rel="noreferrer"
      aria-describedby={peek.open ? id : undefined} {...peek.triggerProps}
      onPointerDown={(event) => { touch.current = event.pointerType !== "mouse"; }}
      onClick={(event) => {
        // Touch has no hover: the first tap shows the key rule (often enough), the card's link opens the lesson.
        if (touch.current && !peek.open) { event.preventDefault(); peek.pinned.current = true; peek.show(); }
      }}>{children}</a>
    <span ref={(element) => { peek.card.current = element; }} id={id} role="tooltip" className={styles.card}
      popover="manual" {...peek.cardProps}>
      <span className={styles.kicker}>Lesson {objective} · key rule</span>
      <strong className={styles.title}>{preview[0]}</strong>
      <span className={styles.plain}>{preview[1].replace(/`([^`]+)`/g, "$1")}</span>
      <a className={styles.lesson} href={href} target="_blank" rel="noreferrer">Open the lesson</a>
    </span>
  </>;
}
