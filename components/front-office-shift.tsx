"use client";

import { closings, conceptSpeaker, consequence, frontOfficeContent, openings, reactions, routes } from "../lib/shifts/front-office";
import type { Concept, Draft, Route } from "../lib/shifts/front-office";
import { completedShifts } from "../lib/shifts/engine";
import type { RoomReaction } from "../lib/scene/room-reactions";
import { ShiftPanel } from "./shift-panel";
import type { ShiftDesk, Speaker } from "./shift-panel";
import styles from "./shift-panel.module.css";

const jordan: Speaker = { name: "Jordan Chen", role: "School administrator", portrait: "jordan" };
const felicia: Speaker = { name: "Felicia Grant", role: "Enrollment lead" };

const frontOfficeDesk: ShiftDesk<Concept, Draft, Route> = {
  id: "front-office",
  track: "associate-foundations",
  content: frontOfficeContent,
  building: "Maplewood School",
  routes,
  routesLabel: "Put this draft in a tray",
  itemsLabel: "Claude's draft",
  people: { brief: jordan, summary: jordan, why: (concept) => conceptSpeaker(concept) === "felicia" ? felicia : jordan },
  itemKey: (draft) => draft.id,
  itemLabel: (draft) => `Claude's draft to ${draft.to}: ${draft.sentence}`,
  renderItem: (draft) => <>
    <span className={styles.draftTo}>Claude's draft to {draft.to}</span>
    <p className={styles.draftText}>“{draft.sentence}”</p>
  </>,
  renderTicket: (ticket) => <ul className={styles.papers} aria-label="Papers on the desk">
    {ticket.items[0].papers.map((paper) => <li key={paper.title} className={styles.paper} data-signed={paper.signed}>
      <span className={styles.paperHead}><span>{paper.title}</span><span className={paper.signed ? styles.signed : styles.unsigned}>{paper.signed ? "Signed" : "Not signed"}</span></span>
      <span>{paper.text}</span>
    </li>)}
  </ul>,
  consequence(draft, route) {
    const result = consequence(draft, route);
    return { correct: result.correct, text: result.text, cost: result.callbackMinutes, counts: { wrongSent: Number(result.wrongSent) } };
  },
  reactions,
  copy: {
    opening(state, number, introduces) {
      const last = completedShifts(state).at(-1);
      if (!last) return openings.first;
      const base = last.callbackMinutes ? openings.callbacks(number, last.callbackMinutes) : openings.clean(number);
      return [base, ...introduces.map((concept) => openings.unlock[concept])].filter(Boolean).join(" ");
    },
    done: "That's today's line handled. More families come in tomorrow.",
    howto: "Read the family's question, the papers on the desk and Claude's draft, then drag the draft to a tray or tap the tray.",
    person: "Family",
    meter: (minutes) => minutes ? `${minutes} min of calls back` : "No calls back",
    cost: (outcome) => `${outcome.cost} min call back added${outcome.counts?.wrongSent ? " · a family got a wrong or undecided answer" : ""}`,
    summary: (record) => [
      ["Drafts in the right tray", `${record.correct}/${record.served}`],
      ["Wrong or undecided answers sent", String(record.counts?.wrongSent ?? 0)],
      ["Calls back owed", `${record.callbackMinutes} min`],
    ],
    closing: (record) => record.callbackMinutes ? closings.some(record.callbackMinutes) : closings.clean,
    back: "Back to the front office",
  },
};

export function FrontOfficeShift({ onClose, onScene }: {
  onClose: () => void;
  /** Drives the school's front office: the family line at the counter, the callback bench and each outcome. */
  onScene: (scene: RoomReaction | null) => void;
}) {
  return <ShiftPanel desk={frontOfficeDesk} onClose={onClose} onScene={onScene} />;
}
