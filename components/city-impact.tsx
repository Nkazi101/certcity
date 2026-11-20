import { Clock3, Coins, MapPin, MessageSquareCheck, X } from "lucide-react";
import type { RefObject } from "react";
import { baselineShift, shiftImpact } from "../lib/shift";
import type { ShiftResult } from "../lib/shift";

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function CityImpact({ savedShift, savedAssignments, localOutcome, dialog }: {
  savedShift: ShiftResult | null;
  savedAssignments: readonly { place: string; outcome: string; title?: string }[];
  dialog: RefObject<HTMLDialogElement | null>;
  localOutcome?: string | null;
}) {
  const impact = shiftImpact(savedShift ?? baselineShift);
  const metrics = [
    { label: impact.hoursSaved < 0 ? "Follow-up added" : "Staff time saved", value: `${Math.abs(impact.hoursSaved).toFixed(1).replace(/\.0$/, "")} h`, icon: Clock3, increase: impact.hoursSaved < 0 },
    { label: impact.falseRepliesAvoided < 0 ? "False replies added" : "False replies avoided", value: String(Math.abs(impact.falseRepliesAvoided)), icon: MessageSquareCheck, increase: impact.falseRepliesAvoided < 0 },
    { label: impact.spendSaved < 0 ? "Extra spend" : "Direct cost saved", value: dollars.format(Math.abs(impact.spendSaved)), icon: Coins, increase: impact.spendSaved < 0 },
  ];
  return (
    <>
      <button type="button" className="city-impact" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
        <span className="impact-heading">City impact <span>{localOutcome ? "this assignment" : savedShift ? "per simulated week" : savedAssignments.length ? `${savedAssignments.length} saved` : "No outcomes saved"}</span></span>
        {localOutcome && <span className="local-city-impact">{localOutcome}</span>}
        {!localOutcome && savedShift && <span className="impact-counters">
          {metrics.map(({ label, value, icon: Icon, increase }) => <span className="impact-counter" data-increase={increase} key={label}>
            <Icon size={16} aria-hidden="true" /><strong>{value}</strong><small>{label}</small>
          </span>)}
        </span>}
      </button>
      <dialog className="game-dialog" ref={dialog} aria-labelledby="city-impact-title">
        <header className="dialog-header">
          <Clock3 size={21} aria-hidden="true" /><h2 id="city-impact-title">City impact</h2>
          <button type="button" className="icon-button" aria-label="Close city impact" onClick={() => dialog.current?.close()}><X size={20} aria-hidden="true" /></button>
        </header>
        <div className="dialog-body city-impact-detail">
          {!savedShift && !savedAssignments.length && <p>Complete a city assignment and save its outcome to see what changed.</p>}
          {!!savedAssignments.length && (
            <ul className="city-outcome-list">
              {savedAssignments.map(({ place, outcome, title }) => <li key={title ?? place}>
                <MapPin size={16} aria-hidden="true" /><span><strong>{place}{title && ` · ${title}`}</strong><br />{outcome}</span>
              </li>)}
            </ul>
          )}
          {savedShift && <>
            <h3>City Dispatch</h3>
            <p>Your saved policy compared with the original policy for the same 1,000 requests.</p>
            <dl>
              {metrics.map(({ label, value, icon: Icon }) => <div key={label}>
                <dt><Icon size={16} aria-hidden="true" /> {label}</dt><dd>{value}</dd>
              </div>)}
            </dl>
            <p>Figures cover one simulated week. Staff time is capacity freed for other work. Payroll stays fixed.</p>
          </>}
        </div>
      </dialog>
    </>
  );
}
