"use client";

import { useEffect, useRef, useState } from "react";
import type { Track } from "../../lib/claude/blueprints";
import { decemberBlueprint } from "../../lib/claude/december-blueprints";
import { emptyReadiness, readReadiness, updateReadiness } from "../../lib/claude/readiness";
import { daysUntilExam, guideForExamDate, readExamDate, saveExamDate } from "../../lib/exam-date";

/**
 * Asked inside the story, after the first case, rather than on a setup form before anything has happened. A learner who
 * starts by helping someone still gets a paced plan; one who's only learning can say so and never be asked again.
 */
export function ExamDatePrompt({ track, person, onClose, onDismiss }: {
  track: Track;
  person?: string;
  onClose: () => void;
  onDismiss: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [date, setDate] = useState("");
  const [now] = useState(() => Date.now());

  useEffect(() => {
    setDate(readExamDate(track.id) ?? "");
    if (!dialog.current?.open) dialog.current?.showModal();
  }, [track.id]);

  const days = date ? daysUntilExam(date, now) : null;

  function save() {
    if (!date) return;
    saveExamDate(track.id, date);
    if (decemberBlueprint(track)) {
      void updateReadiness(track, readReadiness(track) ?? emptyReadiness, { type: "version", version: guideForExamDate(date) }).catch(() => undefined);
    }
    onDismiss();
    dialog.current?.close();
  }

  return <dialog ref={dialog} className="game-dialog first-run-setup" aria-labelledby="exam-date-prompt-title" onClose={onClose}>
    <header className="dialog-header">
      <h2 id="exam-date-prompt-title">Pace the rest of the city</h2>
    </header>
    <div className="dialog-body first-run-body">
      <p>{person ? `${person}: ` : ""}“Thanks, that’s sorted. If you have an exam booked, tell me when and I’ll keep each day’s work to what fits before it.”</p>
      <label className="first-run-date">
        <span>When is your {track.code} exam?</span>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
      {days !== null && <p role="status" className="first-run-plan">{days < 0 ? "That date has passed. Pick your next attempt." : days === 0 ? "That’s today. Good luck." : `${days} ${days === 1 ? "day" : "days"} to go. Today’s work will fit the missions, practice exam and labs into that.`}</p>}
      <div className="first-run-choices">
        <button className="button button-primary" type="button" disabled={!date || (days !== null && days < 0)} onClick={save}>Pace my plan</button>
        <button className="button button-outline" type="button" onClick={() => { onDismiss(); dialog.current?.close(); }}>No date, I’m here to learn</button>
      </div>
      <p className="first-run-skip">You can add or change the date later on the exam’s page.</p>
    </div>
  </dialog>;
}
