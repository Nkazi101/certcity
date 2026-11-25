import { Clock3, MapPin, X } from "lucide-react";
import type { RefObject } from "react";
import { baselineShift, shiftImpact } from "../lib/shift";
import type { ShiftResult } from "../lib/shift";

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function CityImpact({ savedShift, savedAssignments, inRoom = false, dialog }: {
  savedShift: ShiftResult | null;
  savedAssignments: readonly { place: string; outcome: string; title?: string }[];
  dialog: RefObject<HTMLDialogElement | null>;
  inRoom?: boolean;
}) {
  const impact = shiftImpact(savedShift ?? baselineShift);
  const savedCount = savedAssignments.length + (savedShift ? 1 : 0);
  const metrics = [
    { label: impact.hoursSaved < 0 ? "Follow-up added" : "Staff time saved", value: `${Math.abs(impact.hoursSaved).toFixed(1).replace(/\.0$/, "")} h` },
    { label: impact.falseRepliesAvoided < 0 ? "False replies added" : "False replies avoided", value: String(Math.abs(impact.falseRepliesAvoided)) },
    { label: impact.spendSaved < 0 ? "Extra spend" : "Direct cost saved", value: dollars.format(Math.abs(impact.spendSaved)) },
  ];
  const others = savedAssignments.length;
  const summary = savedShift && !inRoom
    ? `Dispatch: ${Math.abs(impact.falseRepliesAvoided)} ${impact.falseRepliesAvoided < 0 ? "more" : "fewer"} wrong replies a week${others ? `, ${others} more ${others === 1 ? "outcome" : "outcomes"}` : ""}`
    : savedCount ? `${savedCount} ${savedCount === 1 ? "outcome" : "outcomes"} saved` : "No outcomes saved yet";
  return (
    <>
      <button type="button" className="city-impact" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
        <span className="impact-heading">City impact <span>{summary}</span></span>
      </button>
      <dialog className="game-dialog" ref={dialog} aria-labelledby="city-impact-title">
        <header className="dialog-header">
          <Clock3 size={21} aria-hidden="true" /><h2 id="city-impact-title">City impact</h2>
          <button type="button" className="icon-button" aria-label="Close city impact" onClick={() => dialog.current?.close()}><X size={20} aria-hidden="true" /></button>
        </header>
        <div className="dialog-body city-impact-detail">
          {!savedShift && !savedAssignments.length && <p>Finish a city mission and save its outcome to see what changed.</p>}
          {!!savedAssignments.length && (
            <ul className="city-outcome-list">
              {savedAssignments.map(({ place, outcome, title }) => <li key={title ?? place}>
                <MapPin size={16} aria-hidden="true" /><span><strong>{place}{title && `: ${title}`}</strong><br />{outcome}</span>
              </li>)}
            </ul>
          )}
          {savedShift && <>
            <h3>City Dispatch</h3>
            <p>Your saved policy compared with the original policy for the same 1,000 requests.</p>
            <dl>
              {metrics.map(({ label, value }) => <div key={label}>
                <dt>{label}</dt><dd>{value}</dd>
              </div>)}
            </dl>
            <p>Figures cover one simulated week. Staff time is capacity freed for other work. Payroll stays fixed.</p>
          </>}
        </div>
      </dialog>
    </>
  );
}
