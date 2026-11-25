"use client";

import { useCallback } from "react";
import {
  closings, conceptNotes, consequence, depotWorkload, dispatchContent, openings, parcelFields, reactions, routes,
} from "../lib/shifts/dispatch";
import type { Concept, Lookup, Route } from "../lib/shifts/dispatch";
import { completedShifts } from "../lib/shifts/engine";
import type { RoomReaction } from "../lib/scene/room-reactions";
import { ShiftPanel } from "./shift-panel";
import type { ShiftDesk } from "./shift-panel";
import styles from "./shift-panel.module.css";

const dispatchDesk: ShiftDesk<Concept, Lookup, Route> = {
  id: "dispatch",
  track: "architect-foundations",
  content: dispatchContent,
  building: "City Dispatch",
  routes,
  routesLabel: "Send this result",
  itemsLabel: "Lookup results",
  people: {
    brief: { name: "Nia Brooks", role: "Support lead", portrait: "nia" },
    summary: { name: "Jo Rivera", role: "Operations lead", portrait: "jo" },
    why: () => ({ name: "Arun Mehta", role: "Integration engineer", portrait: "arun" }),
  },
  itemKey: (lookup) => lookup.callId + lookup.attempt,
  itemLabel: (lookup, ticket) => `Tool result ${lookup.callId}${ticket.kind === "pair" ? "" : ` for ${lookup.orderId}`}`,
  renderItem: (lookup, ticket) => <>
    <span className={styles.parcelId}>{ticket.kind === "pair" ? `tool_use_id ${lookup.callId}` : `${lookup.orderId} · ${lookup.callId}`}</span>
    <dl>{parcelFields(lookup).map(([field, value]) => <div key={field}><dt>{field}</dt><dd>{value}</dd></div>)}</dl>
  </>,
  fieldTerms: (items, ticket) => items.flatMap((lookup) => parcelFields(lookup).map(([field]) => field)).concat(ticket.kind === "pair" ? ["tool_use_id"] : []),
  renderTicket: (ticket) => <p className={styles.orders}>{ticket.items.map(({ orderId }) => <code key={orderId}>{orderId}</code>)}</p>,
  reveal: { label: (ticket) => ticket.kind === "pair" ? "Run both lookups" : "Run the lookup", busy: "Looking up…" },
  consequence(lookup, route) {
    const result = consequence(lookup, route);
    return { correct: result.correct, text: result.text, cost: result.callbackMinutes, counts: { falseNotFound: Number(result.falseNotFound) }, follow: result.follow };
  },
  pair: {
    help: "The results came back in a different order from the calls. Pick a result, then the call it answers.",
    slots: (ticket) => ticket.items.map(({ orderId, callId }) => ({ id: orderId, title: `Where is ${orderId}?`, detail: `tool_use · id ${callId}` })),
    slotOf: (lookup) => lookup.orderId,
    outcome: (ticket, wrong) => wrong ? `${ticket.customer.split(" ")[0]} was told ${wrong.orderId}'s status for the other order.` : "Both statuses reached the right order.",
  },
  reactions,
  copy: {
    opening(state, number, introduces) {
      const last = completedShifts(state).at(-1);
      if (!last) return openings.first;
      const base = last.callbackMinutes ? openings.callbacks(number, last.callbackMinutes) : openings.clean(number);
      return [base, ...introduces.map((concept) => openings.unlock[concept])].filter(Boolean).join(" ");
    },
    done: "That's today's shift done. The next customers arrive tomorrow.",
    howto: "Run each customer's lookup, read the parcel's label, then drag it to a chute or tap the chute.",
    retrying: "Retrying while there's still time…",
    person: "Customer",
    meter: (minutes) => minutes ? `${minutes} min of callbacks` : "No callbacks",
    cost: (outcome) => `${outcome.cost} min callback added${outcome.counts?.falseNotFound ? " · a false “not found”" : ""}`,
    summary: (record) => [
      ["Customers sent the right way", `${record.correct}/${record.served}`],
      ["False “no order found”", String(record.counts?.falseNotFound ?? 0)],
      ["Callbacks owed", `${record.callbackMinutes} min`],
    ],
    closing: (record) => record.callbackMinutes ? closings.some(record.callbackMinutes) : closings.clean,
    back: "Back to the depot",
  },
};

export function DispatchShift({ onClose, onWorkload, onScene, note }: {
  onClose: () => void;
  onWorkload: (hours: number | null) => void;
  /** Drives the 3D depot: the customer line, the callback bench and each routing outcome. */
  onScene: (scene: RoomReaction | null) => void;
  /** An extra line under Nia's brief, e.g. about the learner's saved lookup design. */
  note?: string | null;
}) {
  // The depot's trays and wall queue follow the open work: tickets left plus callbacks owed.
  const onProgress = useCallback((left: number | null, callbacks: number) => onWorkload(left === null ? null : depotWorkload(left, callbacks)), [onWorkload]);
  return <ShiftPanel desk={dispatchDesk} note={note} onClose={onClose} onScene={onScene} onProgress={onProgress} />;
}

export { conceptNotes };
export type { Concept };
