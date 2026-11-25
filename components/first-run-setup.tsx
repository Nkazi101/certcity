"use client";

import { ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Track } from "../lib/claude/blueprints";
import { decemberBlueprint, examGuideLabel } from "../lib/claude/december-blueprints";
import type { ExamVersion } from "../lib/claude/december-blueprints";
import { lessonHref, lessonObjectives } from "../lib/claude/lessons/paths";
import { emptyReadiness, readReadiness, rehearsalTarget, updateReadiness } from "../lib/claude/readiness";
import { cramWindowDays, daysUntilExam, guideForExamDate, inCramWindow, readExamDate, saveExamDate } from "../lib/exam-date";

// Shown once, after a learner picks their first exam. Stored per device; returning learners skip it.
const setupKey = "certcity.first-run.v1";

export function firstRunDone() {
  try {
    return window.localStorage.getItem(setupKey) === "done";
  } catch {
    return false;
  }
}

export function markFirstRunDone() {
  try {
    window.localStorage.setItem(setupKey, "done");
  } catch {
    // Without storage the sheet may show again next visit. Nothing else depends on it.
  }
}

export function FirstRunSetup({ track, caseTitle, onGuide, onFirstCase, onClose }: {
  track: Track;
  caseTitle?: string;
  onGuide: (version: ExamVersion) => void;
  onFirstCase: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [date, setDate] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const lesson = lessonObjectives(track)[0];
  const revised = !!decemberBlueprint(track);

  useEffect(() => {
    setDate(readExamDate(track.id));
    setNow(Date.now());
    if (!dialog.current?.open) dialog.current?.showModal();
  }, [track.id]);

  function chooseDate(value: string | null) {
    setDate(value);
    setNow(Date.now());
    saveExamDate(track.id, value);
    if (value && revised) {
      const version = guideForExamDate(value);
      onGuide(version);
      void updateReadiness(track, readReadiness(track) ?? emptyReadiness, { type: "version", version }).catch(() => undefined);
    }
  }

  const days = date && now ? daysUntilExam(date, now) : null;
  const guide = date && revised ? guideForExamDate(date) : undefined;
  const cram = !!date && !!now && inCramWindow(date, now);

  return (
    <dialog ref={dialog} className="game-dialog first-run-setup" aria-labelledby="first-run-title" onClose={() => {
      markFirstRunDone();
      onClose();
    }}>
      <header className="dialog-header">
        <h2 id="first-run-title">{track.code}: before you start</h2>
        <button className="icon-button" type="button" aria-label="Skip setup" onClick={() => dialog.current?.close()}><X size={20} aria-hidden="true" /></button>
      </header>
      <div className="dialog-body first-run-body">
        <label className="first-run-date">
          <span>When is your exam? <small>Optional</small></span>
          <input type="date" value={date ?? ""} onChange={(event) => chooseDate(event.target.value || null)} />
        </label>
        {days !== null && (days < 0
          ? <p role="status">That date has passed. Pick your next attempt, or leave it blank.</p>
          : <div role="status" className="first-run-plan">
            <p>{days === 0 ? "Your exam is today." : `Your exam is ${days} ${days === 1 ? "day" : "days"} away.`} Guide for that date: {examGuideLabel(track, guide)}.</p>
            {cram && <p>That’s under {cramWindowDays} days, so the short-runway plan applies: score {rehearsalTarget.overall}% overall (and {rehearsalTarget.domain}% in each domain) on two practice exams you haven’t seen, and pass the hands-on lab.</p>}
          </div>)}
        {/* The mission comes first: its hints open the lesson for each skill when it's needed. Reading ahead stays an option. */}
        <div className="first-run-choices">
          <button className="button button-primary" type="button" onClick={() => {
            markFirstRunDone();
            dialog.current?.close();
            onFirstCase();
          }}>
            <span>Start my first mission{caseTitle && <small>{caseTitle}</small>}</span><ArrowRight size={16} aria-hidden="true" />
          </button>
          <Link className="button button-outline" href={lessonHref(track, lesson.id)} onClick={markFirstRunDone}>
            <span>Read lesson 1 instead<small>{lesson.id} {lesson.title}</small></span>
          </Link>
        </div>
        <button className="button button-text first-run-skip" type="button" onClick={() => dialog.current?.close()}>Skip for now</button>
      </div>
    </dialog>
  );
}
